# Security notes

Turtle Lab is a local, static application with no account system, cloud database, telemetry, external fonts, or runtime package dependencies. The GitHub repository is source distribution; it does not publish a hosted app.

## Boundaries

- `serve.py` binds only to `127.0.0.1`. It accepts the exact localhost/127.0.0.1 host and port, and rejects unexpected or duplicate Host headers.
- The server serves a fixed allowlist of public app files. It does not list directories, follow symlinks, expose repository metadata, or implement write methods.
- HTTP headers restrict scripts, styles, and workers to local assets; block outbound connections, framing, object embedding, and form submission; disable MIME sniffing; and set a no-referrer policy. A matching CSP meta policy protects the static page when supported, but framing restrictions require HTTP headers.
- All user-facing strings are assigned as text. There are no HTML injection sinks, evaluated expressions, or dynamically loaded remote code.
- Imported setups are parsed as JSON with a 64 KB limit, a versioned schema, allowed-key checks, numeric bounds, and validated literal colors. Unknown keys, including prototype-related keys, are rejected. Validation finishes before imported settings affect the UI.
- At most 1,000,000 terms and eight remainders are accepted. Integer overflow is rejected. A replacement worker terminates older unfinished work.
- Weighted rules accept a dense list of 2–36 bounded integers covering the selected base; negative sums are normalized to valid remainders. Imported weights are data, never code or expressions.
- Browser storage holds only explicit saved setups. Local hosting metadata, environment files, caches, and agent configuration are excluded from Git.
- CI uses read-only repository permissions and full commit pins for its GitHub Actions.
- Alpha archives bundle Python and a PyInstaller bootloader. The build tool version is pinned, resolved dependencies are audited and recorded, and native binaries are tested after extraction. Published archive checksums detect download changes; they are not code-signing certificates. Packages are unsigned and Mac packages are not notarized.

## Verification and limits

The automated suite exercises malformed inputs, numerical limits, HTML-like names, prototype-related keys, HTTP traversal, symlink escape, hostile Host headers, security headers, and unsupported write methods. The browser was checked for literal setup-name rendering and rejection of an invalid import while retaining the prior valid experiment.

These checks are not a formal security audit or a promise of complete security. The server is intended for local use, not exposure to a public network. A different static host needs equivalent HTTP headers, particularly `frame-ancestors`, and appropriate hosting configuration. Browser extensions, compromised local accounts, and other applications with access to the browser profile are outside this application's protection boundary. Saved setup deletion has no in-app undo; exported JSON can serve as a backup.

## References

- [Python's HTTP server security considerations](https://docs.python.org/3/library/http.server.html#security-considerations) describe why the generic server was replaced instead of relying on its symlink handling.
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) documents the resource restrictions used here.
- [MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) explains the HTTP-header requirement for anti-framing policy.

Please report suspected security problems privately to the repository owner, without posting private setups or credentials in a public issue.
