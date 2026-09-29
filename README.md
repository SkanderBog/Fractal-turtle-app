# Turtle Lab

A lightweight, colorful playground for number-driven turtle paths. It starts with integers in base 2: an even digit sum moves the turtle forward, and an odd sum turns it 60° counterclockwise without moving.

## Run

Requires **Python 3.10+**. No packages need to be installed.

```sh
./run.sh
```

Open **http://127.0.0.1:4173** in your browser. If that port is occupied:

```sh
./run.sh --port 4174
```

Opening the HTML directly as a file is not supported because the app uses a module worker. All drawing calculations and saved setups stay in your browser. The app does not load remote fonts, scripts, analytics, or other third-party resources.

## Explore

- A resizable settings panel with **Sequence**, **Rules**, and **Style** tabs; hide it to give the drawing the full window.
- Integer, square, and triangular sequences; bases 2–36; adjustable starting index, interval, and up to **1,000,000 terms**.
- Digit sum, last digit, nonzero-digit count, or occurrences of a chosen digit.
- An independent action for every remainder: forward, left, right, turn then forward, or pause.
- Default angle and distance, starting direction, and optional **per-rule angle and distance overrides**.
- Colors by sequence position, movement direction, remainder, or a solid color. Four palettes, three backgrounds, line weight, grid, and marker controls.
- Automatic fit, pan, zoom, touch pinch, playback speed, and exact single-term stepping.
- An expandable explanation of the numbers and instructions behind the current path.
- Save up to 12 named setups in this browser, import/export JSON, and export the current drawing view as PNG.

See [the app guide](turtle-lab/README.md) for rule details and keyboard controls. Saved setups are local to your browser and origin, including the port; export JSON to transfer or back them up. PNG export includes the selected background and visible path/markers, not the editor's dot grid.

A finite picture does not establish that its infinite limit is a fractal. The app generates finite paths and fits their complete bounds without changing their mathematical coordinates.

## Tests

Requires Node.js 20+ for JavaScript tests; Python is used for server tests.

```sh
cd turtle-lab
npm run check
npm test
npm run test:server
```

There are **31 automated tests**, including independent randomized geometry comparisons, a million-term sequence, malformed or hostile setup inputs, and HTTP server security checks. GitHub Actions runs these checks on pushes and pull requests with read-only repository permissions and pinned actions.

See [verification details](turtle-lab/VERIFICATION.md) and [security notes](SECURITY.md). These are targeted regression checks, not a guarantee that every possible vulnerability has been excluded.

## Project layout

- `turtle-lab/dist/`: directly served HTML, CSS, and JavaScript modules; no build step.
- `core.mjs`: validated number rules and turtle geometry.
- `worker.mjs`: cancellable background geometry generation.
- `setup.mjs`: strict configuration and JSON-file validation.
- `app.mjs`: editor, renderer, saved setups, and browser interactions.
- `turtle-lab/serve.py`: loopback-only, read-only static server.
- `turtle-lab/tests/`: geometry, hostile-input, and server tests.
