/**
 * Test script to verify the full transcription flow
 */

const { TranscriptionManager } = require('./backend/transcriptionManager');

async function testFullFlow() {
    console.log('=== Testing Full Transcription Flow ===');
    
    const manager = new TranscriptionManager();
    
    // Set up callbacks
    manager.onTranscription((data) => {
        console.log('✓ Received transcription:', data);
        console.log('  Type:', data.type);
        console.log('  Text:', data.text);
        console.log('  Full transcript:', data.full_transcript);
    });
    
    manager.onError((error) => {
        console.error('✗ Received error:', error);
    });
    
    manager.onStatus((status) => {
        console.log('✓ Received status:', status);
    });
    
    manager.onReady((data) => {
        console.log('✓ Server ready:', data);
    });
    
    // Start the server
    console.log('Starting transcription server...');
    const success = await manager.startServer();
    
    if (success) {
        console.log('✓ Server started successfully');
        
        // Wait a bit for the server to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start transcription
        console.log('Starting transcription...');
        const transcriptionStarted = manager.startTranscription('test_session');
        console.log('Transcription start result:', transcriptionStarted);
        
        // Wait for some transcription data
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Stop transcription
        console.log('Stopping transcription...');
        manager.stopTranscription();
        
        // Clean up
        manager.stopServer();
        console.log('✓ Test completed');
    } else {
        console.error('✗ Failed to start server');
    }
}

// Run the test
testFullFlow().catch(console.error); 