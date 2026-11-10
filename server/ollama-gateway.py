#!/usr/bin/env python3
"""Token-gated reverse proxy: public :8787 -> local Ollama :11434."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_HOST = os.environ.get("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8787"))
UPSTREAM = os.environ.get("OLLAMA_UPSTREAM", "http://127.0.0.1:11434").rstrip("/")
TOKEN = os.environ.get("OLLAMA_API_TOKEN", "").strip()
ALLOWED = {"/api/tags", "/api/chat"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def _unauthorized(self) -> None:
        self.send_response(401)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"error":"unauthorized"}')

    def _forbidden_path(self) -> None:
        self.send_response(404)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"error":"not found"}')

    def _authorized(self) -> bool:
        if not TOKEN:
            return False
        got = self.headers.get("Authorization", "")
        return got == f"Bearer {TOKEN}" or self.headers.get("X-Ollama-Token", "") == TOKEN

    def _proxy(self) -> None:
        if not self._authorized():
            self._unauthorized()
            return
        path = self.path.split("?", 1)[0]
        if path not in ALLOWED:
            self._forbidden_path()
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length > 0 else None
        req = urllib.request.Request(
            f"{UPSTREAM}{path}",
            data=body,
            method=self.command,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                self.send_header("content-type", resp.headers.get("Content-Type", "application/json"))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as err:
            payload = err.read()
            self.send_response(err.code)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(payload)
        except Exception as err:
            self.send_response(502)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode("utf-8"))

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("OLLAMA_API_TOKEN is required")
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.serve_forever()
