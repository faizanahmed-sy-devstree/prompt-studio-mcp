---
description: Tie this repo to a Prompt Studio project and a .flow file
argument-hint: [project name or id]
---

Link this repository to a Prompt Studio project so the diagram lives in the
repo as text: $ARGUMENTS

Steps:
1. `list_projects`, and match $ARGUMENTS against the names. If it is empty or
   matches several, show the candidates and ask which — do not guess.
2. `link_project` with the chosen id.
3. Tell them the two files written (the `.flow` file and `.prompt-studio.json`)
   and that **both should be committed**.

Do not commit them yourself.
