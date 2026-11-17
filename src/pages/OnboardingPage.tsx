import { ArrowLeft, ArrowRight, Check, Moon, Monitor, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useThemeStore } from '@/app/theme';
import { Button, Field, Input, Select } from '@/components/ui';
import { useProfile } from '@/core/hooks';
import { buildStarterTree, PROFILE_OPTIONS, splitList, type NodeSeed } from '@/core/domain/templates';
import type { ProfileType, ThemePref } from '@/core/domain/types';
import { completeOnboarding, defaultTimezone, timezoneOptions } from '@/core/repos/profile';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

const STEPS = ['Welcome', 'About you', 'Details', 'Sections', 'Preferences'] as const;

/** Apply the user's include/rename choices to the template tree. */
function applyEdits(tree: NodeSeed[], excluded: Set<string>, renamed: Record<string, string>): NodeSeed[] {
  return tree
    .filter((s) => !excluded.has(s.key))
    .map((s) => ({
      ...s,
      title: renamed[s.key]?.trim() || s.title,
      children: s.children ? applyEdits(s.children, excluded, renamed) : undefined,
    }));
}

function SeedRow({
  seed,
  depth,
  excluded,
  renamed,
  onToggle,
  onRename,
  rootColor,
}: {
  seed: NodeSeed;
  depth: number;
  excluded: Set<string>;
  renamed: Record<string, string>;
  onToggle: (key: string) => void;
  onRename: (key: string, title: string) => void;
  rootColor?: string;
}) {
  const off = excluded.has(seed.key);
  const color = colorFor(seed.color ?? rootColor);
  return (
    <>
      <div
        className={cn('flex items-center gap-2 py-1.5', off && 'opacity-45')}
        style={{ paddingLeft: depth * 20 }}
      >
        <input
          type="checkbox"
          checked={!off}
          onChange={() => onToggle(seed.key)}
          aria-label={`Include ${seed.title}`}
          className="size-4 accent-[var(--accent)]"
        />
        <NodeIcon name={seed.icon} className={cn('size-4 shrink-0', color.text)} />
        <input
          value={renamed[seed.key] ?? seed.title}
          onChange={(e) => onRename(seed.key, e.target.value)}
          disabled={off}
          aria-label={`Name for ${seed.title}`}
          className={cn(
            'hover:border-line focus:border-accent min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm focus:outline-none',
            depth === 0 && 'font-semibold',
          )}
        />
      </div>
      {!off &&
        seed.children?.map((c) => (
          <SeedRow
            key={c.key}
            seed={c}
            depth={depth + 1}
            excluded={excluded}
            renamed={renamed}
            onToggle={onToggle}
            onRename={onRename}
            rootColor={seed.color ?? rootColor}
          />
        ))}
    </>
  );
}

