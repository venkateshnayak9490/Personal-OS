/**
 * Built-in motivational lines (original, written for this app).
 * Keys are section template keys (work, thesis, fitness, …) or a time of day for Today.
 * A section without its own lines uses its area's (work, self, personal, misc).
 */
export const BUILT_IN_MESSAGES: Record<string, string[]> = {
  morning: [
    'Pick the one task that would make today a good day. Start there.',
    'A fresh day. Small, steady steps count.',
    'Do the hard thing while your head is clear.',
  ],
  afternoon: [
    'Halfway through. What is the one thing still worth finishing today?',
    'Momentum beats motivation. Take the next small step.',
    'A short break now buys a sharper evening.',
  ],
  evening: [
    'Close the loops you can, and write down the ones you can’t.',
    'Look at what you did today, not only at what is left.',
    'Rest is part of the work.',
  ],
  night: [
    'It’s late. Tomorrow’s you will thank you for sleeping.',
    'Write it down and let it go until morning.',
  ],

  work: [
    'Small, steady steps compound into discoveries.',
    'Clarity first: what does done look like?',
    'Deep work, one block at a time.',
  ],
  research: [
    'Curiosity first, rigor always.',
    'A failed experiment is still data.',
    'Read one paper well rather than five in a hurry.',
  ],
  thesis: [
    'A page a day becomes a thesis.',
    'Write the messy draft. Editing is easier than a blank page.',
    'Your future self will thank you for today’s paragraph.',
  ],
  coursework: [
    'Understand it, don’t just finish it.',
    'Explain it in your own words; that’s how you know you know it.',
  ],
  meetings: ['Bring questions; leave with next steps.', 'Write the decisions down before you forget them.'],
  ideas: ['Write it down before it disappears.', 'Most good ideas start as bad first drafts.'],

  self: [
    'Show up today. Progress follows the habit, not the mood.',
    'Be kind to yourself; consistency beats intensity.',
  ],
  fitness: [
    'Show up today. Progress follows the habit, not the mood.',
    'Every rep counts, even the slow ones.',
  ],
  health: ['Sleep, water, a walk. The basics carry you far.'],
  learning: ['Every expert kept going as a beginner.', 'Twenty focused minutes beat two distracted hours.'],

  personal: [
    'Make room for the people and moments that matter.',
    'Call someone you’ve been meaning to call.',
  ],
  misc: ['A clear list makes a calm mind.', 'Small chores done now save big ones later.'],
};

export function timeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return hour < 22 ? 'evening' : 'night';
}
