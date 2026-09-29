"""Audit the exact build environment using an isolated, pinned scanner."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import venv

with tempfile.TemporaryDirectory(prefix='turtle-dependency-audit-') as directory:
    root = Path(directory)
    requirements = root / 'requirements.txt'
    requirements.write_bytes(subprocess.check_output([sys.executable, '-m', 'pip', 'freeze', '--all']))
    venv.create(root / 'scanner', with_pip=True)
    python = root / 'scanner' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    subprocess.run([str(python), '-m', 'pip', 'install', 'pip-audit==2.10.1'], check=True)
    subprocess.run([str(python), '-m', 'pip_audit', '--strict', '--disable-pip', '--no-deps', '-r', str(requirements)], check=True)
