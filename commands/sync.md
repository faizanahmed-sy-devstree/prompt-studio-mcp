---
description: Check whether the .flow file and the project still agree
---

Call `sync_status` and say plainly which side has moved:

- in sync — say so, nothing to do
- the project moved — offer `pull_flow`
- the file moved — offer `push_flow`
- both moved — say so explicitly and do NOT pick for them; whichever direction
  they choose discards the other side's work, so that is their call

Do not run `pull_flow` or `push_flow` without being asked.
