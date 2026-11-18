from contextlib import closing
import csv
import hashlib
import http.client
import io
import json
import sqlite3
import tempfile
import threading
import time
import unittest
from pathlib import Path
from app import make_server
from admin_portal import password_config

PASSWORD = 'test-only-password-5Km3!'


def score(ident, name='Player'):
    return dict(id='admin-test-'+str(ident), name=name, score=8000,
                details=dict(outcome='victory', elapsed=120, bossesKilled=3,
                             scores=dict(health=8000, business=8000, ai=8000, agent=8000)))


class AdminTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = self.root/'admin.json'
        self.config.write_text(json.dumps(password_config('gameadmin', PASSWORD)))
        self.db = self.root/'scores.sqlite3'
        self.server = make_server('127.0.0.1', 0, self.root, self.db, admin_config=self.config, mode='admin')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.cookie, self.csrf = '', ''

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, origin='https://admin.example:8443', csrf=True, cookie=True):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        headers = {'Host':'admin.example:8443', 'Content-Type':'application/json'}
        if origin is not None:
            headers['Origin'] = origin
        if cookie and self.cookie:
            headers['Cookie'] = self.cookie
        if csrf:
            headers['X-CSRF-Token'] = self.csrf
        conn.request(method, path, json.dumps(body) if body is not None else None, headers)
        r = conn.getresponse()
        result = r.status, r.read(), dict(r.getheaders())
        conn.close()
        return result

    def login(self):
        status, body, headers = self.request('POST', '/api/admin/login', dict(username='gameadmin', password=PASSWORD))
        self.assertEqual(status, 200)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        self.csrf = json.loads(body)['csrf']
        for flag in ('Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'):
            self.assertIn(flag, headers['Set-Cookie'])

    def test_authentication_and_boundaries(self):
        for path in ('/api/admin/scores', '/api/admin/export?format=csv', '/api/admin/session'):
            self.assertEqual(self.request('GET', path)[0], 401)
        self.assertEqual(self.request('POST','/api/admin/login',dict(username='gameadmin',password='wrong'))[0],401)
        self.login()
        self.assertEqual(self.request('GET','/api/admin/session')[0],200)
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':['admin-test-1']},csrf=False)[0],403)
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':['admin-test-1']},origin='https://evil.example')[0],403)
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':['admin-test-1']},origin=None)[0],403)
        self.assertEqual(self.request('POST','/api/admin/logout',{})[0],200)
        self.assertEqual(self.request('GET','/api/admin/scores')[0],401)

    def test_login_throttle_and_session_expiry(self):
        for _ in range(8):
            self.assertEqual(self.request('POST','/api/admin/login',dict(username='wrong',password='wrong'))[0],401)
        self.assertEqual(self.request('POST','/api/admin/login',dict(username='gameadmin',password=PASSWORD))[0],429)
        self.server.admin.attempts.clear()
        self.login()
        for sess in self.server.admin.sessions.values():
            sess['last'] = time.monotonic()-1801
        self.assertEqual(self.request('GET','/api/admin/session')[0],401)

    def test_search_pagination_and_all_page_export(self):
        for i in range(55):
            self.server.scores.submit(score(i, 'Alice' if i < 53 else '=1+2'))
        self.login()
        data = json.loads(self.request('GET','/api/admin/scores')[1])
        self.assertEqual(data['total'],55)
        self.assertEqual(len(data['scores']),50)
        self.assertEqual(len(json.loads(self.request('GET','/api/admin/scores?page=2')[1])['scores']),5)
        self.assertEqual(json.loads(self.request('GET','/api/admin/scores?q=Alice')[1])['total'],53)
        self.assertEqual(json.loads(self.request('GET','/api/admin/scores?q=%25')[1])['total'],0)
        status, body, headers = self.request('GET','/api/admin/export?format=csv')
        self.assertEqual(status,200)
        rows = list(csv.reader(io.StringIO(body.decode('utf-8-sig'))))
        self.assertEqual(len(rows),56)
        self.assertTrue(any(row[1]=="'=1+2" for row in rows[1:]))
        self.assertEqual(len(json.loads(self.request('GET','/api/admin/export?format=json')[1])),55)
        self.assertEqual(len(json.loads(self.request('GET','/api/admin/export?format=json&q=Alice')[1])),53)
        self.assertIn('attachment;',headers['Content-Disposition'])
        self.assertEqual(self.request('GET','/api/admin/export?format=html')[0],400)

    def test_delete_and_clear_are_audited(self):
        for i in range(3):
            self.server.scores.submit(score(i))
        self.login()
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':[]})[0],400)
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':['admin-test-0', 'admin-test-1']})[0],200)
        self.assertEqual(len(self.server.scores.top()),1)
        self.assertEqual(self.request('POST','/api/admin/delete',{'all':True})[0],400)
        self.assertEqual(self.request('POST','/api/admin/delete',{'all':True,'confirmation':'DELETE ALL'})[0],200)
        self.assertEqual(self.server.scores.top(),[])
        with closing(sqlite3.connect(self.db)) as db:
            audits=db.execute('SELECT action,affected,records FROM admin_audit ORDER BY id').fetchall()
        self.assertEqual([(x[0],x[1]) for x in audits],[('delete',2),('clear',1)])
        self.assertEqual(json.loads(audits[0][2])[0]['name'],'Player')

    def test_failed_audit_rolls_back_deletion(self):
        self.server.scores.submit(score(1))
        with self.server.scores.connect() as db:
            db.execute("CREATE TRIGGER audit_fail BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'fixture'); END")
        self.login()
        self.assertEqual(self.request('POST','/api/admin/delete',{'ids':['admin-test-1']})[0],503)
        self.assertEqual(len(self.server.scores.top()),1)

    def test_assets_and_disabled_portal(self):
        for path in ('/admin','/admin/','/admin/app.js','/admin/style.css'):
            status,body,headers=self.request('GET',path)
            self.assertEqual(status,200)
            self.assertEqual(headers['Cache-Control'],'no-store')
            self.assertIn("frame-ancestors 'none'",headers['Content-Security-Policy'])
        self.assertEqual(self.request('HEAD','/admin/')[1],b'')
        self.assertEqual(self.request('GET','/admin/../admin_portal.py')[0],401)
        self.assertNotIn(PASSWORD,self.config.read_text())
        self.server.admin.config=None
        self.assertEqual(self.request('GET','/admin/')[0],404)
        self.assertEqual(self.request('POST','/api/admin/login',{})[0],404)

    def test_listener_separation(self):
        self.assertEqual(self.request('GET','/')[2]['Location'],'/admin/')
        self.assertEqual(self.request('GET','/api/stand/top')[0],404)
        self.assertEqual(self.request('POST','/api/stand/submit',score(1))[0],404)
        self.server.mode='game'
        for path in ('/admin', '/admin/', '/admin/app.js', '/api/admin/scores', '/api/admin/export'):
            self.assertEqual(self.request('GET',path)[0],404)
        self.assertEqual(self.request('POST','/api/admin/login',dict(username='gameadmin',password=PASSWORD))[0],404)
        self.assertEqual(self.request('GET','/api/stand/top')[0],200)

    def test_source_allowlist_rejects_before_http(self):
        self.server.admin_peer_allowed=lambda peer: False
        with self.assertRaises((http.client.RemoteDisconnected, ConnectionResetError)):
            self.request('GET','/admin/')
        # The same source restriction does not affect the public game listener.
        self.server.mode='game'
        self.assertEqual(self.request('GET','/api/health')[0],200)


if __name__ == '__main__':
    unittest.main()
