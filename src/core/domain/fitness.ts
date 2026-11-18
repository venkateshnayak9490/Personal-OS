import type { FitnessLevel, Routine, RoutineExercise, WorkoutSession, WorkoutSet } from './types';

/** Estimated one-rep max (Epley). Reps above 12 make it unreliable, so they don't count. */
export const e1rm = (s: Pick<WorkoutSet, 'reps' | 'weight'>) =>
  s.reps >= 1 && s.reps <= 12 && s.weight > 0 ? s.weight * (1 + s.reps / 30) : 0;

/** Same exercise whatever the spacing or capitals. */
export const exerciseKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface PR {
  heaviest: number;
  e1rm: number;
}

/**
 * Personal records reached by each set, judged against everything logged before it
 * (earlier days, or earlier in the same workout). Returns the set ids that set a record.
 */
export function prSets(sessions: WorkoutSession[], sets: WorkoutSet[]): Set<string> {
  const when = new Map(sessions.map((s) => [s.id, `${s.date}|${String(s.createdAt).padStart(15, '0')}`]));
  const ordered = sets
    .filter((s) => when.has(s.sessionId) && !s.deletedAt && s.kind !== 'cardio')
    .sort(
      (a, b) => when.get(a.sessionId)!.localeCompare(when.get(b.sessionId)!) || (a.order < b.order ? -1 : 1),
    );
  const best = new Map<string, PR>();
  const out = new Set<string>();
  for (const s of ordered) {
    const k = exerciseKey(s.exercise);
    const prev = best.get(k);
    const est = e1rm(s);
    if (prev && (s.weight > prev.heaviest || est > prev.e1rm + 0.01)) out.add(s.id);
    best.set(k, { heaviest: Math.max(prev?.heaviest ?? 0, s.weight), e1rm: Math.max(prev?.e1rm ?? 0, est) });
  }
  return out;
}

/** Best so far per exercise (for the exercise list). */
export function bests(sets: WorkoutSet[]): Map<string, { name: string } & PR> {
  const m = new Map<string, { name: string } & PR>();
  for (const s of sets) {
    if (s.deletedAt || s.kind === 'cardio') continue;
    const k = exerciseKey(s.exercise);
    const cur = m.get(k);
    m.set(k, {
      name: cur?.name ?? s.exercise.trim(),
      heaviest: Math.max(cur?.heaviest ?? 0, s.weight),
      e1rm: Math.max(cur?.e1rm ?? 0, e1rm(s)),
    });
  }
  return m;
}

/* ---------- Routines ---------- */

export const LEVELS: { value: FitnessLevel; label: string; who: string }[] = [
  { value: 'beginner', label: 'Beginner', who: 'New, or under 6 months of steady training' },
  { value: 'intermediate', label: 'Intermediate', who: '6 months to 2 years of steady training' },
  { value: 'advanced', label: 'Advanced', who: 'Over 2 years, comfortable with the big lifts' },
  { value: 'athlete', label: 'Athlete', who: 'You train for a sport: power, speed, conditioning' },
];

export const CARDIO = [
  'Running',
  'Treadmill',
  'Walking',
  'Cycling',
  'Rowing',
  'Elliptical',
  'Swimming',
  'Skipping rope',
  'Stair climber',
  'HIIT',
];

const ex = (name: string, sets: number, reps: string): RoutineExercise => ({ name, sets, reps });
const cardio = (name: string, minutes: number): RoutineExercise => ({
  name,
  sets: 1,
  reps: `${minutes} min`,
  cardio: true,
  minutes,
});

export type Program = Pick<Routine, 'title' | 'level' | 'perWeek' | 'days' | 'byWeekday'> & {
  programKey: string;
  summary: string;
};

