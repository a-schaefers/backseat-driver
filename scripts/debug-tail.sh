#!/bin/bash
# Follow Backseat Driver's debug log: print each record as it is written.
#
#   scripts/debug-tail.sh                 follow the session that logged last, from now on
#   scripts/debug-tail.sh -a              the same, starting from that session's first record
#   scripts/debug-tail.sh -k model,look   only records of these kinds
#   scripts/debug-tail.sh -s 85000c72     one session, by the end of its folder's name
#   scripts/debug-tail.sh -d <folder>     another data folder than the tutor's default
#   scripts/debug-tail.sh -1              print what is there and stop
#
# Each line is one JSON record: t (ms), seq, s (session), p (project), k (kind),
# n (name), ms (how long it took) and d (the details). The tutor's whole state
# is beside the log, in state.json.
#
# The log is switched on with /backseat debug on, or by starting a dev session
# with BSD_DEBUG=1. It is written in chunks that are written again as they
# grow, so `tail -f` cannot follow it. This prints whole lines only, moves on
# to the next chunk, and to a newer session when one starts logging.
set -euo pipefail

data="${BACKSEAT_DRIVER_HOME:-}"
if [ -z "$data" ] && [ -n "${XDG_DATA_HOME:-}" ]; then data="$XDG_DATA_HOME/backseat-driver"; fi
data="${data:-$HOME/.local/share/backseat-driver}"
kinds=""
session=""
from_start=0
once=0
while getopts "k:s:d:a1h" option; do
  case "$option" in
    k) kinds="${OPTARG//,/|}" ;;
    s) session="$OPTARG" ;;
    d) data="${OPTARG%/}" ;;
    a) from_start=1 ;;
    1) once=1; from_start=1 ;;
    *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  esac
done
root="$data/debug"

# The folder to follow: the one named, or the one whose log was written last.
pick() {
  if [ -n "$session" ]; then
    find "$root" -mindepth 1 -maxdepth 1 -type d -name "*$session" 2>/dev/null | sort | tail -n 1
  else
    find "$root" -mindepth 2 -maxdepth 2 -name '*.jsonl' -size +0 -printf '%T@ %h\n' 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2-
  fi
}

chunks() { find "$1" -maxdepth 1 -name '*.jsonl' 2>/dev/null | sort; }

show() {
  if [ -n "$kinds" ]; then grep -E "\"k\":\"($kinds)\"" || true; else cat; fi
}

dir=""
chunk=""
seen=0
while :; do
  newest="$(pick)"
  if [ -z "$newest" ]; then
    if [ "$once" = 1 ]; then echo "No debug log in $root. Switch it on with /backseat debug on." >&2; exit 1; fi
    sleep 0.5
    continue
  fi

  if [ -z "$dir" ]; then
    dir="$newest"
    echo "--- following $dir" >&2
    if [ "$from_start" = 1 ]; then
      chunk="$(chunks "$dir" | head -n 1)"
      seen=0
    else
      chunk="$(chunks "$dir" | tail -n 1)"
      seen="$(wc -l < "$chunk")"
    fi
  fi

  # Whole lines only: a chunk caught while it is being written again has fewer for a moment.
  total="$(wc -l < "$chunk" 2>/dev/null || echo 0)"
  if [ "$total" -gt "$seen" ]; then
    sed -n "$((seen + 1)),${total}p" "$chunk" | show
    seen="$total"
  fi

  next="$(chunks "$dir" | awk -v current="$chunk" '$0 > current' | head -n 1)"
  if [ -n "$next" ]; then
    # The chunk in hand is closed. What is left of it was printed above.
    chunk="$next"
    seen=0
    continue
  fi

  if [ "$newest" != "$dir" ]; then
    dir="$newest"
    echo "--- following $dir" >&2
    chunk="$(chunks "$dir" | head -n 1)"
    seen=0
    continue
  fi

  if [ "$once" = 1 ]; then exit 0; fi
  sleep 0.3
done
