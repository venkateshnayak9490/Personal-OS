/**
 * Colors users can give sections and tags. Stored by name; class names are literal so Tailwind sees them.
 * Each has a darker shade for light mode and a lighter one for dark mode.
 */
export interface ColorClasses {
  text: string;
  soft: string;
  dot: string;
  ring: string;
}

export const PALETTE: Record<string, ColorClasses> = {
  indigo: {
    text: 'text-indigo-600 dark:text-indigo-400',
    soft: 'bg-indigo-500/12',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500',
  },
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-500/12',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
  rose: {
    text: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-500/12',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-500/12',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
  },
  sky: {
    text: 'text-sky-600 dark:text-sky-400',
    soft: 'bg-sky-500/12',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
  },
  violet: {
    text: 'text-violet-600 dark:text-violet-400',
    soft: 'bg-violet-500/12',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
  },
  teal: {
    text: 'text-teal-600 dark:text-teal-400',
    soft: 'bg-teal-500/12',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500',
  },
  orange: {
    text: 'text-orange-600 dark:text-orange-400',
    soft: 'bg-orange-500/12',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500',
  },
  pink: {
    text: 'text-pink-600 dark:text-pink-400',
    soft: 'bg-pink-500/12',
    dot: 'bg-pink-500',
    ring: 'ring-pink-500',
  },
  slate: {
    text: 'text-slate-600 dark:text-slate-300',
    soft: 'bg-slate-500/12',
    dot: 'bg-slate-500',
    ring: 'ring-slate-500',
  },
};

export const COLOR_NAMES = Object.keys(PALETTE);

export function colorFor(name: string | undefined): ColorClasses {
  return (name && PALETTE[name]) || PALETTE.slate!;
}
