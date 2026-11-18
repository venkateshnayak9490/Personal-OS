import { Select } from '@/components/ui';
import { flatten } from '@/core/domain/tree';
import { useNodeTree } from '@/features/structure/use-tree';

/** A select listing sections as an indented tree. Empty value = none. */
export function SectionSelect({
  value,
  onChange,
  id,
  noneLabel = 'No section',
  className,
}: {
  value: string | undefined;
  onChange: (nodeId: string | undefined) => void;
  id?: string;
  noneLabel?: string;
  className?: string;
}) {
  const t = useNodeTree();
  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={className}
    >
      <option value="">{noneLabel}</option>
      {t &&
        flatten(t.visibleTree).map(({ node, depth }) => (
          <option key={node.id} value={node.id}>
            {'  '.repeat(depth * 2)}
            {node.title}
          </option>
        ))}
    </Select>
  );
}
