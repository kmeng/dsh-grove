# Grove · development contract

> Read this first, whichever AI tool you use. `CLAUDE.md`, `.cursor/rules/project.mdc` and `.github/copilot-instructions.md` are adapters that point here; they do not copy the rules.
> The rules migrated from Maestro's session protocol and the principle layer of 案随's `guard-template`, minus anything tied to team size, model pricing or internal links.

## What this repository is

- A DeepSeek Harness (dsh) plugin, and specifically a dsh **bundle**: `package.json`'s `dsh.bundle.patch` points at `cordis.patch.yml`, which inserts one `grove` row into the host composition.
- Host-only, no web UI. The surface is three model tools (`grove_role` / `grove_propose` / `grove_read`) plus one terminal CLI.
- User data lives in **the user's** Obsidian vault. The repository stores no user content; tests only ever write to temporary directories.
- Support range is declared by `engines.dsh`: `>=0.2.2-rc.1 <0.3.0`.

## Session-start protocol (every new session)

1. Read the newest entry in `docs/journal/` to learn where the last session stopped.
2. Run `gh issue list --state open` to see what is in flight.
3. Run `git status` and `git branch --show-current`; confirm a clean tree and the expected branch.
4. Restate in three sentences: where the project stands, what is open, and what I understand you are asking for.
5. Wait for confirmation before acting. For read-only questions ("what does this field mean") compress step 4 into one sentence and just answer.

After a merged PR, a closed issue or a major decision, offer to add a `docs/journal/` entry. Do not decide on your own that the session is over.

## Change workflow

### 1. Analyze first

Restate the request as checkable acceptance criteria: what to do, what not to do, how to prove it. Write down the definition of "done" before moving on.

### 2. Design second

For any non-trivial change, propose a plan first: which files move, whether interfaces or data shapes change, what the failure modes are. Decisions with long-term consequences (dependencies, host contract, storage format) go into [`docs/development/DECISIONS.md`](docs/development/DECISIONS.md).

### 3. Break into closed loops

One PR = one closed loop = one verifiable result. No half-finished work such as "an interface with no caller". See [`docs/development/ISSUE_HIERARCHY.md`](docs/development/ISSUE_HIERARCHY.md) for how to split.

### 4. Implement

- Branches: `fix/<issue>-<slug>`, `feat/<issue>-<slug>`, `docs/<issue>-<slug>`.
- Commits: Conventional Commits (`fix:` / `feat:` / `docs:` / `test:` / `chore:`); the body says **why**.
- Keep one PR to one topic; put incidental formatting in its own commit with a note.

### 5. Verify (the minimum evidence for this repo)

All four, or it is not done:

```sh
npm ci && npm test                 # unit tests + manifest/asset contract
npm pack --dry-run --json          # must include icon/locale/docs/src/patch, must not include test/ brand/
bash scripts/check-compat.sh       # ask the running dsh whether engines.dsh really admits it
bash scripts/verify-install.sh     # install into a scratch profile, prove the grove row appears, clean up
```

All four are required when the bundle's load behaviour changes (`cordis.patch.yml`, `engines`, entry files); the first two suffice for documentation or brand-only changes.

When you touch the icon or the locale files, confirm with the host's `readPluginMeta` that title/description/icon are readable, rather than "looks fine".

### 6. Deliver

Write the PR description per [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md): what changed, key files, the commands actually run with their real output, risks and gaps, `Closes #n`. Never describe a command you did not run as if you ran it.

## Hard rules

| ID | Rule |
| --- | --- |
| H1 | **Never commit secrets.** Before committing, scan for `sk-`, `Bearer `, `password`, `token`, `api_key`; `.env` and `*.key` stay in `.gitignore` forever. |
| H2 | **Never push to `main`.** All changes go through a branch and a PR; `main` is protected by convention. |
| H3 | **Announce destructive operations before running them.** `rm -rf`, `git reset --hard`, `push -f`, overwriting files, deleting remote branches: state the target and the impact first. |
| H4 | **Never invent content.** Do not claim to have read a file you did not read, or to have run a command that failed to run; when the user says "wait for me to paste it", stop and wait. |
| H5 | **Say "I don't know"** and state which information would settle it. |
| H6 | **Share the plan before acting.** Do not bundle several speculative steps into one change. |
| H7 | **Protected documents**: changes to `AGENTS.md`, `README.md`, `brand/VI*.md` and `docs/development/*` need their own issue/PR and must not ride along with a feature change. |

## Bug protocol

The failing test comes first; the order cannot be reversed:

1. Reproduce → write a test that fails;
2. Commit that test (and say why it fails);
3. Fix → the test turns green;
4. Commit the fix;
5. The PR carries both commits in this order.

Fix the root cause, not the symptom, and put the root cause in the issue. What genuinely cannot be automated goes into the "known limitations" part of `docs/development/DECISIONS.md`, with a code comment pointing at it.

## Definition of Done

The full checklist is in [`docs/development/DEFINITION_OF_DONE.md`](docs/development/DEFINITION_OF_DONE.md). Summary: every acceptance criterion has evidence, tests are green, a real install was verified, documents are in sync, no secrets or debug residue remain, and `main` is still installable and runnable after the merge.

## Communication

- Lead with the conclusion and the plan; skip reassurance filler.
- Say "I'm not sure" plainly instead of hiding a guess behind confident phrasing.
- When the task is ambiguous, ask one focused question, not five.
- Report errors as three sentences: what failed / why / what to do next.

## AI attribution

When AI produced substantive code, name the actual model at the end of the commit message:

```
Co-authored-by: deepseek-flash <noreply@deepseek.com>
Co-authored-by: claude-opus <noreply@anthropic.com>
```

One line per model that took part; if you do not know the model name, leave it out rather than inventing one.

## Document map

| File | Purpose |
| --- | --- |
| [`docs/development/README.md`](docs/development/README.md) | Philosophy overview and sources |
| [`docs/development/ISSUE_HIERARCHY.md`](docs/development/ISSUE_HIERARCHY.md) | Task levels and how to split them |
| [`docs/development/DEFINITION_OF_DONE.md`](docs/development/DEFINITION_OF_DONE.md) | Close-out conditions per task type |
| [`docs/development/REVIEW_CHECKLIST.md`](docs/development/REVIEW_CHECKLIST.md) | Review checklist |
| [`docs/development/DECISIONS.md`](docs/development/DECISIONS.md) | Decision log and existing decisions |
| [`docs/development/HANDOFF.md`](docs/development/HANDOFF.md) | Cross-session handoff and the journal convention |
| [`brand/VI.en.md`](brand/VI.en.md) | Visual identity (English) |
| [`docs/DETAIL.en.md`](docs/DETAIL.en.md) | Plugin detail page copy |

中文版本：[`AGENTS.md`](AGENTS.md)
