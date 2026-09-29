"""Extract and test the actual portable archive, including paths containing spaces."""
import argparse
import hashlib
import http.client
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import queue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='Turtle Lab smoke ') as directory:
        shutil.unpack_archive(args.archive, directory)
        bundles = list(Path(directory).iterdir())
        assert len(bundles) == 1
        bundle = bundles[0]
        manifest = json.loads((bundle / 'MANIFEST.json').read_text())
        actual = {p.relative_to(bundle).as_posix() for p in bundle.rglob('*') if p.is_file()}
        assert actual == set(manifest) | {'MANIFEST.json'}, 'Unexpected or missing bundle files'
        for name, expected in manifest.items():
            assert hashlib.sha256((bundle / name).read_bytes()).hexdigest() == expected, name
            assert not any(part in ['.git', '.openai', '.codex', '.agents', 'node_modules', '.env'] for part in Path(name).parts), name
        executable = bundle / ('TurtleLab.exe' if (bundle / 'TurtleLab.exe').exists() else 'TurtleLab')
        process = subprocess.Popen([str(executable), '--no-browser', '--port', '0'], cwd=directory,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        lines = queue.Queue()

        def read_output():
            for line in process.stdout:
                lines.put(line)

        threading.Thread(target=read_output, daemon=True).start()
        try:
            line = lines.get(timeout=30)
            match = re.search(r'http://127\.0\.0\.1:(\d+)/', line)
            assert match, f'Launcher failed: {line}'
            port = int(match.group(1))

            def request(path, method='GET', host=None):
                connection = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
                connection.request(method, path, headers={'Host':host} if host else {})
                response = connection.getresponse()
                result = response.status, dict(response.getheaders()), response.read()
                connection.close()
                return result

            for asset in ['index.html','style.css','app.mjs','core.mjs','worker.mjs','setup.mjs','favicon.svg']:
                status, headers, body = request('/'+asset)
                assert status == 200 and body, asset
                assert "connect-src 'none'" in headers['Content-Security-Policy']
                assert "frame-ancestors 'none'" in headers['Content-Security-Policy']
                assert headers['X-Content-Type-Options'] == 'nosniff'
                assert body == (bundle / '_internal/dist' / asset).read_bytes(), asset
            assert request('/')[0] == 200
            assert b'Sum of digit weights' in request('/')[2]
            for path in ['/../START_HERE.md','/%2e%2e/BUILD-INFO.json','/.git/config','/.openai/hosting.json','/launcher.py','/_internal/','/index.html%00']:
                assert request(path)[0] in [400,404], path
            assert request('/', host=f'evil.example:{port}')[0] == 403
            assert request('/', method='POST')[0] == 501
            assert request('/app.mjs', method='HEAD')[2] == b''
            print(f'PASS: native executable, all 7 exact assets, security boundaries, {len(manifest)} file hashes; {args.archive.name}')
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
            process.stdout.close()


if __name__ == '__main__':
    main()
