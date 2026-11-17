import { db } from '@/core/db';
import { getDeviceId } from '@/core/device';
import { buildStarterTree, type NodeSeed, type Personalization } from '@/core/domain/templates';
import type { Profile, ProfileType } from '@/core/domain/types';
import { seedNodes } from './nodes';
import { insert, patch } from './write';

/** The profile is a single record with a fixed id, so two devices merge into one profile when syncing. */
export const PROFILE_ID = 'profile';

/** Old IANA names some browsers still report, mapped to their current names. */
const TZ_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
};

export function defaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    return TZ_ALIASES[tz] ?? tz;
  } catch {
    return 'Asia/Kolkata';
  }
}

/** All time zones for pickers, using current names, always including `current`. */
export function timezoneOptions(current?: string): string[] {
  let list: string[];
  try {
    list = Intl.supportedValuesOf('timeZone');
  } catch {
    list = ['Asia/Kolkata', 'UTC'];
  }
  const set = new Set(list.map((z) => TZ_ALIASES[z] ?? z));
  if (current) set.add(current);
  return [...set].sort();
}

export interface OnboardingInput {
  profileTypes: ProfileType[];
  displayName?: string;
  adviserName?: string;
  personalization?: Personalization;
  /** The (possibly edited) starter tree. Defaults to the template for the chosen profiles. */
  tree?: NodeSeed[];
  timezone?: string;
  weekStartsOn?: 0 | 1;
}

/** Creates the starter sections and the profile in one transaction (all or nothing). */
export async function completeOnboarding(input: OnboardingInput): Promise<Profile> {
  await getDeviceId(db); // warm the cache so nested writes don't need the meta table
  const tree = input.tree ?? buildStarterTree(input.profileTypes, input.personalization);
  return db.transaction('rw', [db.nodes, db.profile, db.activityLog, db.outbox], async () => {
    if (await db.profile.get(PROFILE_ID)) throw new Error('Already set up');
    await seedNodes(tree);
    return insert<Profile>('profile', {
      id: PROFILE_ID,
      profileTypes: input.profileTypes,
      onboardedAt: Date.now(),
      timezone: input.timezone ?? defaultTimezone(),
      weekStartsOn: input.weekStartsOn ?? 1,
      dateFormat: 'dd MMM yyyy',
      settings: {
        ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
        ...(input.adviserName?.trim() ? { adviserName: input.adviserName.trim() } : {}),
      },
    });
  });
}

export async function updateProfile(
  changes: Partial<Pick<Profile, 'timezone' | 'weekStartsOn' | 'profileTypes'>>,
) {
  return patch<Profile>('profile', PROFILE_ID, changes);
}

export async function updateProfileSettings(settings: Record<string, unknown>) {
  const cur = await db.profile.get(PROFILE_ID);
  if (!cur) return null;
  return patch<Profile>('profile', PROFILE_ID, { settings: { ...cur.settings, ...settings } });
}
