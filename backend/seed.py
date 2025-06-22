from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt
import certifi
import os

# Load .env variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["courtroom_db"]

# Sample users
clerk = {
    "matricule": "CLERK002",
    "name": "ATANGANA Andre",
    "password_hash": bcrypt.hashpw("clerk124".encode(), bcrypt.gensalt())
}

judge = {
    "matricule": "JUDGE002",
    "name": "MEZOGO Pierre",
    "password_hash": bcrypt.hashpw("judge124".encode(), bcrypt.gensalt())
}

# Insert if not already present
if not db.clerks.find_one({"matricule": "CLERK002"}):
    db.clerks.insert_one(clerk)
    print("✅ Clerk inserted")

if not db.judges.find_one({"matricule": "JUDGE002"}):
    db.judges.insert_one(judge)
    print("✅ Judge inserted")
