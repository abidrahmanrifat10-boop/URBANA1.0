import { ReactNode } from 'react';

export type GlassTone = 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo';
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
  blue: 'from-blue-500/18 via-sky-400/10 to-white/85 border-blue-200/80 text-blue-700',
  indigo: 'from-indigo-500/18 via-blue-400/10 to-white/85 border-indigo-200/80 text-indigo-700',
  emerald: 'from-emerald-500/18 via-teal-400/10 to-white/85 border-emerald-200/80 text-emerald-700',
  amber: 'from-amber-500/18 via-orange-400/10 to-white/85 border-amber-200/80 text-amber-700',
  red: 'from-red-500/18 via-rose-400/10 to-white/85 border-red-200/80 text-red-700',
  slate: 'from-slate-500/12 via-slate-300/10 to-white/85 border-slate-200/90 text-slate-700',
};

const DARK_TONES: Record<GlassTone, string> = {
  blue: 'from-blue-500/25 via-indigo-500/10 to-white/[0.04] border-blue-400/30 text-blue-300',
  indigo: 'from-indigo-500/28 via-indigo-400/12 to-white/[0.04] border-indigo-400/30 text-indigo-300',
  emerald: 'from-emerald-500/25 via-teal-400/10 to-white/[0.04] border-emerald-400/30 text-emerald-300',
  amber: 'from-amber-500/25 via-orange-400/10 to-white/[0.04] border-amber-400/30 text-amber-300',
  red: 'from-rose-500/25 via-red-400/10 to-white/[0.04] border-rose-400/30 text-rose-300',
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
  tone = 'blue',
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
        active
          ? isDark
            ? 'ring-2 ring-indigo-400/35 shadow-sm scale-[1.03]'
            : 'ring-2 ring-blue-500/20 shadow-sm scale-[1.03]'
          : ''
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-gradient-to-b ${
          isDark ? 'from-white/25 to-transparent' : 'from-white/80 to-transparent'
        }`}
      />
      <span className="relative z-10 inline-flex items-center justify-center">{children}</span>
    </span>
  );
}
