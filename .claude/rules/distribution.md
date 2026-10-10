---
paths:
  - "plugin/core/license.ts"
  - "plugin/core/licensekey.ts"
  - "plugin/core/update.ts"
  - "kernel/src/Kernel/License.purs"
  - "license-server/**"
  - "scripts/release.sh"
  - ".claude-plugin/**"
  - "plugin/.claude-plugin/plugin.json"
  - "plugin/tests/license.test.ts"
  - "plugin/tests/update.test.ts"
---

# Distribution

## License

- `license.json` (data folder): `use` (`personal | commercial | null`), `isAsked`, `key`, `keySince`, `answer` (`active | revoked | unknown | null`), `answeredAt`, `triedAt`. Forgetting everything removes it.
- Asked once ever, fresh switch-on, after the language questions (`startLicense` in `engage`, `askLicense`): personal or commercial; commercial asks for the key (free text; "add it later" the option). A key typed into the first question counts as commercial. Dismissing is an answer (`isAsked`). Kit tests that count questions seed `LICENSE_ANSWERED`.
- Not `userConfig`: it outlives reinstalls and install methods, and a change does not reload the mod. `/backseat license [personal | commercial | <key> | clear]`, works while off.
- Key: `BSD1.<payload>.<signature>`; payload JSON in base64url (`v, kid, id, to, seats, iat, exp`); ECDSA P-256 SHA-256 over the payload's base64url text, r‖s, checked in BigInt (`crypto.subtle` is `digest` only). `licensekey.ts` imports nothing, so the server's tests import it. `checkKey`: `malformed`, `forged` (bad signature or unknown `kid`), `unverified` (no public key or no SHA-256), `valid`. `PUBLIC_KEYS` is empty until the owner runs `keygen`, so a well-formed key is taken on trust.
- Standing (`Kernel.License`): `unchosen`, `personal`, `licensed`, `needs-key`, `bad-key`, `expired`, `withdrawn`, `unchecked` (no server answer for 30 days). A server's `unknown` is no news. Nothing ever stops working: `licenseLine`, one dim line under the update notice, commercial problems only (`license` state key; recomputed after `/clear`).
- `checkLicense` at a fresh switch-on and on a paste, when `nextLicenseCheck` says due (new key at once, 7 days after an answer, 1 day after none): `GET <server>/v1/keys/<id>`; 404 is `unknown`, unreadable is no answer. `LICENSE_SERVER` is '' until deployed. Off with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`.
- `license-server/` (dev only, not shipped or deployed; Node 22.18+ runs the TypeScript): `keys.ts` (keys, signing), `store.ts` (licenses in memory or one JSON file written by rename), `server.ts` (`GET /v1/keys/<id>`, `GET /v1/public-keys`; with the owner's bearer token `POST /v1/licenses`, `POST /v1/licenses/<id>/revoke|restore`, `GET /v1/licenses`), `cli.ts` (`keygen`, `issue`, `revoke`, `serve`). No payment, no secrets committed (`license-server/*.pem`, `licenses.json` ignored). `npm run server` checks its keys with the plugin's `checkKey`.
- Verified: tests only (question, `/backseat license`, key check). No server deployed.

## Updates and uninstall

- `update.ts` is pure. Effects: `detectInstall`, `checkForUpdate`, `runUpdate`, `removeHome`, `runUninstall` in `register.tsx`.
- Install kind (`<config>` = `CLAUDE_CONFIG_DIR` or `~/.claude`):
  - `clone`: the git top of `$.plugin.root` has `plugin/` as the root and `.claude-plugin/marketplace.json` (both: not a dotfiles repo around `~/.claude`).
  - `synced`: root under `<config>/plugins/synced/` (org or directory installs): self-updating, not in `installed_plugins.json`.
  - `installed`: an entry in `<config>/plugins/installed_plugins.json` whose `installPath` contains the root.
  - Otherwise `unknown` (the owner's live copy, `local/live/plugin`): its check asks the manifest's `repository`.
- Versions and releases:
  - An installed copy is pinned to `plugin.json` `version`; `claude plugin update` does nothing until it changes. A path marketplace copies too, so only `--plugin-dir` tracks the working copy. `marketplace remove` uninstalls its plugins and deletes their `pluginConfigs`; a reinstall at the same path keeps a stale `.orphaned_at`.
  - New installs copy `main` (entry `./plugin`); a release ref (`git-subdir` with `ref`) is the owner's open decision.
  - Tags: `backseat-driver--vX.Y.Z` (`claude plugin tag`); `newestRelease` also accepts `vX.Y.Z`.
  - `scripts/release.sh` refuses a dirty tree, a branch other than main, or being behind origin. After a release, `scripts/jack.py sync`, or the live copy announces it to the owner.
- Check: fresh switch-on, when `update.json` is missing or 6 h old.
  - `git ls-remote --tags --refs` against the clone's `origin`, Claude Code's marketplace clone, or the manifest `repository`, via `git(…, isNetwork = true)`: `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND=ssh -o BatchMode=yes`. Never prompts.
  - Failure writes nothing, retried next switch-on. A release known from the last check shows before the network is asked.
  - Off with the setting (`update_check`) or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. Notice in the `update` state key, under the status line.
- `/backseat update`:
  - clone: `git pull --ff-only` if `git status --porcelain --untracked-files=no` is empty; the reload follows, mode survives in state.
  - installed: `claude plugin marketplace update <mp>`, `claude plugin update <id>`, `$.command.run({ command: 'reload-plugins' })`. `$.plugin.root` changes per version (`cache/<mp>/<plugin>/<version>/`, old ones deleted after 14 days).
  - synced: says updates arrive by themselves. Every kind says when nothing was new.
- `/backseat uninstall`: Keep (Enter), uninstall and erase, or uninstall and keep.
  - Erase needs the typed phrase. `removeHome` deletes the folder only if `isOwnFolder` (only the marker and `REMOVABLE` entries).
  - Installed: `claude plugin uninstall <id> --yes`; the last line says how to remove the marketplace and what settings remain. A clone is told how to remove itself.
- Marketplace facts (2.1.289): auto-update is off by default for third-party marketplaces (`/plugin` → Marketplaces → enable). npm's `stable` dist-tag was 2.1.285, below the 2.1.287 mods need.
- Testing the marketplace path without GitHub (`file://` refused, a path never exercises update, plain HTTP fails on the shallow clone): serve a bare clone with `git http-backend` under `python3 -m http.server --cgi` (`cgi-bin/git` exporting `GIT_PROJECT_ROOT`, `GIT_HTTP_EXPORT_ALL`); `claude plugin marketplace add http://127.0.0.1:<port>/cgi-bin/git/<repo>.git --scope local`, then `claude plugin install … --scope local` from a scratch project. Clean up: `/backseat uninstall`, `marketplace remove backseat-driver --scope local`, delete `~/.claude/plugins/cache/backseat-driver`.
- Verified: live against a local git server (clone and installed 0.1.0 → 0.2.0, stayed on; dirty clone not pulled; uninstall with erase). Not seen: an install from GitHub told of a release and updating.
