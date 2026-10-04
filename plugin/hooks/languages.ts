import { isNoiseFile } from './noise'

/** File extension to language id. The id is the profile's subject, so it has to stay stable. */
const BY_EXTENSION: Record<string, string> = {
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  go: 'go',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  cs: 'csharp',
  fs: 'fsharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  m: 'objective-c',
  mm: 'objective-c',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  lua: 'lua',
  pl: 'perl',
  pm: 'perl',
  r: 'r',
  jl: 'julia',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  clj: 'clojure',
  cljs: 'clojure',
  zig: 'zig',
  nim: 'nim',
  sql: 'sql',
  el: 'emacs-lisp',
  lisp: 'lisp',
  scm: 'scheme',
  rkt: 'racket',
  vue: 'vue',
  svelte: 'svelte',
  html: 'html',
  css: 'css',
  scss: 'css',
}

/** Ids whose display name is not just the id with a capital. */
const NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  cpp: 'C++',
  csharp: 'C#',
  fsharp: 'F#',
  'objective-c': 'Objective-C',
  php: 'PHP',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  ocaml: 'OCaml',
  'emacs-lisp': 'Emacs Lisp',
  shell: 'shell scripting',
  r: 'R',
  general: 'In general',
}

/** The language a file is written in, by its extension, or null when it is not source code we know. */
export function languageOf(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null

  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null
}

export function languageName(id: string): string {
  return NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

/** A language is a main one when at least this share of the source files is written in it. */
const MAIN_SHARE = 0.15

/**
 * A project's main languages, most files first, from its file list. The
 * biggest one always counts. The others count when they hold a real share,
 * so the one shell script in a Python project does not make it a shell project.
 */
export function mainLanguages(paths: readonly string[], limit = 3): string[] {
  const counts = new Map<string, number>()
  let total = 0
  for (const path of paths) {
    if (isNoiseFile(path)) continue
    const language = languageOf(path)
    if (language === null) continue
    counts.set(language, (counts.get(language) ?? 0) + 1)
    total += 1
  }

  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .filter(([, count], index) => index === 0 || count / total >= MAIN_SHARE)
    .slice(0, limit)
    .map(([language]) => language)
}
