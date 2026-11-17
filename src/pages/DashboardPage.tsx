import { CalendarClock, CircleCheck, FolderKanban, Repeat, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { COLOR_CLASSES, SECTIONS } from '@/app/nav';
import { Card, MilestoneBadge } from '@/components/PageHeader';
import { cn } from '@/lib/cn';

function greeting(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const WIDGETS: { title: string; icon: LucideIcon; empty: string }[] = [
  { title: "Today's tasks", icon: CircleCheck, empty: 'Tasks due today and anything overdue.' },
  { title: 'Habits', icon: Repeat, empty: 'Tap to check off today’s habits.' },
  { title: 'Upcoming deadlines', icon: CalendarClock, empty: 'The next 7 days at a glance.' },
  { title: 'Ongoing projects', icon: FolderKanban, empty: 'Progress bars for active projects.' },
];

export function DashboardPage() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <header className="mb-6">
        <p className="text-muted text-sm">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{greeting(now.getHours())}</h1>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {WIDGETS.map(({ title, icon: Icon, empty }) => (
          <Card key={title}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="text-accent size-4" />
              <h2 className="flex-1 text-sm font-semibold">{title}</h2>
              <MilestoneBadge milestone="M2" />
            </div>
            <p className="text-muted text-sm">{empty}</p>
          </Card>
        ))}
      </div>

      <h2 className="text-muted mb-3 text-sm font-semibold">Sections</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              to={s.path}
              className="border-line bg-surface hover:bg-surface-2 flex flex-col gap-3 rounded-xl border p-4 transition-colors"
            >
              <div className={cn('grid size-9 place-items-center rounded-lg', COLOR_CLASSES[s.color].soft)}>
                <Icon className={cn('size-[18px]', COLOR_CLASSES[s.color].text)} />
              </div>
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-muted text-xs">{s.children?.length ?? 0} subsections</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