export function OnboardingPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [types, setTypes] = useState<ProfileType[]>([]);
  const [topics, setTopics] = useState('');
  const [courses, setCourses] = useState('');
  const [adviser, setAdviser] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [tz, setTz] = useState(defaultTimezone);
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [saving, setSaving] = useState(false);

  const tree = useMemo(
    () => buildStarterTree(types, { researchTopics: splitList(topics), courses: splitList(courses) }),
    [types, topics, courses],
  );
  const zones = useMemo(() => timezoneOptions(defaultTimezone()), []);

  if (profile) return <Navigate to="/" replace />;

  const isResearch = types.includes('researcher');
  const hasCourses = isResearch || types.includes('student');

  const toggleType = (t: ProfileType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const finish = async () => {
    setSaving(true);
    const done = await attempt(() =>
      completeOnboarding({
        profileTypes: types.length ? types : ['other'],
        displayName: name,
        adviserName: adviser,
        tree: applyEdits(tree, excluded, renamed),
        timezone: tz,
        weekStartsOn: weekStart,
      }),
    );
    setSaving(false);
    if (done) navigate('/', { replace: true });
  };

  const canNext = step !== 1 || types.length > 0;

  return (
    <div className="bg-bg min-h-dvh px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-9 rounded-lg" />
          <div className="flex-1">
            <div className="font-semibold tracking-tight">Personal OS</div>
            <div className="text-muted text-xs">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </div>
          </div>
        </div>
        <div className="mb-8 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-5">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Let’s set up your workspace</h1>
            <p className="text-muted">
              Personal OS keeps your work, health, learning and life in one place. Everything is stored on
              this device. You don’t need an account, and you can change everything later.
            </p>
            <Field label="What should we call you? (optional)" htmlFor="ob-name">
              <Input
                id="ob-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
              />
            </Field>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="mb-1 text-xl font-semibold tracking-tight">What describes you?</h1>
            <p className="text-muted mb-5 text-sm">
              Pick one or more. This only decides your starter sections.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILE_OPTIONS.map((o) => {
                const on = types.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleType(o.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                      on ? 'border-accent bg-accent/8' : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border',
                        on ? 'border-accent bg-accent text-accent-fg' : 'border-line',
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{o.label}</span>
                      <span className="text-muted block text-xs">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h1 className="text-xl font-semibold tracking-tight">A few details</h1>
            {!isResearch && !hasCourses && (
              <p className="text-muted text-sm">
                Nothing extra needed for your profile. Continue to review your sections.
              </p>
            )}
            {isResearch && (
              <Field
                label="Research areas"
                hint="Comma-separated. Each becomes a category under Research."
                htmlFor="ob-topics"
              >
                <Input
                  id="ob-topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. Physical AI"
                />
              </Field>
            )}
            {hasCourses && (
              <Field
                label="Current courses"
                hint="Comma-separated. Each becomes a category under Coursework."
                htmlFor="ob-courses"
              >
                <Input
                  id="ob-courses"
                  value={courses}
                  onChange={(e) => setCourses(e.target.value)}
                  placeholder="e.g. SMAI"
                />
              </Field>
            )}
            {isResearch && (
              <Field label="Adviser / supervisor (optional)" htmlFor="ob-adviser">
                <Input
                  id="ob-adviser"
                  value={adviser}
                  onChange={(e) => setAdviser(e.target.value)}
                  placeholder="e.g. Prof. KS Rajan"
                />
              </Field>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="mb-1 text-xl font-semibold tracking-tight">Your sections</h1>
            <p className="text-muted mb-4 text-sm">
              Untick what you don’t need and rename anything. You can add, reorder, nest, hide and restyle
              sections later.
            </p>
            <div className="border-line bg-surface rounded-xl border p-3">
              {tree.map((s) => (
                <SeedRow
                  key={s.key}
                  seed={s}
                  depth={0}
                  excluded={excluded}
                  renamed={renamed}
                  onToggle={(k) =>
                    setExcluded((cur) => {
                      const next = new Set(cur);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      return next;
                    })
                  }
                  onRename={(k, title) => setRenamed((cur) => ({ ...cur, [k]: title }))}
                />
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5">
            <h1 className="text-xl font-semibold tracking-tight">Preferences</h1>
            <Field label="Theme">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['dark', 'Dark', Moon],
                    ['light', 'Light', Sun],
                    ['system', 'System', Monitor],
                  ] as [ThemePref, string, typeof Moon][]
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={theme === v}
                    onClick={() => setTheme(v)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm',
                      theme === v
                        ? 'border-accent bg-accent/8 font-medium'
                        : 'border-line bg-surface text-muted',
                    )}
                  >
                    <Icon className="size-5" />
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="Time zone"
              hint="Used for due dates and daily stats. Deadlines can also use AoE."
              htmlFor="ob-tz"
            >
              <Select id="ob-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Week starts on" htmlFor="ob-week">
              <Select
                id="ob-week"
                value={weekStart}
                onChange={(e) => setWeekStart(Number(e.target.value) as 0 | 1)}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
          </section>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button variant="primary" disabled={saving} onClick={() => void finish()}>
              {saving ? 'Setting up…' : 'Start using Personal OS'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
