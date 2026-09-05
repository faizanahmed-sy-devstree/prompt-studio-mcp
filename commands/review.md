---
description: Where the discovery run has got to, and what is still open
---

Report on the current discovery run — read only, change nothing.

1. `discovery_status` — the progress per module, the root questions still open,
   and whether it is done.
2. If anything is open, `discovery_list_items` with `unanswered: true` for the
   detail, and lead with the roots: everything else depends on them, and a
   module answered before its root question is a module answered twice.
3. Say plainly what is left and give them the studio URL again.

If it says done, offer `discovery_writeback` — but do not run it without being
asked. Do not answer any question here; this command reports.
