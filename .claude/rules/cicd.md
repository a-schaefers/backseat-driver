---
paths:
  - ".github/**"
  - "scripts/ship.sh"
  - "scripts/github-settings.sh"
  - "scripts/release.sh"
  - "scripts/test_workflows.py"
---

# CI/CD

How a change reaches `main`. Adapted from the owner's merecatholicity.com pipeline (its `docs/architecture/CICD.md`, `scripts/ship.sh`, `terraform/github.tf`), minus everything about deploys: here the merge ships nothing, a release tag does.

## The road to main

- `main` takes no direct push (owner, 2026-10-10): the ruleset `.github/rulesets/main.json` wants a pull request, `check` green (from GitHub Actions, app 15368, so a status of that name from anywhere else satisfies nothing), and one approval; a push dismisses a stale approval. No force push, no deletion. Not strict: a pull request need not be on the newest `main`. No bypass actor: the owner, their agents and everyone else get the same rule.
- Auto-merge for the owner and the Claude sessions the owner drives, nobody else. `owner-merge.yml` (`pull_request_target`) approves a pull request whose author and event sender are user id 26800291 (a-schaefers), from this repository, not a draft, at the head it was woken for, then arms auto-merge if nobody has. Claude sessions here open pull requests and push as the owner, so they count as the owner. Anyone else's pull request (other people, other Claudes, Dependabot, forks) waits for the owner's approval by hand; so does the owner's own after someone else pushes to it, until the owner pushes again.
- A draft holds an owner's pull request back. "Ready for review" approves it and arms it (or merges it at once when `check` already passed).
- `owner-merge.yml` must never run the pull request's code: no checkout, no `uses:`, nothing from the event in a shell but the number, the head hash, the repository and the token. `scripts/test_workflows.py` (in `npm run tools`) holds it to that, and to its four conditions.
- Who arms auto-merge decides whether `main` gets its own `check` run: a merge armed with the workflow's token is GitHub Actions' push, which starts no workflow. So `scripts/ship.sh` and cloud sessions arm it as the owner (`gh pr merge --auto --merge`, or the GitHub tool's auto-merge); `owner-merge.yml` arms only when nobody has, and then the nightly run is `main`'s only check. Merge commits by default (`--squash` in `ship.sh` for one commit).

## Shipping

- Local: commit on a branch (or a detached worktree), `scripts/ship.sh`: pushes `HEAD` to the branch (a detached `HEAD` ships as `agent/<worktree>`), opens the pull request or finds the open one, arms auto-merge as you with `--match-head-commit`, waits for the merge or names the failing check. It refuses to ship from `main` and acts only on this repository's own pull request at the commit it pushed. `--draft` opens one that waits. A red check leaves auto-merge armed: fix, commit, run it again.
- Cloud sessions: push the session branch, open the pull request, arm auto-merge (merge commit). Fix a red `check` on the same branch.
- Releases: `scripts/release.sh minor --push` commits the bump on `release/vX.Y.Z`, ships it, then tags the pull request's merge commit with `claude plugin tag` and pushes the tag. Tags are not under the ruleset.

## Settings

- Kept in `scripts/github-settings.sh` (`check` reads GitHub and names any drift; `apply` writes it, needs `gh` as admin): the ruleset; Actions may approve pull requests, default token read only; auto-merge, merge commits, delete branch on merge, update branch; only GitHub-owned and verified actions, each pinned to a commit (`sha_pinning_required`); a fork's workflows wait for approval every time (`all_external_contributors`); secret scanning with push protection; Dependabot alerts and security fixes.
- Order matters the first time: `owner-merge.yml` must be on `main` before the ruleset is applied, or the owner's next pull request has nobody to approve it.
- The emergency door: when `check` itself is broken and its fix cannot pass it, the owner sets the ruleset's enforcement to disabled, merges the fix, and sets it back (`check` shows the drift if forgotten). Never a bypass actor.

## Workflows

- `check.yml`: `npm run check` on every pull request and push to `main`, Claude Code pinned. Its `check` job is the required check: never path-filter it (a required check that never reports holds a pull request at "Expected" for ever), never rename the job without the ruleset.
- `nightly.yml`: the same on the newest Claude Code, daily; red means Claude Code changed, not that `main` broke.
- `owner-merge.yml`: above.
- Every `uses:` names a commit with a `# vX.Y.Z` comment (GitHub enforces it once the setting is on; the test before that). `.github/dependabot.yml` bumps the action pins weekly as one pull request, and the dev toolchain's minor and patch bumps as another; a major comes alone. Each waits for the owner's approval.
- Not taken from merecatholicity.com: the pipeline report comment, Terraform, deploy gates and environments (nothing deploys on a merge here).

## Verified

Tests only (`scripts/test_workflows.py`). Not yet seen on GitHub: `owner-merge.yml` approving and arming, the ruleset holding a push, `github-settings.sh` against the API, `ship.sh` and `release.sh --push` end to end.
