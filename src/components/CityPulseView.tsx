import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  ListOrdered,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  AREAS,
  AreaName,
  AreaTrie,
  CITY_CATEGORIES,
  CityCategory,
  CityReport,
  HashLookupTrace,
  MAX_RECORDS,
  PriorityLevel,
  QUEUE_CAPACITY,
  QueueSnapshot,
  UNDO_CAPACITY,
  UndoAction,
  priorityText,
} from '../engine/urbanaEngine';
import { ConfirmDialog } from './ConfirmDialog';
import { GlassIcon } from './GlassIcon';
import { HashLookupCard } from './HashLookupCard';
import { PriorityLabel, StatusLabel } from './PriorityLabel';
import { StatCard } from './StatCard';
import { Tilt3DCard } from './Tilt3DCard';

interface CityPulseViewProps {
  isAdmin?: boolean;
  reports: CityReport[];
  queueSnapshot: QueueSnapshot;
  undoItems: UndoAction[];
  areaTrie: AreaTrie;
  onAddReport: (data: Omit<CityReport, 'id' | 'resolved'>) => void;
  onUpdateReport: (id: number, description: string, priority: PriorityLevel) => void;
  onToggleResolved: (id: number, resolved: boolean) => void;
  onDeleteReport: (id: number) => void;
  onProcessNextComplaint: () => void;
  onUndoLastAction: () => void;
  onTraceSearchById: (id: number) => HashLookupTrace<CityReport>;
}