/** Built-in programs. Picking one copies it into your routines, so you can change anything. */
export const PROGRAMS: Program[] = [
  {
    programKey: 'weekly-split-6',
    title: 'Weekly split, Mon–Sat',
    level: 'intermediate',
    perWeek: 6,
    byWeekday: true,
    summary:
      'A fixed day for each muscle group: chest/triceps/shoulders, back/biceps, legs, twice a week. Sunday rest.',
    days: [
      {
        name: 'Chest, triceps, shoulders',
        weekday: 1,
        exercises: [
          ex('Bench press', 4, '6-8'),
          ex('Incline dumbbell press', 3, '8-10'),
          ex('Overhead press', 3, '8-10'),
          ex('Lateral raise', 3, '12-15'),
          ex('Triceps pushdown', 3, '10-12'),
          ex('Overhead triceps extension', 3, '10-12'),
        ],
      },
      {
        name: 'Back and biceps',
        weekday: 2,
        exercises: [
          ex('Deadlift', 3, '5'),
          ex('Pull-ups', 3, 'max'),
          ex('Barbell row', 3, '8-10'),
          ex('Lat pulldown', 3, '10-12'),
          ex('Bicep curl', 3, '10-12'),
          ex('Hammer curl', 3, '10-12'),
        ],
      },
      {
        name: 'Legs and core',
        weekday: 3,
        exercises: [
          ex('Back squat', 4, '6-8'),
          ex('Romanian deadlift', 3, '8-10'),
          ex('Leg press', 3, '10-12'),
          ex('Leg curl', 3, '10-12'),
          ex('Standing calf raise', 4, '12-15'),
          ex('Plank', 3, '45 s'),
        ],
      },
      {
        name: 'Chest, triceps, shoulders (B)',
        weekday: 4,
        exercises: [
          ex('Incline bench press', 4, '6-8'),
          ex('Dumbbell bench press', 3, '8-10'),
          ex('Dumbbell shoulder press', 3, '8-10'),
          ex('Lateral raise', 3, '12-15'),
          ex('Dips', 3, 'max'),
          ex('Skull crushers', 3, '10-12'),
        ],
      },
      {
        name: 'Back and biceps (B)',
        weekday: 5,
        exercises: [
          ex('Barbell row', 4, '6-8'),
          ex('Seated cable row', 3, '10-12'),
          ex('Lat pulldown', 3, '10-12'),
          ex('Face pull', 3, '15'),
          ex('Incline dumbbell curl', 3, '10-12'),
          ex('Hammer curl', 3, '10-12'),
        ],
      },
      {
        name: 'Legs and cardio',
        weekday: 6,
        exercises: [
          ex('Front squat', 4, '6-8'),
          ex('Bulgarian split squat', 3, '8-10'),
          ex('Leg extension', 3, '12'),
          ex('Standing calf raise', 4, '12-15'),
          cardio('Running', 20),
        ],
      },
    ],
  },
  {
    programKey: 'full-body-3',
    title: 'Full body, 3 days',
    level: 'beginner',
    perWeek: 3,
    summary: 'Two full-body days, alternated. Learn the movements, build the habit.',
    days: [
      {
        name: 'Full body A',
        exercises: [
          ex('Goblet squat', 3, '10'),
          ex('Dumbbell bench press', 3, '10'),
          ex('Seated cable row', 3, '10'),
          ex('Plank', 3, '30 s'),
          cardio('Walking', 10),
        ],
      },
      {
        name: 'Full body B',
        exercises: [
          ex('Romanian deadlift', 3, '10'),
          ex('Dumbbell shoulder press', 3, '10'),
          ex('Lat pulldown', 3, '10'),
          ex('Walking lunges', 3, '10 each leg'),
          cardio('Cycling', 10),
        ],
      },
    ],
  },
  {
    programKey: 'upper-lower-4',
    title: 'Upper / Lower, 4 days',
    level: 'intermediate',
    perWeek: 4,
    summary: 'Each muscle twice a week, heavy compound lifts first.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          ex('Bench press', 4, '6-8'),
          ex('Barbell row', 4, '6-8'),
          ex('Overhead press', 3, '8-10'),
          ex('Pull-ups', 3, 'max'),
          ex('Bicep curl', 3, '10-12'),
          ex('Triceps pushdown', 3, '10-12'),
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          ex('Back squat', 4, '6-8'),
          ex('Romanian deadlift', 3, '8-10'),
          ex('Leg press', 3, '10-12'),
          ex('Standing calf raise', 4, '12-15'),
          ex('Hanging knee raise', 3, '12'),
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          ex('Incline dumbbell press', 4, '8-10'),
          ex('Lat pulldown', 4, '8-10'),
          ex('Dumbbell shoulder press', 3, '10'),
          ex('Seated cable row', 3, '10-12'),
          ex('Lateral raise', 3, '12-15'),
          ex('Hammer curl', 3, '10-12'),
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          ex('Deadlift', 3, '5'),
          ex('Bulgarian split squat', 3, '8-10'),
          ex('Leg curl', 3, '10-12'),
          ex('Leg extension', 3, '12'),
          ex('Plank', 3, '45 s'),
          cardio('Treadmill', 15),
        ],
      },
    ],
  },
  {
    programKey: 'ppl-6',
    title: 'Push / Pull / Legs, 6 days',
    level: 'advanced',
    perWeek: 6,
    summary: 'Three days, each done twice a week. High volume for experienced lifters.',
    days: [
      {
        name: 'Push',
        exercises: [
          ex('Bench press', 4, '5-8'),
          ex('Overhead press', 3, '6-8'),
          ex('Incline dumbbell press', 3, '8-12'),
          ex('Lateral raise', 4, '12-20'),
          ex('Triceps pushdown', 3, '10-15'),
          ex('Overhead triceps extension', 3, '10-15'),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          ex('Deadlift', 3, '5'),
          ex('Pull-ups', 4, '6-10'),
          ex('Barbell row', 3, '8-10'),
          ex('Face pull', 3, '15'),
          ex('Bicep curl', 3, '10-12'),
          ex('Hammer curl', 3, '10-12'),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          ex('Back squat', 4, '5-8'),
          ex('Romanian deadlift', 3, '8-10'),
          ex('Leg press', 3, '10-15'),
          ex('Leg curl', 3, '10-15'),
          ex('Standing calf raise', 4, '10-15'),
          cardio('Cycling', 10),
        ],
      },
    ],
  },
  {
    programKey: 'athlete-4',
    title: 'Strength & conditioning, 4 days',
    level: 'athlete',
    perWeek: 4,
    summary: 'Power first, then strength, plus a conditioning day. For sport.',
    days: [
      {
        name: 'Lower power',
        exercises: [
          ex('Box jump', 4, '5'),
          ex('Back squat', 5, '3-5'),
          ex('Trap bar deadlift', 3, '5'),
          ex('Walking lunges', 3, '8 each leg'),
          cardio('Running', 10),
        ],
      },
      {
        name: 'Upper power',
        exercises: [
          ex('Medicine ball chest pass', 4, '6'),
          ex('Bench press', 5, '3-5'),
          ex('Weighted pull-ups', 4, '5-6'),
          ex('Push press', 3, '5'),
          ex('Farmer carry', 3, '40 m'),
        ],
      },
      {
        name: 'Conditioning',
        exercises: [
          cardio('Rowing', 20),
          ex('Kettlebell swing', 4, '15'),
          ex('Burpees', 3, '12'),
          ex('Plank', 3, '60 s'),
        ],
      },
      {
        name: 'Full-body strength',
        exercises: [
          ex('Hang power clean', 5, '3'),
          ex('Front squat', 4, '5'),
          ex('Overhead press', 4, '5'),
          ex('Chin-ups', 3, '8'),
          ex('Hanging leg raise', 3, '10'),
        ],
      },
    ],
  },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's day of a routine: by weekday (-1 = rest day), or the next in order. */
