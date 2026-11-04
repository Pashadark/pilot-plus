import { getViolationIcon, violationIconPosition } from '../violation-icon';

export function ViolationIconPng({
  description,
  kind,
}: {
  description?: string | null;
  kind?: 'TOLL';
}) {
  const icon = kind === 'TOLL' ? 'toll' : getViolationIcon(description);
  return (
    <span
      aria-hidden="true"
      data-violation-icon={icon}
      className="block size-10 shrink-0 bg-[url('/fines/violation-icons-v1.png')] bg-[length:400%_200%] bg-no-repeat"
      style={{ backgroundPosition: violationIconPosition[icon] }}
    />
  );
}
