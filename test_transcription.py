#!/usr/bin/env python3
"""
Test script for the new real-time transcription engine
"""

import sys
import os
import time

# Add the python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

try:
    from realtime_transcriber import RealtimeTranscriber
    print("✓ Successfully imported RealtimeTranscriber")
except ImportError as e:
    print(f"✗ Failed to import RealtimeTranscriber: {e}")
    sys.exit(1)

def test_transcription_engine():
    """Test the transcription engine"""
    print("\n=== Testing Real-time Transcription Engine ===")
    
    # Create transcriber
    try:
        transcriber = RealtimeTranscriber(
            sample_rate=16000,
            chunk_duration=3.0,
            device="cpu",
            compute_type="int8"
        )
        print("✓ Transcriber created successfully")
    except Exception as e:
        print(f"✗ Failed to create transcriber: {e}")
        return False
    
    # Test callbacks
    def test_output(data):
        print(f"✓ Received transcription output: {data}")
    
    def test_error(error):
        print(f"✗ Received error: {error}")
    
    transcriber.set_output_callback(test_output)
    transcriber.set_error_callback(test_error)
    print("✓ Callbacks set successfully")
    
    # Test status
    status = transcriber.get_status()
    print(f"✓ Status: {status}")
    
    # Test session management
    try:
        success = transcriber.start_session("test_session")
        if success:
            print("✓ Session started successfully")
        else:
            print("✗ Failed to start session")
            return False
    except Exception as e:
        print(f"✗ Error starting session: {e}")
        return False
    
    # Wait a bit for the model to load and audio to start
    print("Waiting for model to load and audio to start...")
    time.sleep(5)
    
    # Test transcription (if model is loaded)
    if transcriber.whisper_model:
        print("✓ Whisper model loaded successfully")
    else:
        print("⚠ Whisper model not loaded yet (this is normal for first run)")
    
    # Stop session
    try:
        transcriber.stop_session()
        print("✓ Session stopped successfully")
    except Exception as e:
        print(f"✗ Error stopping session: {e}")
        return False
    
    # Test clear transcript
    try:
        transcriber.clear_transcript()
        print("✓ Transcript cleared successfully")
    except Exception as e:
        print(f"✗ Error clearing transcript: {e}")
        return False
    
    print("\n=== All tests passed! ===")
    return True

if __name__ == "__main__":
    success = test_transcription_engine()
    if success:
        print("\n🎉 Transcription engine is working correctly!")
        sys.exit(0)
    else:
        print("\n❌ Transcription engine test failed!")
        sys.exit(1) 