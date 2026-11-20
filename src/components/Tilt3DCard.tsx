import { ReactNode, useEffect, useRef, useState } from 'react';

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  variant?: 'light' | 'emerald';
  disabled?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}

export function Tilt3DCard({
  children,
  className = '',
  maxTilt = 3.2,
  variant = 'light',
  disabled = false,
  as: Component = 'div',
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [canTilt, setCanTilt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || disabled) {
      setCanTilt(false);
      return;
    }
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluate = () => setCanTilt(finePointer.matches && !reducedMotion.matches);
    evaluate();
    finePointer.addEventListener('change', evaluate);
    reducedMotion.addEventListener('change', evaluate);
    return () => {
      finePointer.removeEventListener('change', evaluate);
      reducedMotion.removeEventListener('change', evaluate);
    };
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!canTilt || !cardRef.current) return;
    const el = cardRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, px));
    const clampedY = Math.max(0, Math.min(1, py));

    const rotateY = (clampedX - 0.5) * (maxTilt * 2);
    const rotateX = (0.5 - clampedY) * (maxTilt * 2);

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      el.style.setProperty('--tilt-rx', `${rotateX.toFixed(2)}deg`);
      el.style.setProperty('--tilt-ry', `${rotateY.toFixed(2)}deg`);
      el.style.setProperty('--tilt-mx', `${(clampedX * 100).toFixed(1)}%`);
      el.style.setProperty('--tilt-my', `${(clampedY * 100).toFixed(1)}%`);
      el.style.setProperty('--tilt-glow', '1');
    });
  }

  function handlePointerLeave() {
    if (!cardRef.current) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const el = cardRef.current;
    el.style.setProperty('--tilt-rx', '0deg');
    el.style.setProperty('--tilt-ry', '0deg');
    el.style.setProperty('--tilt-glow', '0');
  }

  const baseSurface = variant === 'emerald' ? 'surface-card-emerald' : 'surface-card';
  const sheenClass = variant === 'emerald' ? 'tilt-3d-sheen-dark' : 'tilt-3d-sheen';

  return (
    <Component
      ref={cardRef as React.Ref<HTMLDivElement>}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`tilt-3d-card ${baseSurface} relative ${className}`}
    >
      {canTilt && (
        <span
          aria-hidden="true"
          className={`${sheenClass} pointer-events-none absolute inset-0 z-0 rounded-[inherit]`}
        />
      )}
      {children}
    </Component>
  );
}
