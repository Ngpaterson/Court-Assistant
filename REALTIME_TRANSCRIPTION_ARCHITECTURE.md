# Real-Time Transcription Architecture

This document describes the new real-time transcription engine architecture that replaces the previous HTTP/SSE-based system with a more efficient CPU-optimized approach using sounddevice and native Electron IPC.

## Architecture Overview

The new system consists of three main components:

1. **Python Transcription Engine** (`python/realtime_transcriber.py`)
2. **Python Transcription Server** (`python/transcription_server.py`)
3. **Electron Transcription Manager** (`backend/transcriptionManager.js`)

## Component Details

### 1. Python Transcription Engine (`realtime_transcriber.py`)

**Purpose**: Core transcription engine using sounddevice for audio capture and faster-whisper for transcription.

**Key Features**:
- Uses `sounddevice` for real-time microphone input
- Processes audio in small chunks (3-5 seconds) for efficiency
- Uses `faster-whisper` with CPU optimization (`device="cpu"`, `compute_type="int8"`)
- Supports real-time transcription with minimal latency
- Thread-safe audio processing and transcription

**Configuration**:
```python
transcriber = RealtimeTranscriber(
    sample_rate=16000,      # Audio sample rate
    chunk_duration=3.0,     # Duration of each audio chunk
    device="cpu",           # CPU-only processing
    compute_type="int8"     # Efficient integer quantization
)
```

### 2. Python Transcription Server (`transcription_server.py`)

**Purpose**: Communication bridge between the Python transcription engine and Electron.

**Key Features**:
- Runs the transcription engine as a subprocess
- Communicates with Electron via stdin/stdout (JSON messages)
- Handles commands from Electron (start, stop, clear, status)
- Sends transcription updates and errors back to Electron

**Message Format**:
```json
{
    "type": "transcription|error|status|ready",
    "data": {...},
    "timestamp": 1234567890.123
}
```

### 3. Electron Transcription Manager (`transcriptionManager.js`)

**Purpose**: Manages the Python transcription server and handles IPC communication with the frontend.

**Key Features**:
- Spawns and manages the Python transcription server process
- Handles IPC communication between main process and renderer
- Provides callbacks for transcription updates, errors, and status
- Manages transcription sessions and state

## Communication Flow

```
Frontend (renderer) ←→ Main Process (Electron) ←→ Python Server ←→ Transcription Engine
```

1. **Frontend to Main Process**: IPC calls for transcription control
2. **Main Process to Python**: JSON commands via child_process.stdin
3. **Python to Main Process**: JSON responses via child_process.stdout
4. **Main Process to Frontend**: IPC events for real-time updates

## Installation and Setup

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies (if not already installed)
npm install
```

### 2. Test the Transcription Engine

```bash
# Test the Python transcription engine directly
python test_transcription.py

# Test the transcription server
python python/transcription_server.py
```

### 3. Run the Application

```bash
# Start the Electron application
npm start
```

## Usage

### Starting Transcription

1. Open the transcript window for a proceeding
2. Click the "Start" button
3. The system will:
   - Start the Python transcription server (if not already running)
   - Begin audio capture using sounddevice
   - Process audio chunks in real-time
   - Display transcribed text in the UI

### Controlling Transcription

- **Start**: Begin real-time transcription
- **Pause**: Temporarily stop transcription (can be resumed)
- **Restart**: Clear current transcript and start fresh
- **Stop**: End the transcription session

## Performance Optimizations

### CPU Optimization
- Uses `faster-whisper` with `compute_type="int8"` for efficient CPU processing
- No GPU requirements - works on any system
- Optimized for real-time processing with minimal latency

### Audio Processing
- Small audio chunks (3-5 seconds) for faster processing
- Voice Activity Detection (VAD) to reduce processing of silence
- Efficient audio format conversion and handling

### Memory Management
- Streaming audio processing to minimize memory usage
- Automatic cleanup of temporary audio files
- Thread-safe queue-based audio processing

## Error Handling

The system includes comprehensive error handling:

1. **Audio Device Errors**: Graceful fallback and user notification
2. **Model Loading Errors**: Automatic retry and status reporting
3. **Process Communication Errors**: Automatic reconnection and recovery
4. **Transcription Errors**: Error reporting without stopping the session

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Ensure microphone permissions are granted
   - Check system audio settings

2. **Python Server Not Starting**
   - Verify Python dependencies are installed
   - Check Python path and environment

3. **Transcription Not Working**
   - Check if Whisper model is downloading (first run)
   - Verify audio input is working
   - Check console for error messages

### Debug Mode

Enable debug logging by setting environment variables:
```bash
export DEBUG_TRANSCRIPTION=1
export DEBUG_AUDIO=1
```

## Migration from Old System

The new system replaces the previous HTTP/SSE-based transcription with these improvements:

1. **Better Performance**: CPU-optimized processing with smaller chunks
2. **Lower Latency**: Direct IPC communication instead of HTTP
3. **More Reliable**: Process-based architecture with better error handling
4. **Easier Maintenance**: Modular design with clear separation of concerns

## Future Enhancements

Potential improvements for future versions:

1. **Multi-language Support**: Dynamic language switching
2. **Speaker Diarization**: Identify different speakers
3. **Custom Models**: Support for fine-tuned Whisper models
4. **Cloud Integration**: Optional cloud-based transcription
5. **Advanced Audio Processing**: Noise reduction and audio enhancement

## API Reference

### RealtimeTranscriber Class

```python
class RealtimeTranscriber:
    def __init__(self, sample_rate=16000, chunk_duration=3.0, device="cpu", compute_type="int8")
    def start_session(self, session_id)
    def stop_session(self)
    def clear_transcript(self)
    def get_status(self)
    def set_output_callback(self, callback)
    def set_error_callback(self, callback)
```

### TranscriptionManager Class

```javascript
class TranscriptionManager {
    async startServer()
    stopServer()
    startTranscription(sessionId)
    stopTranscription()
    clearTranscript()
    getStatus()
    onTranscription(callback)
    onError(callback)
    onStatus(callback)
    onReady(callback)
}
```

## License

This transcription system is part of the Court Assistant application and follows the same licensing terms. 