import http.client
import importlib.util
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer

SPEC = importlib.util.spec_from_file_location('app_server', Path(__file__).resolve().parents[1] / 'serve.py')
server_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server_module)

class ServerSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / 'dist'
        shutil.copytree(server_module.ROOT, cls.root)
        server_module.ROOT = cls.root
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), server_module.AppHandler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def request(self, path='/', method='GET', host=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        headers = {'Host': host} if host else {}
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_assets_and_module_mime_types(self):
        for name, mime in server_module.PUBLIC_FILES.items():
            with self.subTest(name=name):
                status, headers, body = self.request('/' + name)
                self.assertEqual(status, 200)
                self.assertEqual(headers['Content-Type'], mime)
                self.assertEqual(len(body), int(headers['Content-Length']))
        self.assertEqual(self.request('/')[0], 200)

    def test_headers_block_external_connections_and_framing(self):
        _, headers, _ = self.request()
        self.assertIn("connect-src 'none'", headers['Content-Security-Policy'])
        self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertNotIn('unsafe-inline', headers['Content-Security-Policy'])
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(headers['X-Frame-Options'], 'DENY')
        self.assertEqual(headers['Cross-Origin-Resource-Policy'], 'same-origin')
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')

    def test_private_files_and_traversal_are_not_served(self):
        paths = ['/../README.md','/%2e%2e/README.md','/%252e%252e/README.md','/.git/config','/.openai/hosting.json','/serve.py','/tests/','/index.html/../serve.py','/index.html%00','//example.com/index.html','/dist/']
        for path in paths:
            with self.subTest(path=path):
                self.assertIn(self.request(path)[0], [400,404])

    def test_no_directory_listing(self):
        status, _, body = self.request('/')
        self.assertEqual(status, 200)
        self.assertNotIn(b'Directory listing', body)
        self.assertEqual(self.request('/tests/')[0], 404)

    def test_symlink_cannot_expose_a_file_outside_the_app(self):
        asset = self.root / 'favicon.svg'
        original = asset.read_bytes()
        secret = self.root.parent / 'private.txt'
        secret.write_text('PRIVATE_TEST_SENTINEL')
        asset.unlink()
        asset.symlink_to(secret)
        try:
            status, _, body = self.request('/favicon.svg')
            self.assertEqual(status, 404)
            self.assertNotIn(b'PRIVATE_TEST_SENTINEL', body)
        finally:
            asset.unlink()
            asset.write_bytes(original)

    def test_dns_rebinding_hosts_are_rejected(self):
        for host in ['evil.example',f'evil.example:{self.port}','127.0.0.1.evil.example',f'localhost:{self.port+1}']:
            self.assertEqual(self.request(host=host)[0], 403)
        self.assertEqual(self.request(host=f'localhost:{self.port}')[0], 200)

    def test_duplicate_host_is_rejected(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        connection.putrequest('GET','/',skip_host=True)
        connection.putheader('Host',f'127.0.0.1:{self.port}')
        connection.putheader('Host','evil.example')
        connection.endheaders()
        response = connection.getresponse()
        self.assertEqual(response.status,403)
        response.read()
        connection.close()

    def test_http_write_methods_are_not_implemented(self):
        for method in ['POST','PUT','PATCH','DELETE']:
            self.assertEqual(self.request('/index.html',method)[0],501)

    def test_head_has_headers_without_a_body(self):
        status, headers, body = self.request('/app.mjs','HEAD')
        self.assertEqual(status,200)
        self.assertEqual(body,b'')
        self.assertGreater(int(headers['Content-Length']),0)

    def test_multiple_module_requests_complete(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(self.request,['/app.mjs','/core.mjs','/setup.mjs','/worker.mjs']))
        self.assertTrue(all(result[0]==200 for result in results))

if __name__ == '__main__':
    unittest.main()
