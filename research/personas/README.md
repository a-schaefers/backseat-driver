# Persona research

One file per persona, on how the person behind it speaks and how they judge code, from their own talks, posts, books, code and streams, with sources. The persona prompts in `plugin/personas/` are short and are what the models read. These files are the reference those prompts are checked and rewritten against. Nothing here ships with the plugin.

| Persona | Research | Prompts |
| --- | --- | --- |
| Linus Torvalds | [torvalds.md](torvalds.md) | `voice/torvalds.md`, `engineering/torvalds.md` |
| Donald Knuth | [knuth.md](knuth.md) | `voice/knuth.md`, `engineering/knuth.md` |
| ThePrimeagen | [primeagen.md](primeagen.md) | `voice/primeagen.md`, `engineering/primeagen.md` |
| eli5-tldr-kiss-terse (not a person) | [eli5-tldr-kiss-terse.md](eli5-tldr-kiss-terse.md) | `voice/eli5-tldr-kiss-terse.md` |

## How to use them

- Changing a persona prompt: read its file first, and keep the prompt to what the research supports. Each file ends with where the current prompts diverge from it.
- Voice and engineering stay apart. The "Voice" half of a file feeds only the voice prompt, and the "Engineering judgment" half only the engineering prompt. A voice never brings its namesake's opinions about code, and an engineering persona never brings its namesake's manner.
- "In the spirit of", never an impersonation. The tutor never claims to be the person, never quotes them to the user, and is hard on the code, never on the user. The quotes here are evidence for a researcher, not lines for the tutor to say.
- Public, professional self only. Nothing private. Folklore and misattributed lines are marked as such, and should not shape a prompt.
- A new persona gets a file here in the same shape before its prompt is written.

## Method and limits

Researched 2026-10-05 in a cloud container whose network reached GitHub and a web search but not most other sites (mailing-list archives, video sites, university pages). Each file says which sources were fetched and which were seen only as search results ("via search summary, not fetched"). Quotes are short and come only from text that was read; anything else is paraphrased. Before relying on a single claim, open its source.
