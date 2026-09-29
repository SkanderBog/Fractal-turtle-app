"""Portable desktop launcher. Opens Turtle Lab in the default browser."""
import argparse
import errno
import threading
import webbrowser
from http.server import ThreadingHTTPServer

from serve import AppHandler


def create_server(port=None):
    """Prefer a stable browser-storage origin, falling back only if occupied."""
    try:
        return ThreadingHTTPServer(('127.0.0.1', 4173 if port is None else port), AppHandler)
    except OSError as error:
        if port is not None or error.errno not in (errno.EADDRINUSE, 10048):
            raise
        return ThreadingHTTPServer(('127.0.0.1', 0), AppHandler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Local port (0 chooses an available port)')
    parser.add_argument('--no-browser', action='store_true', help='Print the URL without opening a browser')
    args = parser.parse_args()
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error('port must be from 0 to 65535')
    try:
        server = create_server(args.port)
    except OSError as error:
        parser.exit(1, f'Could not start Turtle Lab: {error}. Try --port 0.\n')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Turtle Lab: {url}\nKeep this window open. Press Ctrl+C to stop.', flush=True)
    if server.server_port != 4173:
        print('Using a different port. Saved setups belong to each browser and port; import JSON to transfer them.', flush=True)

    def open_browser():
        try:
            if not webbrowser.open(url):
                print('Open the printed URL in your browser.', flush=True)
        except Exception:
            print('Open the printed URL in your browser.', flush=True)

    if not args.no_browser:
        timer = threading.Timer(0.3, open_browser)
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
