"""Servidor local para el proyecto (fija los tipos MIME que Windows suele dar mal)."""
import http.server
import mimetypes
import os

PORT = 8000
TYPES = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".task": "application/octet-stream",
    ".fbx": "application/octet-stream",
}
for ext, mime in TYPES.items():
    mimetypes.add_type(mime, ext)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # siempre la versión más reciente
        super().end_headers()


os.chdir(os.path.dirname(os.path.abspath(__file__)))
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as server:
    print(f"Servidor local: http://localhost:{PORT}  (Ctrl+C para detener)")
    server.serve_forever()
