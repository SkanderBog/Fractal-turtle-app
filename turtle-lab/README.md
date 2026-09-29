# Using Turtle Lab

Run `../run.sh` from this directory, or `python3 serve.py`, then open http://127.0.0.1:4173. There is no installation or build step. Use the included server to retain the security headers and file restrictions described in [SECURITY.md](../SECURITY.md).

## The initial experiment

Read 16,384 integers starting at **0** in base **2**. Even digit sum means advance one unit. Odd digit sum means turn **60° counterclockwise without moving**. The turtle starts at (0, 0), facing the positive x axis, with mathematical y pointing upward.

## Sequence

The index starts at the selected n and increases by the selected interval. Each term is n, n², or n(n+1)/2, depending on the sequence. Bases 2–36 use digits 0–9 and A–Z. The engine rejects indices or transformed values outside JavaScript's exact safe-integer range.

A digit rule computes one quantity from each number's representation. The representation of zero is one digit, so counting occurrences of digit 0 in number 0 gives 1. Divide the quantity by the selected divisor (2–8) and use the remainder to select a rule.

## Rules

Each remainder supports forward, left, right, left then forward, right then forward, or no action. Combined actions **turn first**. The starting direction is 0–360°; 0° faces right, 90° faces up. The default angle is 0–360°, and default step length is 0.01–1,000 units.

Each rule can override its turn angle and forward distance. Blank means use the default; **zero is a real override**. A zero-distance forward action is still counted as a move, and a 0°/360° turn is still counted as a turn. An unused override is preserved but does not affect an action that does not turn or move.

Invalid edits keep the previous valid drawing visible. New settings cancel unfinished older generation. Expensive geometry work runs in a worker, and render paths are cached for pan and zoom.

## View and playback

- Drag the canvas to pan; scroll, pinch with two touches, or use + / − to zoom.
- Fit drawing centers and scales the full path, including flat and empty paths. It changes only the camera.
- With the canvas focused: **F** fits, **Space** plays/pauses, **+ / −** zoom, and **Left / Right** step one term.
- Replay speed ranges from ¼× to 8×. Pausing or dragging the scrubber retains the chosen sequence position. Playback pauses when the document becomes hidden.
- With a settings tab focused: Left/Right changes tabs; Home/End selects the first/last.
- Resize the settings panel by dragging its divider, or focus the divider and use Left/Right; Home restores its default width.
- On a narrow screen, Customize jumps to the editor beneath the drawing.
- The ring marks the start, and the triangle marks the turtle and its direction.

Colors can follow sequence order, line direction, rule remainder, or one chosen color. Direction/remainder paths are grouped by color for performance; when a path retraces itself, color groups can cover earlier groups. Sequence colors progress from first to last. Line weight is in screen pixels and stays constant as you zoom.

## Save and export

Expand **Save & load setups**. Save here stores up to 12 named setups in local browser storage. Saving the same name replaces that entry. Loading restores rules and appearance; removing a saved entry leaves the current drawing intact. Storage is specific to the browser and origin, including the port.

Download JSON creates a portable versioned setup. Import validates the entire file before changing the experiment, rejects unknown fields, and accepts files only up to 64 KB. Setup names are plain text. No expressions or scripts are evaluated.

Save PNG exports the visible view with its selected background and optional markers, without the editor's dot grid. Downloads use the browser's usual download handling. Some embedded browsers may not surface downloads; use the local URL in a regular browser in that case.

## Limits

At most 1,000,000 terms are generated. Integer sequence values are exact within the enforced range; trigonometry and coordinates use floating-point arithmetic. A finite drawing is not a proof of fractality.

The optional browser WebMCP API exposes read/configure actions using the same validation and visible state. It is not required for ordinary use.
