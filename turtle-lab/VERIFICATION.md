# Verification — 2026-09-29

## Automated checks

All **43 tests passed** locally:

- **18 geometry tests:** exact initial example; bases 2–36 against string-based calculations; clockwise/counterclockwise and combined actions; zero-angle/empty paths; sequence transforms; input precision; viewport fitting; a million-term sequence; initial direction and scale; per-rule overrides; 100 deterministic randomized experiments checked against an independent turtle; defensive array copying; default weighted/unweighted path equivalence across every base; signed weights and safe-integer endpoints; zero and leading-zero semantics; negative remainders; malformed weight vectors; and independently calculated weighted motion for all sequence types.
- **11 setup/security tests:** full JSON round-trip; weighted setup compatibility with old files; invalid imported weights; malformed/oversized files; unknown and prototype-related keys; invalid object/array/value types; resource limits; bounded appearance values; literal and bounded names; schema versions; and source checks against execution/injection sinks and remote resource dependencies.
- **10 HTTP server tests:** asset and MIME correctness; security headers; private files and encoded traversal; no directory listing; symlink escape; hostile and duplicate hosts; unsupported write methods; HEAD behavior; and concurrent module loading.
- **4 launcher tests:** stable origin, occupied-port fallback, explicit-port/permission errors, and invalid arguments.

JavaScript syntax checks and shell syntax checks passed. The GitHub workflow runs syntax, JavaScript tests, and HTTP server tests; live CI results are authoritative for each commit.

The native package workflow runs the same suite on Linux x64, Windows x64, macOS arm64, and macOS x64. It also scans the exact build environment for known package vulnerabilities and tests each extracted executable and its file hashes. Release notes link the successful build run. These are executable and HTTP smoke tests, not certification of native GUI launch behavior. See [packaging details](../packaging/README.md).

Gitleaks 8.30.1 scanned the repository history and working-tree source before publication, with no leaks found. The downloaded scanner was checked against its published SHA-256 digest. This is a targeted secret scan, not a full security audit.

## Browser checks

Verified the updated app with its secured server:

- Initial drawing, presets, per-rule angle/distance edits, live geometry read-back, and reset.
- Weighted rule editing, negative integers, invalid-weight error feedback, base-36 inputs, and preservation of hidden weights when lowering and restoring the base.
- Settings tabs, keyboard panel resizing, hiding/showing the panel, and desktop/390-pixel responsive layouts with no horizontal overflow.
- Direction/remainder appearance options, paper background, grid toggle, and changing style without regenerating the path.
- Playback speed, pause, exact term stepping, and a million-term drawing (500,000 moves and 500,000 turns).
- Saved setup persistence across reload, restoring rules/appearance, and removing the test entry.
- HTML-like setup names rendered literally. No script executed.
- Valid JSON import; invalid billion-term import rejected while the previous experiment remained intact.
- Browser console contained no application or CSP errors during these checks.

PNG/JSON export controls dispatch their downloads. The embedded browser did not expose a completed download event, so saved-file delivery was not independently confirmed there; use a regular browser if the embedded browser does not surface downloads. Setup serialization and restoration are covered by automated tests.

The tests cover the stated cases. They do not prove fractality or rule out all possible security vulnerabilities.
