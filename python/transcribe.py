import whisper
import pyaudio
import wave
import threading
import queue
import numpy as np
import tempfile
import os
import time
from scipy.io import wavfile
import soundfile as sf
import io
from typing import Optional, Callable
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealTimeWhisperTranscriber:
    def __init__(self, model_size: str = "base", language: str = "en"):
        """
        Initialize the real-time Whisper transcriber.
        
        Args:
            model_size: Whisper model size ("tiny", "base", "small", "medium", "large")
            language: Language code for transcription (e.g., "en", "fr", "es")
        """
        self.model_size = model_size
        self.language = language
        self.model = None
        self.is_recording = False
        self.is_paused = False
        
        # Audio configuration
        self.sample_rate = 16000  # Whisper prefers 16kHz
        self.chunk_size = 1024
        self.channels = 1
        self.format = pyaudio.paInt16
        
        # Audio streaming
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.audio_queue = queue.Queue()
        self.transcript_queue = queue.Queue()
        
        # Threading
        self.record_thread = None
        self.transcribe_thread = None
        self.stop_event = threading.Event()
        
        # Callback for real-time transcript updates
        self.transcript_callback: Optional[Callable[[str], None]] = None
        
        # Audio buffer for continuous recording
        self.audio_buffer = []
        self.buffer_duration = 5.0  # seconds
        self.overlap_duration = 30.0  # seconds for continuity
        
        # Initialize model
        self.load_model()
    
    def load_model(self):
        """Load the Whisper model."""
        try:
            logger.info(f"Loading Whisper model: {self.model_size}")
            self.model = whisper.load_model(self.model_size)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    def set_transcript_callback(self, callback: Callable[[str], None]):
        """Set callback function for real-time transcript updates."""
        self.transcript_callback = callback
    
    def start_recording(self) -> bool:
        """Start real-time recording and transcription."""
        if self.is_recording:
            logger.warning("Recording is already in progress")
            return False
        
        try:
            # Initialize audio stream
            self.stream = self.audio.open(
                format=self.format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size,
                stream_callback=self._audio_callback
            )
            
            # Reset state
            self.is_recording = True
            self.is_paused = False
            self.stop_event.clear()
            self.audio_buffer = []
            
            # Start threads
            self.record_thread = threading.Thread(target=self._recording_loop)
            self.transcribe_thread = threading.Thread(target=self._transcription_loop)
            
            self.record_thread.start()
            self.transcribe_thread.start()
            
            # Start audio stream
            self.stream.start_stream()
            
            logger.info("Recording and transcription started")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return False
    
    def pause_recording(self):
        """Pause recording (can be resumed)."""
        if not self.is_recording:
            logger.warning("No recording in progress to pause")
            return
        
        self.is_paused = True
        if self.stream:
            self.stream.stop_stream()
        logger.info("Recording paused")
    
    def resume_recording(self):
        """Resume paused recording."""
        if not self.is_recording or not self.is_paused:
            logger.warning("No paused recording to resume")
            return
        
        self.is_paused = False
        if self.stream:
            self.stream.start_stream()
        logger.info("Recording resumed")
    
    def stop_recording(self):
        """Stop recording and transcription."""
        if not self.is_recording:
            logger.warning("No recording in progress to stop")
            return
        
        logger.info("Stopping recording...")
        
        # Signal threads to stop
        self.stop_event.set()
        self.is_recording = False
        self.is_paused = False
        
        # Stop and close audio stream
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        # Wait for threads to finish
        if self.record_thread and self.record_thread.is_alive():
            self.record_thread.join(timeout=2)
        if self.transcribe_thread and self.transcribe_thread.is_alive():
            self.transcribe_thread.join(timeout=2)
        
        logger.info("Recording stopped")
    
    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream."""
        if not self.is_paused:
            self.audio_queue.put(in_data)
        return (in_data, pyaudio.paContinue)
    
    def _recording_loop(self):
        """Main recording loop that collects audio data."""
        frames_per_buffer = int(self.sample_rate * self.buffer_duration)
        overlap_frames = int(self.sample_rate * self.overlap_duration)
        
        while not self.stop_event.is_set():
            if self.is_paused:
                time.sleep(0.1)
                continue
            
            # Collect audio data for buffer duration
            audio_data = []
            start_time = time.time()
            
            while (time.time() - start_time) < self.buffer_duration and not self.stop_event.is_set():
                try:
                    data = self.audio_queue.get(timeout=0.1)
                    audio_data.append(data)
                except queue.Empty:
                    continue
            
            if audio_data:
                # Convert to numpy array
                audio_bytes = b''.join(audio_data)
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                
                # Normalize to float32 [-1, 1] as expected by Whisper
                audio_float = audio_array.astype(np.float32) / 32768.0
                
                # Add to transcription queue
                self.transcript_queue.put(audio_float)
    
    def _transcription_loop(self):
        """Main transcription loop that processes audio chunks."""
        while not self.stop_event.is_set():
            try:
                # Get audio data from queue
                audio_data = self.transcript_queue.get(timeout=1.0)
                
                if self.is_paused:
                    continue
                
                # Transcribe audio chunk
                transcript = self._transcribe_audio(audio_data)
                
                if transcript and transcript.strip():
                    # Send transcript to callback
                    if self.transcript_callback:
                        self.transcript_callback(transcript.strip())
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Transcription error: {e}")
    
    def _transcribe_audio(self, audio_data: np.ndarray) -> str:
        """Transcribe audio data using Whisper."""
        try:
            # Ensure audio is the right length (pad with zeros if too short)
            min_length = int(self.sample_rate * 0.5)  # 0.5 seconds minimum
            if len(audio_data) < min_length:
                audio_data = np.pad(audio_data, (0, min_length - len(audio_data)), 'constant')
            
            # Transcribe with Whisper
            result = self.model.transcribe(
                audio_data,
                language=self.language,
                task="transcribe",
                fp16=False,  # Use fp32 for better compatibility
                verbose=False
            )
            
            return result.get("text", "")
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            return ""
    
    def get_available_input_devices(self):
        """Get list of available audio input devices."""
        devices = []
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)
            if device_info['maxInputChannels'] > 0:
                devices.append({
                    'index': i,
                    'name': device_info['name'],
                    'sample_rate': int(device_info['defaultSampleRate'])
                })
        return devices
    
    def __del__(self):
        """Cleanup when object is destroyed."""
        self.stop_recording()
        if hasattr(self, 'audio'):
            self.audio.terminate()

# Singleton instance for use in Flask app
transcriber_instance: Optional[RealTimeWhisperTranscriber] = None

def get_transcriber(model_size: str = "base", language: str = "en") -> RealTimeWhisperTranscriber:
    """Get or create transcriber instance."""
    global transcriber_instance
    
    if transcriber_instance is None:
        transcriber_instance = RealTimeWhisperTranscriber(model_size, language)
    
    return transcriber_instance

def cleanup_transcriber():
    """Cleanup transcriber instance."""
    global transcriber_instance
    
    if transcriber_instance:
        transcriber_instance.stop_recording()
        transcriber_instance = None

# Example usage
if __name__ == "__main__":
    def print_transcript(text):
        print(f"[TRANSCRIPT] {text}")
    
    # Initialize transcriber
    transcriber = RealTimeWhisperTranscriber(model_size="base", language="en")
    transcriber.set_transcript_callback(print_transcript)
    
    # List available devices
    devices = transcriber.get_available_input_devices()
    print("Available audio input devices:")
    for device in devices:
        print(f"  {device['index']}: {device['name']} ({device['sample_rate']} Hz)")
    
    # Start recording
    print("Starting recording... Press Ctrl+C to stop")
    try:
        transcriber.start_recording()
        
        # Keep running until interrupted
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping...")
        transcriber.stop_recording()
        print("Done!")


