from flask import Flask, request, jsonify
import whisper
import os

app = Flask(__name__)
model = whisper.load_model("base")

@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio uploaded"}), 400

    audio_file = request.files["audio"]
    save_path = "temp.wav"
    audio_file.save(save_path)

    result = model.transcribe(save_path, language="en")
    return jsonify({"text": result["text"]})

if __name__ == "__main__":
    app.run(port=5001)
