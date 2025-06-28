"""
Simple Real-Time Transcription using Server-Sent Events
No WebSocket dependencies - just HTTP + SSE
"""

from flask import Flask, request, jsonify, Response
import json
import time
import threading
import queue
import tempfile
import os
from faster_whisper import WhisperModel
from datetime import datetime

# Simple transcription manager
class SimpleTranscriptionManager:
    def __init__(self):
        self.active_sessions = {}
        self.whisper_model = None
        self.initialize_whisper()
    
    def initialize_whisper(self):
        """Initialize Whisper model in background"""
        def load_model():
            try:
                print("Loading Whisper model...")
                self.whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
                print("Whisper model loaded successfully!")
            except Exception as e:
                print(f"Error loading Whisper model: {e}")
        
        threading.Thread(target=load_model, daemon=True).start()
    
    def start_session(self, proceeding_id):
        """Start new transcription session"""
        session_id = f"session_{int(time.time())}"
        self.active_sessions[session_id] = {
            'proceeding_id': proceeding_id,
            'transcript': '',
            'updates': queue.Queue(),
            'active': True
        }
        return session_id
    
    def stop_session(self, session_id):
        """Stop transcription session"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id]['active'] = False
    
    def clear_session(self, session_id):
        """Clear session transcript"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id]['transcript'] = ''
            self.add_update(session_id, {'type': 'clear', 'text': ''})
    
    def process_audio(self, session_id, audio_file):
        """Process audio file and add to transcript"""
        if not self.whisper_model:
            return "Whisper model not loaded yet"
        
        if session_id not in self.active_sessions:
            return "Session not found"
        
        try:
            print(f"Processing audio file: {audio_file}")
            
            # Check if file exists and has content
            if not os.path.exists(audio_file):
                print(f"Audio file does not exist: {audio_file}")
                return ""
            
            file_size = os.path.getsize(audio_file)
            print(f"Audio file size: {file_size} bytes")
            
            if file_size == 0:
                print("Audio file is empty")
                return ""
            
            # Transcribe audio with faster-whisper
            print("Starting transcription...")
            segments, info = self.whisper_model.transcribe(
                audio_file, 
                beam_size=1, 
                language="en",
                condition_on_previous_text=False  # Better for short chunks
            )
            
            print(f"Transcription info: {info}")
            
            # Combine segments
            text = ""
            segment_count = 0
            for segment in segments:
                text += segment.text + " "
                segment_count += 1
                print(f"Segment {segment_count}: {segment.text}")
            
            text = text.strip()
            print(f"Final transcribed text: '{text}'")
            
            if text:
                # Add to session transcript
                session = self.active_sessions[session_id]
                session['transcript'] += text + " "
                
                # Send update to client
                self.add_update(session_id, {
                    'type': 'transcription',
                    'text': text,
                    'full_transcript': session['transcript']
                })
                
                print(f"Added text to session transcript: '{text}'")
            else:
                print("No text was transcribed from audio")
            
            return text
            
        except Exception as e:
            print(f"Error processing audio: {e}")
            import traceback
            traceback.print_exc()
            return ""
    
    def add_update(self, session_id, update):
        """Add update to session queue"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id]['updates'].put(update)
    
    def get_updates(self, session_id):
        """Generator for Server-Sent Events"""
        if session_id not in self.active_sessions:
            return
        
        session = self.active_sessions[session_id]
        
        while session['active']:
            try:
                # Wait for update with timeout
                update = session['updates'].get(timeout=1.0)
                yield f"data: {json.dumps(update)}\n\n"
            except queue.Empty:
                # Send heartbeat
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

# Global transcription manager
transcription_manager = SimpleTranscriptionManager()

def create_transcription_routes(app):
    """Add transcription routes to existing Flask app"""
    
    @app.route('/api/transcription/start', methods=['POST'])
    def start_transcription():
        """Start new transcription session"""
        data = request.get_json()
        proceeding_id = data.get('proceeding_id')
        
        if not proceeding_id:
            return jsonify({'error': 'Missing proceeding_id'}), 400
        
        session_id = transcription_manager.start_session(proceeding_id)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Transcription session started'
        })
    
    @app.route('/api/transcription/stop', methods=['POST'])
    def stop_transcription():
        """Stop transcription session"""
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        transcription_manager.stop_session(session_id)
        
        return jsonify({
            'success': True,
            'message': 'Transcription session stopped'
        })
    
    @app.route('/api/transcription/clear', methods=['POST'])
    def clear_transcription():
        """Clear transcription content"""
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        transcription_manager.clear_session(session_id)
        
        return jsonify({
            'success': True,
            'message': 'Transcription cleared'
        })
    
    @app.route('/api/transcription/audio', methods=['POST'])
    def upload_audio():
        """Process uploaded audio chunk"""
        print("=== Audio upload request received ===")
        
        session_id = request.form.get('session_id')
        print(f"Session ID: {session_id}")
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        if 'audio' not in request.files:
            print("No audio file in request")
            return jsonify({'error': 'No audio file'}), 400
        
        audio_file = request.files['audio']
        print(f"Audio file received: {audio_file.filename}, content_type: {audio_file.content_type}")
        
        # Check if Whisper model is loaded
        if not transcription_manager.whisper_model:
            print("Whisper model not loaded yet")
            return jsonify({'error': 'Whisper model not loaded yet'}), 503
        
        # Save to temporary file with proper cleanup
        temp_file = None
        temp_filename = None
        text = ""
        
        try:
            # Determine file extension based on content type
            if audio_file.content_type:
                if 'webm' in audio_file.content_type:
                    suffix = '.webm'
                elif 'mp4' in audio_file.content_type:
                    suffix = '.mp4'
                elif 'wav' in audio_file.content_type:
                    suffix = '.wav'
                else:
                    suffix = '.webm'  # Default
            else:
                suffix = '.webm'  # Default
            
            print(f"Using file suffix: {suffix}")
            
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_filename = temp_file.name
                print(f"Saving audio to temp file: {temp_filename}")
                audio_file.save(temp_filename)
            
            # Check file was saved properly
            if os.path.exists(temp_filename):
                file_size = os.path.getsize(temp_filename)
                print(f"Temp file saved successfully, size: {file_size} bytes")
                
                # Process audio (file is now closed)
                text = transcription_manager.process_audio(session_id, temp_filename)
                print(f"Transcription result: '{text}'")
            else:
                print("Error: Temp file was not created")
                return jsonify({'error': 'Failed to save audio file'}), 500
            
        except Exception as e:
            print(f"Error in upload_audio: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Processing error: {str(e)}'}), 500
            
        finally:
            # Clean up temp file safely
            if temp_filename and os.path.exists(temp_filename):
                try:
                    os.unlink(temp_filename)
                    print(f"Cleaned up temp file: {temp_filename}")
                except PermissionError:
                    # On Windows, sometimes files are still locked
                    # Try again after a short delay
                    import time
                    time.sleep(0.1)
                    try:
                        os.unlink(temp_filename)
                        print(f"Cleaned up temp file after delay: {temp_filename}")
                    except Exception as cleanup_error:
                        print(f"Warning: Could not delete temp file {temp_filename}: {cleanup_error}")
        
        return jsonify({
            'success': True,
            'text': text,
            'session_id': session_id
        })
    
    @app.route('/api/transcription/stream/<session_id>')
    def stream_updates(session_id):
        """Server-Sent Events stream for real-time updates"""
        def generate():
            yield "data: {\"type\": \"connected\"}\n\n"
            
            for update in transcription_manager.get_updates(session_id):
                yield update
        
        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )

# Export the function to add to main app
__all__ = ['create_transcription_routes'] 