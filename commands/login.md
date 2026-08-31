---
description: Sign this machine in to Prompt Studio
---

Print the exact command this user must run to sign in, then stop.

The CLI lives next to the running server, so resolve the real path rather than
guessing: it is `dist/cli.mjs` in the same directory as the `dist/server.mjs`
that `claude mcp list` reports for `plugin:prompt-studio:prompt-studio`.

Present it as a single copyable bash block ending in ` login`, and say that it
asks for their Prompt Studio email and password, stores only the resulting
tokens in `~/.prompt-studio/credentials.json`, and never writes the password.

If they are already signed in — check by calling `list_projects`, which
succeeds when they are — say so and show what it returned instead.
