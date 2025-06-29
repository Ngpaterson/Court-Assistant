#!/usr/bin/env python3
"""
Test script to verify the data structure being sent from the transcription server
"""

import json
import sys
import os

# Add the python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from realtime_transcriber import RealtimeTranscriber

def test_data_structure():
    """Test the data structure being sent from the transcription engine"""
    print("=== Testing Data Structure ===")
    
    # Create transcriber
    transcriber = RealtimeTranscriber(
        sample_rate=16000,
        chunk_duration=3.0,
        device="cpu",
        compute_type="int8"
    )
    
    # Test the output callback
    def test_output(data):
        print("=== Transcription Output Data ===")
        print(f"Data type: {type(data)}")
        print(f"Data: {json.dumps(data, indent=2)}")
        print(f"Has 'text' field: {'text' in data}")
        print(f"Has 'full_transcript' field: {'full_transcript' in data}")
        print(f"Has 'type' field: {'type' in data}")
        print(f"Text: {data.get('text', 'NOT FOUND')}")
        print(f"Full transcript: {data.get('full_transcript', 'NOT FOUND')}")
        print(f"Type: {data.get('type', 'NOT FOUND')}")
    
    def test_error(error):
        print(f"Error: {error}")
    
    transcriber.set_output_callback(test_output)
    transcriber.set_error_callback(test_error)
    
    # Simulate a transcription output
    test_data = {
        'type': 'transcription',
        'text': 'Hello world',
        'full_transcript': 'Hello world',
        'session_id': 'test_session',
        'timestamp': '2024-01-01T12:00:00'
    }
    
    print("Simulating transcription output...")
    transcriber._handle_transcription("Hello world")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    test_data_structure() 