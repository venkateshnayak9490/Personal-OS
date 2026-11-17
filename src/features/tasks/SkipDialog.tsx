import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input } from '@/components/ui';
import type { Task } from '@/core/domain/types';
import { changeStatus } from './actions';

/** Skipping is deliberate and never counts as completed; an optional reason is kept. */
export function SkipDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const skip = async () => {
    await changeStatus(task, 'skipped', reason);
    onClose();
  };
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Skip task"
      description="Skipped tasks are recorded honestly: they don’t count as completed."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void skip()}>
            Skip
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void skip();
        }}
      >
        <Field label="Reason (optional)" htmlFor="skip-reason">
          <Input
            id="skip-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Rest day, sick, plan changed"
          />
        </Field>
      </form>
    </Sheet>
  );
}
