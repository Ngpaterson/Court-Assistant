/**
 * Transcription Manager for Electron
 * Manages the Python transcription server and handles IPC communication
 */

const { spawn } = require('child_process');
const path = require('path');

class TranscriptionManager {
    constructor() {
        this.pythonProcess = null;
        this.isRunning = false;
        this.currentSession = null;
        this.transcriptBuffer = '';
        this.callbacks = {
            onTranscription: null,
            onError: null,
            onStatus: null,
            onReady: null
        };
    }

    /**
     * Start the Python transcription server
     */
    async startServer() {
        if (this.isRunning) {
            console.log('Transcription server already running');
            return true;
        }

        try {
            console.log('Starting Python transcription server...');
            
            // Path to the Python transcription server
            const pythonScript = path.join(__dirname, '..', 'python', 'transcription_server.py');
            
            // Spawn Python process
            this.pythonProcess = spawn('python', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.join(__dirname, '..')
            });

            // Handle stdout (transcription output)
            this.pythonProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        this._handlePythonOutput(line);
                    }
                });
            });

            // Handle stderr (Python errors/logs)
            this.pythonProcess.stderr.on('data', (data) => {
                console.log('Python stderr:', data.toString());
            });

            // Handle process exit
            this.pythonProcess.on('close', (code) => {
                console.log(`Python transcription server exited with code ${code}`);
                this.isRunning = false;
                this.pythonProcess = null;
            });

            // Handle process errors
            this.pythonProcess.on('error', (error) => {
                console.error('Error starting Python transcription server:', error);
                this.isRunning = false;
                this.pythonProcess = null;
                if (this.callbacks.onError) {
                    this.callbacks.onError(`Failed to start transcription server: ${error.message}`);
                }
            });

            // Wait for the ready message from the server
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.error('Timeout waiting for transcription server ready message');
                    resolve(false);
                }, 10000); // 10 second timeout

                // Override the onReady callback to resolve the promise
                const originalOnReady = this.callbacks.onReady;
                this.callbacks.onReady = (data) => {
                    clearTimeout(timeout);
                    this.isRunning = true;
                    console.log('Transcription server ready, resolving promise');
                    if (originalOnReady) {
                        originalOnReady(data);
                    }
                    resolve(true);
                };
            });

        } catch (error) {
            console.error('Error starting transcription server:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(`Failed to start transcription server: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * Stop the Python transcription server
     */
    stopServer() {
        if (this.pythonProcess) {
            console.log('Stopping Python transcription server...');
            this.pythonProcess.kill();
            this.pythonProcess = null;
            this.isRunning = false;
        }
    }

    /**
     * Send command to Python transcription server
     */
    _sendCommand(command) {
        if (!this.pythonProcess || !this.isRunning) {
            console.error('Transcription server not running');
            return false;
        }

        try {
            const commandStr = JSON.stringify(command) + '\n';
            this.pythonProcess.stdin.write(commandStr);
            return true;
        } catch (error) {
            console.error('Error sending command to Python server:', error);
            return false;
        }
    }

    /**
     * Handle output from Python transcription server
     */
    _handlePythonOutput(line) {
        try {
            const message = JSON.parse(line);
            const { type, data, timestamp } = message;

            switch (type) {
                case 'ready':
                    console.log('Transcription server ready:', data);
                    // isRunning is set in the promise resolution
                    if (this.callbacks.onReady) {
                        this.callbacks.onReady(data);
                    }
                    break;

                case 'transcription':
                    console.log('Received transcription:', data);
                    this._handleTranscription(data);
                    break;

                case 'error':
                    console.error('Transcription server error:', data);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(data.message);
                    }
                    break;

                case 'start_response':
                    console.log('Start response:', data);
                    break;

                case 'stop_response':
                    console.log('Stop response:', data);
                    break;

                case 'clear_response':
                    console.log('Clear response:', data);
                    break;

                case 'status_response':
                    console.log('Status response:', data);
                    if (this.callbacks.onStatus) {
                        this.callbacks.onStatus(data);
                    }
                    break;

                default:
                    console.log('Unknown message type:', type, data);
            }
        } catch (error) {
            console.error('Error parsing Python output:', error, 'Raw line:', line);
        }
    }

    /**
     * Handle transcription data
     */
    _handleTranscription(data) {
        console.log('Handling transcription data:', data);
        
        // The data from Python server has the structure:
        // { type: 'transcription', text: '...', full_transcript: '...', session_id: '...', timestamp: '...' }
        if (data.type === 'transcription') {
            this.transcriptBuffer = data.full_transcript;
            if (this.callbacks.onTranscription) {
                this.callbacks.onTranscription({
                    type: 'transcription',
                    text: data.text,
                    full_transcript: data.full_transcript,
                    session_id: data.session_id,
                    timestamp: data.timestamp
                });
            }
        } else if (data.type === 'clear') {
            this.transcriptBuffer = '';
            if (this.callbacks.onTranscription) {
                this.callbacks.onTranscription({
                    type: 'clear',
                    text: '',
                    full_transcript: '',
                    session_id: data.session_id,
                    timestamp: data.timestamp
                });
            }
        } else {
            console.log('Unknown transcription data type:', data.type);
        }
    }

    /**
     * Start transcription session
     */
    startTranscription(sessionId) {
        if (!this.isRunning) {
            console.error('Transcription server not running');
            return false;
        }

        this.currentSession = sessionId;
        return this._sendCommand({
            type: 'start',
            session_id: sessionId
        });
    }

    /**
     * Stop transcription session
     */
    stopTranscription() {
        if (!this.isRunning) {
            return false;
        }

        this.currentSession = null;
        return this._sendCommand({
            type: 'stop'
        });
    }

    /**
     * Clear transcript
     */
    clearTranscript() {
        if (!this.isRunning) {
            return false;
        }

        return this._sendCommand({
            type: 'clear'
        });
    }

    /**
     * Get transcription status
     */
    getStatus() {
        if (!this.isRunning) {
            return false;
        }

        return this._sendCommand({
            type: 'status'
        });
    }

    /**
     * Set callback for transcription updates
     */
    onTranscription(callback) {
        this.callbacks.onTranscription = callback;
    }

    /**
     * Set callback for error handling
     */
    onError(callback) {
        this.callbacks.onError = callback;
    }

    /**
     * Set callback for status updates
     */
    onStatus(callback) {
        this.callbacks.onStatus = callback;
    }

    /**
     * Set callback for ready state
     */
    onReady(callback) {
        this.callbacks.onReady = callback;
    }

    /**
     * Get current transcript buffer
     */
    getTranscriptBuffer() {
        return this.transcriptBuffer;
    }

    /**
     * Check if transcription is running
     */
    isTranscriptionRunning() {
        return this.isRunning && this.currentSession !== null;
    }
}

module.exports = { TranscriptionManager }; 