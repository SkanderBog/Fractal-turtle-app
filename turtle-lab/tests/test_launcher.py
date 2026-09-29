import errno
import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import launcher


class LauncherTests(unittest.TestCase):
    def test_default_prefers_the_stable_loopback_origin(self):
        with patch.object(launcher, 'ThreadingHTTPServer') as server:
            self.assertIs(launcher.create_server(), server.return_value)
            server.assert_called_once_with(('127.0.0.1',4173), launcher.AppHandler)

    def test_occupied_default_uses_a_free_loopback_port(self):
        sentinel = Mock()
        with patch.object(launcher, 'ThreadingHTTPServer', side_effect=[OSError(errno.EADDRINUSE,'occupied'),sentinel]) as server:
            self.assertIs(launcher.create_server(), sentinel)
            self.assertEqual(server.call_args_list[1].args[0], ('127.0.0.1',0))

    def test_explicit_port_and_other_failures_are_not_silently_changed(self):
        for port, error in [(4173,errno.EADDRINUSE),(None,errno.EACCES)]:
            with patch.object(launcher, 'ThreadingHTTPServer', side_effect=OSError(error,'test')) as server:
                with self.assertRaises(OSError):
                    launcher.create_server(port)
                self.assertEqual(server.call_count,1)

    def test_invalid_ports_fail_before_opening_a_browser(self):
        for port in ['-1','65536','oops']:
            result = subprocess.run([sys.executable,str(ROOT/'launcher.py'),'--no-browser','--port',port], capture_output=True, timeout=10)
            self.assertEqual(result.returncode,2)


if __name__ == '__main__':
    unittest.main()
