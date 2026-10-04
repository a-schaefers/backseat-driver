import { languageName } from './languages'
import { GENERAL } from './profiles'

/**
 * One first-run question, in the shape Claude Code's question dialog takes.
 *
 * Every question is single choice on purpose. In the dialog a single choice
 * is one keypress, while "pick any" takes a toggle, a move to Submit and a
 * confirmation screen. The dialog's own "Type something" row covers the rest.
 */
export type Question = {
  /** The subject whose profile the answer is stored in: a language id, or `general`. */
  subject: string
  /** The key the answer is stored under. */
  id: string
  /** A chip beside the question: 12 characters at most. */
  header: string
  question: string
  /** Two to four labels. The dialog adds a row for typing something else. */
  options: string[]
}

/** Asked once ever: what they bring with them. */
const BACKGROUND: Question = {
  subject: GENERAL,
  id: 'knows',
  header: 'Background',
  question: 'Which language do you know best? New ideas get explained by comparison with it. Type it if it is not listed.',
  options: ['None: this is my first', 'Python', 'JavaScript or TypeScript', 'C, C++ or Rust'],
}

/** Asked once per language: where they are and where they want to get to. */
function languageQuestions(language: string): Question[] {
  const name = languageName(language)

  return [
    {
      subject: language,
      id: 'level',
      header: 'Level',
      question: `How much ${name} have you written?`,
      options: [
        'None yet',
        'A little: tutorials and small scripts',
        'Regularly: I build real things in it',
        'For years: I know it well',
      ],
    },
    {
      subject: language,
      id: 'goals',
      header: 'Goals',
      question: `What do you most want from ${name} right now?`,
      options: [
        'Read and change existing code with confidence',
        'Write idiomatic code without looking things up',
        'Understand what happens underneath',
        'Design larger programs well',
      ],
    },
    {
      subject: language,
      id: 'focus',
      header: 'Focus',
      question: `What should I watch most closely in your ${name}?`,
      options: ['Bugs and risky code', 'Idioms and style', 'Performance', 'Tests and design'],
    },
  ]
}

/** However many languages a project has, the first run asks at most this many questions. */
export const MAX_QUESTIONS = 10

/**
 * The questions for a first engagement: the background question if it was
 * never asked, then three for each language that has no profile yet.
 */
export function firstRunQuestions(newLanguages: readonly string[], isBackgroundKnown: boolean): Question[] {
  const questions = isBackgroundKnown ? [] : [BACKGROUND]
  for (const language of newLanguages) {
    const next = languageQuestions(language)
    if (questions.length + next.length > MAX_QUESTIONS) break
    questions.push(...next)
  }

  return questions
}

/** Answers by subject and question id. A subject with no answers was skipped. */
export function groupAnswers(
  questions: readonly Question[],
  answers: readonly (string | null)[],
): Record<string, Record<string, string>> {
  const grouped: Record<string, Record<string, string>> = {}
  questions.forEach((question, index) => {
    const subject = (grouped[question.subject] ??= {})
    const answer = answers[index]
    if (typeof answer === 'string' && answer.trim() !== '') subject[question.id] = answer.trim()
  })

  return grouped
}
