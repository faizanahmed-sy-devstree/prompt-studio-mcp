---
description: Push a discovery run to the studio and wait for the decisions
---

Take the questions weaver wrote and get them answered in Prompt Studio.

1. `sync_status` — find the linked project. Nothing linked? Say so and point at
   `/prompt-studio:link`; stop there.
2. `discovery_push_run` — sends `weave/discovery/questions.json` and writes
   `weave/discovery/.run-id`. If the file does not exist, run `weave-decide`
   first; there is nothing to push without it.
3. `discovery_push_docs` — sends the rest of `weave/` (the KB, issues, features,
   diagrams) so the person answering can read the evidence, and merges
   `weave/schema.flow` onto the Data canvas if it is there.
4. **Give them the URL** the push printed, in plain text on its own line, and
   say roughly how many questions are waiting. This is the point of the whole
   command — do not bury it.
5. `discovery_wait` — one call waits up to five minutes. Report the module
   progress and the open root questions each time it comes back, then call it
   again. Keep going until it says done, or until they tell you to stop.
6. `discovery_writeback` — folds the decisions into `weave/discovery/issues.md`
   and `features.md` and re-pushes them.
7. Check the gate yourself before claiming it is clear:

   ```bash
   grep -cE 'decision: PENDING|\| *PENDING *\|' weave/discovery/*.md
   ```

   Every file must report 0. If any does not, say which and stop — `weave-author`
   is not ready to run.

Do not answer questions on their behalf unless they ask you to. If they do,
`discovery_answer` per key, or `discovery_accept_defaults` for a whole module or
every standing rule at once.
