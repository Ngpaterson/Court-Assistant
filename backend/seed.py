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
    "matricule": "CLERK001",
    "name": "MVE Didier",
    "password_hash": bcrypt.hashpw("clerk123".encode(), bcrypt.gensalt())
}

judge = {
    "matricule": "JUDGE001",
    "name": "Justice Mbeng",
    "password_hash": bcrypt.hashpw("judge123".encode(), bcrypt.gensalt())
}

# Insert if not already present
if not db.clerks.find_one({"matricule": "CLERK001"}):
    db.clerks.insert_one(clerk)
    print("✅ Clerk inserted")

if not db.judges.find_one({"matricule": "JUDGE001"}):
    db.judges.insert_one(judge)
    print("✅ Judge inserted")