export function todaysDayIndex(routine: Routine, sessions: WorkoutSession[], date: string): number {
  if (!routine.byWeekday) return nextDayIndex(routine, sessions);
  const wd = new Date(`${date}T12:00`).getDay();
  return routine.days.findIndex((d) => d.weekday === wd);
}

/** "Mon: Chest, triceps, shoulders; Tue: …" for a weekday routine. */
export function weekPlan(routine: Pick<Routine, 'days'>): string {
  return [...routine.days]
    .filter((d) => d.weekday !== undefined)
    .sort((a, b) => ((a.weekday! + 6) % 7) - ((b.weekday! + 6) % 7))
    .map((d) => `${WEEKDAYS[d.weekday!]}: ${d.name}`)
    .join('; ');
}

/** Which day of a routine comes next: the one after the last workout done from it. */
export function nextDayIndex(routine: Routine, sessions: WorkoutSession[]): number {
  const last = sessions
    .filter((s) => s.routineId === routine.id && s.dayIndex !== undefined && !s.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  return last ? (last.dayIndex! + 1) % routine.days.length : 0;
}

/** The sets of an exercise from the most recent other workout (to pre-fill today's). */
export function lastTime(
  exercise: string,
  sets: WorkoutSet[],
  sessions: WorkoutSession[],
  excludeSession?: string,
): WorkoutSet[] {
  const k = exerciseKey(exercise);
  const order = new Map(sessions.map((s) => [s.id, `${s.date}|${String(s.createdAt).padStart(15, '0')}`]));
  const mine = sets.filter(
    (s) =>
      !s.deletedAt &&
      s.sessionId !== excludeSession &&
      order.has(s.sessionId) &&
      exerciseKey(s.exercise) === k,
  );
  if (!mine.length) return [];
  const latest = mine.reduce((a, b) => (order.get(a.sessionId)! > order.get(b.sessionId)! ? a : b)).sessionId;
  return mine.filter((s) => s.sessionId === latest);
}

/** Cardio minutes and km in workouts dated from..to (inclusive). */
export function cardioTotals(sets: WorkoutSet[], sessions: WorkoutSession[], from: string, to: string) {
  const inRange = new Set(sessions.filter((s) => s.date >= from && s.date <= to).map((s) => s.id));
  let minutes = 0;
  let km = 0;
  for (const s of sets)
    if (s.kind === 'cardio' && !s.deletedAt && inRange.has(s.sessionId)) {
      minutes += s.minutes ?? 0;
      km += s.distanceKm ?? 0;
    }
  return { minutes, km: Math.round(km * 10) / 10 };
}
