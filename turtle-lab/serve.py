"""Loopback-only static server for Turtle Lab. No writes, directory listing, or symlinks."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent / 'dist'
PUBLIC_FILES = {
    'index.html': 'text/html; charset=utf-8',
    'style.css': 'text/css; charset=utf-8',
    'app.mjs': 'text/javascript; charset=utf-8',
    'edge.mjs': 'text/javascript; charset=utf-8',
    'core.mjs': 'text/javascript; charset=utf-8',
    'worker.mjs': 'text/javascript; charset=utf-8',
    'setup.mjs': 'text/javascript; charset=utf-8',
    'favicon.svg': 'image/svg+xml',
}
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'; img-src 'self' data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'"

class AppHandler(BaseHTTPRequestHandler):
    server_version = 'TurtleLab'
    sys_version = ''

    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        self.serve_asset(head=False)

    def do_HEAD(self):
        self.serve_asset(head=True)

    def serve_asset(self, head):
        hosts = self.headers.get_all('Host', [])
        port = self.server.server_port
        allowed_hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        if port == 80:
            allowed_hosts.update({'127.0.0.1', 'localhost'})
        if len(hosts) != 1 or hosts[0].lower() not in allowed_hosts:
            self.send_error(403, 'Host not allowed')
            return
        try:
            url = urlsplit(self.path)
            route = unquote(url.path, errors='strict')
        except (ValueError, UnicodeError):
            self.send_error(400, 'Invalid path')
            return
        if url.scheme or url.netloc:
            self.send_error(400, 'Invalid path')
            return
        name = 'index.html' if route == '/' else route.removeprefix('/')
        if name not in PUBLIC_FILES:
            self.send_error(404, 'Not found')
            return
        source = ROOT / name
        if source.is_symlink() or not source.is_file() or source.resolve().parent != ROOT.resolve():
            self.send_error(404, 'Not found')
            return
        try:
            content = source.read_bytes()
        except OSError:
            self.send_error(404, 'Not found')
            return
        self.send_response(200)
        self.send_header('Content-Type', PUBLIC_FILES[name])
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        if not head:
            self.wfile.write(content)

    def log_message(self, format, *args):
        # Avoid logging untrusted request strings or user filesystem paths.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be from 1 to 65535')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), AppHandler)
    except OSError as error:
        parser.exit(1, f'Could not start Turtle Lab: {error}. Try --port 4174.\n')
    print(f'Turtle Lab: http://127.0.0.1:{args.port}\nPress Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
