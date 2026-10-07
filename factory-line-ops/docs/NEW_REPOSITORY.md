# New repository

Factory Line Operations is a **new product**. It must live in its own GitHub repository, not in [wolf359-ai/idev](https://github.com/wolf359-ai/idev).

The current GitHub repository hosts an unrelated application. This project is a Splunk app + technology add-on with its own packaging, CI (AppInspect), indexes, and access model. Sharing a repo would couple unrelated release cycles, licenses, and reviewers.

## Proposed GitHub repo

| Field | Value |
| --- | --- |
| Owner | `wolf359-ai` |
| Name | `factory-line-ops` |
| Visibility | Private until the first AppInspect-clean package exists |
| Default branch | `main` |
| Description | Splunk app for real-time factory line shift and personnel monitoring, with multi-factory business rollup |

Splunk app folder IDs (underscores, required by Splunk) stay inside `packages/`. The GitHub repo name uses hyphens.

## Why this agent cannot create it

The cloud agent on idev has a **read-only** GitHub CLI. It can push branches and open PRs on `wolf359-ai/idev` only. Creating `wolf359-ai/factory-line-ops` has to be done by a human (or a later agent with repo-create permission).

## Create the repo (owner)

From a machine that can create repositories under `wolf359-ai`:

```bash
gh repo create wolf359-ai/factory-line-ops \
  --private \
  --description "Splunk app for real-time factory line shift and personnel monitoring" \
  --disable-wiki

git clone git@github.com:wolf359-ai/factory-line-ops.git
cd factory-line-ops

# Copy this seed (the factory-line-ops/ folder in the idev PR) to the new repo root:
rsync -a --exclude .git /path/to/idev/factory-line-ops/ ./

git add .
git commit -m "Initial seed: Factory Line Operations Splunk app plan and packages"
git push -u origin main
```

After that, all implementation work happens on `factory-line-ops`, not on idev. Delete the staged copy from idev once the new repo has the same files on `main`.

## What belongs in the new repo

- `packages/TA-factory_line` and `packages/factory_line_ops`
- `docs/`, `samples/`, `scripts/`, `Makefile`
- GitHub Actions for AppInspect (`--included-tags cloud` and `private_app`)
- Sample events with **fictional** workers only

## What must never go in either repo

- HEC tokens, Splunk passwords, client secrets
- Real employee names, badge numbers, or HR extracts
- `local/` Splunk overrides from a live instance
- Certificate private keys
