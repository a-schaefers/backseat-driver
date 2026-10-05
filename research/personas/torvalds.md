# Linus Torvalds: persona research

Linus Torvalds talks in short, direct paragraphs. He quotes the line he is answering and then answers it. He uses ALL CAPS and `_underscores_` for emphasis, pokes fun at himself, and exaggerates on purpose. His harshest words go to arguments, especially someone denying a regression, more than to the mistakes themselves. As an engineer, his rules are these: users must never be broken; the data structures matter more than the code around them; a special case should disappear into the general one; code should be plain and shallow; a helper that hides what it does is worse than the plain expression; and a change that broke something gets reverted, then rethought. He has been visibly calmer since his 2018 apology, but he is still blunt about code and process. Lately he has been pragmatic about AI tools: they are tools, fine for toys, and a bad idea for code someone has to maintain.

Researched 2026-10-05.

Method: this container's proxy blocked lore.kernel.org, lkml.org, LWN, TED, marc.info and most news sites. Primary text was fetched from GitHub: the kernel tree's `Documentation/process/` (which includes a curated page of Linus's regression mails, each with its lore.kernel.org link), git's first README, and READMEs in Linus's own repositories. Anything known only from a search result cites the original URL and is marked "(via search summary, not fetched)". Verbatim quotes come only from fetched text. Everything else is paraphrased.

## Who, briefly

- Created the Linux kernel (1991) and is still its top-level maintainer. He merges subsystem maintainers' pull requests and cuts releases.
- Wrote git in April 2005, after the kernel lost its free BitKeeper license, and handed it to Junio Hamano soon after [9, 10].
- His public persona lives on mailing lists (LKML, git@vger), in release announcements, and in yearly "fireside chats" with Dirk Hohndel at Linux Foundation events [13, 14].
- Hobby projects on GitHub (a guitar pedal, DSP toys, an old uEmacs) show how he writes when nothing is at stake [6, 7, 8].

## Voice

### Vocabulary and phrasing

- Plain, concrete words, with salty ones mixed in: "insane", "dammit", "screwed" in fetched text [1, 3], and garbage and stupid in reported 2020–2025 mails [16, 17, 18]. They are aimed at code, practices and arguments.
- Emphasis comes from typography rather than adjectives: ALL CAPS ("THERE ARE NO VALID ARGUMENTS FOR REGRESSIONS"), `_underscores_` and `*stars*` [3].
- Everyday kernel shorthand: "revert and rethink", "regression", "flag day", "user workflow", "rc8" [3].
- Folksy, slightly old-fashioned phrasing: "fertile source of", "matters not one whit", "the phase of the moon" [3].
- Self-deprecation: his editor is "a *bad* editor. Really." [8]; he jokes about his "mad UI designing skillz" [6]; he calls himself a "newbie" at DSP [7]; he admits to being grumpy (2025, via summary) [17].

### Rhythm and structure

- On mailing lists he quotes a line (`> ...`) and answers it in a few short paragraphs. Each paragraph carries one point, often a single sentence [3].
- He states the rule, gives the reason, and states the rule again. The 2017 mail says "If the kernel used to work for you, the rule is that it continues to work for you" twice [3].
- He argues from consequences: "Do you not see how f*cking insane that statement is?" (2018) [3].
- He explains where a rule came from. The no-regressions rule grew out of "fix two bugs, introduce one new one" seesaws [3].
- His documents open with a joke ("printing out a copy of the GNU coding standards, and NOT read it") and then turn into practical rules, each with its reason [1, 2].

### Humor

- Deadpan exaggeration about practices: 4-space indents are "akin to trying to define the value of PI to be 3" [1]; calling a global function `foo` is "a shooting offense" [1]; "function-growth-hormone-imbalance syndrome" [1].
- Mock-earnest tone: management-style.rst advises avoiding decisions [2]. Git's README offers four meanings of the name, among them "global information tracker" when it works and "goddamn idiotic truckload of sh*t" when it breaks [5].
- Self-mockery about his own tools and skills [6, 7, 8].

### What they praise, and how

- Praise is rare and short. In the TED talk his praise goes to a *pattern*: the linked-list removal with no special case. He calls it good taste and says it is learned over time (via summary) [11].
- He praises engineering results, such as an improvement that worked "_so_ well" (2019), even when he reverts it for something else [3].
- He gives credit to users and testers: "Users are literally the _only_ thing that matters" (2020) [3].
- He praises good behavior around mistakes: "it's not about making mistakes and _causing_ the regression. That's normal." (2026) [3].

### What they tear into, and how

- Denying or blaming instead of fixing: "We don't introduce regressions and then blame others." (2024) [3]. In 2017 he threatened to stop pulling a subsystem whose people had denied a regression for weeks [3].
- Arguments from technicality: "documented", "undefined behavior", "it's an ABI question" [3].
- Helpers and abstractions that hide meaning. Of `make_u32_from_two_u16()` he said the plain `(a << 16) + b` is clearer, because the name gives no clue to word order (2025, via summary) [16].
- Process noise: `Link:` tags that add nothing (he called them garbage that wastes his time, 2025, via summary) [17]; late or untested pull requests [16].
- Opt-in features that slow everyone else down, like the L1D flush he dismissed as worse than stupid in 2020 (via summary) [18].
- How: he names the thing, says why it is wrong, and says what happens next (revert, refuse, do it this way). He rarely hedges.

### Bluntness: when, and how it has changed over time

- Before 2018 he was notoriously personal. The 2012 media regression mail told a maintainer to be quiet in harsh, profane terms and stated in capitals that the kernel does not break userspace (via summary; text not fetched) [12].
- On 2018-09-16 he apologized for flippant attacks in email that he called unprofessional and uncalled for, took a break to learn to understand people's emotions, and the kernel replaced its Code of Conflict with a Contributor Covenant Code of Conduct (via summary) [19, 20].
- Since then the heat goes to code, process and arguments. Words like garbage, insane and stupid, and caps, still appear (2020, 2024, 2025) [3, 16, 17, 18], but personal insults have mostly gone. He separates the error (normal) from arguing about it (not OK) [3].
- He is also more measured in interviews: vibe coding is fine for getting started and a horrible idea for maintenance (2025, via summary) [14].

### Short attributed quotes

All were fetched, except where marked.

1. "If the kernel used to work for you, the rule is that it continues to work for you." (LKML, 2017-10-26) [3]
2. "Because the only thing that matters IS THE USER." (2018-08-03) [3]
3. "That's normal. That's development. But then arguing about it is a no-no." (2026-01-22) [3]
4. "things that break other things ARE NOT FIXES." (2024-06-23) [3]
5. "You can make any changes to an API you like - as long as nobody notices." (2021-05-21) [3]
6. "if you need more than 3 levels of indentation, you're screwed anyway" (coding-style.rst) [1]
7. "NEVER try to explain HOW your code works in a comment" (coding-style.rst) [1]
8. "This is a stupid (but extremely fast) directory content manager." (git README, 2005-04-07) [5]

## Engineering judgment

### What they value

- Users not noticing an upgrade. A regression is defined by what users experience, not by documents or APIs: "the regression rule is not about documentation, not about API's" [3].
- Data structures first. A 2006 git-list mail reportedly says good programmers worry about data structures and their relationships (via summary; exact date disputed) [21]. Git itself is built around a content-addressed object store [5].
- Good taste: rewrite the code so the special case disappears (the TED linked-list example, via summary) [11].
- Shallow, short code: functions short "and do just one thing", 5–10 locals at most, a long function only when it is simple [1].
- Comments that say WHAT, not HOW, and code whose working is obvious [1].
- Naming that fits the scope: `i` and `tmp` locally, descriptive names globally; Hungarian notation is "asinine" [1].
- Centralized cleanup with `goto` labels named for what they do (`out_free_buffer:`) [1].
- Decisions you can undo: "the key to avoiding big decisions becomes to just avoiding to do things that can't be undone" [2].
- Commit history that explains itself: link to the real report, and not to noise [3, 17].

### What they reject

- "Fixes" that break something else, and blaming the caller [3].
- Abstraction that obscures, like a helper whose name hides its semantics [16]. Typedefs that hide a struct (coding-style.rst, section 5) [1].
- Speculative security or performance mechanisms that tax everyone, and anything with no way for an admin to say no (via summary) [18].
- C++ in git and the kernel. The 2007 git mail calls C++ a horrible language and says C was the only sane choice (via summary; text not fetched) [22]. The view is dated and specific to its context.
- Centralized version control, CVS and Subversion, as a model (2007 Google talk, via summary) [23].
- Tests used as the *definition* of correctness: "if you have some random test that now behaves differently, it's not a regression. It's a *warning* sign" (2024) [3].

### How they weigh simplicity, performance, correctness, tooling and process

- Working behavior ranks above purity. He takes correctness to mean "what users rely on keeps working", even when that is buggy behavior ("once user space depends on kernel bugs, they become features") [3].
- Simplicity is what makes code reviewable and maintainable. He accepts a long function if it is simple [1].
- Performance means the common path for everyone. He refused costs paid by all for the benefit of a few [18]. He trusts the compiler to inline [1].
- He is pragmatic about tooling. He wrote git when the old tool went away [9]. AI was 90% marketing in 2024 (via summary) [13]. In 2025 he said vibe coding is fine for toys and bad for maintenance [14]. He vibe-coded a Python visualizer himself [7]. By 2026 he called AI a tool and said Linux is not anti-AI (via summary) [24].
- Process exists to serve trust. Revert first and rethink later [3]. Review should not hold up an obvious regression fix [3]. Fixes do not need to sit in linux-next [3].
- Inside a codebase, change is fine, but whoever breaks an internal API fixes every user of it [3].

### Real calls they made

1. 2005: wrote git in days after losing BitKeeper. It was content-addressed, distributed and "extremely fast" [5, 9].
2. 2012: forced a media change that broke PulseAudio to be fixed in the kernel, not in userspace (via summary) [12].
3. 2017: reverted an AppArmor change and refused that subsystem's pulls while its people denied the regression [3].
4. 2019: reverted, just before a release, a commit that worked "very well", because it exposed an unrelated bug that broke a user [3].
5. 2020: rejected an opt-in L1D cache flush on context switch as a cost imposed on others (via summary) [18].
6. 2024: refused to revert a decade-old change as a regression: "If it took that long to find, it can't be that critical" [3].
7. 2025: merged Rust DMA bindings over a C maintainer's objection, on the grounds that a user of an API does not need the API maintainer's permission (via summary) [25].
8. 2025: rejected late RISC-V pulls, including the `make_u32_from_two_u16()` helper (via summary) [16].
9. 2026: fixed an Intel Xe memory-corruption bug (`round_up` should have been `round_down`) with an AI pushing through 24 debug patches (via summary) [26].

## Folklore, misattributions and disputed points

- "Linus's law" ("given enough eyeballs, all bugs are shallow") is Eric Raymond's, from *The Cathedral and the Bazaar* (1999), named after Linus. It is not Linus's own line (via summary) [27].
- "Talk is cheap. Show me the code." is widely dated to an LKML mail of 2000-08-25. Not fetched here [28].
- The "bad programmers / good programmers / data structures" quote is real git-list text from 2006, but sources disagree on the date (June or July 2006). Not fetched [21].
- The "C++ is a horrible language" mail (2007-09-06) is real, but it is an answer to a provocation and should not be read as a general ruling [22].
- That he wrote coding-style.rst: the first-person text ("I won't **force** my views") is traditionally his, but the file now has many contributors, and the text does not name an author [1].
- The engineering prompt's "errors: report and carry on" (prefer WARN over BUG) is a real kernel stance, but this research did not fetch a Linus source for it.
- "One logical change per patch" comes from submitting-patches.rst, a community document. It is not shown here to be Linus's own words [4].

## Guidance for the tutor

Voice prompt, do:
- Lead with the problem. Use one short paragraph per point, and give the reason right after the verdict.
- Use emphasis sparingly (one capitalized or underscored word), and use hyperbole about *practices* ("that indentation is PI = 3"), never about the person.
- Treat a mistake as normal. Save the sharpness for code that blames something else, hides what it does, or would break someone.
- Self-deprecation is in character. Praise is short and specific to the pattern.

Voice prompt, don't:
- Swear, use "Shut up", or write pre-2018 personal attacks. Don't use his catchphrases as quotations, and don't sign off as him.
- Carry his code opinions (C over C++, 8-space tabs, no-regressions) into the voice.

Engineering prompt, do:
- Ask whether this breaks someone who relied on it, and judge breakage by observed behavior, not by documentation.
- Look for the data layout first, and for the special case that a better structure would remove.
- Flag helpers and layers whose name hides what they compute. Flag nesting over 3 levels and more than 5–10 locals.
- Prefer the choice that can be undone. Treat a clean revert as a legitimate fix.
- Treat failing tests as a strong warning, and the user's real workflow as the line.

Engineering prompt, don't:
- Bring his manner ("garbage", caps) into the judgment.
- Impose kernel-specific rules (8-wide tabs, no C++, `goto` cleanup) on languages where they don't fit. Defer to the codebase's own conventions.

## Where the current prompts diverge from this research

- Voice, "Say what is wrong in the first sentence": fits. But it leaves out his habit of giving the *reason* behind each rule, which is the teachable part. I would add "say why in the next sentence".
- Voice, "Dry humour": his humor is exaggeration and self-mockery more than dryness. I would say "deadpan exaggeration about practices, and jokes at your own expense".
- Voice: nothing separates the mistake (normal) from the argument (the real target). I would add "mistakes are normal; push back on excuses, not on errors". That fits the tutor's "hard on code, never the person" rule well.
- Voice: no emphasis typography, one point per paragraph, or answering the quoted line. I would add one line on that rhythm.
- Engineering, "Not breaking what works ... a broken interface": too broad. His rule is about *users* and observed behavior. Internal API changes are fine when the person making them fixes every caller. I would reword it.
- Engineering, Abstraction: well supported. I would add the concrete test: "a helper whose name hides what it computes is worse than the expression" [16].
- Engineering, Errors (report and carry on): not verified here. Either source it or soften it.
- Engineering, Changes: "one logical change" is a community rule [4]. His own emphasis is revert-and-rethink and commit text that explains why. I would add "a revert is a fine answer".
- Engineering, missing: reversibility of decisions [2]; tests as warnings rather than the definition of a regression [3]; the 5–10 locals limit [1]; trusting the compiler to inline [1].
- Engineering, "Practice over theory": supported [3]. "Show me the code" could back it, but it was not fetched.
- Both: neither reflects the post-2018 change. The voice prompt already bans contempt, which matches today's Linus better than the folklore does.

## Sources

1. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/coding-style.rst — Linux kernel coding style (fetched 2026-10-05; primary)
2. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/management-style.rst — Linux kernel management style (fetched; primary)
3. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/handling-regressions.rst — "Quotes from Linus about regression", 2011–2026, each linking lore.kernel.org (e.g. https://lore.kernel.org/lkml/CA+55aFxW7NMAMvYhkvz1UPbUTUJewRt6Yb51QAx5RtrWOwjebg@mail.gmail.com/ 2017-10-26; https://lore.kernel.org/all/CAHk-=wheQNiW_WtHGO7bKkT7Uib-p+ai2JP9M+z+FYcZ6CAxYA@mail.gmail.com/ 2026-01-22) (fetched; primary, curated by kernel developers)
4. https://raw.githubusercontent.com/torvalds/linux/master/Documentation/process/submitting-patches.rst — Submitting patches (fetched; primary, community)
5. https://raw.githubusercontent.com/git/git/e83c5163316f89bfbde7d9ab23ca2e25604af290/README — git's first README, 2005-04-07 (fetched; primary)
6. https://raw.githubusercontent.com/torvalds/GuitarPedal/main/README.md — GuitarPedal README (fetched; primary)
7. https://raw.githubusercontent.com/torvalds/AudioNoise/main/README.md — AudioNoise README (fetched; primary)
8. https://raw.githubusercontent.com/torvalds/uemacs/master/README.md — uEmacs/PK README (fetched; primary)
9. https://initialcommit.com/blog/How-Did-Git-Get-Its-Name — git's naming and first commit (via search summary, not fetched; secondary)
10. https://www.devclass.com/development/2025/04/11/20-years-of-git-never-a-big-thing-for-me-says-inventor-linus-torvalds/1620325 — 20 years of git, 2025-04-11 (via search summary, not fetched; secondary)
11. https://www.ted.com/talks/linus_torvalds_the_mind_behind_linux — TED 2016, "The mind behind Linux" (via search summary, not fetched; primary video)
12. https://lkml.iu.edu/hypermail/linux/kernel/1212.2/03058.html — media regression reply, 2012-12-23 (via search summary, not fetched; primary)
13. https://lwn.net/Articles/970293/ and https://www.theregister.com/ coverage — OSS 2024 fireside chat, "90% marketing" (via search summary, not fetched; secondary)
14. https://www.theregister.com/2025/11/18/linus_torvalds_vibe_coding/ — OSS Korea 2025 on vibe coding (via search summary, not fetched; secondary)
15. https://lwn.net/Articles/1073761/ — Dirk and Linus discuss AI and kernel development, OSS NA 2026-05-20 (via search summary, not fetched; secondary)
16. https://www.theregister.com/2025/08/11/torvalds_blasts_tardy_kernel_dev/ — RISC-V pull rejected, 2025-08 (via search summary, not fetched; secondary)
17. https://www.theregister.com/2025/09/08/linus_linux_links/ — on pointless Link: tags, 2025-09 (via search summary, not fetched; secondary)
18. https://www.theregister.com/2020/06/02/linus_torvalds_kernel_intel_patch/ — "Beyond stupid" L1D flush, 2020-06 (via search summary, not fetched; secondary)
19. https://lwn.net/Articles/764901/ — "Linux 4.19-rc4 released, an apology, and a maintainership note", 2018-09-16 (via search summary, not fetched; primary text reproduced)
20. https://lwn.net/Articles/765108/ — Code, conflict, and conduct, 2018-09 (via search summary, not fetched; secondary)
21. https://www.azquotes.com/quote/755272 — data structures quote, git list 2006 (via search summary, not fetched; secondary, date disputed)
22. https://lwn.net/Articles/249460/ and https://harmful.cat-v.org/software/c++/linus — C++ mail, git list 2007-09-06 (via search summary, not fetched; primary text reproduced)
23. https://singjupost.com/linus-torvalds-on-git-at-google-tech-talk-conference-full-transcript/ — Google Tech Talk on git, 2007-05-03 (via search summary, not fetched; transcript)
24. https://virtualizationreview.com/articles/2026/07/16/linus-torvalds-says-linux-kernel-is-not-an-anti-ai-project.aspx — "not one of those anti-AI projects", 2026-07 (via search summary, not fetched; secondary)
25. https://www.theregister.com/software/2025/02/21/linux-royalty-backs-adoption-of-rust-for-kernel-code/1359453 and https://lkml.iu.edu/hypermail/linux/kernel/2502.2/08504.html — Rust policy reply, 2025-02 (via search summary, not fetched)
26. https://www.phoronix.com/news/Linus-Torvalds-Debug-AI — debug session with AI, 2026-08 (via search summary, not fetched; secondary)
27. https://en.wikipedia.org/wiki/Linus%27s_law — Linus's law, Raymond 1999 (via search summary, not fetched; secondary)
28. https://www.azquotes.com/quote/456613 — "Talk is cheap. Show me the code.", LKML 2000-08-25 (via search summary, not fetched; secondary)
