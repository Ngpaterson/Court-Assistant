from flask import Flask, request, jsonify
from pymongo import MongoClient
from gridfs import GridFS
from dotenv import load_dotenv
import bcrypt
import certifi
import os
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import uuid
from datetime import datetime
import face_recognition
import numpy as np
import cv2
import base64
from PIL import Image
import io
import traceback
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))
from transcribe import get_transcriber, cleanup_transcriber

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
# MongoDB Atlas setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["courtroom_db"]
fs = GridFS(db)

import traceback

def make_transcript_template(data):
    # human-readable schedule time
    dt = datetime.fromisoformat(data["schedule_datetime"])
    dt_str = dt.strftime("%Y-%m-%d %H:%M")

    lines = [
        "Republic of Cameroon",
        "Court of First Instance – Douala",
        "",
        f"Case: {data['case_number']}   Type: {data['case_type'].capitalize()}   Charges: {data['charges']}",
        f"Parties: {data['plaintiff_appelation']} {data['plaintiff_name']}  vs  "
         f"{data['defendant_appelation']} {data['defendant_name']}",
        f"Judge: {data['judge_matricule']}",
        f"Clerk: {data['clerk_matricule']}",
        f"Scheduled for: {dt_str}",
        "",
        "---- BEGIN TRANSCRIPT ----",
        ""
    ]
    # join with newline
    return "\n".join(lines)

@app.route("/api/schedule", methods=["POST"])
def schedule_proceeding():
    data = request.get_json(force=True)
    print("📥 /api/schedule payload:", data)  # log what arrived

    required = [
        "case_number", "case_type", "plaintiff_name",
        "defendant_appelation", "defendant_name",
        "judge_matricule", "schedule_datetime",
        "charges",
        "clerk_matricule"
    ]
    for field in required:
        if field not in data:
            return jsonify({
                "success": False,
                "message": f"Missing field: {field}"
            }), 400
    template = make_transcript_template(data)
    try:
        proceeding = {
            "proceeding_id": str(uuid.uuid4()),
            "case_number": data["case_number"],
            "case_type": data["case_type"],
            "plaintiff": {
                "appelation": data["plaintiff_appelation"],
                "name": data["plaintiff_name"]
            },
            "defendant": {
                "appelation": data["defendant_appelation"],
                "name": data["defendant_name"]
            },
            "judge_matricule": data["judge_matricule"],
            "charges": data["charges"],
            "clerk_matricule": data["clerk_matricule"],
            "transcript": template,
            "schedule_datetime": data["schedule_datetime"],
            "status": "scheduled"
        }

        db.proceedings.insert_one(proceeding)
        return jsonify({
            "success": True,
            "proceeding_id": proceeding["proceeding_id"]
        }), 200

    except Exception as e:
        traceback.print_exc()  # print full stack trace
        return jsonify({
            "success": False,
            "message": "Failed to save proceeding: " + str(e)
        }), 500

import traceback

@app.route("/api/proceedings", methods=["GET"])
def get_proceedings():
    clerk = request.args.get("clerk_matricule")
    if not clerk:
        return jsonify({"success": False, "message": "Missing clerk_matricule"}), 400

    try:
        # fetch all proceedings for this clerk
        procs = list(db.proceedings.find(
            {"clerk_matricule": clerk},
            {"_id": 0}
        ))

        # enrich with judge name
        for p in procs:
            j = db.judges.find_one(
                {"matricule": p["judge_matricule"]},
                {"_id": 0, "name": 1}
            )
            p["judge_name"] = j["name"] if j else "Unknown"

        return jsonify(procs), 200

    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "message": "Server error"}), 500

    
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    matricule = data.get("matricule")
    password = data.get("password")

    if not matricule or not password:
        return jsonify({"success": False, "message": "Please provide both matricule and password"}), 400

    # Determine role
    if matricule.upper().startswith("CLERK"):
        user = db.clerks.find_one({"matricule": matricule})
        role = "clerk"
    elif matricule.upper().startswith("JUDGE"):
        user = db.judges.find_one({"matricule": matricule})
        role = "judge"
    else:
        return jsonify({"success": False, "message": "Invalid matricule format"}), 400

    if not user:
        return jsonify({"success": False, "message": "Account not found"}), 404

    if bcrypt.checkpw(password.encode(), user["password_hash"]):
        return jsonify({
            "success": True,
            "role": role,
            "user": {
                "name": user["name"],
                "matricule": user["matricule"]
            }
        }), 200
    else:
        return jsonify({"success": False, "message": "Incorrect password"}), 401

