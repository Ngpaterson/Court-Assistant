#!/usr/bin/env python3
"""
Setup script for Whisper real-time transcription system.
This script installs dependencies and tests the system.
"""

import subprocess
import sys
import os
import platform

def run_command(command, description=""):
    """Run a command and handle errors."""
    if description:
        print(f"⏳ {description}...")
    
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              capture_output=True, text=True)
        if description:
            print(f"✅ {description} completed successfully")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return None

def check_python_version():
    """Check if Python version is compatible."""
    version = sys.version_info
    print(f"🐍 Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        return False
    
    print("✅ Python version is compatible")
    return True

def install_system_dependencies():
    """Install system-level dependencies."""
    system = platform.system().lower()
    
    if system == "windows":
        print("📦 Windows detected - Please install the following manually:")
        print("   1. Microsoft Visual C++ Redistributable")
        print("   2. Windows SDK (for PyAudio)")
        print("   3. FFmpeg (for audio processing)")
        print("   You can download these from Microsoft's official website")
    
    elif system == "darwin":  # macOS
        print("📦 macOS detected - Installing system dependencies...")
        run_command("brew install portaudio ffmpeg", "Installing PortAudio and FFmpeg")
    
    elif system == "linux":
        print("📦 Linux detected - Installing system dependencies...")
        # Try different package managers
        if run_command("which apt-get", "") is not None:
            run_command("sudo apt-get update", "Updating package list")
            run_command("sudo apt-get install -y portaudio19-dev python3-pyaudio ffmpeg", 
                       "Installing PortAudio and FFmpeg")
        elif run_command("which yum", "") is not None:
            run_command("sudo yum install -y portaudio-devel python3-pyaudio ffmpeg", 
                       "Installing PortAudio and FFmpeg")
        elif run_command("which pacman", "") is not None:
            run_command("sudo pacman -S portaudio python-pyaudio ffmpeg", 
                       "Installing PortAudio and FFmpeg")

def install_python_dependencies():
    """Install Python dependencies."""
    print("📦 Installing Python dependencies...")
    
    # Install PyTorch first (CPU version for compatibility)
    run_command("pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu", 
               "Installing PyTorch (CPU version)")
    
    # Install other dependencies
    run_command("pip install -r requirements.txt", "Installing requirements")
    
    # Install Whisper
    run_command("pip install openai-whisper", "Installing OpenAI Whisper")

def test_whisper_installation():
    """Test if Whisper is properly installed."""
    print("🧪 Testing Whisper installation...")
    
    try:
        import whisper
        print("✅ Whisper imported successfully")
        
        # Try to load the base model
        print("⏳ Loading Whisper base model (this may take a few minutes)...")
        model = whisper.load_model("base")
        print("✅ Whisper base model loaded successfully")
        
        return True
    except Exception as e:
        print(f"❌ Whisper test failed: {e}")
        return False

def test_audio_dependencies():
    """Test if audio dependencies are working."""
    print("🧪 Testing audio dependencies...")
    
    try:
        import pyaudio
        print("✅ PyAudio imported successfully")
        
        # Test audio device enumeration
        audio = pyaudio.PyAudio()
        device_count = audio.get_device_count()
        print(f"✅ Found {device_count} audio devices")
        
        # List input devices
        print("🎤 Available input devices:")
        for i in range(device_count):
            device_info = audio.get_device_info_by_index(i)
            if device_info['maxInputChannels'] > 0:
                print(f"   {i}: {device_info['name']} ({device_info['defaultSampleRate']} Hz)")
        
        audio.terminate()
        return True
    except Exception as e:
        print(f"❌ Audio test failed: {e}")
        return False

def test_socketio_dependencies():
    """Test if Socket.IO dependencies are working."""
    print("🧪 Testing Socket.IO dependencies...")
    
    try:
        import flask_socketio
        import socketio
        print("✅ Socket.IO dependencies imported successfully")
        return True
    except Exception as e:
        print(f"❌ Socket.IO test failed: {e}")
        return False

def run_test_transcription():
    """Run a quick test of the transcription system."""
    print("🧪 Running transcription system test...")
    
    try:
        # Import the transcription module
        sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))
        from transcribe import RealTimeWhisperTranscriber
        
        # Create transcriber instance
        transcriber = RealTimeWhisperTranscriber(model_size="tiny", language="en")
        print("✅ Transcriber created successfully")
        
        # Test device enumeration
        devices = transcriber.get_available_input_devices()
        print(f"✅ Found {len(devices)} input devices")
        
        # Clean up
        del transcriber
        print("✅ Transcription system test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Transcription system test failed: {e}")
        return False

def main():
    """Main setup function."""
    print("🚀 Setting up Whisper Real-Time Transcription System")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install system dependencies
    install_system_dependencies()
    
    # Install Python dependencies
    install_python_dependencies()
    
    # Run tests
    print("\n🧪 Running system tests...")
    print("=" * 30)
    
    tests_passed = 0
    total_tests = 4
    
    if test_whisper_installation():
        tests_passed += 1
    
    if test_audio_dependencies():
        tests_passed += 1
    
    if test_socketio_dependencies():
        tests_passed += 1
    
    if run_test_transcription():
        tests_passed += 1
    
    print(f"\n📊 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 Setup completed successfully!")
        print("\nNext steps:")
        print("1. Start the Flask server: python backend/app.py")
        print("2. Open the transcript page in your browser")
        print("3. Click 'Start' to begin real-time transcription")
        print("\nNote: The first time you run transcription, Whisper will")
        print("download the model files, which may take a few minutes.")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        print("You may need to install additional system dependencies.")

if __name__ == "__main__":
    main()
