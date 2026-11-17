import { uuidv7 } from 'uuidv7';
import type { BaseEntity } from './types';

export function newId(): string {
  return uuidv7();
}

/** Fields for a brand-new record. */
export function newBase(deviceId: string, now: number = Date.now()): BaseEntity {
  return { id: newId(), createdAt: now, updatedAt: now, version: 1, deviceId };
}

/** Returns the bookkeeping fields to apply when a record is modified. */
export function touch<T extends BaseEntity>(
  entity: T,
  deviceId: string,
  now: number = Date.now(),
): Pick<BaseEntity, 'updatedAt' | 'version' | 'deviceId'> {
  // Guard against clock skew: updatedAt never moves backwards.
  return { updatedAt: Math.max(now, entity.updatedAt + 1), version: entity.version + 1, deviceId };
}
