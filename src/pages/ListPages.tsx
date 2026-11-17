import { ChevronRight, Ellipsis, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router';
import {
  COLOR_CLASSES,
  PRIMARY_NAV,
  PRIVATE_NAV,
  SECTIONS,
  SETTINGS_NAV,
  TOOLS_NAV,
  type NavItem,
} from '@/app/nav';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/cn';

function Row({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        'hover:bg-surface-2 active:bg-surface-2 flex min-h-12 items-center gap-3 px-4 transition-colors',
        nested && 'min-h-11 pl-12 text-sm',
      )}
    >
      {!nested && (
        <Icon
          className={cn(
            'size-5 shrink-0',
            item.color === 'neutral' ? 'text-muted' : COLOR_CLASSES[item.color].text,
          )}
        />
      )}
      <span className={cn('flex-1 truncate', !nested && 'font-medium')}>{item.title}</span>
      <ChevronRight className="text-muted size-4" />
    </Link>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-line border-line bg-surface mb-4 divide-y overflow-hidden rounded-xl border">
      {children}
    </div>
  );
}

/** Mobile "Sections" tab: the four main sections and their subsections. */
export function SectionsPage() {
  return (
    <>
      <PageHeader title="Sections" icon={LayoutGrid} />
      {SECTIONS.map((s) => (
        <Group key={s.key}>
          <Row item={s} />
          {s.children?.map((c) => (
            <Row key={c.key} item={c} nested />
          ))}
        </Group>
      ))}
    </>
  );
}

/** Mobile "More" tab. */
export function MorePage() {
  const inbox = PRIMARY_NAV.find((i) => i.key === 'inbox');
  return (
    <>
      <PageHeader title="More" icon={Ellipsis} />
      <Group>{inbox && <Row item={inbox} />}</Group>
      <Group>
        {TOOLS_NAV.map((i) => (
          <Row key={i.key} item={i} />
        ))}
      </Group>
      <Group>
        {PRIVATE_NAV.map((i) => (
          <Row key={i.key} item={i} />
        ))}
      </Group>
      <Group>
        <Row item={SETTINGS_NAV} />
      </Group>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted mt-1 text-sm">This page doesn’t exist (yet).</p>
      <Link to="/" className="text-accent mt-4 inline-block text-sm font-medium hover:underline">
        Go to Today
      </Link>
    </div>
  );
}
