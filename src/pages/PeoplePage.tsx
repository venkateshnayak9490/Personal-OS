import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { attempt } from '@/app/toast';
import { EmptyState, Loading } from '@/components/ui';
import { db } from '@/core/db';
import { createCollection } from '@/core/repos/collections';
import { CollectionPage } from './CollectionPage';

/** The one app-wide People list (fixed id, made on first visit). */
export const PEOPLE_ID = 'people';

export function PeoplePage() {
  const list = useLiveQuery(async () => (await db.collections.get(PEOPLE_ID)) ?? null, []);
  const creating = useRef(false);
  useEffect(() => {
    if (list !== null || creating.current) return;
    creating.current = true;
    void attempt(() => createCollection({ id: PEOPLE_ID, templateKey: 'people' }));
  }, [list]);

  if (!list) return <Loading />;
  if (list.deletedAt)
    return (
      <EmptyState title="Your People list is in Trash">
        <Link to="/trash" className="font-medium hover:underline">
          Restore it from Trash
        </Link>
      </EmptyState>
    );
  return <CollectionPage id={PEOPLE_ID} />;
}
