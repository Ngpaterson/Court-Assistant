from flask import Flask, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt
import certifi
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)

# MongoDB Atlas setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["courtroom_db"]

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

if __name__ == "__main__":
    app.run(debug=True, port=5001)
