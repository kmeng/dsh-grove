# Grove

![Grove. Build knowledge you can revisit and revise.](brand/exports/readme-header-1600x480.en.png)

[简体中文](README.md) · [English](README.en.md) · [MIT license](LICENSE)

## Why Grove exists

Grove started with a question. How can an idea, a conversation, or a round of research become knowledge you can find, verify, and revise later? Grove connects DeepSeek Harness to your own Obsidian vault so that work stays with you as Markdown.

The Personal Knowledge & Growth System (PKGS) connects exploration, learning, research, creation, and reflection. You can jot down a sentence or revise a judgment after trying it in practice, then carry that understanding into your next study. AI can compare explanations, ask questions, and draft. You decide what to believe, keep, and share. [PKGS guide](docs/PKGS.en.md)

## Core features

The features below describe this repository. Installations from npm use the version published in the registry. [npm package](https://www.npmjs.com/package/dsh-grove)

- **Capture ideas.** Jot down a thought, find it by keyword, and reopen an earlier version.
- **Research with evidence.** Start an independent study or configure a model to analyze selected excerpts. Import Markdown or PDFs with a text layer, save passages with paragraph or page locations, and confirm a report after review.
- **Build knowledge and create works.** Turn findings into concepts or methods, and use your knowledge to draft a work. Record why your understanding changed while keeping earlier references readable.
- **Keep your data locally.** Notes and versions live in the vault’s `Grove/` folder. The CLI can verify a backup and restore it to a separate directory.

## Install and use

Have an Obsidian vault ready. Check [`engines` in package.json](package.json) for the supported Node.js and DeepSeek Harness versions.

- **Install from npm.** Run `dsh plugin --profile <profile> add dsh-grove`.
- **Try the source in Desktop.** Open **Plugins → Add plugin** and select this repository directory. Restart the host after editing the source. Desktop manages its own profile.
- **Try the source in a separate profile.** From the repository root, run the following commands.

```sh
dsh plugin --profile grove-trial add "$PWD"
dsh --profile grove-trial
```

Open **Grove** (or **知林** in Chinese) in the sidebar, choose your vault, and save an idea. Open **Research** to save a question and observations, then add sources, capture evidence, or confirm a report as needed. For AI research, enter a Chat Completions-compatible HTTPS endpoint and model name in the research panel, and set `GROVE_MODEL_KEY` in the host environment.

Install the CLI separately with `npm install --global .` from the repository root, or run `npm install --global dsh-grove` for the published CLI.

```sh
export GROVE_VAULT="/absolute/path/to/Obsidian vault"
grove capture --body 'Why do the two sides of this street feel so different?'
grove list
grove show ASSET_ID --version 1
```

In a Harness session, use `grove_role` for collaboration guidance and `grove_propose` for drafts. Back in your terminal, run `grove preview DRAFT_ID`, then `grove accept DRAFT_ID` to confirm or `grove discard DRAFT_ID` to discard. To share selected assets with the model, configure the read allowlist. [Tools and permissions](docs/DETAIL.en.md)

Before upgrading, pause writes and run `grove backup /absolute/path/to/snapshot`. To restore, run `grove restore /absolute/path/to/snapshot --destination /absolute/path/to/new-vault`, check the restored files, and switch the panel to that directory. To remove the plugin, run `dsh plugin --profile <profile> remove dsh-grove`. Your vault data stays in place.

## Contributing

1. Check open issues. For a bug, include reproduction steps and the expected and actual behavior. For a feature, describe what the user needs and how to verify it. [Issues](https://github.com/kmeng/dsh-grove/issues)
2. Read the development contract and open a branch for a change reviewers can verify in one PR. Use a temporary vault and include actual test results and any gaps. [Development contract](AGENTS.en.md) · [Development guide](docs/development/README.md)
3. Run the checks below. Documentation and brand-only changes need the first two. Host checks use an installed dsh and a temporary profile.

```sh
npm ci && npm test
npm pack --dry-run --json
bash scripts/check-compat.sh
bash scripts/verify-install.sh
```

See the [journal](docs/journal/) for handoffs and release history and the [brand guide](brand/README.en.md) for logos and visual identity.
