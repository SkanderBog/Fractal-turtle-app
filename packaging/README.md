# Alpha distribution

Version 1.2.0-alpha.1 provides portable bundles. These are browser apps with a bundled Python launcher, not Electron applications or system installers. Extract the complete archive; keep its executable and `_internal` folder together. The app works offline after download.

| Archive target | Native build and smoke-test host | Target |
| --- | --- | --- |
| linux-x64 | Ubuntu 22.04 x64 | glibc 2.35+ Linux x64 |
| windows-x64 | Windows Server 2022 x64 | Windows 10/11 x64; desktop GUI testing remains open |
| macos-arm64 | macOS 14 Apple Silicon | macOS 14+ Apple Silicon |
| macos-x64 | macOS 15 Intel | macOS 15+ Intel |

Each build runs all source tests, audits the installed build packages using pip-audit, builds with pinned PyInstaller, extracts the archive into a directory containing spaces, verifies every file against MANIFEST.json, starts the actual bundled executable, and checks all seven exact app assets plus security headers, traversal blocking, hostile hosts, unsupported writes, and HEAD responses. These checks exercise native executable startup and serving; they do not simulate a graphical browser on every operating system.

Packages are unsigned; Mac packages are not notarized. SmartScreen or Gatekeeper may prevent a launch. Physical-device GUI launch, OS security prompts, browser downloads, and broad distribution compatibility remain alpha-testing tasks. Follow local software policy. Running the source with an installed Python is an alternative.

The launcher binds to 127.0.0.1, prefers port 4173, opens the default browser, and stops when its console receives Ctrl+C. If 4173 is occupied it chooses a free port without opening the existing service. Use `--port 4174` for a stable alternate port, `--port 0` to request any free port, or `--no-browser`. Browser storage depends on the exact origin and port; export setups to JSON to move them.

## Rebuild

On each native target OS with Python 3.12 and Node.js 22:

```sh
python -m pip install -r packaging/requirements-build.txt
python packaging/audit.py
python packaging/build.py --target linux-x64
python packaging/smoke.py release-dist/TurtleLab-1.2.0-alpha.1-linux-x64.tar.gz
```

Substitute the target and archive filename for Windows or macOS. The build refuses an OS/architecture mismatch. PyInstaller's entry point and data directory are explicit; it does not copy the repository wholesale. Every archive contains START_HERE.md, BUILD-INFO.json (source commit, exact Python and dependency versions), MANIFEST.json, and third-party notices. Build dependency resolution is recorded but archives are not claimed to be bit-for-bit reproducible. Publication uses only artifacts from the tested source commit and a SHA256SUMS file.

Build automation has read-only repository permission and cannot publish a release or change visibility by itself. Source tests run on PRs; native packaging runs on main pushes and manual dispatches.

References: [PyInstaller native build requirements](https://pyinstaller.org/en/latest/usage.html), [GitHub runner platforms](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [Python third-party licenses](https://docs.python.org/3.12/license.html).
