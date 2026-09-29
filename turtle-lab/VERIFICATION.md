# Verification — 2026-09-29

## Automated checks

All **31 tests passed** locally:

- **12 geometry tests:** exact initial example; bases 2–36 against string-based calculations; clockwise/counterclockwise and combined actions; zero-angle/empty paths; sequence transforms; input precision; viewport fitting; a million-term sequence; initial direction and scale; per-rule overrides; 100 deterministic randomized experiments checked against an independent turtle; and defensive array copying.
- **9 setup/security tests:** full JSON round-trip; malformed/oversized files; unknown and prototype-related keys; invalid object/array/value types; resource limits; bounded appearance values; literal and bounded names; schema versions; and source checks against execution/injection sinks and remote resource dependencies.
- **10 HTTP server tests:** asset and MIME correctness; security headers; private files and encoded traversal; no directory listing; symlink escape; hostile and duplicate hosts; unsupported write methods; HEAD behavior; and concurrent module loading.

JavaScript syntax checks and shell syntax checks passed. The GitHub workflow runs syntax, JavaScript tests, and HTTP server tests; live CI results are authoritative for each commit.

## Browser checks

Verified the updated app with its secured server:

- Initial drawing, presets, per-rule angle/distance edits, live geometry read-back, and reset.
- Settings tabs, keyboard panel resizing, hiding/showing the panel, and desktop/390-pixel responsive layouts with no horizontal overflow.
- Direction/remainder appearance options, paper background, grid toggle, and changing style without regenerating the path.
- Playback speed, pause, exact term stepping, and a million-term drawing (500,000 moves and 500,000 turns).
- Saved setup persistence across reload, restoring rules/appearance, and removing the test entry.
- HTML-like setup names rendered literally. No script executed.
- Valid JSON import; invalid billion-term import rejected while the previous experiment remained intact.
- Browser console contained no application or CSP errors during these checks.

PNG/JSON export controls dispatch their downloads. The embedded browser did not expose a completed download event, so saved-file delivery was not independently confirmed there; use a regular browser if the embedded browser does not surface downloads. Setup serialization and restoration are covered by automated tests.

The tests cover the stated cases. They do not prove fractality or rule out all possible security vulnerabilities.
