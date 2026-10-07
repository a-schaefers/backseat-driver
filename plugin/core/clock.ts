/** A time of day as the person's clock shows it: 09:05. The kernel is handed this to say a time. */
export function clockTime(ms: number): string {
  const date = new Date(ms)

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * A moment in the past as the person reads it beside today's clock: today's
 * by its time alone, yesterday's and older ones with their day, so that a
 * review of last night does not read as one of tonight's (the fifth ui-truth
 * pass, 2026-10-06: four reviews of the day before listed as "19:57").
 */
export function dayTime(ms: number, now: number): string {
  const then = new Date(ms)
  const time = clockTime(ms)
  if (then.toDateString() === new Date(now).toDateString()) return time
  if (then.toDateString() === new Date(now - 86_400_000).toDateString()) return `yesterday ${time}`

  return `${MONTHS[then.getMonth()] ?? ''} ${then.getDate()}, ${time}`
}
