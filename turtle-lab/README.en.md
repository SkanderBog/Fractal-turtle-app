# Using Turtle Lab

Run `../run.sh` from this directory, or `python3 serve.py`, then open http://127.0.0.1:4173. There is no installation or build step. Use the included server to retain the security headers and file restrictions described in [SECURITY.md](../SECURITY.md).

## The initial experiment

Read 16,384 integers starting at **0** in base **2**. Even digit sum means advance one unit. Odd digit sum means turn **60° counterclockwise without moving**. The turtle starts at (0, 0), facing the positive x axis, with mathematical y pointing upward.

## Sequence

The index starts at the selected n and increases by the selected interval. Each term is n, n², or n(n+1)/2, depending on the sequence. Bases 2–36 use digits 0–9 and A–Z. The engine rejects indices or transformed values outside JavaScript's exact safe-integer range.

A digit rule computes one quantity from each number's representation. The representation of zero is one digit, so counting occurrences of digit 0 in number 0 gives 1. Divide the quantity by the selected divisor (2–8) and use the remainder to select a rule.

## Rules

Choose **Sum of digit weights** to assign a signed integer to each digit. The app adds those weights for every digit in the number, then takes the remainder to select a turtle action. For example, in base 2 with weights **0 → −2, 1 → 1**, the number 5 is `101`, so its weight sum is `1 − 2 + 1 = 0`. The number 2 is `10`, whose sum is −1; with divisor 3 it selects remainder **2**. Remainders are always between 0 and divisor − 1.

Zero is represented by a single digit 0 and contributes its weight once. No leading zeros are added. Each weight must be a whole number from −1,000,000 to 1,000,000. Weights stay exact within the supported sequence limits.

**Digit values** restores ordinary digit sums. **All 1** counts the number of digits; **All 0** sends every term to remainder 0. The editor shows digits for the current base (0–9 and A–Z); hidden weights remain available if you lower and then raise the base. Saved JSON contains all 36 weights, and files from earlier versions still load with ordinary digit-value weights. Invalid edits retain the last valid picture and display an error.

Each remainder supports forward, left, right, left then forward, right then forward, or no action. Combined actions **turn first**. The starting direction is 0–360°; 0° faces right, 90° faces up. The default angle is 0–360°, and default step length is 0.01–1,000 units.

Each rule can override its turn angle and forward distance. Blank means use the default; **zero is a real override**. A zero-distance forward action is still counted as a move, and a 0°/360° turn is still counted as a turn. An unused override is preserved but does not affect an action that does not turn or move.

Invalid edits keep the previous valid drawing visible. New settings cancel unfinished older generation. Expensive geometry work runs in a worker, and render paths are cached for pan and zoom.

## Edge-avoiding mode

Choose an **Edge trail** preset, or select **Edge avoiding · triangular lattice** in Rules. Every successful unit move permanently forbids the traversed edge in both directions. Headings and turns must be multiples of 60°; forward distances must be exactly one. These restrictions apply only in edge mode. The ordinary free-drawing model keeps its original arbitrary angles, distances, and zero-distance overrides.

**Stay** consumes a blocked instruction without moving. **Search counterclockwise** rotates through marked directions until it finds a free edge, then moves within the same instruction. Combined actions turn first, then apply this policy. The turn count includes both configured turn instructions and individual 60° search turns.

Expand **Initial marked edges** to toggle a specific axial edge, edit by clicking the canvas, clear the marks, or generate a fixed-count random set. Axial `(q,r)` corresponds to `(q+r/2, √3·r/2)` on the drawing; directions 0–5 run counterclockwise from east. Reverse descriptions of the same edge are identical. The random seed, radius and edge count produce a reproducible set; saved setups contain the actual edge list. **Enclose this hexagon** marks every edge crossing its boundary. It is different from tracing the hexagon's perimeter. At most 512 initial edges are accepted.

Turning on canvas editing centers a lattice guide near the origin. Click near an edge to add/remove it; drag and pinch still move the view. Zoom in when the lattice is too small for precise selection. Editing restarts the walk, so an edge used by the previous drawing can become an initial mark. Seed edits preserve the camera; Fit drawing includes both the path and seeds.

The status line separates three situations:

- **Trapped**: all six incident edges are marked. The walk stops before another instruction, including a possible zero-instruction initial trap.
- **Term limit reached**: the requested prefix ended. This alone says nothing about eventual trapping or permanent stalling.
- **Movement locked**: an invariant proves that no future forward move can succeed, or the table has no forward action. Instructions still run and can rotate the turtle. The certificate is sufficient, not a complete detector of every possible stationary future.

For the invariant, take the subgroup of the six headings generated by all configured turn amounts. If every edge reachable within the current heading's subgroup is marked under the stay policy, all future requests remain blocked. An example is 180° parity turns with the single initial edge `(2,0,0)`: after two moves, the forward and backward edges are both marked while four other directions remain free.

**Unblocked / after edge search** colors successful moves by whether searching was required. The inspector shows each requested action and its actual outcome. **Show possible trap sites** adds pink rings derived from the odd degrees of the initial-edge graph, with the origin's parity reversed. These are necessary candidates, not predictions that the turtle will reach or trap there; some may be unreachable.

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

Download JSON creates a portable version-2 setup containing the model and exact seed edges. Version-1 files still load with their original free geometry when they have no edge settings. The existing browser library is retained and migrated on reading. Import validates the entire file before changing the experiment, rejects unknown fields, and accepts files only up to 64 KB. Setup names are plain text. No expressions or scripts are evaluated.

Save PNG exports the visible view with its selected background and optional markers, including initial edges, trap markers, and the lattice guide when editing is enabled. The CSS dot grid is not exported. Downloads use the browser's usual download handling. Some embedded browsers may not surface downloads; use the local URL in a regular browser in that case.

## Limits

At most 1,000,000 terms are generated. Integer sequence values are exact within the enforced range. Free drawing uses floating-point trigonometry; edge geometry and edge identities use exact integer axial coordinates, converted to floating point only for display. A finite drawing is not a proof of fractality.

The optional browser WebMCP API exposes read/configure actions using the same validation and visible state. It is not required for ordinary use.
