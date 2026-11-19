import { Inbox, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Confirm, Sheet } from '@/components/Sheet';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { Card, PageHeader } from '@/components/PageHeader';
import {
  Badge,
  BlockHeader,
  Button,
  EmptyState,
  Field,
  Input,
  Loading,
  ProgressBar,
  SaveHint,
  Segmented,
  Select,
  StatusMark,
  Textarea,
  type Mark,
} from '@/components/ui';
import { toast } from '@/app/toast';
import { useThemeStore } from '@/app/theme';

const COLOURS = [
  ['bg', 'surface', 'surface-2', 'surface-3'],
  ['line', 'line-strong', 'fg', 'fg-2', 'muted'],
  ['accent', 'focus', 'shell', 'shell-2'],
  ['danger', 'warning', 'success', 'info'],
  ['sec-work', 'sec-self', 'sec-personal', 'sec-misc'],
] as const;
const MARKS: Mark[] = ['done', 'skipped', 'rest', 'missed', 'due', 'none'];

/** Development reference: every token and shared component, in the current theme. Route: /dev/design. */
export default function DesignSystemPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [seg, setSeg] = useState<'week' | 'month' | 'year'>('week');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState('');

  return (
    <div className="space-y-10">
      <PageHeader
        title="Design system"
        subtitle="Tokens and shared components. Development only."
        actions={
          <Segmented
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        }
      />

      <section aria-labelledby="ds-colour">
        <BlockHeader id="ds-colour" title="Colour" />
        <div className="space-y-3">
          {COLOURS.map((row) => (
            <div key={row[0]} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {row.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="border-line size-8 rounded-md border" style={{ background: `var(--${c})` }} />
                  <code className="text-meta text-muted">--{c}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ds-type">
        <BlockHeader id="ds-type" title="Type" />
        <p className="title-page">Page title, 21–22px bold</p>
        <p className="title-block mt-3">Block title, 14–15px bold</p>
        <p className="mt-2 text-[15px] md:text-sm">Body: Email Prof. Rajan about the draft. 09:30, 1/3 done.</p>
        <p className="text-meta text-muted mt-1">Meta: Thesis · due today · 12.5–13px</p>
      </section>

      <section aria-labelledby="ds-buttons">
        <BlockHeader id="ds-buttons" title="Buttons" />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">
            <Plus className="size-4" /> New task
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
          <Button size="icon" aria-label="Search">
            <Search className="size-[18px]" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Search">
            <Search className="size-4" />
          </Button>
        </div>
      </section>

      <section aria-labelledby="ds-inputs" className="grid gap-4 md:grid-cols-2">
        <BlockHeader id="ds-inputs" title="Inputs" className="md:col-span-2" />
        <Field label="Title" htmlFor="ds-title">
          <Input id="ds-title" placeholder="Add a task" />
        </Field>
        <Field label="Section" htmlFor="ds-select">
          <Select id="ds-select" defaultValue="thesis">
            <option value="thesis">Thesis</option>
            <option value="smai">SMAI</option>
          </Select>
        </Field>
        <Field label="Invalid" htmlFor="ds-bad" hint="Give it a name">
          <Input id="ds-bad" aria-invalid="true" defaultValue="" />
        </Field>
        <Field label="Due">
          <DatePicker value={date} onChange={setDate}>
            <DateButton label="Due date" value={date} />
          </DatePicker>
        </Field>
        <Field label="Notes" htmlFor="ds-notes" className="md:col-span-2">
          <Textarea id="ds-notes" placeholder="Anything to remember" />
        </Field>
        <div className="flex items-center gap-3 md:col-span-2">
          <SaveHint>Give it a name</SaveHint>
          <Segmented
            label="Range"
            as="tabs"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'week', label: 'Week', count: 4 },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="ds-status">
        <BlockHeader id="ds-status" title="Status" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge>3 open</Badge>
          <Badge tone="danger">Overdue</Badge>
          <Badge tone="warning">Due soon</Badge>
          <Badge tone="success">Saved</Badge>
          <Badge tone="info">Synced</Badge>
        </div>
        <div className="mt-3 flex items-center gap-4">
          {MARKS.map((m) => (
            <span key={m} className="text-meta text-muted flex items-center gap-1.5">
              <span className="border-line grid size-8 place-items-center border">
                <StatusMark mark={m} />
              </span>
              {m}
            </span>
          ))}
        </div>
        <ProgressBar pct={62} label="Example progress" className="mt-4 max-w-sm" />
      </section>

      <section aria-labelledby="ds-panels" className="grid gap-4 md:grid-cols-2">
        <BlockHeader id="ds-panels" title="Panels, overlays and feedback" className="md:col-span-2" />
        <Card>
          <p className="title-block">Card</p>
          <p className="text-muted mt-1 text-sm">For one object: a form, a table, the check-in.</p>
        </Card>
        <div className="flex flex-wrap items-start gap-2">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
          <Button onClick={() => setConfirm(true)}>Confirm</Button>
          <Button onClick={() => toast('Task completed', () => undefined)}>Toast with undo</Button>
          <Menu
            trigger={<Button>Menu</Button>}
            items={[
              { label: 'Edit', onSelect: () => undefined },
              null,
              { label: 'Delete', icon: Trash2, danger: true, onSelect: () => undefined },
            ]}
          />
        </div>
        <EmptyState icon={Inbox} title="Inbox is empty" action={<Button variant="primary">Add a task</Button>}>
          Anything you capture without a section lands here.
        </EmptyState>
        <Loading />
      </section>

      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        title="New task"
        footer={
          <>
            <Button onClick={() => setSheet(false)}>Cancel</Button>
            <Button variant="primary">Save</Button>
          </>
        }
      >
        <Input placeholder="What needs doing?" />
      </Sheet>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this list?"
        description="It moves to Trash, where you can restore it."
        confirmLabel="Delete"
        danger
        onConfirm={() => setConfirm(false)}
      />
    </div>
  );
}
