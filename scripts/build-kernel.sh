#!/bin/bash
# Builds the kernel: kernel/src (PureScript) into plugin/hooks/kernel.js, the
# one ES module the mod loads. That file is committed, because nothing is built
# on a user's machine.
#
#   scripts/build-kernel.sh           compile what changed and write the bundle
#   scripts/build-kernel.sh --clean   compile everything from nothing first
#   scripts/build-kernel.sh --check   build beside the bundle and fail when the
#                                     bundle is not what the source builds
#
# The compiler comes by pinned hash (scripts/toolchain.py), spago and esbuild
# from node_modules (npm install), the packages by spago's pinned set.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bundle="$root/plugin/hooks/kernel.js"
banner='// The kernel of Backseat Driver, compiled from PureScript (kernel/src in the repository) by scripts/build-kernel.sh. Do not edit: change the source and build again.'

python3 "$root/scripts/toolchain.py" > /dev/null
export PATH="$root/local/bin:$root/node_modules/.bin:$PATH"
cd "$root/kernel"
if [ "${1:-}" = "--clean" ]; then rm -rf output; fi
spago build --quiet

out="$bundle"
if [ "${1:-}" = "--check" ]; then out="$root/kernel/output/kernel.check.js"; fi
esbuild output/Kernel.Main/index.js --bundle --format=esm --charset=utf8 --banner:js="$banner" --outfile="$out" --log-level=warning

if [ "${1:-}" = "--check" ]; then
  if ! cmp -s "$out" "$bundle"; then
    echo "plugin/hooks/kernel.js is not what kernel/src builds. Run: npm run build:kernel" >&2
    exit 1
  fi
  echo "kernel: plugin/hooks/kernel.js is what kernel/src builds ($(wc -c < "$bundle") bytes)"
else
  echo "kernel: wrote plugin/hooks/kernel.js ($(wc -c < "$bundle") bytes)"
fi
