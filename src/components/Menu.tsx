import type { LucideIcon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** A "⋯" style dropdown. Pass `null` in items for a separator. */
export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode;
  items: (MenuItem | null)[];
  align?: 'start' | 'end';
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className="border-line bg-surface-3 z-50 min-w-48 rounded-md border p-1 shadow-xl"
        >
          {items.map((item, i) =>
            item === null ? (
              <DropdownMenu.Separator key={`sep-${i}`} className="bg-line my-1 h-px" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'data-[highlighted]:bg-surface-2 flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  item.danger && 'text-danger',
                )}
              >
                {item.icon && <item.icon className="size-4 shrink-0" />}
                {item.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
