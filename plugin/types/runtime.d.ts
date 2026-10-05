/**
 * What the host-neutral modules may take for granted in their runtime, beyond
 * the ES2023 library: the part of Claude Code's mod environment that any other
 * host (Bun, Node) has too. Only `tsconfig.core.json` reads this file. The
 * full typecheck has Claude Code's own declarations instead, so a module that
 * reaches for anything else (a timer, `fetch`, `$`) fails `npm run core`.
 */

declare global {
  interface AbortSignal {
    readonly aborted: boolean
    readonly reason: unknown
    throwIfAborted(): void
    addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void
    removeEventListener(type: 'abort', listener: () => void): void
  }
  var AbortSignal: {
    prototype: AbortSignal
    abort(reason?: unknown): AbortSignal
    timeout(milliseconds: number): AbortSignal
    any(signals: AbortSignal[]): AbortSignal
  }
  interface AbortController {
    readonly signal: AbortSignal
    abort(reason?: unknown): void
  }
  var AbortController: {
    prototype: AbortController
    new (): AbortController
  }
}

export {}
