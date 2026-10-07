// Backseat Driver for VS Code: tells the tutor where you are in your code.
//
// It keeps one file in the tutor's data folder, editors/vscode-<pid>.json,
// saying which file has the caret, the line and column, the selection, which
// files are open and on screen, whether the file has unsaved changes, and
// whether the window has the keyboard. It writes when that changes, and every
// 20 seconds while nothing does, so the tutor knows the window is still open.
// The file goes away when the window closes. Nothing is written until
// Backseat Driver has made its data folder, and nothing is read back.
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const vscode = require('vscode')

const BEAT_MS = 20_000
const DEBOUNCE_MS = 150
const STALE_MS = 24 * 60 * 60 * 1000
const MAX_LISTED = 50

/** The data folder, found the way the tutor finds it. */
function dataHome() {
  const configured = vscode.workspace.getConfiguration('backseatDriver').get('home', '')
  if (configured.trim() !== '') return configured.trim().replace(/[\\/]+$/, '')
  const override = process.env.BACKSEAT_DRIVER_HOME
  if (override && override.trim() !== '') return override.trim().replace(/[\\/]+$/, '')
  const xdg = process.env.XDG_DATA_HOME
  if (xdg && xdg.trim() !== '') return `${xdg.trim().replace(/[\\/]+$/, '')}/backseat-driver`
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
  return home ? `${home.replace(/[\\/]+$/, '')}/.local/share/backseat-driver` : ''
}

function real(file) {
  try {
    return fs.realpathSync.native(file)
  } catch {
    return file
  }
}

const roots = new Map()

/**
 * The nearest folder upward with a .git (a folder, or a file in a worktree), remembered per folder once found. A
 * folder with none is looked at again each time: a repository may be made under the editor (2026-10-06).
 */
function repoRoot(file) {
  const start = path.dirname(file)
  if (roots.has(start)) return roots.get(start)
  let dir = start
  let root = null
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      root = real(dir)
      break
    }
    const up = path.dirname(dir)
    if (up === dir) break
    dir = up
  }
  if (root !== null) roots.set(start, root)
  return root
}

/** A document's file, its real path, or null when it is not a file on disk. */
function fileOf(document) {
  return document && document.uri.scheme === 'file' ? real(document.uri.fsPath) : null
}

/** What VS Code says about itself, or null when the active editor is not a file. */
function report() {
  const editor = vscode.window.activeTextEditor
  const file = editor ? fileOf(editor.document) : null
  if (file === null) return null
  const { active, anchor } = editor.selection
  const lines = [active.line + 1, anchor.line + 1].sort((a, b) => a - b)
  const buffers = []
  for (const document of vscode.workspace.textDocuments) {
    const other = fileOf(document)
    if (other !== null && !buffers.includes(other) && buffers.length < MAX_LISTED) buffers.push(other)
  }
  const visible = []
  for (const shown of vscode.window.visibleTextEditors) {
    const other = fileOf(shown.document)
    if (other !== null && other !== file && !visible.includes(other)) visible.push(other)
  }
  const root = repoRoot(file)

  return {
    ...(root === null ? {} : { root }),
    file,
    line: editor.selection.isEmpty ? active.line + 1 : lines[0],
    column: active.character + 1,
    ...(lines[1] > lines[0] ? { endLine: lines[1] } : {}),
    modified: editor.document.isDirty,
    buffers,
    visible,
    active: vscode.window.state.focused,
  }
}

function activate(context) {
  const home = dataHome()
  if (home === '') return
  const folder = `${home}/editors`
  const target = `${folder}/vscode-${process.pid}.json`
  let last = null
  let lastText = ''
  let changed = 0
  let debounce = null

  function write(fields) {
    if (!fs.existsSync(`${home}/.backseat-driver`)) return
    fs.mkdirSync(folder, { recursive: true })
    const temp = `${folder}/.vscode-${process.pid}.json.tmp`
    fs.writeFileSync(temp, JSON.stringify({ v: 1, editor: 'vscode', pid: process.pid, at: Date.now(), changed, ...fields }))
    fs.renameSync(temp, target)
  }

  function send(isBeat) {
    if (!vscode.workspace.getConfiguration('backseatDriver').get('enabled', true)) return
    try {
      const now = report()
      if (now !== null) {
        const text = JSON.stringify(now)
        const isSame = text === lastText
        if (!isSame) {
          last = now
          lastText = text
          changed = Date.now()
        }
        if (isBeat || !isSame) write(last)
      } else if (isBeat && last !== null) {
        // Not in a file: what was last said stands until the caret is in one again.
        write(last)
      }
    } catch {
      // The tutor's folder is not writable right now. The next change or beat tries again.
    }
  }

  function soon() {
    clearTimeout(debounce)
    debounce = setTimeout(() => send(false), DEBOUNCE_MS)
  }

  function remove() {
    try {
      fs.unlinkSync(target)
    } catch {
      // Already gone.
    }
  }

  // Files left by editors that did not get to remove theirs.
  try {
    for (const name of fs.readdirSync(folder)) {
      const file = `${folder}/${name}`
      if (Date.now() - fs.statSync(file).mtimeMs > STALE_MS) fs.unlinkSync(file)
    }
  } catch {
    // No folder yet.
  }

  const beat = setInterval(() => send(true), BEAT_MS)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(soon),
    vscode.window.onDidChangeTextEditorSelection(soon),
    vscode.window.onDidChangeVisibleTextEditors(soon),
    vscode.window.onDidChangeWindowState(soon),
    vscode.workspace.onDidOpenTextDocument(soon),
    vscode.workspace.onDidCloseTextDocument(soon),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === vscode.window.activeTextEditor?.document) soon()
    }),
    vscode.workspace.onDidSaveTextDocument(soon),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('backseatDriver.enabled')) return
      if (vscode.workspace.getConfiguration('backseatDriver').get('enabled', true)) soon()
      else remove()
    }),
    { dispose: () => (clearInterval(beat), clearTimeout(debounce), remove()) },
  )
  send(false)
}

function deactivate() {}

module.exports = { activate, deactivate }
