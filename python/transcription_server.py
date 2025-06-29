"""
Transcription Server for Electron Integration
Runs the real-time transcription engine and communicates via stdout
"""

import json
import sys
import threading
import time
from realtime_transcriber import RealtimeTranscriber

class TranscriptionServer:
    def __init__(self):
        """Initialize the transcription server"""
        self.transcriber = None
        self.running = True
        self.command_thread = None
        
        # Initialize transcriber
        self.transcriber = RealtimeTranscriber(
            sample_rate=16000,
            chunk_duration=3.0,
            device="cpu",
            compute_type="int8"
        )
        
        # Set up callbacks
        self.transcriber.set_output_callback(self._handle_transcription_output)
        self.transcriber.set_error_callback(self._handle_error)
        
        print("Transcription server initialized", file=sys.stderr)
    
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
        try:
            cmd_type = command.get('type')
            
            if cmd_type == 'start':
                session_id = command.get('session_id', 'default_session')
                success = self.transcriber.start_session(session_id)
                self._send_message('start_response', {
                    'success': success,
                    'session_id': session_id
                })
            
            elif cmd_type == 'stop':
                self.transcriber.stop_session()
                self._send_message('stop_response', {'success': True})
            
            elif cmd_type == 'clear':
                self.transcriber.clear_transcript()
                self._send_message('clear_response', {'success': True})
            
            elif cmd_type == 'status':
                status = self.transcriber.get_status()
                self._send_message('status_response', status)
            
            elif cmd_type == 'quit':
                self.running = False
                self.transcriber.stop_session()
                self._send_message('quit_response', {'success': True})
            
            else:
                self._send_message('error', {
                    'message': f'Unknown command type: {cmd_type}'
                })
        
        except Exception as e:
            self._send_message('error', {
                'message': f'Error handling command: {str(e)}'
            })
    
    def _read_commands(self):
        """Read commands from stdin (from Electron)"""
        while self.running:
            try:
                line = input()
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
        print("Transcription server starting...", file=sys.stderr)
        
        # Send ready signal
        self._send_message('ready', {
            'message': 'Transcription server ready',
            'capabilities': {
                'device': 'cpu',
                'compute_type': 'int8',
                'sample_rate': 16000,
                'chunk_duration': 3.0
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
        
        print("Transcription server stopped", file=sys.stderr)

def main():
    """Main entry point"""
    server = TranscriptionServer()
    server.start()

if __name__ == "__main__":
    main() 