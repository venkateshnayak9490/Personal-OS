import { createElement } from 'react';
import { iconFor } from './icons';

/** Renders a section icon by its stored name (e.g. "flask"). */
export function NodeIcon({ name, className }: { name: string | undefined; className?: string }) {
  return createElement(iconFor(name), { className, 'aria-hidden': true });
}
