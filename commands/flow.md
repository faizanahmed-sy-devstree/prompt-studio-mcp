---
description: Change the linked project by describing what you want
argument-hint: <what to add or change>
---

Change the Prompt Studio project for this repo: $ARGUMENTS

Work in this order, and do not skip step 1:

1. `flow_language_guide` — read the grammar before writing any Flow.
2. `sync_status` to find the linked project. If nothing is linked, say so and
   point at `/prompt-studio:link`.
3. `read_project` for the current state and the version to write back.
4. Write Flow for **only** what $ARGUMENTS asks for, and `check_flow` it. That
   costs nothing, so iterate there until it parses.
5. `write_flow` in `merge` mode with a short label saying what changed.

`merge` is not optional here. `replace` deletes every part of the project the
source does not mention, so use it only if they explicitly ask to replace the
whole document.

Then report what changed and the version it saved as.
