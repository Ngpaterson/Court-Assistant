# Real-Time Transcription Feature

## Overview
The Court Assistant now features real-time speech-to-text transcription powered by **faster-whisper** for accurate, privacy-focused transcription of court proceedings.

## Key Features

### ✅ Real-Time Processing
- **Live Speech Recognition**: Microphone audio is captured and processed in real-time
- **Instant Display**: Transcribed text appears automatically on the interface
- **No Timestamps**: Clean, continuous text without distracting timestamps
- **Automatic Scrolling**: Interface automatically scrolls to show latest transcription

### ✅ Privacy & Security
- **Local Processing**: All transcription happens locally using faster-whisper
- **No Cloud Dependencies**: No data sent to external services
- **MongoDB Storage**: Transcripts stored securely in your database

### ✅ Smart Controls
- **Start**: Begin real-time transcription with microphone access
- **Pause**: Temporarily stop transcription (can resume)
- **Restart**: Clear all content and delete from storage permanently

## Technical Implementation

### Backend Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Microphone    │───▶│   WebSocket     │───▶│ faster-whisper  │
│   (Frontend)    │    │   Streaming     │    │   Processing    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Live Display  │◀───│   Real-time     │◀───│   Transcribed   │
│   (Frontend)    │    │   Updates       │    │     Text        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components Added
1. **WebSocket Server** (Flask-SocketIO): Handles real-time communication
2. **TranscriptionSession Class**: Manages individual transcription sessions
3. **Audio Processing**: Converts WebRTC audio to WAV for Whisper
4. **Real-time Frontend**: Captures audio and displays transcription

## Installation

### Step 1: Install Dependencies
Run the installation script:
```bash
# Windows
install_transcription.bat

# Or manually:
cd backend
pip install faster-whisper==0.10.0 pyaudio==0.2.11 webrtcvad==2.0.10 flask-socketio==5.3.6
```

### Step 2: First Run
- The first time you start the backend, faster-whisper will download the 'small' model (~460MB)
- This may take a few minutes depending on your internet connection
- Subsequent runs will be much faster

## Usage

### Starting Transcription
1. **Navigate** to any proceeding's transcript page
2. **Click "Start"** - Browser will request microphone permission
3. **Allow microphone access** when prompted
4. **Speak clearly** - Transcription will appear automatically

### During Transcription
- **Text appears in real-time** without timestamps
- **Automatic saving** occurs every 5 seconds
- **Scrolling is automatic** to show latest content
- **Status indicator** shows current state

### Pause/Resume
- **Click "Pause"** to temporarily stop transcription
- **Click "Resume"** to continue from where you left off
- **Audio recording stops** during pause

### Restart (Clear All)
- **Click "Restart"** to completely clear the transcript
- **Confirmation dialog** appears for safety
- **Deletes from storage** permanently
- **Clears display** and resets to ready state

## Audio Requirements

### Microphone Setup
- **Clear audio input** recommended
- **Reduce background noise** for better accuracy
- **Speak clearly** and at moderate pace
- **Close to microphone** for optimal results

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Requires HTTPS** for microphone access (handled by Electron)

## Model Information

### Whisper Model Used
- **Model**: OpenAI Whisper 'small' (244MB)
- **Language**: English optimized
- **Accuracy**: High quality transcription
- **Speed**: Optimized for real-time processing

### Performance Characteristics
- **Processing Time**: ~1-3 seconds per chunk
- **Chunk Size**: 3 seconds of audio
- **Memory Usage**: ~2GB RAM recommended
- **CPU Usage**: Moderate (optimized for real-time)

## Storage & Persistence

### Automatic Saving
- **Auto-save interval**: Every 5 seconds
- **Real-time updates**: Immediate display, periodic save
- **Storage location**: MongoDB GridFS
- **Backup strategy**: Automatic with proceedings

### Data Format
```json
{
  "filename": "transcript_PROC123",
  "content_type": "text/plain",
  "metadata": {
    "proceeding_id": "PROC123",
    "created_at": "2024-01-01T10:00:00Z",
    "type": "transcript"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Microphone Access Denied
- **Check browser permissions** in settings
- **Allow microphone** for the application
- **Restart browser** if needed

#### 2. Model Loading Issues
- **Check internet connection** for initial download
- **Ensure sufficient disk space** (~500MB)
- **Restart backend** if download fails

#### 3. Poor Transcription Quality
- **Improve microphone setup** (closer, clearer)
- **Reduce background noise** in environment
- **Speak clearly and at moderate pace**
- **Check audio levels** in system settings

#### 4. WebSocket Connection Issues
- **Check backend is running** on port 5001
- **Verify firewall settings** allow connections
- **Restart application** if connection fails

### Debug Information
- **Check browser console** for error messages
- **Monitor backend logs** for processing errors
- **Verify SocketIO connection** in network tab

## Advanced Configuration

### Model Selection
To use a different Whisper model size, edit `backend/app.py`:
```python
# Options: tiny, base, small, medium, large
whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
```

### Audio Settings
Adjust audio parameters in `js/transcript.js`:
```javascript
audio: {
  sampleRate: 16000,    // Higher = better quality, slower processing
  channelCount: 1,      // Mono recommended
  echoCancellation: true, // Reduces echo
  noiseSuppression: true  // Reduces background noise
}
```

### Processing Intervals
Modify real-time processing in `backend/app.py`:
```python
self.save_interval = 5  # Auto-save every 5 seconds
if len(audio_buffer) >= 48000 * 2:  # 3 seconds of audio
```

## Future Enhancements

### Planned Features
- **Speaker identification** for multi-party proceedings
- **Punctuation enhancement** for better readability
- **Custom vocabulary** for legal terminology
- **Export formats** (PDF, DOCX, etc.)
- **Playback synchronization** with audio recording

### Performance Improvements
- **GPU acceleration** for faster processing
- **Streaming optimization** for lower latency
- **Batch processing** for efficiency
- **Caching strategies** for repeated terms

---

## Support

For issues or questions regarding real-time transcription:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify all dependencies are installed correctly
4. Ensure microphone permissions are granted

The real-time transcription feature transforms the Court Assistant into a powerful tool for accurate, immediate documentation of court proceedings while maintaining complete privacy and security. 