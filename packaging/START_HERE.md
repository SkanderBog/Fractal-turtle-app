# Turtle Lab — alpha test build

Extract the entire archive before starting. Keep all files together.

- Windows x64: double-click `TurtleLab.exe`.
- macOS: double-click `Start Turtle Lab.command`, or run `./TurtleLab` in Terminal. Choose the arm64 build for Apple Silicon or x64 for Intel.
- Linux x64: run `./TurtleLab` from the extracted folder in a terminal. Requires glibc 2.35+ (Ubuntu 22.04 or newer, or compatible distribution).

The launcher opens your default browser. Keep its terminal window open; press Ctrl+C there to stop the local server. If the browser does not open, copy the printed localhost URL. No Python installation or internet connection is needed. A current browser with Canvas and module-worker support is required.

The packages are unsigned and the macOS packages are not notarized. Windows or macOS may block launching them. Follow your organization's software policy; source-run instructions are available in the repository. These are early testing builds, not production installers. GUI launches on physical devices have not been certified.

The launcher prefers port 4173 and chooses a free port if occupied. Saved setups belong to the browser and port. Use JSON export/import to keep a backup or move a setup. `./TurtleLab --port 4174` selects a stable alternate port; `--no-browser` prevents automatic browser opening. Closing the browser tab does not stop the server.

Try Rules → Digit rule → Sum of digit weights. Set one integer weight for every digit. Weights can be negative; the sum wraps into a remainder between zero and divisor minus one. For example, binary weights [−2, 1] turn 101₂ into 1 − 2 + 1 = 0. The number zero contributes the weight of digit 0 once; leading zeros are not added.

BUILD-INFO.json records the source commit and build tools. MANIFEST.json contains SHA-256 hashes of bundle files. The release's SHA256SUMS file checks the complete downloaded archives. THIRD_PARTY contains bundled-runtime and build-tool license notices.

Source, instructions, and issue reporting: https://github.com/SkanderBog/Fractal-turtle-app
Do not include private setups, credentials, or personal paths when reporting a problem.
