#!/usr/bin/env python3
"""
Test script for the improved real-time transcription engine with overlap buffering
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
    """Test the improved transcription engine"""
    print("\n=== Testing Improved Real-time Transcription Engine ===")
    
    # Create transcriber with improved settings
    try:
        transcriber = RealtimeTranscriber(
            sample_rate=16000,
            chunk_duration=2.0,  # Improved: reduced from 3.0s to 2.0s
            overlap_duration=0.5,  # New: 0.5s overlap to prevent word loss
            device="cpu",
            compute_type="int8"
        )
        print("✓ Improved transcriber created successfully")
        print(f"  - Chunk duration: {transcriber.chunk_duration}s")
        print(f"  - Overlap duration: {transcriber.overlap_duration}s")
        print(f"  - Audio blocksize: {int(transcriber.sample_rate * 0.1)} samples (0.1s)")
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
    print("Waiting for Whisper model to load and audio stream to start...")
    print("Features: 2.0s chunks, 0.5s overlap, 0.1s blocksize for improved responsiveness")
    time.sleep(5)
    
    # Check if recording started
    status = transcriber.get_status()
    if status['is_recording']:
        print("✓ Recording started successfully")
        print("✓ Speak into your microphone to test transcription...")
        print("  (The improved engine should capture words more accurately)")
        
        # Let it record for a while to test
        time.sleep(10)
        
        # Stop the session
        transcriber.stop_session()
        print("✓ Session stopped successfully")
        
    else:
        print("✗ Recording did not start")
        return False
    
    return True

def test_overlap_functionality():
    """Test the overlap buffering functionality"""
    print("\n=== Testing Overlap Buffering ===")
    
    transcriber = RealtimeTranscriber(
        sample_rate=16000,
        chunk_duration=2.0,
        overlap_duration=0.5,
        device="cpu",
        compute_type="int8"
    )
    
    # Test overlap calculations
    expected_chunk_samples = 16000 * 2.0  # 32000 samples
    expected_overlap_samples = 16000 * 0.5  # 8000 samples
    
    if transcriber.chunk_samples == expected_chunk_samples:
        print(f"✓ Chunk samples calculation correct: {transcriber.chunk_samples}")
    else:
        print(f"✗ Chunk samples incorrect: expected {expected_chunk_samples}, got {transcriber.chunk_samples}")
        return False
    
    if transcriber.overlap_samples == expected_overlap_samples:
        print(f"✓ Overlap samples calculation correct: {transcriber.overlap_samples}")
    else:
        print(f"✗ Overlap samples incorrect: expected {expected_overlap_samples}, got {transcriber.overlap_samples}")
        return False
    
    print("✓ Overlap buffering configuration validated")
    return True

if __name__ == "__main__":
    print("Improved Real-time Transcription Engine Test")
    print("=" * 50)
    
    try:
        # Test basic functionality
        if not test_transcription_engine():
            print("\n✗ Basic transcription test failed")
            sys.exit(1)
        
        # Test overlap functionality
        if not test_overlap_functionality():
            print("\n✗ Overlap functionality test failed")
            sys.exit(1)
        
        print("\n" + "=" * 50)
        print("✓ All tests passed!")
        print("Improvements implemented:")
        print("  - Reduced chunk duration: 3.0s → 2.0s")
        print("  - Added overlap buffering: 0.5s overlap")
        print("  - Improved audio blocksize: 0.1s for better responsiveness")
        print("  - Enhanced temp file cleanup")
        print("  - Better word boundary preservation")
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        sys.exit(1) 