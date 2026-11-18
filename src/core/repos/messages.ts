import type { MotivationalMessage } from '@/core/domain/types';
import { insert, softDeleteBatch } from './write';

/** Your own motivational lines. `contexts` empty = anywhere; otherwise the section ids it shows in. */
export async function createMessage(text: string, nodeId?: string) {
  const t = text.trim();
  if (!t) throw new Error('Write a message first');
  return insert<MotivationalMessage>('messages', {
    text: t,
    contexts: nodeId ? [nodeId] : [],
    builtIn: false,
    enabled: true,
  });
}

export const deleteMessage = (id: string) => softDeleteBatch([{ tableName: 'messages', id }]);
