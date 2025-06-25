# 📸 Facial Recognition Setup Instructions

## 🚀 Quick Start Guide

Your facial recognition second factor authentication system is now ready! Follow these steps to get started:

### Step 1: Install Dependencies

First, install the required Python packages:

```bash
pip install -r requirements.txt
```

**Note:** If you encounter issues with `face_recognition`, you may need to install additional system dependencies:
- **Windows**: Install Microsoft Visual C++ Build Tools
- **macOS**: Install cmake: `brew install cmake`

### Step 2: Start Your Servers

1. **Start the Flask Backend:**
   ```bash
   cd backend
   python app.py
   ```
   ✅ Server should start on `http://localhost:5001`

2. **Start the Electron App:**
   ```bash
   npm start
   ```

### Step 3: Register Your Face Data

**Option A: Using the Upload Interface (Recommended)**

1. Open your browser and navigate to: `pages/face-upload.html`
   - Or add this to your app's navigation menu

2. Follow the 3-step wizard:
   - **Step 1**: Enter your matricule (e.g., "CLERK001" or "JUDGE001")
   - **Step 2**: Upload a clear photo of your face
   - **Step 3**: Confirm and register

**Photo Guidelines:**
- ✅ Clear, well-lit photo
- ✅ Face looking directly at camera
- ✅ No sunglasses or face coverings
- ✅ Only one person in the photo
- ✅ JPG, PNG, or JPEG format

### Step 4: Test the Login Flow

1. Go to the login page
2. Enter your matricule and password
3. After successful password authentication, you'll be redirected to facial recognition
4. Allow camera access when prompted
5. Click "Start Verification" to authenticate with your face
6. Upon successful recognition, you'll be logged in!

## 🔧 File Structure

### New Files Created:
```
pages/
├── face-auth.html      # Facial recognition authentication page
├── face-upload.html    # Photo upload interface for setup
└── face-register.html  # Live camera registration interface

assets/style/
├── face-auth.css       # Styling for facial authentication
├── face-upload.css     # Styling for photo upload
└── face-register.css   # Styling for camera registration

js/
├── face-auth.js        # Facial authentication logic
├── face-upload.js      # Photo upload functionality
└── face-register.js    # Camera registration functionality
```

### Modified Files:
- `js/login.js` - Updated to redirect to facial recognition
- `backend/app.py` - Added facial recognition endpoints
- `requirements.txt` - Added face recognition dependencies

## 🎯 Testing Your Setup

### For Each User in Your System:

1. **CLERK Users**: Use matricules like "CLERK001", "CLERK002", etc.
2. **JUDGE Users**: Use matricules like "JUDGE001", "JUDGE002", etc.

### Upload Process:
1. Navigate to `face-upload.html`
2. Enter the user's matricule
3. Upload their photo
4. System will process and store facial encoding

### Login Process:
1. Regular login with matricule/password
2. Automatic redirect to facial recognition
3. Camera opens with live preview
4. Face verification against stored data
5. Successful login upon recognition

## ⚙️ Configuration

You can adjust the recognition sensitivity in `backend/app.py`:

```python
# Line ~400 in app.py
threshold = 0.6  # Lower = more strict (0.4-0.8 recommended)
```

## 🔒 Security Features

- **Live Detection**: Uses real-time camera (not static images)
- **Encoding Storage**: Stores mathematical representations, not photos
- **Threshold Control**: Adjustable recognition accuracy
- **Two-Factor**: Requires both password AND facial recognition

## 🆘 Troubleshooting

### Common Issues:

1. **Camera Access Denied**
   - Grant camera permissions in your browser
   - Check Windows camera privacy settings

2. **Face Recognition Errors**
   - Ensure good lighting
   - Face the camera directly
   - Remove glasses/hats if needed

3. **"No face detected"**
   - Improve lighting conditions
   - Move closer to camera
   - Ensure face is clearly visible

4. **Connection Errors**
   - Verify Flask server is running on port 5001
   - Check network connectivity

## 📞 Ready to Test?

1. Install dependencies: `pip install -r requirements.txt`
2. Start backend: `python backend/app.py`
3. Start frontend: `npm start`
4. Open: `pages/face-upload.html`
5. Upload your photo and test!

Your facial recognition system is ready to use! 🎉 