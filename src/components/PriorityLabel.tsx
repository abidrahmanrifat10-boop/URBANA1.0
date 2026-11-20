import { AlertTriangle, CheckCircle2, Clock, Flame, MinusCircle } from 'lucide-react';
import { PriorityLevel, priorityText } from '../engine/urbanaEngine';

export function PriorityLabel({ level }: { level: PriorityLevel }) {
  const label = priorityText(level);
  if (level === 4) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (level === 3) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (level === 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function StatusLabel({ done, doneText = 'Completed' }: { done: boolean; doneText?: string }) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>{doneText}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
      <span>Pending</span>
    </span>
  );
}
