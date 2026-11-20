import { ReactNode } from 'react';

export type GlassTone = 'teal' | 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo';
export type GlassSize = 'xs' | 'sm' | 'md' | 'lg';

interface GlassIconProps {
  children: ReactNode;
  tone?: GlassTone;
  size?: GlassSize;
  variant?: 'light' | 'dark';
  active?: boolean;
  className?: string;
}

const LIGHT_TONES: Record<GlassTone, string> = {
  teal: 'from-emerald-500/18 via-teal-400/10 to-white/90 dark:to-zinc-800/80 border-emerald-200/80 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300',
  blue: 'from-slate-500/14 via-slate-400/10 to-white/90 dark:to-zinc-800/80 border-slate-200/90 dark:border-zinc-700 text-slate-800 dark:text-zinc-200',
  indigo: 'from-indigo-500/18 via-blue-400/10 to-white/90 dark:to-zinc-800/80 border-indigo-200/80 dark:border-indigo-700/40 text-indigo-700 dark:text-indigo-300',
  emerald: 'from-emerald-500/20 via-teal-400/10 to-white/90 dark:to-zinc-800/80 border-emerald-200/80 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300',
  amber: 'from-amber-500/18 via-orange-400/10 to-white/90 dark:to-zinc-800/80 border-amber-200/80 dark:border-amber-700/40 text-amber-700 dark:text-amber-300',
  red: 'from-red-500/18 via-rose-400/10 to-white/90 dark:to-zinc-800/80 border-red-200/80 dark:border-red-700/40 text-red-700 dark:text-red-300',
  slate: 'from-slate-500/12 via-slate-300/10 to-white/90 dark:to-zinc-800/80 border-slate-200/90 dark:border-zinc-700 text-slate-700 dark:text-zinc-300',
};

const DARK_TONES: Record<GlassTone, string> = {
  teal: 'from-emerald-400/25 via-teal-400/12 to-white/[0.06] border-emerald-300/30 text-emerald-200',
  blue: 'from-white/20 via-white/10 to-white/[0.04] border-white/25 text-white',
  indigo: 'from-indigo-500/28 via-indigo-400/12 to-white/[0.04] border-indigo-400/30 text-indigo-200',
  emerald: 'from-emerald-400/25 via-teal-400/12 to-white/[0.06] border-emerald-300/30 text-emerald-200',
  amber: 'from-amber-500/25 via-orange-400/10 to-white/[0.04] border-amber-400/30 text-amber-200',
  red: 'from-rose-500/25 via-red-400/10 to-white/[0.04] border-rose-400/30 text-rose-200',
  slate: 'from-slate-400/20 via-slate-500/10 to-white/[0.04] border-white/15 text-slate-200',
};

const SIZE_CLASSES: Record<GlassSize, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-11 h-11 rounded-xl',
};

export function GlassIcon({
  children,
  tone = 'emerald',
  size = 'md',
  variant = 'light',
  active = false,
  className = '',
}: GlassIconProps) {
  const toneClasses = variant === 'dark' ? DARK_TONES[tone] : LIGHT_TONES[tone];
  const isDark = variant === 'dark';

  return (
    <span
      className={`${isDark ? 'glass-icon-dark' : 'glass-icon'} relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br backdrop-blur-md border transition-transform duration-200 ${SIZE_CLASSES[size]} ${toneClasses} ${
        active ? 'ring-2 ring-emerald-500/25 shadow-sm scale-[1.03]' : ''
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-gradient-to-b ${
          isDark ? 'from-white/25 to-transparent' : 'from-white/80 dark:from-white/15 to-transparent'
        }`}
      />
      <span className="relative z-10 inline-flex items-center justify-center">{children}</span>
    </span>
  );
}