@app.route("/api/judges", methods=["GET"])
def get_judges():
    try:
        # Fetch all judges with only name and matricule (exclude _id and password)
        judges = list(db.judges.find({}, {"_id": 0, "name": 1, "matricule": 1}))
        return jsonify(judges), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/proceeding/<proceeding_id>", methods=["GET"])
def get_proceeding(proceeding_id):
    """Get individual proceeding data for transcript page"""
    try:
        # Fetch the proceeding
        proceeding = db.proceedings.find_one(
            {"proceeding_id": proceeding_id},
            {"_id": 0}
        )
        
        if not proceeding:
            return jsonify({"success": False, "message": "Proceeding not found"}), 404
        
        # Enrich with judge name
        judge = db.judges.find_one(
            {"matricule": proceeding["judge_matricule"]},
            {"_id": 0, "name": 1}
        )
        if judge:
            proceeding["judge_name"] = judge["name"]
        
        # Enrich with clerk name
        clerk = db.clerks.find_one(
            {"matricule": proceeding["clerk_matricule"]},
            {"_id": 0, "name": 1}
        )
        if clerk:
            proceeding["clerk_name"] = clerk["name"]
        
        return jsonify(proceeding), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": "Server error"}), 500

@app.route("/api/transcript/<proceeding_id>", methods=["GET"])
def get_transcript(proceeding_id):
    """Get existing transcript from GridFS"""
    try:
        # Find the transcript file in GridFS
        transcript_file = fs.find_one({"filename": f"transcript_{proceeding_id}"})
        
        if transcript_file:
            content = transcript_file.read().decode('utf-8')
            return jsonify({
                "content": content,
                "last_modified": transcript_file.upload_date.isoformat(),
                "proceeding_id": proceeding_id
            }), 200
        else:
            return jsonify({"content": "", "proceeding_id": proceeding_id}), 200
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": "Error fetching transcript"}), 500

