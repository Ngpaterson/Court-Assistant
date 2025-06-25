# Whisper Real-Time Transcription Integration

This document provides instructions for setting up and using the integrated Whisper model for real-time transcription in the Court Assistant system.

## 🚀 Quick Start

1. **Run the setup script**:
   ```bash
   python setup_whisper.py
   ```

2. **Start the server**:
   ```bash
   python backend/app.py
   ```

3. **Open the transcript page** and click "Start" to begin real-time transcription.

## 📋 System Requirements

- **Python**: 3.8 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space for Whisper models
- **Microphone**: Any USB or built-in microphone

### Operating System Specific Requirements

#### Windows
- Microsoft Visual C++ Redistributable
- Windows SDK (for PyAudio)
- FFmpeg (for audio processing)

#### macOS
- Homebrew
- PortAudio and FFmpeg (installed via Homebrew)

#### Linux
- PortAudio development libraries
- Python development headers
- FFmpeg

## 🔧 Manual Installation

If the setup script doesn't work, you can install dependencies manually:

### 1. Install System Dependencies

**Windows:**
```bash
# Install Visual C++ Redistributable from Microsoft
# Install Windows SDK
# Download and install FFmpeg
```

**macOS:**
```bash
brew install portaudio ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install portaudio19-dev python3-pyaudio ffmpeg
```

**CentOS/RHEL:**
```bash
sudo yum install portaudio-devel python3-pyaudio ffmpeg
```

### 2. Install Python Dependencies

```bash
# Install PyTorch (CPU version for compatibility)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install requirements
pip install -r requirements.txt

# Install Whisper
pip install openai-whisper
```

## 🎤 How to Use

### 1. Starting Transcription

1. Open the transcript page in your browser
2. The system will automatically connect to the transcription server
3. Select your preferred:
   - **Audio Input Device**: Choose your microphone
   - **Whisper Model**: Select based on your needs (see model comparison below)
   - **Language**: Choose the language for transcription

4. Click the **"Start"** button to begin real-time transcription

### 2. Controlling Transcription

- **Pause**: Click "Pause" to temporarily stop transcription
- **Resume**: Click "Resume" to continue transcription
- **Restart**: Click "Restart" to clear the transcript and start over

### 3. Automatic Features

- **Auto-save**: Transcripts are automatically saved every 10 seconds
- **Real-time display**: Text appears as it's transcribed
- **Timestamps**: Each transcript segment includes timestamps

## 🧠 Whisper Model Comparison

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| Tiny  | 39MB | Very Fast | Basic | Quick notes, testing |
| Base  | 74MB | Fast | Good | General use, balanced |
| Small | 244MB | Moderate | Better | Important meetings |
| Medium| 769MB | Slow | High | Critical transcripts |
| Large | 1550MB | Very Slow | Highest | Maximum accuracy needed |

**Recommendation**: Start with "Base" model for balanced performance.

## 🌍 Supported Languages

- English (en) - Default
- French (fr)
- Spanish (es)
- German (de)
- Italian (it)
- Portuguese (pt)
- And many more...

## 🔧 Troubleshooting

### Common Issues

#### 1. "PyAudio not found" Error
**Solution**: Install system audio dependencies first, then reinstall PyAudio:
```bash
# Windows: Install Windows SDK
# macOS: brew install portaudio
# Linux: sudo apt-get install portaudio19-dev

pip uninstall pyaudio
pip install pyaudio
```

#### 2. "No module named 'whisper'" Error
**Solution**: Install Whisper directly:
```bash
pip install openai-whisper
```

#### 3. "Connection failed" Error
**Solution**: Ensure the Flask server is running with WebSocket support:
```bash
python backend/app.py
```

#### 4. "No audio devices found" Error
**Solution**: Check your microphone permissions and try:
```bash
# Test audio devices
python -c "import pyaudio; p=pyaudio.PyAudio(); print(f'Devices: {p.get_device_count()}'); p.terminate()"
```

#### 5. Model Download Fails
**Solution**: Manually download models:
```bash
python -c "import whisper; whisper.load_model('base')"
```

### Performance Optimization

#### For Better Speed:
- Use "Tiny" or "Base" model
- Ensure good CPU performance
- Close unnecessary applications

#### For Better Accuracy:
- Use "Medium" or "Large" model
- Ensure quiet environment
- Use a good quality microphone
- Speak clearly and at moderate pace

## 📊 Technical Details

### Architecture
- **Frontend**: JavaScript with Socket.IO for real-time communication
- **Backend**: Flask-SocketIO server with WebSocket support
- **Audio Processing**: PyAudio for microphone capture
- **Transcription**: OpenAI Whisper for speech-to-text
- **Storage**: MongoDB for transcript persistence

### Audio Processing
- **Sample Rate**: 16kHz (Whisper's preferred rate)
- **Channels**: Mono (1 channel)
- **Buffer Size**: 5-second chunks with 1-second overlap
- **Format**: 16-bit PCM

### Real-time Pipeline
1. **Audio Capture**: Continuous microphone recording
2. **Buffering**: 5-second audio chunks
3. **Preprocessing**: Audio normalization and format conversion
4. **Transcription**: Whisper model processing
5. **Streaming**: Real-time text updates via WebSocket
6. **Storage**: Automatic database saves

## 🔐 Security Considerations

- Audio processing happens locally (no cloud services)
- Whisper models run on your machine
- Transcripts are stored in your local database
- No audio data is transmitted externally

## 📈 Performance Monitoring

The system includes built-in performance monitoring:
- Connection status indicators
- Transcription status updates
- Error handling and reporting
- Audio device status

## 🆘 Getting Help

If you encounter issues:

1. **Check the setup script output** for specific error messages
2. **Verify system requirements** are met
3. **Test individual components** using the provided test functions
4. **Check the browser console** for JavaScript errors
5. **Review the Flask server logs** for backend issues

## 🔄 Updates and Maintenance

### Updating Whisper
```bash
pip install --upgrade openai-whisper
```

### Updating Dependencies
```bash
pip install -r requirements.txt --upgrade
```

### Model Management
Whisper models are cached in:
- **Windows**: `C:\Users\<username>\.cache\whisper`
- **macOS**: `~/.cache/whisper`
- **Linux**: `~/.cache/whisper`

You can delete model files to free space or force re-download.

## 📝 Notes

- **First Use**: The first time you use a Whisper model, it will be downloaded automatically
- **Network**: Internet connection required only for initial model download
- **Storage**: Each model is downloaded once and cached locally
- **Performance**: Larger models provide better accuracy but require more processing time

## 🤝 Contributing

To contribute improvements to the transcription system:

1. Test your changes with the setup script
2. Ensure compatibility across different operating systems
3. Update this README with any new features or requirements
4. Follow the existing code structure and error handling patterns

---

**Happy Transcribing! 🎙️📝** 