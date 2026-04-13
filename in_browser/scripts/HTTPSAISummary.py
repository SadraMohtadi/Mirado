#Copyright 2026 Sadra Mohtadi
#
#Licensed under the Apache License, Version 2.0
#http://www.apache.org/licenses/LICENSE-2.0

# HTTPS VERSION!
# This is a demo server-side code.
# It automatically downloads everything it needs.
# It also has a built in query system so you're welcome :)

import json
import os
import urllib.request
import subprocess
import socket
import time
import sys
import platform
from http.server import BaseHTTPRequestHandler, HTTPServer

# The model to use and the port the server listens on
MODEL = "gemma3:4b"
PORT = 8000

# Hardcoded rules prompt (DO NOT TOUCH)
# This tells the model exactly how to format its JSON response
PROMPT_RULES = """
Return ONLY valid JSON. No explanations.

Rules:

Required fields (must always be present):

summary (string)

category (string)

used_for (string)

pros (array of short strings, 1–5 words)

cons (array of short strings, 1–5 words)

Optional additional fields:

Add exactly enough extra fields so the total number of top-level fields is 7, 9, or 11.

Each additional field must follow:

"field_name": { "value": "Short Value", "icon": "fa-icon-name" }

value: under 3 words

icon: free Font Awesome icon name (omit fa-)

Constraints:

NO PRICE FIELDS

Field names under 3 words

All fields are top-level

JSON must be parsable by JavaScript

No extra explanations, comments, or unknown values

Output example (do not copy values):

{
  "summary": "Product Name",
  "category": "Category",
  "used_for": "Usage",
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "field1": { "value": "Short Value", "icon": "fa-icon-name" },
  "field2": { "value": "Short Value", "icon": "fa-icon-name" }
  (and other fields if necessary)
}
"""

# Logging helpers — just prefixes log lines with [SERVER] or the client's IP
def log_server(msg):
    print(f"[SERVER] {msg}")

def log_client(ip, msg):
    print(f"[{ip}] {msg}")


# Shows the user what's missing and how big it is, then asks if they want to install it
# Returns True if they say yes, False if they say no
def ask_permission(name, description, estimated_size):
    print()
    print("=" * 60)
    print(f"  MISSING DEPENDENCY: {name}")
    print("=" * 60)
    print(f"  Description : {description}")
    print(f"  Est. size   : {estimated_size}")
    print("=" * 60)
    while True:
        answer = input(f"  Install {name} now? [y/N]: ").strip().lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("", "n", "no"):
            return False
        print("  Please enter 'y' or 'n'.")


# Runs the official Ollama install script on Linux/macOS
# Windows users have to install manually since there's no scripted installer
def install_ollama():
    system = platform.system()
    if system == "Linux" or system == "Darwin":
        log_server("Running Ollama install script…")
        result = subprocess.run(
            "curl -fsSL https://ollama.com/install.sh | sh",
            shell=True
        )
        if result.returncode != 0:
            log_server("ERROR: Ollama installation failed. Visit https://ollama.com/download")
            sys.exit(1)
    elif system == "Windows":
        log_server(
            "Automatic installation is not supported on Windows.\n"
            "Please download the installer from https://ollama.com/download and re-run this script."
        )
        sys.exit(1)
    else:
        log_server(f"Unknown OS '{system}'. Please install Ollama manually: https://ollama.com/download")
        sys.exit(1)


# Installs a Python package using pip
def install_python_package(package, pip_name=None):
    pip_name = pip_name or package
    log_server(f"Installing Python package '{pip_name}'…")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", pip_name],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        log_server(f"ERROR: Failed to install '{pip_name}'.\n{result.stderr}")
        sys.exit(1)
    log_server(f"'{pip_name}' installed successfully.")


# Installs a system package using apt (Linux) or brew (macOS)
def install_system_package(package, estimated_size):
    system = platform.system()
    if system == "Linux":
        manager = "apt-get"
        cmd = ["sudo", "apt-get", "install", "-y", package]
    elif system == "Darwin":
        manager = "brew"
        cmd = ["brew", "install", package]
    else:
        log_server(f"Cannot auto-install system packages on {system}. Install '{package}' manually.")
        sys.exit(1)

    log_server(f"Installing '{package}' via {manager}…")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        log_server(f"ERROR: Failed to install '{package}'.")
        sys.exit(1)
    log_server(f"'{package}' installed successfully.")


# Add extra Python packages here if needed: (import_name, pip_name, description, estimated_size)
OPTIONAL_PYTHON_DEPS = [
]

# Loops through OPTIONAL_PYTHON_DEPS and offers to install anything that's missing
def check_python_dependencies():
    import importlib
    for import_name, pip_name, description, size in OPTIONAL_PYTHON_DEPS:
        try:
            importlib.import_module(import_name)
            log_server(f"Python package '{pip_name}' detected.")
        except ImportError:
            if ask_permission(pip_name, description, size):
                install_python_package(import_name, pip_name)
            else:
                log_server(f"ERROR: '{pip_name}' is required. Exiting.")
                sys.exit(1)


