import type { RentalDetailView } from './rental-detail-presentation';
import { RentalFinancialCard } from './RentalFinancialCard';
import { RentalHandoverCard } from './RentalHandoverCard';
import { RentalIdentityHeader } from './RentalIdentityHeader';
import { RentalLifecycle } from './RentalLifecycle';
import { RentalSummaryCards } from './RentalSummaryCards';

export function RentalDetailWorkspace({ detail }: { detail: RentalDetailView }) {
  return (
    <div className="grid min-w-0 gap-5">
      <RentalIdentityHeader detail={detail} />
      <RentalSummaryCards detail={detail} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <RentalFinancialCard detail={detail} />
        <RentalHandoverCard detail={detail} />
      </div>
      <RentalLifecycle detail={detail} />
    </div>
  );
}
