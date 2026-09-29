"""Build one portable alpha archive on its native OS; never cross-compile."""
import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, choices=['linux-x64', 'windows-x64', 'macos-arm64', 'macos-x64'])
    args = parser.parse_args()
    expected = {'linux': 'Linux', 'windows': 'Windows', 'macos': 'Darwin'}[args.target.split('-')[0]]
    machine = platform.machine().lower()
    if platform.system() != expected or (args.target.endswith('arm64') and machine not in ['arm64','aarch64']) or (args.target.endswith('x64') and machine not in ['amd64','x86_64']):
        parser.error('Build on the native target OS and architecture.')
    version = json.loads((ROOT / 'turtle-lab/package.json').read_text())['version']
    stem = f'TurtleLab-{version}-{args.target}'
    work = ROOT / 'build' / args.target
    out = ROOT / 'release-dist'
    out.mkdir(exist_ok=True)
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--console',
                    '--name', 'TurtleLab', '--distpath', str(work / 'dist'), '--workpath', str(work / 'work'),
                    '--specpath', str(work), '--add-data', f'{ROOT / "turtle-lab/dist"}:dist',
                    str(ROOT / 'turtle-lab/launcher.py')], check=True, cwd=ROOT)
    bundle = work / stem
    if bundle.exists():
        shutil.rmtree(bundle)
    shutil.copytree(work / 'dist/TurtleLab', bundle)
    shutil.copyfile(ROOT / 'packaging/START_HERE.md', bundle / 'START_HERE.md')
    notices = bundle / 'THIRD_PARTY'
    notices.mkdir()
    shutil.copyfile(ROOT / 'packaging/PYTHON-LICENSE.txt', notices / 'PYTHON-LICENSE.txt')
    shutil.copyfile(ROOT / 'packaging/PYTHON-THIRD-PARTY-NOTICES.txt', notices / 'PYTHON-THIRD-PARTY-NOTICES.txt')
    # Retain licenses accompanying every build distribution, including bootloader exceptions.
    for dist in importlib.metadata.distributions():
        for file in dist.files or []:
            if any(word in file.name.lower() for word in ['license', 'copying', 'copyright']) and file.suffix.lower() in ['', '.txt', '.md', '.rst']:
                source = Path(dist.locate_file(file))
                if source.is_file():
                    dest = notices / dist.metadata['Name'] / str(file).replace('..','_')
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, dest)
    if expected == 'Darwin':
        command = bundle / 'Start Turtle Lab.command'
        command.write_text('#!/bin/sh\ncd -- "$(dirname -- "$0")"\nexec ./TurtleLab "$@"\n')
        command.chmod(0o755)
    commit = subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip()
    metadata = {'version':version, 'commit':commit, 'target':args.target, 'python':platform.python_version(),
                'platform':platform.platform(), 'dependencies': sorted(f'{d.metadata["Name"]}=={d.version}' for d in importlib.metadata.distributions())}
    (bundle / 'BUILD-INFO.json').write_text(json.dumps(metadata, indent=2)+'\n')
    hashes = {str(p.relative_to(bundle)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(bundle.rglob('*')) if p.is_file()}
    (bundle / 'MANIFEST.json').write_text(json.dumps(hashes, indent=2)+'\n')
    # tar preserves Unix executability and shared-library symlinks; Windows uses ZIP.
    archive = shutil.make_archive(str(out / stem), 'zip' if expected == 'Windows' else 'gztar', root_dir=work, base_dir=stem)
    print(f'Created {Path(archive).name}', flush=True)


if __name__ == '__main__':
    main()
