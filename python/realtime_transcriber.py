"""
Real-time Transcription Engine using sounddevice and faster-whisper
Optimized for CPU-only processing with overlap buffering to prevent word loss
"""

import sounddevice as sd
import numpy as np
import threading
import queue
import time
import json
import sys
import os
from faster_whisper import WhisperModel
from datetime import datetime
import tempfile
import wave

class RealtimeTranscriber:
    def __init__(self, sample_rate=16000, chunk_duration=2.0, overlap_duration=0.2, device="cpu", compute_type="int8"):
        """
        Initialize the real-time transcriber with overlap buffering
        
        Args:
            sample_rate: Audio sample rate (Hz)
            chunk_duration: Duration of each audio chunk in seconds (reduced to 2.0s)
            overlap_duration: Duration of overlap between chunks in seconds (0.5s)
            device: Device to use for Whisper ("cpu" or "cuda")
            compute_type: Compute type for Whisper ("int8", "int16", "float16", "float32")
        """
        self.sample_rate = sample_rate
        self.chunk_duration = chunk_duration
        self.overlap_duration = overlap_duration
        self.chunk_samples = int(sample_rate * chunk_duration)
        self.overlap_samples = int(sample_rate * overlap_duration)
        self.device = device
        self.compute_type = compute_type
        
        # Audio processing with overlap buffering
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.audio_thread = None
        self.processing_thread = None
        self.last_overlap = np.array([], dtype=np.float32)  # Buffer for overlap
        
        # Transcription
        self.whisper_model = None
        self.transcript_buffer = ""
        self.current_session = None
        
        # Output handling
        self.output_callback = None
        self.error_callback = None
        
        # Initialize Whisper model
        self._initialize_whisper()
    
    def _initialize_whisper(self):
        """Initialize Whisper model in background thread"""
        def load_model():
            try:
                print("Loading Whisper model...", file=sys.stderr)
                self.whisper_model = WhisperModel(
                    "small", 
                    device=self.device, 
                    compute_type=self.compute_type
                )
                print(f"Whisper model loaded successfully on {self.device} with {self.compute_type}", file=sys.stderr)
            except Exception as e:
                print(f"Error loading Whisper model: {e}", file=sys.stderr)
                if self.error_callback:
                    self.error_callback(f"Failed to load Whisper model: {e}")
        
        threading.Thread(target=load_model, daemon=True).start()
    
    def set_output_callback(self, callback):
        """Set callback function for transcription output"""
        self.output_callback = callback
    
    def set_error_callback(self, callback):
        """Set callback function for error handling"""
        self.error_callback = callback
    
    def start_session(self, session_id):
        """Start a new transcription session"""
        if self.is_recording:
            self.stop_session()
        
        self.current_session = session_id
        self.transcript_buffer = ""
        self.last_overlap = np.array([], dtype=np.float32)  # Reset overlap buffer
        self.is_recording = True
        
        # Start audio recording thread
        self.audio_thread = threading.Thread(target=self._audio_callback, daemon=True)
        self.audio_thread.start()
        
        # Start processing thread
        self.processing_thread = threading.Thread(target=self._process_audio_chunks, daemon=True)
        self.processing_thread.start()
        
        print(f"Started transcription session: {session_id} with {self.chunk_duration}s chunks and {self.overlap_duration}s overlap", file=sys.stderr)
        return True
    
    def stop_session(self):
        """Stop the current transcription session"""
        self.is_recording = False
        
        if self.audio_thread and self.audio_thread.is_alive():
            self.audio_thread.join(timeout=1.0)
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=1.0)
        
        self.current_session = None
        self.last_overlap = np.array([], dtype=np.float32)  # Clear overlap buffer
        print("Transcription session stopped", file=sys.stderr)
    
    def clear_transcript(self):
        """Clear the current transcript buffer"""
        self.transcript_buffer = ""
        self.last_overlap = np.array([], dtype=np.float32)  # Clear overlap buffer
        if self.output_callback:
            self.output_callback({
                'type': 'clear',
                'session_id': self.current_session,
                'text': '',
                'full_transcript': ''
            })
    
    def _audio_callback(self):
        """Audio recording callback using sounddevice with improved blocksize"""
        try:
            def callback(indata, frames, time, status):
                if status:
                    print(f"Audio callback status: {status}", file=sys.stderr)
                
                if self.is_recording:
                    # Convert to float32 and add to queue
                    audio_data = indata[:, 0].astype(np.float32)
                    self.audio_queue.put(audio_data)
            
            # Improved blocksize for better real-time responsiveness (0.1s)
            blocksize = int(self.sample_rate * 0.1)
            
            # Start audio stream
            with sd.InputStream(
                callback=callback,
                channels=1,
                samplerate=self.sample_rate,
                dtype=np.float32,
                blocksize=blocksize  # Improved: 0.1s blocksize for better responsiveness
            ):
                print(f"Audio stream started with {blocksize} samples blocksize (0.1s)", file=sys.stderr)
                while self.is_recording:
                    time.sleep(0.1)
                
                print("Audio stream stopped", file=sys.stderr)
                
        except Exception as e:
            print(f"Error in audio callback: {e}", file=sys.stderr)
            if self.error_callback:
                self.error_callback(f"Audio recording error: {e}")
    
    def _process_audio_chunks(self):
        """Process audio chunks with overlap buffering to prevent word truncation"""
        audio_buffer = np.array([], dtype=np.float32)
        
        while self.is_recording:
            try:
                # Collect audio data
                while not self.audio_queue.empty() and self.is_recording:
                    chunk = self.audio_queue.get_nowait()
                    audio_buffer = np.concatenate([audio_buffer, chunk])
                
                # Process when we have enough data for a chunk
                if len(audio_buffer) >= self.chunk_samples:
                    # Extract chunk for processing
                    current_chunk = audio_buffer[:self.chunk_samples]
                    audio_buffer = audio_buffer[self.chunk_samples:]
                    
                    # Create processing chunk with overlap from previous chunk
                    if len(self.last_overlap) > 0:
                        # Prepend previous overlap to current chunk
                        process_chunk = np.concatenate([self.last_overlap, current_chunk])
                        print(f"Processing chunk with {len(self.last_overlap)} overlap samples + {len(current_chunk)} new samples", file=sys.stderr)
                    else:
                        process_chunk = current_chunk
                        print(f"Processing first chunk with {len(current_chunk)} samples (no overlap)", file=sys.stderr)
                    
                    # Prepare next overlap from the end of current chunk
                    if len(current_chunk) >= self.overlap_samples:
                        self.last_overlap = current_chunk[-self.overlap_samples:].copy()
                    else:
                        self.last_overlap = current_chunk.copy()
                    
                    # Transcribe the chunk with overlap
                    self._transcribe_chunk(process_chunk)
                
                time.sleep(0.1)  # Small delay to prevent busy waiting
                
            except Exception as e:
                print(f"Error processing audio chunks: {e}", file=sys.stderr)
                if self.error_callback:
                    self.error_callback(f"Audio processing error: {e}")
                time.sleep(0.5)
    
    def _transcribe_chunk(self, audio_chunk):
        """Transcribe a single audio chunk with improved temp file management"""
        if not self.whisper_model:
            print("Whisper model not loaded yet", file=sys.stderr)
            return
        
        temp_filename = None
        try:
            # Save audio chunk to temporary WAV file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_filename = temp_file.name
            
            # Convert float32 to int16 for WAV file
            audio_int16 = (audio_chunk * 32767).astype(np.int16)
            
            # Save as WAV file
            with wave.open(temp_filename, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(audio_int16.tobytes())
            
            # Transcribe with Whisper
            segments, info = self.whisper_model.transcribe(
                temp_filename,
                beam_size=1,  # Fast processing
                language="en",
                condition_on_previous_text=False,  # Better for short chunks
                vad_filter=True,  # Voice activity detection
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Combine segments
            chunk_text = ""
            for segment in segments:
                chunk_text += segment.text + " "
            
            chunk_text = chunk_text.strip()
            
            # Process transcribed text
            if chunk_text:
                self._handle_transcription(chunk_text)
            
        except Exception as e:
            print(f"Error transcribing chunk: {e}", file=sys.stderr)
        finally:
            # Ensure cleanup of temp file even on exceptions
            if temp_filename and os.path.exists(temp_filename):
                try:
                    os.unlink(temp_filename)
                except Exception as cleanup_error:
                    print(f"Warning: Could not delete temp file {temp_filename}: {cleanup_error}", file=sys.stderr)
    
    def _handle_transcription(self, text):
        """Handle transcribed text and send to output"""
        if not text.strip():
            return
        
        # Add to transcript buffer
        self.transcript_buffer += text + " "
        
        # Send update via callback
        if self.output_callback:
            self.output_callback({
                'type': 'transcription',
                'session_id': self.current_session,
                'text': text,
                'full_transcript': self.transcript_buffer.strip(),
                'timestamp': datetime.now().isoformat()
            })
        
        print(f"Transcribed: {text}", file=sys.stderr)
    
    def get_status(self):
        """Get current transcription status"""
        return {
            'is_recording': self.is_recording,
            'session_id': self.current_session,
            'model_loaded': self.whisper_model is not None,
            'device': self.device,
            'compute_type': self.compute_type,
            'sample_rate': self.sample_rate,
            'chunk_duration': self.chunk_duration,
            'overlap_duration': self.overlap_duration,
            'overlap_samples': self.overlap_samples
        }

# Command-line interface for testing
if __name__ == "__main__":
    def print_output(data):
        """Print transcription output"""
        if data['type'] == 'transcription':
            print(f"[{data['timestamp']}] {data['text']}")
        elif data['type'] == 'clear':
            print("Transcript cleared")
    
    def print_error(error):
        """Print error messages"""
        print(f"ERROR: {error}")
    
    # Create transcriber with improved settings
    transcriber = RealtimeTranscriber(
        sample_rate=16000,
        chunk_duration=2.0,  # Reduced from 3.0s to 2.0s
        overlap_duration=0.5,  # 0.5s overlap to prevent word loss
        device="cpu",
        compute_type="int8"
    )
    
    transcriber.set_output_callback(print_output)
    transcriber.set_error_callback(print_error)
    
    print("Improved Real-time Transcription Engine")
    print("Features: 2.0s chunks, 0.5s overlap, 0.1s blocksize")
    print("Press Enter to start, Enter again to stop, 'q' to quit")
    
    try:
        while True:
            command = input("> ").strip().lower()
            
            if command == 'q':
                break
            elif command == '':
                if transcriber.is_recording:
                    print("Stopping transcription...")
                    transcriber.stop_session()
                else:
                    print("Starting transcription...")
                    transcriber.start_session("test_session")
            elif command == 'status':
                status = transcriber.get_status()
                print(json.dumps(status, indent=2))
            elif command == 'clear':
                transcriber.clear_transcript()
                print("Transcript cleared")
            else:
                print("Commands: Enter (start/stop), 'q' (quit), 'status', 'clear'")
    
    except KeyboardInterrupt:
        print("\nShutting down...")
    
    finally:
        if transcriber.is_recording:
            transcriber.stop_session()
        print("Improved transcription engine stopped") 