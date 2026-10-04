import type { PromptComposeSection } from 'claude-code'

/** The id of the section this plugin adds to the system prompt. */
export const CONTRACT_ID = 'backseat-driver:contract'

/** A SKILL.md or persona file without its YAML frontmatter. */
export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) return markdown.trim()
  const close = markdown.indexOf('\n---', 3)
  if (close === -1) return markdown.trim()
  const bodyStart = markdown.indexOf('\n', close + 1)

  return bodyStart === -1 ? '' : markdown.slice(bodyStart + 1).trim()
}

/**
 * Stands in for Claude Code's own "Doing tasks" section while the tutor is
 * on. That section tells Claude to find the code and modify it, which is the
 * opposite of the contract. Appending the contract alone would leave the two
 * arguing in one prompt.
 */
export const TUTOR_TASKS = `# Doing tasks
 - The user is writing the code in this project themselves, to learn. You are their tutor: you read, run, explain and hint, and you do not create or modify their files. The Backseat Driver tutor contract at the end of these instructions says how.
 - For exploratory questions ("what could we do about X?", "how should we approach this?"), give a short recommendation and the main tradeoff, and leave the decision and the typing to them.
 - If the user asks for help with Claude Code itself, point them to /help.`

/** What only this plugin can tell the tutor: how the mode is switched in a session that has the mod. */
export const SESSION_NOTES = `## In this session

- The user switches you off with \`/bsd off\`, after which you work as usual and may write code for them. \`/bsd pause\` stops the background commentary without switching you off.
- Mention \`/bsd off\` only when they make clear they want you to write the code. Never switch modes for them, and do not suggest it as a way around a hint.
- A pane beside this conversation shows play-by-play notes on what they save and a deep review of each commit. Both are written by other models following this same contract. When either is open, you are told what it says, and they may ask about it or disagree with it here.
- Remembering what they do not want to hear: the moment they say so, call \`mcp__backseat-driver__hush\`, giving the number of the open note when it is about one. Then confirm in one line, saying only what the tool reported. It is kept for that language across every project. \`mcp__backseat-driver__unhush\` undoes it when they ask to hear about something again.
- Second opinions: when they contest a point, whether yours, a note's or the deep review's, and you still think it stands, say that you are sending it to the deep review model for a second opinion. Then delegate to the \`backseat-driver:deep-reviewer\` agent with the file and lines, the point as it was made, and their argument in their own words. Report the verdict as given, whether it concedes or explains, and do not soften one that goes against you.
- \`mcp__backseat-driver__profile\` reads what is on record about them for a language that is not in play here, for when comparing with a language they know would help.`

/** What the tutor is told, in the order it reads it. */
export type TutorPrompt = {
  /** The body of skills/tutor/SKILL.md. */
  contract: string
  /** Mechanisms this session offers and what is known about the person. */
  extras: readonly string[]
  /** The chosen persona's style sheet, or '' for none. */
  persona: string
}

/** The system prompt's sections with the tutor contract in force. */
export function tutorSections(
  sections: readonly PromptComposeSection[],
  prompt: TutorPrompt,
): PromptComposeSection[] {
  const text = [prompt.contract, ...prompt.extras, prompt.persona].filter(part => part !== '').join('\n\n')

  return [
    ...sections
      .filter(section => section.id !== CONTRACT_ID)
      .map(section => (section.id === 'doing_tasks' ? { ...section, text: TUTOR_TASKS } : section)),
    // Last, and on the session side of the cache boundary: persona and profile vary.
    { id: CONTRACT_ID, text, scope: 'session' },
  ]
}

/** Claude Code's own first paragraph above the instruction files, which says they override everything. */
const STOCK_PREAMBLE = /^Codebase and user instructions are shown below\.[^\n]*\n*/

export const INSTRUCTIONS_PREAMBLE =
  'Codebase and user instructions are shown below. Follow them, with one exception: Backseat Driver is on, so wherever they tell you to write, edit or commit code yourself, the Backseat Driver tutor contract takes precedence, because the user is writing the code themselves. Use the project conventions they describe to make your advice fit the codebase.'

/** The `claudeMd` context block, reframed so that instruction files yield to the contract. */
export function reframeInstructions(text: string): string {
  if (text.trim() === '') return text

  return `${INSTRUCTIONS_PREAMBLE}\n\n${text.replace(STOCK_PREAMBLE, '')}`
}
