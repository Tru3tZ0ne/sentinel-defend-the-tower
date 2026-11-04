import concurrent.futures
from contextlib import closing
import http.client
import json
import shutil
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path

from app import Scores, make_server
from backup import backup


def attempt(ident='test-attempt-0001', health=8000):
    dims = dict(health=health, business=6000, ai=3000, agent=2000)
    return dict(id=ident, name='Test Player', score=int(health*.55+6000*.25+3000*.12+2000*.08),
                details=dict(outcome='victory', elapsed=120, bossesKilled=3, scores=dims))


class Integration(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root/'stand.html').write_text('<h1>Sentinel</h1>')
        (self.root/'server').mkdir()
        (self.root/'server'/'secret.js').write_text('private')
        self.db = self.root/'scores.sqlite3'
        self.start()

    def start(self):
        self.server = make_server('127.0.0.1', 0, self.root, self.db)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        data = json.dumps(body) if body is not None else None
        conn.request(method, path, data, headers or {'Content-Type':'application/json'})
        res = conn.getresponse()
        result = res.status, res.read(), dict(res.getheaders())
        conn.close()
        return result

    def test_persistence_clients_idempotency_and_conflict(self):
        payload = attempt()
        self.assertEqual(self.request('POST','/api/stand/submit',payload)[0],200)
        self.assertEqual(self.request('POST','/api/stand/submit',payload)[0],200)
        self.assertEqual(len(json.loads(self.request('GET','/api/stand/top')[1])['scores']),1)
        self.stop()
        self.start()
        self.assertEqual(json.loads(self.request('GET','/api/stand/top')[1])['scores'][0]['score'],6420)
        self.assertEqual(self.request('POST','/api/stand/submit',attempt(health=7000))[0],409)

    def test_validation(self):
        cases=[]
        for field,value in [('elapsed',119),('bossesKilled',2),('outcome','defeat'),('scores',[]),('scores',{'health':float('nan')})]:
            row=attempt();row['details'][field]=value;cases.append(row)
        for value in [True,10001,-1,1.5]:
            row=attempt();row['details']['scores']['ai']=value;cases.append(row)
        row=attempt();row['score']=9999;cases.append(row)
        row=attempt();row['details']['scores']['health']=0;cases.append(row)
        cases.extend([[],{'id':'../escape'}])
        for row in cases:
            with self.subTest(row=row):
                self.assertEqual(self.request('POST','/api/stand/submit',row)[0],400)
        self.assertEqual(self.request('POST','/api/stand/submit',attempt(), {'Content-Type':'application/json','Origin':'https://other.example'})[0],403)
        self.assertEqual(self.request('POST','/api/stand/submit',attempt(), {'Content-Type':'text/plain'})[0],415)

    def test_history_rank_and_concurrent_retry(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results=list(pool.map(lambda _:self.server.scores.submit(attempt()), range(12)))
        self.assertTrue(all(r['saved'] for r in results))
        for i in range(65):
            self.server.scores.submit(attempt('history-attempt-%03d'%i,5000))
        self.assertEqual(len(self.server.scores.top()),50)
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM scores').fetchone()[0],66)
        self.assertEqual(self.server.scores.submit(attempt('lower-score-attempt',4000))['rank'],67)
        self.assertEqual(self.server.scores.submit(attempt('tied-score-attempt',8000))['rank'],1)

    def test_static_and_config(self):
        self.assertEqual(self.request('GET','/')[0],302)
        self.assertIn(b'Sentinel',self.request('GET','/stand.html')[1])
        self.assertEqual(self.request('HEAD','/stand.html')[1],b'')
        self.assertIn(b'__STAND_SERVER_REQUIRED=true',self.request('GET','/deployment-config.js')[1])
        for path in ['/server/secret.js','/.git/config','/scores.sqlite3','/%2e%2e/stand.html','/assets/']:
            self.assertEqual(self.request('GET',path)[0],404,path)
        self.assertEqual(json.loads(self.request('GET','/api/health')[1])['storage'],'sqlite')

    def test_backup_restore(self):
        self.server.scores.submit(attempt())
        snapshot=backup(self.db,self.root/'backups')
        restore=self.root/'restored.sqlite3'
        shutil.copyfile(snapshot,restore)
        self.assertEqual(Scores(restore).top()[0]['id'],'test-attempt-0001')


if __name__ == '__main__':
    unittest.main()
