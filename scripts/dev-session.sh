#!/bin/bash
# Start Claude Code with this working copy of the plugin inside tmux, in a
# throwaway git repository, so a change can be tried in a real session.
#
#   scripts/dev-session.sh [claude arguments]   start or restart the session
#   tmux attach -t bsd                          watch it, or drive it yourself
#   tmux send-keys -t bsd '/bsd' Enter          type into it from a script
#   tmux capture-pane -p -t bsd                 read the screen back
#   tmux kill-session -t bsd                    stop it
#
# Starting it again replaces the tmux session of the same name. Two Claude
# Code sessions checking changes side by side each need their own
# BSD_SESSION, or each one kills the other's session and types into it.
#
# The first start in a new folder shows Claude Code's trust prompt, which a
# person or a script has to answer. Real model calls are made on your plan.
#
# BSD_SESSION     the tmux session's name (default: bsd)
# BSD_RIDE_DIR    the throwaway repository (default: a folder under $TMPDIR)
# BSD_DATA_DIR    where this session keeps profiles, progress and caches
#                 (default: a folder under $TMPDIR, never your real one)
# BSD_FULLSCREEN  set to 1 for the fullscreen layout, where the pane docks
#                 beside the conversation; tmux gets the main screen otherwise
# BSD_DEBUG       set to 1 to switch the tutor's debug log on in that data
#                 folder, with Claude Code's own debug log beside it.
#                 scripts/debug-tail.sh -d "$BSD_DATA_DIR" follows it
set -euo pipefail

plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/plugin"
ride="${BSD_RIDE_DIR:-${TMPDIR:-/tmp}/backseat-driver-ride}"
data="${BSD_DATA_DIR:-${TMPDIR:-/tmp}/backseat-driver-home}"
session="${BSD_SESSION:-bsd}"

if [ ! -d "$ride/.git" ]; then
  mkdir -p "$ride"
  git -C "$ride" init -q -b main
  git -C "$ride" config user.name "Backseat Driver dev session"
  git -C "$ride" config user.email "dev-session@example.invalid"
  printf 'def mean(xs):\n    return sum(xs) / len(xs)\n' > "$ride/stats.py"
  git -C "$ride" add .
  git -C "$ride" commit -q -m "Start"
fi

# A clean environment: started from inside Claude Code, the session would
# otherwise inherit the parent session's own variables.
launch=(env -i HOME="$HOME" USER="${USER:-$(id -un)}" SHELL=/bin/bash LANG=C.UTF-8
  TERM=xterm-256color BACKSEAT_DRIVER_HOME="$data"
  PATH="$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
if [ "${BSD_FULLSCREEN:-0}" = "1" ]; then
  launch+=(CLAUDE_CODE_NO_FLICKER=1)
fi
launch+=(claude --plugin-dir "$plugin" "$@")
if [ "${BSD_DEBUG:-0}" = "1" ]; then
  mkdir -p "$data/debug"
  printf '{"on": true}\n' > "$data/debug.json"
  launch+=(--debug-file "$data/debug/claude-code.log")
fi

tmux kill-session -t "$session" 2>/dev/null || true
tmux new-session -d -s "$session" -x 170 -y 48 -c "$ride" "$(printf '%q ' "${launch[@]}")"
echo "Session '$session' started in $ride, keeping its data in $data"
