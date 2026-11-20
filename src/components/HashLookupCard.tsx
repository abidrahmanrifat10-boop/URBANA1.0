import { ReactNode, useState } from 'react';
import { Hash } from 'lucide-react';
import { HashLookupTrace } from '../engine/urbanaEngine';
import { GlassIcon } from './GlassIcon';

interface HashLookupCardProps<T extends { id: number }> {
  title: string;
  subtitle?: string;
  placeholder: string;
  notFoundLabel: (id: number) => string;
  onTraceSearchById: (id: number) => HashLookupTrace<T>;
  renderFound: (record: T) => ReactNode;
}

export function HashLookupCard<T extends { id: number }>({
  title,
  subtitle = 'slot = id % 211',
  placeholder,
  notFoundLabel,
  onTraceSearchById,
  renderFound,
}: HashLookupCardProps<T>) {
  const [input, setInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [trace, setTrace] = useState<HashLookupTrace<T> | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    const id = parseInt(trimmed, 10);
    if (!trimmed || Number.isNaN(id) || id < 1 || !/^\d+$/.test(trimmed)) {
      setTrace(null);
      setValidationError('Enter a valid positive numeric ID.');
      return;
    }
    setValidationError('');
    setTrace(onTraceSearchById(id));
  }

  return (
    <div className="group surface-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <GlassIcon tone="slate" size="sm">
            <Hash className="w-3.5 h-3.5" aria-hidden="true" />
          </GlassIcon>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{title}</h2>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 shrink-0">{subtitle}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Hash className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
          <input
            type="number"
            min={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (validationError) setValidationError('');
            }}
            placeholder={placeholder}
            aria-label={title}
            className="w-full h-10 pl-9 pr-3 text-sm font-mono tabular-nums bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <button
          type="submit"
          className="px-4 h-10 text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          Lookup ID
        </button>
      </form>

      {validationError && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {validationError}
        </p>
      )}

      {trace && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-zinc-400">
            <span>
              Hash Bucket: <strong className="font-mono text-slate-900 dark:text-zinc-100">#{trace.slot}</strong> · Chain: [
              <span className="font-mono">{trace.chainIds.join(', ') || 'empty'}</span>]
            </span>
            <span className="font-mono text-slate-500 dark:text-zinc-400">{trace.steps} probe(s)</span>
          </div>
          {trace.found && trace.record ? (
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-800 dark:text-zinc-200">
              {renderFound(trace.record)}
            </div>
          ) : (
            <p className="text-red-600 dark:text-red-400 font-medium">{notFoundLabel(trace.id)}</p>
          )}
        </div>
      )}
    </div>
  );
}
