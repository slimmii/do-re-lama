#!/usr/bin/env python3
"""Start Do Re Lama op http://localhost:8770 (de microfoon werkt enkel via http://localhost of https)."""
import http.server, os, sys, webbrowser

PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8770)
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2'}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    url = f'http://localhost:{PORT}/'
    print(f'Do Re Lama draait op {url}  (stoppen: Ctrl+C)')
    if '--no-browser' not in sys.argv:
        webbrowser.open(url)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
