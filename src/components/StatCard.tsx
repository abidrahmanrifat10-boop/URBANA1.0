import { ReactNode } from 'react';
import { GlassIcon, GlassTone } from './GlassIcon';
import { Tilt3DCard } from './Tilt3DCard';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  valueClassName?: string;
  icon?: ReactNode;
  iconTone?: GlassTone;
  footer?: ReactNode;
}

export function StatCard({
  label,
  value,
  suffix,
  valueClassName = 'text-slate-900 dark:text-zinc-100',
  icon,
  iconTone = 'emerald',
  footer,
}: StatCardProps) {
  return (
    <Tilt3DCard className="group p-5 flex flex-col justify-between h-full">
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span className="truncate">{label}</span>
          {icon && (
            <GlassIcon tone={iconTone} size="sm">
              {icon}
            </GlassIcon>
          )}
        </div>
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${valueClassName}`}>
            {value}
          </span>
          {suffix && <span className="text-xs text-slate-500 dark:text-zinc-400">{suffix}</span>}
        </div>
      </div>
      {footer && (
        <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
          {footer}
        </div>
      )}
    </Tilt3DCard>
  );
}