export function CityPulseView({
  isAdmin = false,
  reports,
  queueSnapshot,
  undoItems,
  areaTrie,
  onAddReport,
  onUpdateReport,
  onToggleResolved,
  onDeleteReport,
  onProcessNextComplaint,
  onUndoLastAction,
  onTraceSearchById,
}: CityPulseViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [area, setArea] = useState<AreaName>('Shaheb Bazar');
  const [category, setCategory] = useState<CityCategory>('Traffic');
  const [priority, setPriority] = useState<PriorityLevel>(3);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<PriorityLevel>(2);
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<CityReport | null>(null);
  const [triePrefix, setTriePrefix] = useState('');

  const trieResult = useMemo(() => areaTrie.complete(triePrefix), [areaTrie, triePrefix]);

  const reportById = useMemo(() => {
    const map = new Map<number, CityReport>();
    for (const r of reports) map.set(r.id, r);
    return map;
  }, [reports]);

  const { pendingCount, completedCount, criticalPendingCount, filteredReports } = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let critical = 0;
    const filtered: CityReport[] = [];

    for (const r of reports) {
      if (r.resolved) completed++;
      else {
        pending++;
        if (r.priority === 4) critical++;
      }
      if (statusFilter === 'pending' && r.resolved) continue;
      if (statusFilter === 'completed' && !r.resolved) continue;
      if (areaFilter !== 'all' && r.area !== areaFilter) continue;
      filtered.push(r);
    }
    return {
      pendingCount: pending,
      completedCount: completed,
      criticalPendingCount: critical,
      filteredReports: filtered,
    };
  }, [reports, statusFilter, areaFilter]);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setFormError('Description cannot be empty.');
      return;
    }
    setFormError('');
    onAddReport({ area, category, description, priority });
    setDescription('');
    setShowAddForm(false);
  }

  function startEdit(report: CityReport) {
    setEditingId(report.id);
    setEditDesc(report.description);
    setEditPriority(report.priority);
    setEditError('');
  }

  function saveEdit(report: CityReport) {
    if (!editDesc.trim()) {
      setEditError('Description cannot be empty.');
      return;
    }
    setEditError('');
    if (editDesc.trim() !== report.description || editPriority !== report.priority) {
      onUpdateReport(report.id, editDesc, editPriority);
    }
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            CityPulse · Civic issue reports
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            City Issues
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                onClick={onProcessNextComplaint}
                disabled={queueSnapshot.count === 0}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Process Next Complaint</span>
              </button>

              <button
                onClick={onUndoLastAction}
                disabled={undoItems.length === 0}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" aria-hidden="true" />
                <span>Undo ({undoItems.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowAddForm((prev) => !prev)}
            disabled={reports.length >= MAX_RECORDS}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showAddForm ? 'Close Form' : 'New Report'}</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Reports"
          value={reports.length}
          suffix={`/ ${MAX_RECORDS}`}
          icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
          iconTone="slate"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          valueClassName="text-amber-700 dark:text-amber-400"
          icon={<Clock className="w-4 h-4" aria-hidden="true" />}
          iconTone="amber"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          valueClassName="text-emerald-700 dark:text-emerald-400"
          icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
        />
        <StatCard
          label="Critical Pending"
          value={criticalPendingCount}
          valueClassName="text-red-700 dark:text-red-400"
          icon={<AlertOctagon className="w-4 h-4" aria-hidden="true" />}
          iconTone="red"
        />
      </div>

      {/* Add Report Form */}
      {showAddForm && (
        <form onSubmit={handleCreateSubmit} className="surface-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Log New City Issue Report</h2>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Each report receives a reference number and joins the review queue
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cp-area" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Rajshahi Area
              </label>
              <select
                id="cp-area"
                value={area}
                onChange={(e) => setArea(e.target.value as AreaName)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cp-cat" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Issue Category
              </label>
              <select
                id="cp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as CityCategory)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
              >
                {CITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cp-priority" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Priority Level (1–4)
              </label>
              <select
                id="cp-priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as PriorityLevel)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
              >
                <option value={1}>1 — Low</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — High</option>
                <option value={4}>4 — Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cp-desc" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Problem Description{' '}
              <span className="text-slate-400 dark:text-zinc-500 font-normal">(pipe &apos;|&apos; sanitized to &apos;/&apos;)</span>
            </label>
            <input
              id="cp-desc"
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="Describe the civic issue clearly..."
              className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
            />
            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1" role="alert">
                {formError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
            >
              Save Report
            </button>
          </div>
        </form>
      )}

      {/* Search by ID (O(1) Hash Index) + Area Trie Prefix Search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HashLookupCard
          title="Find a Report by ID"
          placeholder="Enter Report ID (e.g. 1001)"
          notFoundLabel={(id) => `Report ID ${id} not found.`}
          onTraceSearchById={onTraceSearchById}
          renderFound={(record) => (
            <>
              <span className="font-mono font-semibold">#{record.id}</span> ·{' '}
              <span className="font-medium">{record.area}</span> ·{' '}
              <span>{record.category}</span> ·{' '}
              <span>{priorityText(record.priority)}</span> — {record.description}
            </>
          )}
        />

        <div className="group surface-card p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <GlassIcon tone="emerald" size="sm">
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
              </GlassIcon>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">Area Trie Prefix Search</h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 shrink-0">O(L) character trie</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
            <input
              type="text"
              value={triePrefix}
              onChange={(e) => setTriePrefix(e.target.value)}
              placeholder="Type area prefix (e.g. sha, rail, zero, tal)..."
              aria-label="Area Trie prefix search"
              className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 dark:text-zinc-400 mb-2">
              <span>
                Normalized path:{' '}
                <strong className="font-mono text-slate-900 dark:text-zinc-100">
                  {trieResult.normalizedPrefix || '(root)'}
                </strong>
              </span>
              <span className="font-mono">
                Nodes: {trieResult.traversedNodeIds.join(' -> ')}
              </span>
            </div>
            {trieResult.matches.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-zinc-300">
                <span className="text-slate-500 dark:text-zinc-400">Matches (click to filter):</span>
                {trieResult.matches.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setAreaFilter(m)}
                    className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {m}
                    {i < trieResult.matches.length - 1 ? ',' : ''}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-red-600 dark:text-red-400 font-medium">
                No Rajshahi area starts with &ldquo;{triePrefix}&rdquo;.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reports Data Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-xl w-fit">
            {(['all', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="area-filter-select" className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
              Filter Area:
            </label>
            <select
              id="area-filter-select"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="h-9 px-2.5 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
            >
              <option value="all">All 8 Areas</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {areaFilter !== 'all' && (
              <button
                onClick={() => setAreaFilter('all')}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              {reports.length === 0
                ? 'No reports yet.'
                : 'No reports match these filters.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {reports.length === 0
                ? 'New reports will appear here as soon as they are submitted.'
                : 'Try adjusting or clearing the filters.'}
            </p>
            <div className="pt-1 flex justify-center gap-2">
              {reports.length > 0 && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setAreaFilter('all');
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  Reset Filters
                </button>
              )}
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                New Report
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Description</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-sm">
                {filteredReports.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {r.area}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{r.category}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(Number(e.target.value) as PriorityLevel)}
                            aria-label="Edit priority"
                            className="h-8 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded"
                          >
                            <option value={1}>Low</option>
                            <option value={2}>Medium</option>
                            <option value={3}>High</option>
                            <option value={4}>Critical</option>
                          </select>
                        ) : (
                          <PriorityLabel level={r.priority} />
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel done={r.resolved} />
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 min-w-[220px]">
                        {isEditing ? (
                          <div>
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => {
                                setEditDesc(e.target.value);
                                if (editError) setEditError('');
                              }}
                              aria-label="Edit description"
                              className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded"
                            />
                            {editError && (
                              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1" role="alert">
                                {editError}
                              </p>
                            )}
                          </div>
                        ) : (
                          r.description
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(r)}
                                className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditError('');
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => onToggleResolved(r.id, !r.resolved)}
                                title={r.resolved ? 'Reopen report' : 'Mark completed'}
                                aria-label={r.resolved ? `Reopen report ${r.id}` : `Mark report ${r.id} completed`}
                                className="p-2 text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                              >
                                {r.resolved ? (
                                  <RotateCcw className="w-4 h-4" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => startEdit(r)}
                                title="Edit description or priority"
                                aria-label={`Edit report ${r.id}`}
                                className="p-2 text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(r)}
                                title="Delete report"
                                aria-label={`Delete report ${r.id}`}
                                className="p-2 text-slate-600 dark:text-zinc-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Embedded Live Visualizers: Circular Complaint Queue & Undo Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tilt3DCard as="section" className="group p-5" maxTilt={1.8}>
          <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <GlassIcon tone="emerald" size="sm">
                <ListOrdered className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  Review Queue
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                  front={queueSnapshot.front} · rear={queueSnapshot.rear} · count={queueSnapshot.count}/{QUEUE_CAPACITY}
                </p>
              </div>
            </div>
            <button
              onClick={onProcessNextComplaint}
              disabled={queueSnapshot.count === 0}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:text-slate-400 dark:disabled:text-zinc-600 disabled:no-underline whitespace-nowrap shrink-0"
            >
              Dequeue Next
            </button>
          </div>

          <div className="relative z-10 mt-4">
            <div className="text-xs text-slate-600 dark:text-zinc-400 mb-2">Active FIFO Order (Front to Rear):</div>
            {queueSnapshot.orderedIds.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-3">Queue is empty.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {queueSnapshot.orderedIds.map((id, i) => {
                  const rec = reportById.get(id);
                  const stateNote = !rec ? ' · Deleted' : rec.resolved ? ' · Done' : '';
                  return (
                    <div
                      key={`${id}-${i}`}
                      className={`px-2.5 py-1.5 border rounded font-mono tabular-nums text-xs ${
                        i === 0
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {i === 0 ? `FRONT → #${id}` : `#${id}`}
                      {stateNote && <span className="text-slate-500 dark:text-zinc-400 font-sans">{stateNote}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="text-xs text-slate-500 dark:text-zinc-400 mb-2">50-Slot Circular Array Indices:</div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {queueSnapshot.slots.map((val, idx) => {
                  const isFront = idx === queueSnapshot.front && queueSnapshot.count > 0;
                  const isRear = idx === queueSnapshot.rear;
                  return (
                    <div
                      key={idx}
                      title={`Slot ${idx}: ${val ?? 'empty'}${isFront ? ' (FRONT)' : ''}${isRear ? ' (REAR)' : ''}`}
                      className={`h-7 flex items-center justify-center rounded text-[11px] font-mono tabular-nums border ${
                        val !== null
                          ? isFront
                            ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                          : isRear
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-white dark:bg-zinc-950 text-slate-300 dark:text-zinc-700 border-slate-100 dark:border-zinc-900'
                      }`}
                    >
                      {val !== null ? val : idx}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Tilt3DCard>

        <Tilt3DCard as="section" className="group p-5" maxTilt={1.8}>
          <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <GlassIcon tone="slate" size="sm">
                <History className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  Recent Changes
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">
                  top={undoItems.length} / capacity {UNDO_CAPACITY}
                </p>
              </div>
            </div>
            <button
              onClick={onUndoLastAction}
              disabled={undoItems.length === 0}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:text-slate-400 dark:disabled:text-zinc-600 disabled:no-underline whitespace-nowrap shrink-0"
            >
              Pop & Undo
            </button>
          </div>

          <div className="relative z-10 mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
            {undoItems.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-6 text-center">
                No changes recorded yet.
              </p>
            ) : (
              [...undoItems].reverse().map((act, idx) => (
                <div
                  key={`${act.before.id}-${act.timestamp}-${idx}`}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded border text-xs ${
                    idx === 0
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-slate-900 dark:text-zinc-100'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                      {idx === 0 ? 'TOP · ' : ''}
                      {act.type}
                    </span>
                    <span className="mx-1.5 text-slate-400 dark:text-zinc-500">·</span>
                    <span className="font-mono tabular-nums">ID {act.before.id}</span>
                    <span className="mx-1.5 text-slate-400 dark:text-zinc-500">·</span>
                    <span>{act.before.area}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500 shrink-0">
                    {act.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </Tilt3DCard>
      </div>

      {/* Confirmation Dialog for Deleting Report */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete City Report #${deleteTarget?.id ?? ''}?`}
        description={`This removes the ${deleteTarget?.category ?? ''} report in ${deleteTarget?.area ?? ''} from CityPulse. You can restore it afterwards using Undo Last Action.`}
        confirmLabel="Delete Report"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) onDeleteReport(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
