@echo off
echo Installing Simple Real-Time Transcription Dependencies...
echo.

cd backend

echo Installing Python dependencies...
pip install faster-whisper==0.10.0

echo.
echo Installation complete!
echo.
echo MUCH SIMPLER - No WebSocket dependencies needed!
echo Only faster-whisper is required for transcription.
echo.
echo The first time you start the backend, faster-whisper will download the 'small' model (~460MB).
echo This may take a few minutes depending on your internet connection.
echo.
pause 