"""
Transcription Server for Electron Integration
Runs the improved real-time transcription engine with overlap buffering
"""

import json
import sys
import threading
import time
from realtime_transcriber import RealtimeTranscriber

class TranscriptionServer:
    def __init__(self):
        """Initialize the transcription server with improved settings"""
        self.transcriber = None
        self.running = True
        self.command_thread = None
        
        # Initialize transcriber with improved parameters
        self.transcriber = RealtimeTranscriber(
            sample_rate=16000,
            chunk_duration=2.0,  # Reduced from 3.0s to 2.0s for faster processing
            overlap_duration=0.5,  # 0.5s overlap to prevent word loss
            device="cpu",
            compute_type="int8"
        )
        
        # Set up callbacks
        self.transcriber.set_output_callback(self._handle_transcription_output)
        self.transcriber.set_error_callback(self._handle_error)
        
        print("Improved transcription server initialized with 2.0s chunks and 0.5s overlap", file=sys.stderr)
    
    def _send_message(self, message_type, data):
        """Send message to Electron via stdout"""
        message = {
            'type': message_type,
            'data': data,
            'timestamp': time.time()
        }
        print(json.dumps(message), flush=True)
    
    def _handle_transcription_output(self, data):
        """Handle transcription output from the engine"""
        self._send_message('transcription', data)
    
    def _handle_error(self, error):
        """Handle errors from the transcription engine"""
        self._send_message('error', {'message': error})
    
    def _handle_command(self, command):
        """Handle commands from Electron"""
        cmd_type = command.get('type')
        
        if cmd_type == 'start':
            session_id = command.get('session_id', 'default')
            success = self.transcriber.start_session(session_id)
            self._send_message('response', {
                'command': 'start',
                'success': success,
                'session_id': session_id
            })
            
        elif cmd_type == 'stop':
            self.transcriber.stop_session()
            self._send_message('response', {
                'command': 'stop',
                'success': True
            })
            
        elif cmd_type == 'clear':
            self.transcriber.clear_transcript()
            self._send_message('response', {
                'command': 'clear',
                'success': True
            })
            
        elif cmd_type == 'status':
            status = self.transcriber.get_status()
            self._send_message('status', status)
            
        elif cmd_type == 'quit':
            self.running = False
            
        else:
            self._send_message('error', {
                'message': f'Unknown command type: {cmd_type}'
            })
    
    def _read_commands(self):
        """Read commands from stdin in a separate thread"""
        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                if line.strip():
                    command = json.loads(line)
                    self._handle_command(command)
            except EOFError:
                break
            except json.JSONDecodeError as e:
                self._send_message('error', {
                    'message': f'Invalid JSON command: {str(e)}'
                })
            except Exception as e:
                self._send_message('error', {
                    'message': f'Error reading command: {str(e)}'
                })
                break
    
    def start(self):
        """Start the transcription server"""
        print("Improved transcription server starting...", file=sys.stderr)
        
        # Send ready signal with improved capabilities
        self._send_message('ready', {
            'message': 'Improved transcription server ready',
            'capabilities': {
                'device': 'cpu',
                'compute_type': 'int8',
                'sample_rate': 16000,
                'chunk_duration': 2.0,  # Improved: reduced from 3.0s
                'overlap_duration': 0.5,  # New: overlap buffering
                'blocksize': 1600,  # New: 0.1s blocksize for better responsiveness
                'features': [
                    'overlap_buffering',
                    'improved_responsiveness',
                    'reduced_word_loss',
                    'faster_processing'
                ]
            }
        })
        
        # Start command reading thread
        self.command_thread = threading.Thread(target=self._read_commands, daemon=True)
        self.command_thread.start()
        
        # Keep main thread alive
        try:
            while self.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("Received interrupt signal", file=sys.stderr)
        
        # Cleanup
        if self.transcriber:
            self.transcriber.stop_session()
        
        print("Improved transcription server stopped", file=sys.stderr)

def main():
    """Main entry point"""
    server = TranscriptionServer()
    server.start()

if __name__ == "__main__":
    main() 