# Other model backends: OpenAI, Google, Ollama

Research note, 2026-10-05. Read against Claude Code 2.1.289, the docs at code.claude.com as of today, and `main` at `1b2ce36`. The terms section is a reading, not legal advice.

## Recommendation

Do it in two stages, and don't bend Claude Code itself.

1. **Inside Claude Code, let the tutor's own background jobs run on any model.** The conversation stays on Claude, because that is Claude Code. But the play-by-play, Explain, the progress look and (later) the deep review are the mod's own requests. A mod can send those anywhere with `$.http.fetch`, using the user's own OpenAI key, Google key, or a local Ollama server. That's a plugin calling an API: documented, nothing modified, nothing intermediated. It also gives the cheapest setup there is: a free, local Qwen watching every save, with Claude only in the chat.
2. **For people who don't use Claude Code, ship a second client on OpenCode.** OpenCode is MIT-licensed, speaks to OpenAI, Google and Ollama out of the box, and has a TypeScript plugin API with the two hooks the contract needs: rewrite the system prompt, and refuse an edit. Stage 1's seams are what make that a port and not a rewrite.

Pointing Claude Code wholesale at GPT, Gemini or Qwen (through `ANTHROPIC_BASE_URL`, a router, or Ollama's Anthropic endpoint) works technically, but a mod can't do it, Anthropic says it doesn't support it, and building a product on it is where the terms get uncomfortable. Don't build on it. Don't break if a user does it on their own.

## The options

| Option | What it is | Works? | Allowed? | Verdict |
| --- | --- | --- | --- | --- |
| A. Reroute Claude Code itself | User sets `ANTHROPIC_BASE_URL` to Ollama (native `/v1/messages`), LiteLLM, or claude-code-router (OpenAI, Gemini, OpenRouter, Ollama…). Everything, conversation included, runs on the other model. | Yes, with rough edges: Claude Code sends Claude-only fields (adaptive thinking, effort, context management, beta tool fields) and the router has to translate or drop them. Tool use on small local models is shaky. | Unsupported and gray, see below. Not something a mod can switch on. | Don't build on it. Tolerate it. |
| B. Mod calls other models for its own jobs | The mod's `callModel` sends the play-by-play, Explain and progress requests to a chosen backend with `$.http.fetch`. Deep review gets a small tool loop of its own. | Yes. `$.http.fetch` is in the mod API: "http or https, to whatever the host reaches". | Yes, on this reading. | **Stage 1.** |
| C. Second client on OpenCode | The same engine and prompts, hosted by an OpenCode plugin. Conversation on any model OpenCode supports. | Yes. OpenCode has `experimental.chat.system.transform`, `tool.execute.before`, custom tools and file events. No pane API, so the pane lives in the editor plugins or a small terminal app. | Yes. No Anthropic service is involved at run time. | **Stage 2.** |
| D. Standalone Backseat Driver CLI with its own chat | Build a chat loop, tool calls, permissions and a TUI ourselves. | Yes, eventually. | Yes. | No. It rebuilds a coding agent to host a tutor. OpenCode already is one. |
| E. Gemini CLI or Codex CLI extensions | Same idea as C on Google's or OpenAI's own agent. | Partly: each covers mostly its own vendor's models. | Their own terms. | Later, if users ask. C covers all three backends at once. |
| F. Patch the Claude Code binary | Swap its API client. | Fragile. | No. | Never. |

### Why a mod can't do option A

- The backend is chosen from environment variables and settings read at startup (`ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, …). A mod loads after that.
- A plugin's own `settings` only take `agent` and `subagentStatusLine`: "other keys are dropped at load" ([manifest reference](https://code.claude.com/docs/en/plugins-reference)).
- `$.model.complete` "runs one text completion through the session's own API client" (mod types, `model.complete`). It goes wherever the session goes. It can't be pointed elsewhere.

So "hack Claude Code with a mod" can only ever mean option B: the mod's own calls.

## The terms, read

What applies to Claude Code: "Your use of Claude Code is subject to: Commercial Terms of Service — for Team, Enterprise, and Claude API users; Consumer Terms of Service — for Free, Pro, and Max users" ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). The Claude Code repository's own license says: "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service" ([LICENSE.md](https://github.com/anthropics/claude-code/blob/main/LICENSE.md)).

The passages this reading rests on:

1. **Non-Claude models through Claude Code are unsupported.** "Anthropic doesn't endorse, maintain, or audit third-party gateway products, and doesn't support routing Claude Code to non-Claude models through any gateway." ([Other LLM gateways](https://code.claude.com/docs/en/llm-gateway)). That's "not supported", not "forbidden". Nothing I found forbids a user from pointing their own copy at their own endpoint.
2. **Competing products.** Commercial Terms D.4: Customer may not "access the Services to build a competing product or service, including to train competing AI models", "reverse engineer or duplicate the Services", or "support any third party's attempt at any of the conduct restricted in this sentence" ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms), effective 2025-06-17). Consumer Terms §3 has the same idea: not "to develop any products or services that compete with our Services" ([Consumer Terms](https://www.anthropic.com/legal/consumer-terms), effective 2025-10-08).
3. **No modified binary, no borrowed logins.** For products that run Claude Code: "The Claude Code binary must not be modified." And: "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users." ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance))
4. **Reverse engineering.** Consumer Terms §3: not "to decompile, reverse engineer, disassemble, or otherwise reduce our Services to human-readable form".
5. **Third-party services are on the user.** Consumer Terms §7: "Your use of any Third-Party Content, services, and integrations is at your own risk and subject to any terms, conditions, or policies applicable to such third-party content, services, and integrations."

What I make of it:

- **Allowed (stage 1).** A plugin using Claude Code's documented plugin API, unmodified, calling OpenAI, Google or a local Ollama with the user's own key for its own side jobs. The Claude part (the conversation) is the user's own login on the unmodified binary, which the docs say is fine. The other providers' terms apply to those calls (§7), and so does each model's license (Qwen's open models are Apache-2.0).
- **Allowed (stage 2).** An OpenCode plugin. No Anthropic service runs in it. Developing it with Claude Code's help is ordinary use: a tutor plugin for another tool isn't a coding agent that competes with Claude Code. That's the weakest link in this reading, so if the owner wants certainty, ask Anthropic (the legal page links to [sales](https://www.anthropic.com/contact-sales)).
- **Gray (option A as a product).** A user rerouting their own Claude Code is unsupported but not prohibited by any passage above. Backseat Driver shipping or advertising "run Claude Code on GPT or Qwen" is different: it builds on Claude Code as a front end for competitors' models, which reads close to D.4's "support any third party's attempt". Don't.
- **Not allowed.** Patching the binary. Reusing a user's claude.ai login outside Claude Code. Putting "Claude Code" in a second client's name or logo (the legal page: no Anthropic names "as part of your own product, feature, or company name").

## The seams in the code

Most of the repo is already host-neutral. The Claude-specific parts sit in a short list of places, almost all in `plugin/hooks/register.tsx`.

### Already neutral (no change)

Pure modules with plain values in and out: `watcher.ts`, `git.ts`, `diff.ts`, `noise.ts`, `journal.ts`, `recorder.ts`, `attention.ts`, `enclosing.ts`, `glance.ts`, `knowledge.ts`, `explainer.ts`, `explain-prompts.ts`, `notes.ts`, `review.ts`, `reviewqueue.ts`, `progress.ts`, `authorship.ts`, `profiles.ts`, `project.ts`, `languages.ts`, `store.ts`, `locks.ts`, `lease.ts`, `scheduler.ts`, `sensor.ts`, `focus.ts`, `working.ts`, `questions.ts`, `forget.ts`, and the PureScript kernel. The engines already take ports (`explainer.ts`, `recorder.ts`), and the health model's troubles (`rate-limit`, `overloaded`, `server`, `offline`, `timeout`, `account`, `job`, `reply`) fit any provider. The prompts in `plugin/prompts/` and the personas say nothing that needs Claude. The editor protocol (`focus.json`, `view.json`) is neutral by design, and the `claude/editor-plugins` branch builds on it.

### Claude-specific (the seams)

| # | Where | What it assumes | Seam |
| --- | --- | --- | --- |
| 1 | `register.tsx:689` `callModel` | Every model request goes to `$.model.complete`. | **Model port.** The one choke point for the play-by-play, Explain and progress. Dispatch by backend here. |
| 2 | `core.ts:103` `outcomeOf`, `:113` `outcomeOfError` | Claude Code's result shape and Anthropic's error words. | One `outcomeOf` per backend, each mapping HTTP status and body to the same troubles. |
| 3 | `register.tsx:1560` `$.agent.register`, `:1926` `$.agent.spawn`, `turn.complete` (`:3610`), `classic.StopFailure` (`:3685`), `agent.offer` | The deep review is a Claude Code subagent with Read, Grep and Glob. | **Reviewer port.** Claude: as now. Others: the mod runs the tool loop itself (function calling, `$.fs.read`, `$.fs.list`, `git grep` through the existing git call). |
| 4 | `register.tsx:721` `readPressure`, `session.measure` (`:3705`), `gate.ts` `usagePressure` | Claude plan windows (`rateLimits`, `resetsAt`). | **Pressure port.** Others: none, or derived from `429` and `retry-after`. The kernel's pacing already accepts "no pressure". |
| 5 | `settings.ts:88-99`, `plugin.json` `userConfig` | Model aliases `haiku`, `sonnet`, `opus`, `fable`; effort `low…max`. | Add a backend per job, a free-text model, and keys. Effort maps to `reasoning_effort` where the provider has it, and is dropped where not. |
| 6 | `status.ts:20-24` | Says "Claude is rate limited", "no connection to Claude". | Name the backend in use ("Ollama is not answering"). |
| 7 | `contract.ts:84`, `:96`; `prompt.compose` (`:3559`), `prompt.context` (`:3575`) | Claude Code's system prompt section ids (`doing_tasks`) and its `claudeMd` block. | **Host port: contract.** Stays Claude Code's. OpenCode's version uses `experimental.chat.system.transform`. |
| 8 | `register.tsx:3836` `tool.call` on `Edit`, `Write`, `NotebookEdit`; `guard.ts` | Claude Code's tool names and `~/.claude` paths. | **Host port: edit guard.** OpenCode: `tool.execute.before` on `edit`, `write`, `patch`, throwing to refuse. |
| 9 | `$.tool.register` (8 tools), `SESSION_NOTES` | Tools served by the mod, named for `/bsd`. | **Host port: tools.** OpenCode custom tools take the same inputs. |
| 10 | `pane.tsx`, `ui.render` (`:3845`), `$.ui.ask`, `$.ui.toast` | Claude Code's renderer. | **Host port: UI.** `pane.tsx` already draws from plain `PaneView`. OpenCode has toasts only, so its pane is `view.json` read by the editor plugins, or a small terminal app. |
| 11 | `update.ts` | `claude plugin` commands and Claude Code's install layout. | Per host. |

### How to rearrange it

Keep the module-shape rule (every `on(...)` and `$` call spelled in `register.tsx`). The ports are closures over `$`, exactly as the store and the engines get theirs today.

1. **`backend.ts` (pure, new).** Types `Backend = 'claude' | 'openai' | 'google' | 'ollama'`, `ModelRequest` (system, prompt, max tokens, effort, timeout), and two functions per backend: `httpRequestOf(backend, request) → { url, init }` and `outcomeOfHttp(backend, status, body) → Outcome`. OpenAI, Google and Ollama all speak OpenAI-style chat completions, so that's one wire format with three base URLs plus the Claude path:
   - OpenAI: `https://api.openai.com/v1/chat/completions`
   - Google: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (Gemini's OpenAI-compatible endpoint; Google's page was blocked from this sandbox, so confirm it before building)
   - Ollama: `http://localhost:11434/v1/chat/completions`, or its Anthropic-format `/v1/messages`
   No SDKs: the mod can't import npm packages, and plain `fetch` code runs unchanged in Bun and Node for stage 2.
2. **`callModel` dispatches.** `claude` → `$.model.complete` as now. Anything else → `$.http.fetch(url, init)` → `outcomeOfHttp`. Health, pacing and retries stay as they are.
3. **Which backend a job uses is a kernel decision.** Put "which backend for this job, and what to do when it's blocked" in `Kernel.Backend`, per the rule that new decision logic is born in PureScript. Example: fall back to Claude for a job whose backend is down, or hold it. That's an owner choice; the default is hold, so nobody pays for a request they didn't pick.
4. **Deep review on other backends, in two steps.** First, no tools: send the commit's diff and the touched files whole (the request already has them), and accept a shallower review. Then the tool loop, capped by turns and bytes.
5. **`engine.ts` for stage 2.** Move what `register.tsx` keeps in module variables (the watcher, the look, the review queue, the journal, Explain, the lease) behind one `createTutor(ports)` in a pure file. `register.tsx` becomes the Claude Code adapter. This is the big step: `register.tsx` is ~3,950 lines. Do it after the kernel port (`claude/finish-kernel-port`) lands, since it moves the same code.
6. **Layout for stage 2.**
   ```text
   plugin/                      Claude Code plugin, unchanged in shape; still everything shipped
   plugin/hooks/*.ts            the shared core (pure modules, engine.ts, backend.ts, kernel.js)
   clients/opencode/            OpenCode plugin: index.ts imports ../../plugin/hooks/*, built with esbuild
   editors/                     the editor plugins (already on claude/editor-plugins)
   ```
   The core stays inside `plugin/` because Claude Code installs only that folder. The OpenCode client bundles from it into one file and is published to npm.

## Setup: stage 1 (the next thing to build)

### Owner decisions first

- `$.http.fetch` is a new kind of call. CLAUDE.md's footprint invariant says that needs the owner's decision and a README update: the tutor would then call the network of the user's chosen model provider, and only when they choose one.
- How keys arrive. Preferred: `sensitive: true` fields in `userConfig`, which Claude Code keeps "in the platform's secure credential store instead" of `settings.json`. Check in the first live probe that a mod's `options` actually receives sensitive values. Fallback: `$.env.get('OPENAI_API_KEY')` and `$.env.get('GEMINI_API_KEY')`, which changes the `env reads:` list the README states.
- Fallback when a non-Claude backend is down: hold (default) or use Claude.

### Settings to add (`plugin.json` `userConfig`)

| Key | Type | Default |
| --- | --- | --- |
| `play_by_play_backend`, `explain_backend`, `deep_review_backend` | picker: `claude`, `openai`, `google`, `ollama` | `claude` |
| `play_by_play_model`, `explain_model`, `deep_review_model` | becomes free text when the backend isn't `claude` (pickers only take fixed lists, so add `*_other_model` text fields beside the alias pickers) | as now |
| `ollama_url` | string | `http://localhost:11434` |
| `openai_api_key`, `google_api_key` | string, `sensitive` | none |

### What a user does

Ollama with Qwen (free, local):

```bash
# install from https://ollama.com, then:
ollama pull qwen3-coder
ollama serve              # if it isn't already running as a service
```

Then in Claude Code: `/config`, Backseat Driver, set the play-by-play and Explain backend to `ollama` and the model to `qwen3-coder`. Keep deep review on `claude` until the tool loop lands. Small local models get the JSON reply formats wrong more often: the parsers already drop a reply they can't read, which costs a look and nothing else.

OpenAI or Google: create a key (platform.openai.com, or aistudio.google.com for Gemini), paste it into `/config`, pick the backend, type the model id from the provider's model list.

### Build order

1. `backend.ts` with table tests for every backend's request and error mapping. Kit: a fake `$.http.fetch` beside the fake `$.model.complete`, with the same `session.failing` words.
2. `callModel` dispatch, the settings, the status wording. Play-by-play and Explain work on all four backends.
3. Live check with Ollama and `qwen3-coder` (the owner's machine; cloud threads have no Claude login).
4. Progress look on other backends.
5. Deep review without tools, then with the tool loop.

## Setup: stage 2 (second client)

Stack: TypeScript, OpenCode's plugin API (`@opencode-ai/plugin`), Bun (OpenCode's runtime), esbuild into one file, published to npm as `backseat-driver-opencode`. Same prompts, personas, kernel and engine as the Claude Code plugin.

| Tutor need | Claude Code today | OpenCode |
| --- | --- | --- |
| Contract in the system prompt | `prompt.compose`, `prompt.context` | `experimental.chat.system.transform` |
| Never edit the user's files | `tool.call` deny | `tool.execute.before`, throw on `edit`, `write`, `patch` |
| Tutor tools (`hush`, `lookup`, …) | `$.tool.register` | custom `tool({...})` |
| Saves and commits | the scan | `file.watcher.updated` and `file.edited` events, plus the same git checks |
| Background model calls | `callModel` | `backend.ts` directly |
| Pane | `ui.render` | `view.json` in the editor plugins, or a small terminal app; toasts for notices |
| Settings | `/config` | `opencode.json` plugin options |

What a user would do:

```bash
# install OpenCode (https://opencode.ai), then in opencode.json:
{ "plugin": ["backseat-driver-opencode"] }
# pick any provider OpenCode supports: OpenAI, Google, or Ollama with qwen3-coder
```

The hooks whose names start with `experimental.` may change under us: pin the OpenCode version the client is tested on, the way `check.yml` pins Claude Code.

## Sources

- Claude Code: [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), [Other LLM gateways](https://code.claude.com/docs/en/llm-gateway), [Gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol), [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference), mod API types (`plugin/.claude-plugin/types/claude-code/index.d.ts`, 2.1.289: `model.complete`, `http.fetch`, `PluginOptions`), [LICENSE.md](https://github.com/anthropics/claude-code/blob/main/LICENSE.md)
- Anthropic: [Commercial Terms](https://www.anthropic.com/legal/commercial-terms), [Consumer Terms](https://www.anthropic.com/legal/consumer-terms), [Usage Policy](https://www.anthropic.com/legal/aup)
- Ollama: [Anthropic compatibility](https://github.com/ollama/ollama/blob/main/docs/api/anthropic-compatibility.mdx), [Claude Code integration](https://github.com/ollama/ollama/blob/main/docs/integrations/claude-code.mdx)
- Routers: [claude-code-router](https://github.com/musistudio/claude-code-router)
- OpenCode: [plugins](https://opencode.ai/docs/plugins/), [plugin types](https://github.com/sst/opencode/blob/dev/packages/plugin/src/index.ts)
