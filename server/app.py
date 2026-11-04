"""Dependency-free intranet HTTPS host and durable Last Stand leaderboard."""
import argparse
from contextlib import contextmanager
import functools
import json
import math
import re
import sqlite3
import ssl
import time
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs


class Scores:
    def __init__(self, path):
        self.path = str(path)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('''CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, score INTEGER NOT NULL,
                at INTEGER NOT NULL, note TEXT NOT NULL, details TEXT NOT NULL)''')
            db.execute('CREATE INDEX IF NOT EXISTS ranking ON scores(score DESC, at DESC)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            db.execute('PRAGMA synchronous=FULL')
            with db:
                yield db
        finally:
            db.close()

    def top(self, n=50):
        with self.connect() as db:
            return [dict(r) for r in db.execute(
                'SELECT id,name,score,at,note FROM scores ORDER BY score DESC,at DESC,id LIMIT ?', (n,))]

    def submit(self, data):
        if not isinstance(data, dict):
            raise ValueError('Expected an object')
        ident = data.get('id', '')
        if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,96}', ident):
            raise ValueError('Invalid attempt ID')
        name = data.get('name', '')
        if not isinstance(name, str):
            raise ValueError('Invalid name')
        name = re.sub(r'[\x00-\x1f<>]', '', name).strip()[:14] or 'Anonymous'
        details = data.get('details', {})
        if not isinstance(details, dict) or details.get('outcome') != 'victory':
            raise ValueError('Only completed victories can be ranked')
        if details.get('bossesKilled') != 3 or details.get('elapsed') != 120:
            raise ValueError('Campaign must complete all three bosses and 120 seconds')
        dimensions = details.get('scores', {})
        if not isinstance(dimensions, dict):
            raise ValueError('Invalid score dimensions')
        values = []
        for key in ('health', 'business', 'ai', 'agent'):
            value = dimensions.get(key)
            if type(value) is not int or not 0 <= value <= 10000:
                raise ValueError('Invalid score dimension: ' + key)
            values.append(value)
        if values[0] <= 0:
            raise ValueError('A victory must retain base integrity')
        total = math.floor(sum(v * w for v, w in zip(values, (.55, .25, .12, .08))))
        if type(data.get('score')) is not int or data['score'] != total:
            raise ValueError('Score does not match dimensions')
        # Store only bounded, relevant metadata. Client timestamps are never trusted.
        canonical = json.dumps(dict(outcome='victory', bossesKilled=3, elapsed=120,
                                    scores=dict(zip(('health','business','ai','agent'), values))), sort_keys=True)
        note = 'Enterprise / 10000 | 3/3 bosses | 120s'
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT name,score,details FROM scores WHERE id=?', (ident,)).fetchone()
            if old and (old['name'], old['score'], old['details']) != (name, total, canonical):
                raise FileExistsError('Attempt ID already has a different result')
            db.execute('INSERT OR IGNORE INTO scores VALUES (?,?,?,?,?,?)',
                       (ident, name, total, int(time.time() * 1000), note, canonical))
            rank = 1 + db.execute('SELECT COUNT(*) FROM scores WHERE score>?', (total,)).fetchone()[0]
        return dict(id=ident, rank=rank, saved=True, scores=self.top())


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript',
                      '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp'}

    def setup(self):
        self.request.settimeout(15)
        if getattr(self.server, 'tls_context', None):
            self.request = self.server.tls_context.wrap_socket(self.request, server_side=True)
        super().setup()
        self.connection.settimeout(15)

    def end_headers(self):
        if getattr(self, '_static', False):
            self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        super().end_headers()

    def json(self, data, status=200, head=False):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        path = urlsplit(self.path).path
        if path == '/api/health':
            self.server.scores.top(1)  # Check database readability as well as process health.
            return self.json(dict(ok=True, storage='sqlite', version=self.server.version), head=head)
        if path == '/api/stand/top':
            try:
                n = max(1, min(50, int(parse_qs(urlsplit(self.path).query).get('n', ['50'])[0])))
            except ValueError:
                return self.json(dict(error='Invalid limit'), 400, head)
            return self.json(dict(scores=self.server.scores.top(n)), head=head)
        if path.startswith('/api/'):
            return self.json(dict(error='Not found'), 404, head)
        if path == '/deployment-config.js':
            body = b"window.__STAND_ENTERPRISE_API='/api/stand';window.__STAND_SERVER_REQUIRED=true;\n"
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/stand.html')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        decoded = unquote(path)
        parts = Path(decoded.lstrip('/')).parts
        root = Path(self.directory).resolve()
        target = (root / decoded.lstrip('/')).resolve()
        # Only game files are public, even if an operator copies additional files into a release.
        if (any(p.startswith('.') for p in parts) or not target.is_relative_to(root)
                or not parts or (parts[0] not in ('src', 'assets', 'vendor') and len(parts) != 1)
                or (len(parts) == 1 and target.suffix not in ('.html', '.js', '.css', '.ico', '.png', '.svg'))
                or not target.is_file()):
            return self.send_error(404)
        if head:
            return super().do_HEAD()
        return super().do_GET()

    def send_head(self):
        # Revalidate releases rather than keeping stale modules after deployment.
        self._static = True
        return super().send_head()

    def do_POST(self):
        if urlsplit(self.path).path != '/api/stand/submit':
            return self.json(dict(error='Not found'), 404)
        if self.headers.get('Origin') not in (None, 'https://' + self.headers.get('Host', '')):
            return self.json(dict(error='Cross-origin submission rejected'), 403)
        if self.headers.get_content_type() != 'application/json' or self.headers.get('Transfer-Encoding'):
            return self.json(dict(error='Expected JSON with Content-Length'), 415)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                return self.json(dict(error='Invalid body size'), 413)
            data = json.loads(self.rfile.read(size), parse_constant=lambda _: None)
            return self.json(self.server.scores.submit(data))
        except (ValueError, TypeError, UnicodeError):
            return self.json(dict(error='Invalid completed campaign'), 400)
        except FileExistsError as error:
            return self.json(dict(error=str(error)), 409)
        except sqlite3.Error:
            self.log_error('Score database unavailable')
            return self.json(dict(error='Storage unavailable; retry this attempt'), 503)


class BoundedServer(ThreadingHTTPServer):
    # Bound simultaneous downloads and TLS handshakes; slow clients cannot grow threads forever.
    def __init__(self, *args):
        self.slots = threading.BoundedSemaphore(64)
        super().__init__(*args)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


def make_server(host, port, root, db, version='development'):
    server = BoundedServer((host, port), functools.partial(Handler, directory=str(root)))
    server.scores = Scores(db)
    server.version = version
    return server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--db', required=True)
    parser.add_argument('--cert', required=True)
    parser.add_argument('--key', required=True)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=443)
    parser.add_argument('--version', default='intranet-v1')
    args = parser.parse_args()
    server = make_server(args.host, args.port, args.root, args.db, args.version)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(args.cert, args.key)
    server.tls_context = context
    server.serve_forever()


if __name__ == '__main__':
    main()
