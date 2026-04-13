#Copyright 2026 Sadra Mohtadi
#
#Licensed under the Apache License, Version 2.0
#http://www.apache.org/licenses/LICENSE-2.0

# HTTPS VERSION!
# This is a demo server-side code.
# It automatically downloads everything it needs.
# It also has a built in query system so you're welcome :)

import json
import ssl
import urllib.request
import subprocess
import socket
import time
import base64
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL = "gemma3:4b"
PORT = 8001

CERT_FILE = "cert.pem"
KEY_FILE  = "key.pem"

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

# Generate a self-signed TLS cert covering the LAN IP + localhost.
# Reuses existing cert.pem / key.pem if already present.
# NOTE: if you already ran server.py, these files already exist — this server
# will reuse them automatically (both servers share the same cert).
def ensure_tls_cert():
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        log_server("TLS certificate found, reusing.")
        return

    log_server("Generating self-signed TLS certificate…")

    try:
        lan_ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        lan_ip = "127.0.0.1"

    san = f"subjectAltName=IP:{lan_ip},IP:127.0.0.1,DNS:localhost"

    result = subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", KEY_FILE,
            "-out",    CERT_FILE,
            "-days",   "825",
            "-nodes",
            "-subj",   "/CN=LocalAIServer",
            "-addext", san,
        ],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        log_server(f"ERROR: openssl failed:\n{result.stderr}")
        log_server("Install openssl and re-run, or supply your own cert.pem / key.pem.")
        exit(1)

    log_server(f"Certificate generated (covers {lan_ip} + localhost).")
    log_server(f"⚠  First connection: open https://{lan_ip}:{PORT} in your phone's browser")
    log_server("   and tap 'Advanced → Proceed' to trust the self-signed cert.")

# Build prompt
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
    ensure_tls_cert()

    server = HTTPServer(("0.0.0.0", PORT), AIHandler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)

    ip = socket.gethostbyname(socket.gethostname())
    log_server(f"Server running at https://{ip}:{PORT}")
    log_server("Remember: accept the self-signed cert warning on first visit from your phone.")
    server.serve_forever()

if __name__ == "__main__":
    main()