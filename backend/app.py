from flask import Flask, request, jsonify
from pymongo import MongoClient
from gridfs import GridFS
from dotenv import load_dotenv
import bcrypt
import certifi
import os
from flask_cors import CORS
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)
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

if __name__ == "__main__":
    app.run(debug=True, port=5001)