@app.route("/api/transcript/<proceeding_id>", methods=["POST"])
def save_transcript(proceeding_id):
    """Save transcript to GridFS"""
    try:
        data = request.get_json()
        content = data.get("content", "")
        
        if not content.strip():
            return jsonify({"success": False, "message": "No content to save"}), 400
        
        # Delete existing transcript if it exists
        existing_file = fs.find_one({"filename": f"transcript_{proceeding_id}"})
        if existing_file:
            fs.delete(existing_file._id)
        
        # Save new transcript to GridFS
        file_id = fs.put(
            content.encode('utf-8'),
            filename=f"transcript_{proceeding_id}",
            content_type="text/plain",
            metadata={
                "proceeding_id": proceeding_id,
                "created_at": datetime.utcnow(),
                "type": "transcript"
            }
        )
        
        # Update proceeding status
        db.proceedings.update_one(
            {"proceeding_id": proceeding_id},
            {
                "$set": {
                    "status": "in_progress",
                    "last_updated": datetime.utcnow().isoformat()
                }
            }
        )
        
        return jsonify({
            "success": True,
            "file_id": str(file_id),
            "message": "Transcript saved successfully"
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": "Error saving transcript"}), 500

@app.route("/api/transcript/<proceeding_id>/export", methods=["GET"])
def export_transcript(proceeding_id):
    """Export complete transcript with header information"""
    try:
        # Get proceeding data
        proceeding = db.proceedings.find_one(
            {"proceeding_id": proceeding_id},
            {"_id": 0}
        )
        
        if not proceeding:
            return jsonify({"success": False, "message": "Proceeding not found"}), 404
        
        # Get transcript content
        transcript_file = fs.find_one({"filename": f"transcript_{proceeding_id}"})
        transcript_content = ""
        
        if transcript_file:
            transcript_content = transcript_file.read().decode('utf-8')
        
        # Generate complete transcript with header
        complete_transcript = make_transcript_template(proceeding)
        if transcript_content:
            complete_transcript += "\n\n" + transcript_content
        
        return jsonify({
            "success": True,
            "proceeding_id": proceeding_id,
            "content": complete_transcript,
            "case_number": proceeding.get("case_number"),
            "export_date": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": "Error exporting transcript"}), 500

# Facial Recognition Helper Functions
def process_image_data(image_data):
    """Process base64 image data and return face encodings"""
    try:
        # Remove data URL prefix if present
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL image to numpy array
        image_array = np.array(image)
        
        # Find face locations and encodings
        face_locations = face_recognition.face_locations(image_array)
        
        if not face_locations:
            return None, "No face detected in the image"
        
        if len(face_locations) > 1:
            return None, "Multiple faces detected. Please ensure only one face is visible"
        
        # Get face encoding
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        
        if not face_encodings:
            return None, "Could not generate face encoding"
        
        return face_encodings[0], None
        
    except Exception as e:
        return None, f"Error processing image: {str(e)}"

@app.route("/api/face-auth", methods=["POST"])
def face_authentication():
    """Authenticate user using facial recognition"""
    try:
        data = request.get_json()
        matricule = data.get("matricule")
        image_data = data.get("image_data")
        
        if not matricule or not image_data:
            return jsonify({
                "success": False,
                "message": "Missing matricule or image data"
            }), 400
        
        # Get user and their stored face encoding
        if matricule.upper().startswith("CLERK"):
            user = db.clerks.find_one({"matricule": matricule})
        elif matricule.upper().startswith("JUDGE"):
            user = db.judges.find_one({"matricule": matricule})
        else:
            return jsonify({
                "success": False,
                "message": "Invalid matricule format"
            }), 400
        
        if not user:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 404
        
        # Check if user has face encoding stored
        if "face_encoding" not in user:
            return jsonify({
                "success": False,
                "message": "No facial data found for this user. Please contact administrator to register your face."
            }), 400
        
        # Process the captured image
        captured_encoding, error = process_image_data(image_data)
        
        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400
        
        # Compare with stored encoding
        stored_encoding = np.array(user["face_encoding"])
        
        # Calculate face distance (lower is better match)
        face_distance = face_recognition.face_distance([stored_encoding], captured_encoding)[0]
        
        # Threshold for face recognition (adjust as needed)
        threshold = 0.6
        
        if face_distance < threshold:
            return jsonify({
                "success": True,
                "message": "Face recognition successful",
                "confidence": float(1 - face_distance)  # Convert to confidence score
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": f"Face not recognized. Please try again or contact administrator.",
                "confidence": float(1 - face_distance)
            }), 401
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Face authentication error"
        }), 500

@app.route("/api/register-face", methods=["POST"])
def register_face():
    """Register face encoding for a user"""
    try:
        data = request.get_json()
        matricule = data.get("matricule")
        image_data = data.get("image_data")
        
        if not matricule or not image_data:
            return jsonify({
                "success": False,
                "message": "Missing matricule or image data"
            }), 400
        
        # Process the image and get face encoding
        face_encoding, error = process_image_data(image_data)
        
        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400
        
        # Determine collection and update user
        if matricule.upper().startswith("CLERK"):
            collection = db.clerks
        elif matricule.upper().startswith("JUDGE"):
            collection = db.judges
        else:
            return jsonify({
                "success": False,
                "message": "Invalid matricule format"
            }), 400
        
        # Update user with face encoding
        result = collection.update_one(
            {"matricule": matricule},
            {
                "$set": {
                    "face_encoding": face_encoding.tolist(),
                    "face_registered_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 404
        
        return jsonify({
            "success": True,
            "message": "Face encoding registered successfully"
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Error registering face encoding"
        }), 500

@app.route("/api/check-face-registration/<matricule>", methods=["GET"])
def check_face_registration(matricule):
    """Check if user has face encoding registered"""
    try:
        # Determine collection
        if matricule.upper().startswith("CLERK"):
            user = db.clerks.find_one({"matricule": matricule}, {"face_encoding": 1})
        elif matricule.upper().startswith("JUDGE"):
            user = db.judges.find_one({"matricule": matricule}, {"face_encoding": 1})
        else:
            return jsonify({
                "success": False,
                "message": "Invalid matricule format"
            }), 400
        
        if not user:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 404
        
        has_face_data = "face_encoding" in user and user["face_encoding"] is not None
        
        return jsonify({
            "success": True,
            "has_face_data": has_face_data
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Error checking face registration"
        }), 500

# WebSocket events for real-time transcription
current_transcription_sessions = {}  # proceeding_id -> transcript_content

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('status', {'message': 'Connected to transcription server'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('start_transcription')
def handle_start_transcription(data):
    """Start real-time transcription for a proceeding"""
    try:
        proceeding_id = data.get('proceeding_id')
        model_size = data.get('model_size', 'base')  # tiny, base, small, medium, large
        language = data.get('language', 'en')
        
        if not proceeding_id:
            emit('error', {'message': 'Proceeding ID is required'})
            return
        
        # Initialize or get transcriber
        transcriber = get_transcriber(model_size, language)
        
        # Set up callback for real-time updates
        def on_transcript_update(text):
            # Update session transcript
            if proceeding_id not in current_transcription_sessions:
                current_transcription_sessions[proceeding_id] = ""
            
            # Add new text with timestamp
            timestamp = datetime.now().strftime("%H:%M:%S")
            current_transcription_sessions[proceeding_id] += f"[{timestamp}] {text} "
            
            # Emit to client using socketio context
            socketio.emit('transcript_update', {
                'proceeding_id': proceeding_id,
                'text': text,
                'timestamp': timestamp,
                'full_transcript': current_transcription_sessions[proceeding_id]
            })
        
        transcriber.set_transcript_callback(on_transcript_update)
        
        # Start recording
        success = transcriber.start_recording()
        
        if success:
            emit('transcription_started', {
                'proceeding_id': proceeding_id,
                'message': 'Transcription started successfully',
                'model_size': model_size,
                'language': language
            })
        else:
            emit('error', {'message': 'Failed to start transcription'})
    
    except Exception as e:
        print(f"Error starting transcription: {e}")
        emit('error', {'message': f'Failed to start transcription: {str(e)}'})

@socketio.on('pause_transcription')
def handle_pause_transcription(data):
    """Pause real-time transcription"""
    try:
        transcriber = get_transcriber()
        transcriber.pause_recording()
        
        emit('transcription_paused', {
            'proceeding_id': data.get('proceeding_id'),
            'message': 'Transcription paused'
        })
    
    except Exception as e:
        print(f"Error pausing transcription: {e}")
        emit('error', {'message': f'Failed to pause transcription: {str(e)}'})

@socketio.on('resume_transcription')
def handle_resume_transcription(data):
    """Resume paused transcription"""
    try:
        transcriber = get_transcriber()
        transcriber.resume_recording()
        
        emit('transcription_resumed', {
            'proceeding_id': data.get('proceeding_id'),
            'message': 'Transcription resumed'
        })
    
    except Exception as e:
        print(f"Error resuming transcription: {e}")
        emit('error', {'message': f'Failed to resume transcription: {str(e)}'})

@socketio.on('stop_transcription')
def handle_stop_transcription(data):
    """Stop real-time transcription and save final transcript"""
    try:
        proceeding_id = data.get('proceeding_id')
        
        transcriber = get_transcriber()
        transcriber.stop_recording()
        
        # Save final transcript to database
        if proceeding_id in current_transcription_sessions:
            final_transcript = current_transcription_sessions[proceeding_id]
            
            # Save to database
            transcript_data = {
                "proceeding_id": proceeding_id,
                "content": final_transcript,
                "last_modified": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "method": "whisper_realtime"
            }
            
            # Update or insert transcript
            db.transcripts.update_one(
                {"proceeding_id": proceeding_id},
                {"$set": transcript_data},
                upsert=True
            )
            
            # Clean up session
            del current_transcription_sessions[proceeding_id]
        
        emit('transcription_stopped', {
            'proceeding_id': proceeding_id,
            'message': 'Transcription stopped and saved'
        })
    
    except Exception as e:
        print(f"Error stopping transcription: {e}")
        emit('error', {'message': f'Failed to stop transcription: {str(e)}'})

@socketio.on('get_audio_devices')
def handle_get_audio_devices():
    """Get available audio input devices"""
    try:
        transcriber = get_transcriber()
        devices = transcriber.get_available_input_devices()
        
        emit('audio_devices', {
            'devices': devices,
            'message': 'Audio devices retrieved successfully'
        })
    
    except Exception as e:
        print(f"Error getting audio devices: {e}")
        emit('error', {'message': f'Failed to get audio devices: {str(e)}'})

# REST API endpoint to get current transcription status
@app.route("/api/transcription/status/<proceeding_id>", methods=["GET"])
def get_transcription_status(proceeding_id):
    """Get current transcription status for a proceeding"""
    try:
        transcriber = get_transcriber()
        
        status = {
            "proceeding_id": proceeding_id,
            "is_recording": transcriber.is_recording if transcriber else False,
            "is_paused": transcriber.is_paused if transcriber else False,
            "has_session": proceeding_id in current_transcription_sessions,
            "current_transcript": current_transcription_sessions.get(proceeding_id, "")
        }
        
        return jsonify(status), 200
    
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error getting transcription status: {str(e)}"
        }), 500

if __name__ == "__main__":
    try:
        socketio.run(app, debug=True, port=5001, host='localhost')
    except KeyboardInterrupt:
        cleanup_transcriber()
        print("Server stopped")



