import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Recycle,
  RotateCcw,
  Scale,
  Trash2,
} from 'lucide-react';
import {
  AREAS,
  AreaName,
  HashLookupTrace,
  MAX_RECORDS,
  PriorityLevel,
  WASTE_TYPES,
  WasteRecord,
  WasteType,
  priorityText,
} from '../engine/urbanaEngine';
import { ConfirmDialog } from './ConfirmDialog';
import { HashLookupCard } from './HashLookupCard';
import { PriorityLabel, StatusLabel } from './PriorityLabel';
import { StatCard } from './StatCard';

interface WasteXViewProps {
  isAdmin?: boolean;
  records: WasteRecord[];
  onAddWaste: (data: Omit<WasteRecord, 'id' | 'collected'>) => void;
  onUpdateWaste: (id: number, amountKg: number, urgency: PriorityLevel, notes: string) => void;
  onToggleCollected: (id: number, collected: boolean) => void;
  onDeleteWaste: (id: number) => void;
  onTraceSearchById: (id: number) => HashLookupTrace<WasteRecord>;
}

export function WasteXView({
  isAdmin = false,
  records,
  onAddWaste,
  onUpdateWaste,
  onToggleCollected,
  onDeleteWaste,
  onTraceSearchById,
}: WasteXViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [area, setArea] = useState<AreaName>('Shaheb Bazar');
  const [wasteType, setWasteType] = useState<WasteType>('Household');
  const [amountKg, setAmountKg] = useState('250');
  const [urgency, setUrgency] = useState<PriorityLevel>(3);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'collected'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKg, setEditKg] = useState('100');
  const [editUrgency, setEditUrgency] = useState<PriorityLevel>(2);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<WasteRecord | null>(null);

  const { pendingCount, collectedCount, totalKg, highUrgentCount, filteredRecords } = useMemo(() => {
    let pending = 0;
    let collected = 0;
    let kgSum = 0;
    let high = 0;
    const filtered: WasteRecord[] = [];

    for (const r of records) {
      kgSum += r.amountKg;
      if (r.collected) collected++;
      else {
        pending++;
        if (r.urgency >= 3) high++;
      }
      if (statusFilter === 'pending' && r.collected) continue;
      if (statusFilter === 'collected' && !r.collected) continue;
      filtered.push(r);
    }

    return {
      pendingCount: pending,
      collectedCount: collected,
      totalKg: kgSum,
      highUrgentCount: high,
      filteredRecords: filtered,
    };
  }, [records, statusFilter]);

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseInt(amountKg, 10);
    if (Number.isNaN(kg) || kg < 1 || kg > 100000) {
      setFormError('Estimated amount must be between 1 and 100,000 kg.');
      return;
    }
    setFormError('');
    onAddWaste({
      area,
      wasteType,
      amountKg: kg,
      urgency,
      notes,
    });
    setNotes('');
    setAmountKg('250');
    setShowAddForm(false);
  }

  function startEdit(r: WasteRecord) {
    setEditingId(r.id);
    setEditKg(String(r.amountKg));
    setEditUrgency(r.urgency);
    setEditNotes(r.notes);
    setEditError('');
  }

  function saveEdit(id: number) {
    const kg = parseInt(editKg, 10);
    if (Number.isNaN(kg) || kg < 1 || kg > 100000) {
      setEditError('Amount must be 1–100,000 kg.');
      return;
    }
    setEditError('');
    onUpdateWaste(id, kg, editUrgency, editNotes);
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            WasteX · Waste collection
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            Waste Collection
          </h1>
        </div>

        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          disabled={records.length >= MAX_RECORDS}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0 w-fit"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{showAddForm ? 'Close Form' : 'New Pickup'}</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Waste Points"
          value={records.length}
          suffix={`/ ${MAX_RECORDS}`}
          icon={<Recycle className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          valueClassName="text-amber-700 dark:text-amber-400"
          icon={<Clock className="w-4 h-4" aria-hidden="true" />}
          iconTone="amber"
        />
        <StatCard
          label="Collected"
          value={collectedCount}
          valueClassName="text-emerald-700 dark:text-emerald-400"
          icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
        />
        <StatCard
          label="Recorded Waste"
          value={`${totalKg.toLocaleString()} kg`}
          icon={<Scale className="w-4 h-4" aria-hidden="true" />}
          iconTone="slate"
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label="High/Critical Pending"
            value={highUrgentCount}
            valueClassName="text-red-700 dark:text-red-400"
            icon={<AlertOctagon className="w-4 h-4" aria-hidden="true" />}
            iconTone="red"
          />
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="surface-card p-5 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Register Waste Collection Point</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="wx-area" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Area
              </label>
              <select
                id="wx-area"
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
              <label htmlFor="wx-type" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Waste Type
              </label>
              <select
                id="wx-type"
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value as WasteType)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
              >
                {WASTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="wx-kg" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Estimated Amount (kg)
              </label>
              <input
                id="wx-kg"
                type="number"
                min={1}
                max={100000}
                value={amountKg}
                onChange={(e) => {
                  setAmountKg(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="wx-urgency" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Urgency (1–4)
              </label>
              <select
                id="wx-urgency"
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value) as PriorityLevel)}
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
            <label htmlFor="wx-notes" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Notes (optional)
            </label>
            <input
              id="wx-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Location landmark or bin access notes..."
              className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
            />
            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1" role="alert">
                {formError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              New Pickup
            </button>
          </div>
        </form>
      )}

      {/* O(1) Hash Lookup by Waste ID */}
      <HashLookupCard
        title="Find a Pickup by ID"
        subtitle="IdIndex bucket (id % 211)"
        placeholder="Waste ID (e.g. 5001)"
        notFoundLabel={(id) => `Waste record ${id} not found.`}
        onTraceSearchById={onTraceSearchById}
        renderFound={(record) => (
          <>
            <span className="font-mono font-semibold">#{record.id}</span> ·{' '}
            {record.area} · {record.wasteType} ·{' '}
            <span className="font-mono">{record.amountKg} kg</span> ·{' '}
            {priorityText(record.urgency)} ·{' '}
            {record.collected ? 'Collected' : 'Pending'}
            {record.notes ? ` — ${record.notes}` : ''}
          </>
        )}
      />

      {/* Waste Records Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-xl">
            {(['all', 'pending', 'collected'] as const).map((tab) => (
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
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
            Showing {filteredRecords.length} of {records.length}
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              {records.length === 0
                ? 'No pickup requests yet.'
                : 'No pickups match this filter.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              New pickup requests will appear here and in the collection schedule.
            </p>
            <div className="pt-1 flex justify-center gap-2">
              {records.length > 0 && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  Show All
                </button>
              )}
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                New Pickup
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
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount (kg)</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-sm">
                {filteredRecords.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {r.area}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{r.wasteType}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                        {isEditing ? (
                          <div>
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              value={editKg}
                              onChange={(e) => {
                                setEditKg(e.target.value);
                                if (editError) setEditError('');
                              }}
                              aria-label="Edit weight in kg"
                              className="w-24 h-8 px-2 text-xs text-right bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded"
                            />
                            {editError && (
                              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 text-right" role="alert">
                                {editError}
                              </p>
                            )}
                          </div>
                        ) : (
                          r.amountKg.toLocaleString()
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editUrgency}
                            onChange={(e) => setEditUrgency(Number(e.target.value) as PriorityLevel)}
                            aria-label="Edit urgency"
                            className="h-8 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded"
                          >
                            <option value={1}>Low</option>
                            <option value={2}>Medium</option>
                            <option value={3}>High</option>
                            <option value={4}>Critical</option>
                          </select>
                        ) : (
                          <PriorityLabel level={r.urgency} />
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel done={r.collected} doneText="Collected" />
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 min-w-[200px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            aria-label="Edit notes"
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded"
                          />
                        ) : (
                          r.notes || <span className="text-slate-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(r.id)}
                                className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditError('');
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => onToggleCollected(r.id, !r.collected)}
                                title={r.collected ? 'Reopen collection' : 'Mark collected'}
                                aria-label={r.collected ? `Reopen waste point ${r.id}` : `Mark waste point ${r.id} collected`}
                                className="p-2 text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                              >
                                {r.collected ? (
                                  <RotateCcw className="w-4 h-4" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => startEdit(r)}
                                title="Update amount, urgency, or notes"
                                aria-label={`Edit waste point ${r.id}`}
                                className="p-2 text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(r)}
                                title="Delete waste point"
                                aria-label={`Delete waste point ${r.id}`}
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

      {/* Confirmation Dialog for Deleting Waste Record (Irreversible) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete Waste Point #${deleteTarget?.id ?? ''}?`}
        description={`This permanently deletes the ${deleteTarget?.amountKg ?? 0} kg ${deleteTarget?.wasteType ?? ''} waste record in ${deleteTarget?.area ?? ''}. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) onDeleteWaste(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
