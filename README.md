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

### As a Claude Code plugin — nothing to install first

```
/plugin marketplace add faizanahmed-sy-devstree/prompt-studio-mcp
/plugin install prompt-studio@prompt-studio
```

The server is bundled in the repo, so this needs no npm, no build step and no
Node toolchain beyond the one Claude Code already runs on. Then sign in once —
the server tells you the exact command for your installation if you ask it to
do anything before you have:

```bash
node ~/.claude/plugins/cache/*/prompt-studio/*/dist/cli.mjs login
```

### From npm

Not published yet — use the plugin above until it is.

```bash
# 1. sign in once, on this machine
npx prompt-studio-mcp login

# 2. register it with Claude Code
claude mcp add prompt-studio -- npx -y prompt-studio-mcp serve
```

### Either way

`login` asks for your Prompt Studio email and password, exchanges them for tokens, and stores **only the tokens** in `~/.prompt-studio/credentials.json` (owner-readable). Your password is never written to disk, and never goes anywhere near your Claude Code config.

Check it worked — `whoami` sits next to `login`, so use whichever of the two
paths above you installed with:

```bash
npx prompt-studio-mcp whoami          # npm install
node <plugin-dir>/dist/cli.mjs whoami # plugin install
```

The server acts as **you**. It reaches exactly the projects your account can reach, and every change is attributed to you in the project's activity feed. There is no service account and no shared credential.

## Commands

| Command | What it does |
| --- | --- |
| `/prompt-studio:login` | The sign-in command for *this* installation, with the path filled in. |
| `/prompt-studio:projects` | Your projects, as a table. |
| `/prompt-studio:link` | Tie this repo to a project and a `.flow` file. |
| `/prompt-studio:sync` | Whether the file and the project still agree. |
| `/prompt-studio:flow` | Change the project by describing what you want. |
| `/prompt-studio:prompt` | The build prompt, ready to paste elsewhere. |
| `/prompt-studio:discover` | Push a discovery run to the studio and wait for the decisions. |
| `/prompt-studio:review` | Where the discovery run has got to, and what is still open. |

You never have to use them — asking in plain English reaches the same tools.
They exist because nothing in the slash menu otherwise says the server is here.

`/prompt-studio:flow` is the one worth knowing: it reads the grammar first and
checks the source before saving, which is the difference between one write and
three failed ones against a live project.

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
| `discovery_push_run` | Send `weave/discovery/questions.json` as a run, and record its id. |
| `discovery_push_docs` | Upload `weave/`, skipping unchanged files; merge `weave/schema.flow` onto the Data canvas. |
| `discovery_status` | Progress per module, which root questions are still open, whether it is done. |
| `discovery_wait` | Poll until the run is done, up to five minutes a call. |
| `discovery_list_items` | The questions, filtered by module, family, needs-a-person or unanswered. |
| `discovery_answer` | Record one decision, by question key. |
| `discovery_accept_defaults` | Accept the proposed answer on named keys, a module, or every standing rule. |
| `discovery_answers` | Every decision recorded so far. |
| `discovery_writeback` | Fold the decisions back into `issues.md` / `features.md` and re-push them. |
| `artifact_list` / `artifact_read` / `artifact_write` | The project's files, one at a time. |
| `list_members` / `add_member` | Who can open the project; share it with a colleague. |
| `list_comments` / `add_comment` / `resolve_comment` | Review notes on the project. |
| `list_activity` | What changed, newest first. |
| `create_api_token` / `list_api_tokens` / `revoke_api_token` | Personal API tokens for CI and `weaver push`. |

## Keeping a `.flow` file in your repo

The diagram lives in Prompt Studio, but the *text* of it can live next to your code, where it can be reviewed in a pull request like anything else:

```
claude: link this repo to my dispatch project
```

That writes two files — a `.flow` file holding the diagram as text, and a small `.prompt-studio.json` recording which project it belongs to. **Commit both.**

From then on the file is kept current automatically: any `write_flow` updates it too, so it never silently becomes the stale copy. `sync_status` tells you which side has moved, `pull_flow` brings the studio's version down, and `push_flow` sends yours up.

## Discovery: deciding before building

Weaver reads a prototype and produces a knowledge base — an inventory, a list of
every conflict and gap it found, a feature table, a schema, a diagram per
journey — and a list of questions that have to be decided before any of it can
be built. On a real product that is a couple of hundred decisions, which is more
than a chat window can carry.

So the decisions get made in the studio instead. The whole `weave/` folder is
pushed to the project, the questions become a run, and a person answers them in
the Discovery tab — organised by module, root questions first — while Claude
waits.

```
claude: /prompt-studio:discover
        → pushed 178 questions as run 4f2c…
        → answer them here: https://your-studio/discovery?p=<project>
        → 40/178 answered · Finance 4/30 ←
        → done. wrote back 138 issue decisions and 40 feature decisions. 0 PENDING left.
```

The write-back matters: the gate that lets the build step start is a `grep` for
`PENDING` in `weave/discovery/*.md`, so a decision that lived only in the
database would be a decision the build never saw. `discovery_writeback` puts
each one into the block or table row it belongs to and re-pushes the files.

`weave/schema.flow` is a `data { … }` block, and `discovery_push_docs` merges it
into the project document — so the tables land on the **Data canvas** that is
already there, rather than in a picture of a schema nobody can edit.

From a terminal, without Claude:

```bash
npx prompt-studio-mcp push-weave [dir]        # push weave/ to the linked project
npx prompt-studio-mcp discovery status        # how far through the questions it is
npx prompt-studio-mcp token create "CI push"  # an API token for CI — set it as STUDIO_TOKEN
```

The token is a personal one: it acts as you, with your access to your projects,
and it is shown once. Use it as a bearer token against `/api/v1` from CI or
`weaver push`, where there is nowhere to type a password.

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
| `PROMPT_STUDIO_APP_URL` | guessed from the API URL | The studio itself, for the links the discovery tools print |

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
