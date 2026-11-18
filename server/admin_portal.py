"""Authenticated score administration. No third-party runtime dependencies."""
import csv
import hashlib
import hmac
import io
import json
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.cookies import SimpleCookie, CookieError
from pathlib import Path
from tempfile import SpooledTemporaryFile
from urllib.parse import parse_qs, urlsplit

COOKIE = '__Host-sentinel_admin'
ASSETS = Path(__file__).with_name('admin')
POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"


def password_config(username, password):
    if not isinstance(username, str) or not 1 <= len(username) <= 64:
        raise ValueError('Invalid administrator username')
    if not isinstance(password, str) or not 16 <= len(password) <= 256:
        raise ValueError('Use a password of 16 to 256 characters')
    salt = secrets.token_bytes(32)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return dict(username=username, salt=salt.hex(), password_hash=digest.hex(), version=1)


class AdminPortal:
    def __init__(self, scores, config_path=None):
        self.scores = scores
        self.config = None
        self.lock = threading.Lock()
        self.password_slots = threading.BoundedSemaphore(2)
        self.sessions = {}
        self.attempts = {}
        if config_path and Path(config_path).is_file():
            self.config = json.loads(Path(config_path).read_text(encoding='utf-8'))
            if (self.config.get('version') != 1 or not isinstance(self.config.get('username'), str)
                    or len(bytes.fromhex(self.config['salt'])) != 32
                    or len(bytes.fromhex(self.config['password_hash'])) != 64):
                raise ValueError('Invalid admin configuration')
            with scores.connect() as db:
                db.execute('''CREATE TABLE IF NOT EXISTS admin_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
                    actor TEXT NOT NULL, action TEXT NOT NULL, affected INTEGER NOT NULL,
                    records TEXT NOT NULL)''')

    def respond(self, h, data, status=200, cookie=None, head=False):
        body = json.dumps(data, ensure_ascii=False).encode()
        h.send_response(status)
        h.send_header('Content-Type', 'application/json; charset=utf-8')
        h.send_header('Cache-Control', 'no-store')
        h.send_header('Content-Security-Policy', POLICY)
        if cookie:
            h.send_header('Set-Cookie', cookie)
        h.send_header('Content-Length', str(len(body)))
        h.end_headers()
        if not head:
            h.wfile.write(body)

    def cookie(self, token='', expire=False):
        return (f'{COOKIE}={token}; Path=/; Secure; HttpOnly; SameSite=Strict; '
                f'Max-Age={0 if expire else 28800}')

    def session(self, h):
        try:
            jar = SimpleCookie()
            jar.load(h.headers.get('Cookie', ''))
            token = jar[COOKIE].value if COOKIE in jar else ''
        except CookieError:
            token = ''
        key = hashlib.sha256(token.encode()).hexdigest()
        now = time.monotonic()
        with self.lock:
            self.sessions = {k: v for k, v in self.sessions.items()
                             if now - v['last'] < 1800 and now - v['created'] < 28800}
            sess = self.sessions.get(key)
            if sess:
                sess['last'] = now
                return key, dict(sess)
        return None, None

    def query(self, h):
        params = parse_qs(urlsplit(h.path).query)
        q = params.get('q', [''])[0].strip()[:100]
        where, args = '', []
        if q:
            # Literal substring search, including names containing SQL LIKE wildcards.
            q = q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            where, args = " WHERE name LIKE ? ESCAPE '\\'", ['%' + q + '%']
        return params, where, args

    def handle_get(self, h, head=False):
        if not self.config:
            return self.respond(h, dict(error='Admin portal is not configured'), 404, head=head)
        path = urlsplit(h.path).path
        assets = {'/admin': ('index.html', 'text/html'), '/admin/': ('index.html', 'text/html'),
                  '/admin/app.js': ('app.js', 'text/javascript'), '/admin/style.css': ('style.css', 'text/css')}
        if path in assets:
            name, mime = assets[path]
            body = (ASSETS/name).read_bytes()
            h.send_response(200)
            h.send_header('Content-Type', mime + '; charset=utf-8')
            h.send_header('Cache-Control', 'no-store')
            h.send_header('Content-Security-Policy', POLICY)
            h.send_header('Content-Length', str(len(body)))
            h.end_headers()
            if not head:
                h.wfile.write(body)
            return
        _, sess = self.session(h)
        if not sess:
            return self.respond(h, dict(error='Please sign in'), 401, head=head)
        if path == '/api/admin/session':
            return self.respond(h, dict(username=self.config['username'], csrf=sess['csrf']), head=head)
        try:
            params, where, args = self.query(h)
            if path == '/api/admin/scores':
                page = max(1, min(1000000, int(params.get('page', ['1'])[0])))
                limit = 50
                with self.scores.connect() as db:
                    total = db.execute('SELECT count(*) FROM scores' + where, args).fetchone()[0]
                    rows = [dict(r) for r in db.execute('SELECT * FROM scores' + where +
                            ' ORDER BY score DESC,at DESC,id LIMIT ? OFFSET ?', args + [limit, (page-1)*limit])]
                    all_total = db.execute('SELECT count(*) FROM scores').fetchone()[0]
                for r in rows:
                    r['details'] = json.loads(r['details'])
                return self.respond(h, dict(scores=rows, total=total, allTotal=all_total, page=page, pageSize=limit), head=head)
            if path == '/api/admin/export':
                fmt = params.get('format', ['csv'])[0]
                if fmt not in ('csv', 'json'):
                    raise ValueError('Invalid export format')
                return self.export(h, fmt, where, args, head)
        except (ValueError, TypeError):
            return self.respond(h, dict(error='Invalid query'), 400, head=head)
        except sqlite3.Error:
            return self.respond(h, dict(error='Score storage unavailable'), 503, head=head)
        return self.respond(h, dict(error='Not found'), 404, head=head)

    def export(self, h, fmt, where, args, head):
        # Spool larger exports to disk rather than accumulating the entire history in RAM.
        with SpooledTemporaryFile(max_size=1024*1024, mode='w+b') as file:
            text = io.TextIOWrapper(file, encoding='utf-8', newline='', write_through=True)
            try:
                writer = csv.writer(text) if fmt == 'csv' else None
                if writer:
                    text.write('\ufeff')  # Excel recognizes UTF-8 names correctly.
                    writer.writerow(['id', 'name', 'score', 'time_utc', 'health', 'business', 'ai', 'agent', 'note'])
                else:
                    text.write('[\n')
                count = 0
                with self.scores.connect() as db:
                    for row in db.execute('SELECT * FROM scores' + where + ' ORDER BY score DESC,at DESC,id', args):
                        r = dict(row)
                        r['details'] = json.loads(r['details'])
                        if writer:
                            dims = r['details'].get('scores', {})
                            values = [r['id'], r['name'], r['score'], datetime.fromtimestamp(r['at']/1000, timezone.utc).isoformat(),
                                      *[dims.get(k, '') for k in ('health', 'business', 'ai', 'agent')], r['note']]
                            # Do not let player-supplied names execute as spreadsheet formulas.
                            writer.writerow(["'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@', '\t', '\r', '\n')) else v for v in values])
                        else:
                            if count:
                                text.write(',\n')
                            text.write(json.dumps(r, ensure_ascii=False))
                        count += 1
                if not writer:
                    text.write('\n]\n')
                text.flush()
                length = file.tell()
                file.seek(0)
                h.send_response(200)
                h.send_header('Content-Type', 'text/csv; charset=utf-8' if writer else 'application/json; charset=utf-8')
                stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
                h.send_header('Content-Disposition', f'attachment; filename="sentinel-scores-{stamp}.{fmt}"')
                h.send_header('Cache-Control', 'no-store')
                h.send_header('Content-Length', str(length))
                h.end_headers()
                if not head:
                    while True:
                        chunk = file.read(65536)
                        if not chunk:
                            break
                        h.wfile.write(chunk)
            finally:
                text.detach()

    def handle_post(self, h):
        if not self.config:
            return self.respond(h, dict(error='Admin portal is not configured'), 404)
        origin = h.headers.get('Origin')
        # All mutations, including login, require an explicit same-origin browser request.
        if origin != 'https://' + h.headers.get('Host', ''):
            return self.respond(h, dict(error='Cross-origin request rejected'), 403)
        if h.headers.get_content_type() != 'application/json' or h.headers.get('Transfer-Encoding'):
            return self.respond(h, dict(error='Expected JSON'), 415)
        path = urlsplit(h.path).path
        key, sess = self.session(h)
        if path != '/api/admin/login':
            if not sess:
                return self.respond(h, dict(error='Please sign in'), 401)
            if not hmac.compare_digest(h.headers.get('X-CSRF-Token', '').encode(), sess['csrf'].encode()):
                return self.respond(h, dict(error='Invalid request token'), 403)
        try:
            size = int(h.headers.get('Content-Length', '0'))
            if not 0 < size <= 32768:
                return self.respond(h, dict(error='Invalid body size'), 413)
            data = json.loads(h.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Expected an object')
            if path == '/api/admin/login':
                return self.login(h, data)
            if path == '/api/admin/logout':
                with self.lock:
                    self.sessions.pop(key, None)
                return self.respond(h, dict(ok=True), cookie=self.cookie(expire=True))
            if path == '/api/admin/delete':
                return self.delete(h, data)
            return self.respond(h, dict(error='Not found'), 404)
        except (ValueError, TypeError, KeyError):
            return self.respond(h, dict(error='Invalid request'), 400)
        except sqlite3.Error:
            return self.respond(h, dict(error='Score storage unavailable; no deletion was committed'), 503)

    def login(self, h, data):
        now, ip = time.monotonic(), h.client_address[0]
        with self.lock:
            self.attempts = {k: v for k, v in self.attempts.items() if now - v[0] < 900}
            attempts = self.attempts.get(ip, [now, 0])
            if attempts[1] >= 8 or sum(v[1] for v in self.attempts.values()) >= 100:
                return self.respond(h, dict(error='Too many login attempts. Try again in 15 minutes.'), 429)
            if ip not in self.attempts and len(self.attempts) >= 1024:
                return self.respond(h, dict(error='Login is temporarily busy'), 429)
            self.attempts[ip] = [attempts[0], attempts[1]+1]
        username, password = data.get('username'), data.get('password')
        if not isinstance(username, str) or not isinstance(password, str) or len(password) > 256:
            raise ValueError('Invalid credentials')
        if not self.password_slots.acquire(blocking=False):
            return self.respond(h, dict(error='Login is temporarily busy'), 429)
        try:
            digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(self.config['salt']), n=16384, r=8, p=1).hex()
        finally:
            self.password_slots.release()
        if not (hmac.compare_digest(username.encode(), self.config['username'].encode())
                & hmac.compare_digest(digest, self.config['password_hash'])):
            return self.respond(h, dict(error='Incorrect username or password'), 401)
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        # Prune expired sessions before adding another; keep the cache bounded.
        self.session(h)
        with self.lock:
            if len(self.sessions) >= 256:
                return self.respond(h, dict(error='Too many active administrator sessions'), 429)
            old_key = hashlib.sha256(token.encode()).hexdigest()
            self.sessions[old_key] = dict(csrf=csrf, created=now, last=now)
            self.attempts.pop(ip, None)
        return self.respond(h, dict(username=self.config['username'], csrf=csrf), cookie=self.cookie(token))

    def delete(self, h, data):
        ids, all_rows = data.get('ids', []), data.get('all') is True
        if all_rows:
            if data.get('confirmation') != 'DELETE ALL':
                raise ValueError('Explicit confirmation is required')
        elif (not isinstance(ids, list) or not 1 <= len(ids) <= 200
              or not all(isinstance(x, str) and 1 <= len(x) <= 96 for x in ids)):
            raise ValueError('Select between 1 and 200 records')
        where = '' if all_rows else ' WHERE id IN (' + ','.join('?' for _ in ids) + ')'
        with self.scores.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            # Record the original rows and delete within the same transaction for recovery.
            # Store large clears in batches to keep memory bounded.
            count, batch = 0, []
            for row in db.execute('SELECT * FROM scores' + where, [] if all_rows else ids):
                batch.append(dict(row))
                count += 1
                if len(batch) == 200:
                    self.audit_batch(db, batch, all_rows)
                    batch = []
            if batch:
                self.audit_batch(db, batch, all_rows)
            db.execute('DELETE FROM scores' + where, [] if all_rows else ids)
        return self.respond(h, dict(deleted=count))

    def audit_batch(self, db, rows, all_rows):
        db.execute('INSERT INTO admin_audit(at,actor,action,affected,records) VALUES (?,?,?,?,?)',
                   (int(time.time()*1000), self.config['username'], 'clear' if all_rows else 'delete',
                    len(rows), json.dumps(rows, ensure_ascii=False)))
