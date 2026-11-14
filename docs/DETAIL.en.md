# Grove

Grove turns DeepSeek Harness conversations into versioned knowledge assets in an Obsidian vault: inspirations, questions, concepts, theories, judgements, methods, outputs, explorations and research projects. AI helps you think; **every saved asset is confirmed by you**.

## What it provides

Three model tools, registered inside the host:

| Tool | Purpose | Boundary |
| --- | --- | --- |
| `grove_role` | Returns the collaboration guidance for a role you named explicitly (`thinking` / `knowledge` / `research` / `critical` / `creation`) | Read-only text; never touches the vault |
| `grove_propose` | Drafts one proposal from your request and writes it as `.proposal.json` | Does not create an asset; only `grove accept` in your terminal saves it |
| `grove_read` | Reads one asset you explicitly shared | Only IDs listed in `GROVE_READABLE_IDS` |

There are ten asset types: inspiration, question, concept, theory, claim, evidence, method, output, exploration and research. Research projects and evidence are recorded through the terminal commands; the model may only draft the other types.

## How to use it

1. Configure the vault: the plugin config field `vault`, or the `GROVE_VAULT` environment variable. It must be an **absolute path to a real directory**; symlinks in the path are rejected.
2. Talk to the agent; ask it to call `grove_role` when you want a different way of collaborating.
3. To keep part of a discussion, ask it to call `grove_propose`, passing the conversation reference you want saved as `origin`.
4. In your terminal, `grove preview <draft-id>` to review, `grove accept <draft-id>` and type `SAVE` to save, or `grove discard <draft-id>`.
5. `grove list` / `grove show <asset-id> --version <N>` to look back; `grove update` writes a new version and leaves the old version's evidence links on it.

## Where the data lives

Everything is under `<vault>/Grove/`: one file per asset, `<id>.v<version>.md`, with YAML frontmatter, a Markdown body and Obsidian wikilinks; dot-prefixed `.proposal.json` files beside them are drafts. There is no database — copying the whole `Grove/` folder is the backup and the migration.

## Known limitations

- Evidence records only the source identifier and locator you type (`--source` / `--locator`). No attachment management, no automatic session locating.
- No dedicated Web UI: the surface is the in-session tools plus the terminal CLI.
- Saving must happen in an interactive terminal (`grove accept` asks you to type `SAVE`); the model cannot save on your behalf.
- Asset bodies are not given to the model by default; sharing requires `GROVE_READABLE_IDS` in advance, and turning sharing off needs a host restart.
- One note is capped at 1 MiB and a draft body at 128 KiB; `grove_read` refuses assets outside the sharing list and archived assets.
- The `grove` command comes from the package's `bin` and needs a global install; installing the plugin into a profile does not put it on `PATH`.
- Compatible with dsh `>=0.2.2-rc.1 <0.3.0`.
