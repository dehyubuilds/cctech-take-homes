"""
Local server for testing without deploying Lambda.
Run from project root: python backend/server_local.py
Then open frontend/index.html and use ?api=http://localhost:8000
"""
import json
import os
import sys

# Project root = parent of backend
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)

# Load .env from project root
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
except ImportError:
    pass

# Backend dir on path so "from app import ..." and services work
BACKEND = os.path.dirname(os.path.abspath(__file__))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from flask import Flask, request, jsonify
from app import handler

app = Flask(__name__)

def _api_gateway_event(method: str, path: str, body: str | None = None) -> dict:
    return {
        "requestContext": {"http": {"method": method, "path": path}},
        "rawPath": path,
        "body": body,
    }

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "March Madness V1 API",
        "message": "Open the admin frontend with ?api=http://localhost:8000",
        "endpoints": ["/health", "/allowed-numbers", "/today-picks", "POST /run-daily-picks", "POST /send-test", "POST /send-sample"],
    }), 200

@app.route("/health", methods=["GET"])
@app.route("/allowed-numbers", methods=["GET"])
@app.route("/today-picks", methods=["GET"])
def get_routes():
    path = request.path
    event = _api_gateway_event(request.method, path)
    result = handler(event, None)
    status = result.get("statusCode", 200)
    body = result.get("body", "{}")
    return jsonify(json.loads(body)), status

@app.route("/run-daily-picks", methods=["POST"])
@app.route("/send-test", methods=["POST"])
@app.route("/send-sample", methods=["POST"])
def post_routes():
    path = request.path
    body = request.get_data(as_text=True) or None
    event = _api_gateway_event(request.method, path, body)
    result = handler(event, None)
    status = result.get("statusCode", 200)
    res_body = result.get("body", "{}")
    return jsonify(json.loads(res_body)), status

@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return resp

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        from flask import make_response
        r = make_response("", 204)
        r.headers["Access-Control-Allow-Origin"] = "*"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return r

if __name__ == "__main__":
    print("March Madness V1 local API: http://localhost:8000")
    print("Frontend: open frontend/index.html?api=http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
