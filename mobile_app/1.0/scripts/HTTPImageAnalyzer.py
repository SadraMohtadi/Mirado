#Copyright 2026 Sadra Mohtadi
#
#Licensed under the Apache License, Version 2.0
#http://www.apache.org/licenses/LICENSE-2.0

# HTTP VERSION!
# This is a demo server-side code.
# It automatically downloads everything it needs.
# It also has a built in query system so you're welcome :) 

import json
import urllib.request
import subprocess
import socket
import time
import base64
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL = "gemma3:4b"
PORT = 8001

# Hardcoded rules prompt (DO NOT TOUCH)
PROMPT_RULES = """
NO EXPLANATION.

Return a single sentence made of keywords describing the product in the image.

Rules:
- Use semicolon-separated keywords
- Include brand if visible in the first spot
- Include multiple categories, second, third and fourth spots
- Put as many keywords as possible, second third and fourth spots
- Include units if visible, anything after the fourth spot
- Keep it short and dense

Example:

Coca-Cola;Food & Drinks;Beverages;Soda;500ml
"""

# Logging helpers
def log_server(msg):
    print(f"[SERVER] {msg}")

def log_client(ip, msg):
    print(f"[{ip}] {msg}")

# Ensure Ollama is installed
def ensure_ollama():
    try:
        subprocess.run(["ollama", "--version"], stdout=subprocess.DEVNULL)
        log_server("Ollama detected")
    except:
        log_server("ERROR: Ollama not installed. Download from https://ollama.com/download")
        exit(1)

# Ensure Ollama is running
def ensure_ollama_running():
    try:
        urllib.request.urlopen("http://localhost:11434", timeout=1)
        log_server("Ollama already running")
    except:
        log_server("Starting Ollama serve...")
        subprocess.Popen(
            ["ollama", "serve"],
            env={**os.environ, "OLLAMA_MAX_LOADED_MODELS": "1"}
        )

        # Wait until ready
        for _ in range(30):
            try:
                urllib.request.urlopen("http://localhost:11434", timeout=1)
                log_server("Ollama started")
                return
            except:
                time.sleep(1)

        log_server("ERROR: Ollama failed to start")
        exit(1)

# Ensure the model exists
def ensure_model():
    result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
    if MODEL not in result.stdout:
        log_server(f"Model {MODEL} missing. Pulling...")
        subprocess.run(["ollama", "pull", MODEL])
    log_server(f"Model {MODEL} ready")

# Build prompt (now structured like your first server)
def build_prompt():
    return f"""
{PROMPT_RULES}
""".strip()

# HTTP handler
class AIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        ip = self.client_address[0]
        log_client(ip, "CORS preflight")
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        ip = self.client_address[0]

        if self.path != "/prompt":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
            image_b64 = data.get("image")

            if not image_b64:
                raise ValueError("No 'image' field provided")

            # Remove data URL prefix if present
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            # Validate base64
            base64.b64decode(image_b64, validate=True)

        except Exception as e:
            log_client(ip, f"Invalid request: {e}")
            self.send_response(400)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        log_client(ip, f"Image received: {len(image_b64)} base64 chars")

        final_prompt = build_prompt()
        log_client(ip, f"Prompt length: {len(final_prompt)} chars")

        payload = json.dumps({
            "model": MODEL,
            "prompt": final_prompt,
            "images": [image_b64],
            "stream": False
        }).encode()

        req = urllib.request.Request(
            "http://localhost:11434/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as res:
                result = json.loads(res.read().decode())

            response = {"response": result.get("response", "")}
            log_client(ip, "Response generated")

        except Exception as e:
            log_client(ip, f"Model error: {e}")
            response = {"error": str(e)}

        self.send_response(200)
        self.send_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

# Main entry
def main():
    log_server("Starting server...")
    ensure_ollama()
    ensure_ollama_running()
    ensure_model()

    server = HTTPServer(("0.0.0.0", PORT), AIHandler)
    ip = socket.gethostbyname(socket.gethostname())
    log_server(f"Server running at http://{ip}:{PORT}")
    server.serve_forever()

if __name__ == "__main__":
    main()