import { LIFECYCLE, STATUS_LABELS } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

/** Lifecycle steps with timestamps from the status history; CANCELLED/REFUNDED shown as end states. */
export default function OrderTimeline({ status, timeline }) {
  const reachedAt = Object.fromEntries(timeline.map((t) => [t.to_status, t.changed_at]));
  const cancelled = status === 'CANCELLED';
  const steps = cancelled ? ['PLACED', 'CANCELLED'] : [...LIFECYCLE, ...(status === 'REFUNDED' ? ['REFUNDED'] : [])];
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="relative space-y-4">
      {steps.map((step, i) => {
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const bad = step === 'CANCELLED' || step === 'REFUNDED';
        const dot = done ? (bad ? 'bg-rose-500' : 'bg-brand-600') : 'bg-gray-200';
        return (
          <li key={step} className="relative flex gap-3">
            {i < steps.length - 1 && (
              <span className={`absolute left-[9px] top-5 h-full w-0.5 ${i < currentIndex ? 'bg-brand-200' : 'bg-gray-100'}`} aria-hidden="true" />
            )}
            <span className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${dot}`}>
              {done && <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M7.6 14.2 3.4 10l1.4-1.4 2.8 2.8 7.6-7.6L16.6 5z" /></svg>}
            </span>
            <div className={done ? '' : 'opacity-50'}>
              <p className={`text-sm ${isCurrent ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{STATUS_LABELS[step]}</p>
              {reachedAt[step] && <p className="text-xs text-gray-400">{formatDateTime(reachedAt[step])}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