# Makes sure curl is available — it's needed to download the Ollama installer
def check_curl():
    if platform.system() == "Windows":
        return  # Not needed on Windows
    try:
        subprocess.run(["curl", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log_server("curl detected.")
    except FileNotFoundError:
        if ask_permission("curl", "Command-line tool used to download the Ollama installer", "~500 KB"):
            install_system_package("curl", "~500 KB")
        else:
            log_server("ERROR: curl is required to install Ollama. Exiting.")
            sys.exit(1)


# Checks if Ollama is installed, and offers to install it if not
def ensure_ollama():
    try:
        subprocess.run(
            ["ollama", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        log_server("Ollama detected.")
    except (FileNotFoundError, subprocess.CalledProcessError):
        if ask_permission(
            "Ollama",
            "Local LLM runtime used to run AI models on your machine",
            "~500 MB  (+ ~2.5 GB for the default model)"
        ):
            check_curl()  # curl is needed by the install script
            install_ollama()
            try:
                subprocess.run(["ollama", "--version"], stdout=subprocess.DEVNULL, check=True)
                log_server("Ollama installed successfully.")
            except Exception:
                log_server("ERROR: Ollama installation could not be verified. Exiting.")
                sys.exit(1)
        else:
            log_server("ERROR: Ollama is required to run this server. Exiting.")
            sys.exit(1)


# Starts the Ollama background process if it isn't already running
# Waits up to 30 seconds for it to be ready
def ensure_ollama_running():
    try:
        urllib.request.urlopen("http://localhost:11434", timeout=1)
        log_server("Ollama already running.")
    except Exception:
        log_server("Starting Ollama serve…")
        subprocess.Popen(
            ["ollama", "serve"],
            env={**os.environ, "OLLAMA_MAX_LOADED_MODELS": "1"}
        )
        for _ in range(30):
            try:
                urllib.request.urlopen("http://localhost:11434", timeout=1)
                log_server("Ollama started.")
                return
            except Exception:
                time.sleep(1)
        log_server("ERROR: Ollama failed to start.")
        sys.exit(1)


# Checks if the required model is downloaded, and offers to pull it if not
def ensure_model():
    result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
    if MODEL not in result.stdout:
        if ask_permission(f"Model: {MODEL}", "The AI model this server uses to generate responses", "~2.5 GB"):
            log_server(f"Pulling model '{MODEL}'…")
            pull_result = subprocess.run(["ollama", "pull", MODEL])
            if pull_result.returncode != 0:
                log_server(f"ERROR: Failed to pull model '{MODEL}'. Exiting.")
                sys.exit(1)
            log_server(f"Model '{MODEL}' pulled successfully.")
        else:
            log_server(f"ERROR: Model '{MODEL}' is required. Exiting.")
            sys.exit(1)
    log_server(f"Model '{MODEL}' ready.")


# Combines the user's product text with PROMPT_RULES into a single prompt string
def build_prompt(product_text):
    return f'''Return ONLY valid JSON. No explanations.

Input:
"{product_text}"

{PROMPT_RULES}
'''


# Handles incoming HTTP requests
class AIHandler(BaseHTTPRequestHandler):

    # Suppress the default request logging (we do our own)
    def log_message(self, format, *args):
        return

    # Attach CORS headers so browsers can call this from any origin
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # Respond to CORS preflight requests sent by browsers before a POST
    def do_OPTIONS(self):
        ip = self.client_address[0]
        log_client(ip, "CORS preflight")
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    # Handle POST /prompt — parse input, call the model, return the result
    def do_POST(self):
        ip = self.client_address[0]
        if self.path != "/prompt":
            self.send_response(404)
            self.end_headers()
            return

        # Read and parse the request body
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
            product_text = data.get("input")
            if not product_text:
                raise ValueError("No 'input' field provided")
        except Exception as e:
            log_client(ip, f"Invalid request: {e}")
            self.send_response(400)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        log_client(ip, f"Product input received: {product_text[:100]} chars")

        # Build the prompt and send it to Ollama
        final_prompt = build_prompt(product_text)
        log_client(ip, f"Final prompt length: {len(final_prompt)} chars")

        payload = json.dumps({
            "model": MODEL,
            "prompt": final_prompt,
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

        # Send the model's response back to the client
        self.send_response(200)
        self.send_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())


def main():
    log_server("Starting server…")

    # Check all dependencies before starting, installing any that are missing
    check_python_dependencies()
    ensure_ollama()
    ensure_ollama_running()
    ensure_model()

    server = HTTPServer(("0.0.0.0", PORT), AIHandler)
    ip = socket.gethostbyname(socket.gethostname())
    log_server(f"Server running at http://{ip}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()