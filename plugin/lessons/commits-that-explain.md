---
title: Commits that explain themselves
language: general
level: beginner
skills: commit-hygiene, small-commits, commit-messages
summary: One change per commit, a message that says why, and a history you can read back.
---
Your history is the only record of why the code is the way it is. This path is about making commits a later reader (you, in six months) can use: small, whole, and explained. It works in any language, in the project you are in now.

## One change per commit
A commit that fixes a bug, renames a function and reformats a file can't be reviewed, reverted or understood as one thing.

Try it: before your next commit, run `git diff` and sort what you see into separate changes. Stage and commit them one at a time, with `git add -p` where one file holds two changes.

Done when: the tutor has seen a run of your commits where each one does one thing.

## Say why, not what
The diff already says what changed. The message is for what the diff can't say: why it changed, and what you considered.

Try it: write your next commit message as a short title (under 60 characters, in the imperative: "Reject empty input in parse") and, under a blank line, a few lines on why. Read your last five messages and rewrite one of them in your head the same way.

Done when: your latest commit's message says why the change was needed.

## Read history back
History is only worth keeping if you use it. `git log -p <file>`, `git blame` and `git log -S <text>` answer "why is this here?" without asking anyone.

Try it: pick a line of your project that puzzles you, or that you wrote a while ago. Find the commit that introduced it, and read what its message says about why.

Done when: you can tell the tutor which commit a line came from, and whether its message helped.
