# Prompt Studio for Claude Code

An MCP server that lets Claude read and write your [Prompt Studio](https://github.com/faizanahmed-sy-devstree/prompt-studio) project directly — as text, in your repo, with a version behind every change.

Prompt Studio's document has a text form called **Flow**. This server makes that text form the interface: Claude reads the grammar, writes Flow, checks it, and folds it into your real project. Anyone with the canvas open watches the screens appear as it goes.

```
you:     "add a billing journey — plan picker, payment, receipt"
claude:  reads the grammar, writes Flow, checks it, merges it
studio:  three screens and a journey appear on the canvas
git:     prompt-studio.flow updated, ready to commit
```

## Install

```bash
# 1. sign in once, on this machine
npx prompt-studio-mcp login

# 2. register it with Claude Code
claude mcp add prompt-studio -- npx -y prompt-studio-mcp serve
```

That's it. `login` asks for your Prompt Studio email and password, exchanges them for tokens, and stores **only the tokens** in `~/.prompt-studio/credentials.json` (owner-readable). Your password is never written to disk, and never goes anywhere near your Claude Code config.

Check it worked:

```bash
npx prompt-studio-mcp whoami
```

The server acts as **you**. It reaches exactly the projects your account can reach, and every change is attributed to you in the project's activity feed. There is no service account and no shared credential.

## What Claude can do

| Tool | What it does |
| --- | --- |
| `flow_language_guide` | The complete grammar, with worked examples. Claude reads this first. |
| `list_projects` | Every project your account can open. |
| `read_project` | The project as Flow source, plus the version to write back. |
| `check_flow` | Parse Flow without touching anything. Free — the right way to iterate. |
| `write_flow` | Fold Flow into a project. Merges by default, snapshots first. |
| `create_project` | A new project, optionally written from Flow in one go. |
| `build_prompt` | The build prompt the project generates, per surface. |
| `list_versions` | The project's version history, newest first. |
| `save_version` | Snapshot the project as it stands, with a label. |
| `read_version` | A past version as Flow, so it can be compared with today's. |
| `restore_version` | Put the project back. Snapshots the current state first. |
| `link_project` | Tie this repo to a project and a `.flow` file. |
| `pull_flow` | Overwrite the linked file with the project. |
| `push_flow` | Send the linked file to the project. |
| `sync_status` | Whether the file and the project agree, and which way they have drifted. |

## Keeping a `.flow` file in your repo

The diagram lives in Prompt Studio, but the *text* of it can live next to your code, where it can be reviewed in a pull request like anything else:

```
claude: link this repo to my dispatch project
```

That writes two files — a `.flow` file holding the diagram as text, and a small `.prompt-studio.json` recording which project it belongs to. **Commit both.**

From then on the file is kept current automatically: any `write_flow` updates it too, so it never silently becomes the stale copy. `sync_status` tells you which side has moved, `pull_flow` brings the studio's version down, and `push_flow` sends yours up.

## Four things it does deliberately

**Merge is the default.** Asked to add a billing journey, a model writes the billing journey — not the other eleven. A write that replaced the document would delete the rest of the project every single time. `replace` exists, is named plainly, and has to be asked for.

**Every write snapshots first.** The version is taken *before* the change and labelled with what the change was about, so the history is a list of states you can return to rather than a list of times something happened. `restore_version` also snapshots before restoring, so undoing is itself undoable.

**Stale writes are refused, not merged.** A write sends the version it read as its base. If somebody saved in between, it comes back as a conflict telling Claude to read again and reapply. It never lands on top of your colleague's work. `push_flow` does the same for the file on disk.

**Checking is free.** `check_flow` needs no project and touches nothing, so getting the grammar right costs iterations rather than writes.

## Configuration

| Variable | Default | For |
| --- | --- | --- |
| `PROMPT_STUDIO_API_URL` | `https://prompt-studio-backend.onrender.com` | Pointing at a self-hosted or local backend |
| `PROMPT_STUDIO_EMAIL` | — | CI, where there is no interactive login |
| `PROMPT_STUDIO_PASSWORD` | — | CI. Prefer `login` on a personal machine. |
| `PROMPT_STUDIO_HOME` | `~/.prompt-studio` | Where credentials are stored |

Stored tokens win over environment variables: somebody who ran `login` meant it, and silently preferring a stale env var over that is an hour of confusion.

Running against a local backend:

```bash
PROMPT_STUDIO_API_URL=http://localhost:8010 npx prompt-studio-mcp login
```

## Building it yourself

```bash
pnpm install
pnpm build          # bundles dist/cli.mjs and dist/server.mjs
pnpm test           # unit tests, no network
pnpm typecheck
```

End to end, against a running backend — this one creates a real account and a real project:

```bash
PROMPT_STUDIO_API_URL=http://localhost:8010 node tests/e2e.mjs
```

### The vendored studio

`src/studio/` is a copy of the slice of Prompt Studio this server needs: the Flow parser, the serializer, the merge rules and the prompt engine. It is vendored rather than imported so that installing this package does not require checking out the app — which is the entire point of shipping it separately.

To refresh it against a local checkout:

```bash
pnpm sync           # defaults to ../prompt-studio
git diff            # this is the review
```

The sync script walks the real import graph from a handful of entry points, so it copies exactly what is reachable and nothing else. It refuses to vendor React components — one appearing means a barrel file is being imported where a direct module should be.

## Licence

MIT.
