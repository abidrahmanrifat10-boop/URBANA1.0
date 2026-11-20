import { useEffect, useMemo, useState } from 'react';
import { Layers, Play, RotateCcw, Sliders, Trash2 } from 'lucide-react';
import {
  PriorityLevel,
  WasteMaxHeap,
  WasteRecord,
  buildScheduler,
  priorityText,
} from '../engine/urbanaEngine';
import { GlassIcon } from './GlassIcon';
import { PriorityLabel } from './PriorityLabel';
import { Tilt3DCard } from './Tilt3DCard';

interface SchedulerViewProps {
  wasteRecords: WasteRecord[];
  onProcessNextPickup: (id: number) => void;
}

export function SchedulerView({ wasteRecords, onProcessNextPickup }: SchedulerViewProps) {
  const [whatIfHeap, setWhatIfHeap] = useState<WasteMaxHeap | null>(null);
  const [simLog, setSimLog] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newUrgency, setNewUrgency] = useState<PriorityLevel>(4);

  const liveHeap = useMemo(() => buildScheduler(wasteRecords), [wasteRecords]);
  const activeHeap = whatIfHeap ?? liveHeap;
  const isSimulating = whatIfHeap !== null;

  const heapNodes = activeHeap.getHeapNodes();
  const orderedPickups = activeHeap.getOrderedList();

  useEffect(() => {
    if (orderedPickups.length > 0 && !orderedPickups.some((p) => String(p.id) === selectedId)) {
      setSelectedId(String(orderedPickups[0].id));
    }
  }, [orderedPickups, selectedId]);

  function ensureWhatIfCopy(): WasteMaxHeap {
    if (whatIfHeap) return whatIfHeap.clone();
    return liveHeap.clone();
  }

  function handleWhatIfUrgency(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(selectedId, 10);
    if (Number.isNaN(id)) return;
    const copy = ensureWhatIfCopy();
    if (copy.updateUrgency(id, newUrgency)) {
      setWhatIfHeap(copy);
      setSimLog(
        `Temporary What-If: Updated ID ${id} urgency to ${priorityText(newUrgency)}. Master WasteX list unchanged.`,
      );
    } else {
      setSimLog(`Point ${id} is not in the pending plan.`);
    }
  }

  function handleWhatIfRemove() {
    const id = parseInt(selectedId, 10);
    if (Number.isNaN(id)) return;
    const copy = ensureWhatIfCopy();
    if (copy.deleteById(id)) {
      setWhatIfHeap(copy);
      setSimLog(
        `Temporary What-If: Removed ID ${id} from simulation plan. Master WasteX list unchanged.`,
      );
    }
  }

  function resetSimulation() {
    setWhatIfHeap(null);
    setSimLog('');
  }

  function handleProcessRealPickup() {
    const top = liveHeap.getOrderedList()[0];
    if (!top) return;
    setWhatIfHeap(null);
    setSimLog('');
    onProcessNextPickup(top.id);
  }

  const visibleNodes = heapNodes.slice(0, 15);
  const svgW = 760;
  const svgH = 320;
  function getNodePos(oneBasedIdx: number) {
    const level = Math.floor(Math.log2(oneBasedIdx));
    const levelStart = Math.pow(2, level);
    const posInLevel = oneBasedIdx - levelStart;
    const nodesInLevel = levelStart;
    const spacing = svgW / (nodesInLevel + 1);
    const x = spacing * (posInLevel + 1);
    const y = 48 + level * 76;
    return { x, y };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            SCHEDULER · 1-Based Binary Max Heap (Priority: Urgency → Amount kg → Smaller ID)
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Waste Collection Scheduler
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSimulating && (
            <button
              onClick={resetSimulation}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset What-If Plan</span>
            </button>
          )}
          <button
            onClick={handleProcessRealPickup}
            disabled={liveHeap.size() === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-45 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Process Next Pickup</span>
          </button>
        </div>
      </div>

      {isSimulating && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
          <span>
            <strong>What-If Simulation Active:</strong> {simLog || 'Viewing temporary heap modifications.'}
          </span>
          <button
            onClick={resetSimulation}
            className="font-semibold underline hover:no-underline whitespace-nowrap shrink-0"
          >
            Exit Simulation
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="group lg:col-span-8 surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone="amber" size="sm">
                <Layers className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Max-Heap Binary Tree & 1-Based Array
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Heap size n = {heapNodes.length} · Root at index 1 is always next dispatch
                </p>
              </div>
            </div>
            {heapNodes.length > 15 && (
              <span className="text-xs text-slate-500 font-mono">
                Showing top 15 of {heapNodes.length} nodes
              </span>
            )}
          </div>

          {visibleNodes.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No pending waste pickups in scheduler. Add pending waste points in WASTEX to build the heap.
            </div>
          ) : (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-md p-2 overflow-x-auto">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full min-w-[540px] h-72">
                {visibleNodes.map((node, idx) => {
                  const i = idx + 1;
                  if (i === 1) return null;
                  const parentIdx = Math.floor(i / 2);
                  const pPos = getNodePos(parentIdx);
                  const cPos = getNodePos(i);
                  return (
                    <line
                      key={`edge-${node.id}-${i}`}
                      x1={pPos.x}
                      y1={pPos.y}
                      x2={cPos.x}
                      y2={cPos.y}
                      stroke="#CBD5E1"
                      strokeWidth={1.75}
                    />
                  );
                })}

                {visibleNodes.map((node, idx) => {
                  const i = idx + 1;
                  const { x, y } = getNodePos(i);
                  const isRoot = i === 1;
                  const strokeColor =
                    node.urgency === 4
                      ? '#DC2626'
                      : node.urgency === 3
                        ? '#D97706'
                        : isRoot
                          ? '#1D4ED8'
                          : '#64748B';
                  const fillColor = isRoot ? '#EFF6FF' : '#FFFFFF';
                  return (
                    <g key={`node-${node.id}-${i}`}>
                      <rect
                        x={x - 36}
                        y={y - 22}
                        width={72}
                        height={44}
                        rx={6}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isRoot ? 2.2 : 1.5}
                      />
                      <text
                        x={x}
                        y={y - 5}
                        textAnchor="middle"
                        className="fill-slate-900 font-mono text-[11px] font-bold"
                      >
                        [{i}] #{node.id}
                      </text>
                      <text
                        x={x}
                        y={y + 11}
                        textAnchor="middle"
                        className="fill-slate-600 font-mono text-[10px]"
                      >
                        U{node.urgency} · {node.amountKg}kg
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {heapNodes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-2">
                1-Based Heap Array (parent = i/2, left = 2i, right = 2i+1):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {heapNodes.map((node, idx) => (
                  <div
                    key={`arr-${node.id}-${idx}`}
                    className={`px-2.5 py-1 rounded border font-mono tabular-nums text-xs ${
                      idx === 0
                        ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    [{idx + 1}] #{node.id} ({node.urgency}/{node.amountKg}kg)
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* What-If Simulator Controls */}
        <Tilt3DCard as="section" className="group lg:col-span-4 p-5 space-y-4" maxTilt={2.2}>
          <div className="relative z-10 flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <GlassIcon tone="blue" size="sm">
              <Sliders className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <h2 className="text-sm font-semibold text-slate-900">What-If Plan Simulator</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Test temporary urgency changes or removals on a cloned Max Heap without altering your saved WasteX records.
          </p>

          <form onSubmit={handleWhatIfUrgency} className="space-y-3">
            <div>
              <label htmlFor="sim-id" className="block text-xs font-medium text-slate-700 mb-1">
                Target Pending Waste ID
              </label>
              <select
                id="sim-id"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={orderedPickups.length === 0}
                className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-300 rounded-md"
              >
                {orderedPickups.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.area} ({p.amountKg} kg, U{p.urgency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-urgency" className="block text-xs font-medium text-slate-700 mb-1">
                Simulated Urgency (1–4)
              </label>
              <select
                id="sim-urgency"
                value={newUrgency}
                onChange={(e) => setNewUrgency(Number(e.target.value) as PriorityLevel)}
                disabled={orderedPickups.length === 0}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value={1}>1 — Low</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — High</option>
                <option value={4}>4 — Critical</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={orderedPickups.length === 0}
                className="w-full py-2.5 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-45 rounded-md transition-colors"
              >
                Simulate Urgency Update
              </button>
              <button
                type="button"
                onClick={handleWhatIfRemove}
                disabled={orderedPickups.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-45 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Simulate Remove from Plan</span>
              </button>
            </div>
          </form>
        </Tilt3DCard>
      </div>

      {/* Extraction Order Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Collection Dispatch Order (Highest Priority First)
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {orderedPickups.length} pending task(s)
          </span>
        </div>

        {orderedPickups.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No pending waste tasks in queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Waste ID</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">Waste Type</th>
                  <th className="py-3 px-4 text-right">Amount (kg)</th>
                  <th className="py-3 px-4">Urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {orderedPickups.map((t, index) => (
                  <tr
                    key={t.id}
                    className={index === 0 ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}
                  >
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-semibold text-blue-700">
                      {t.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">{t.area}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{t.wasteType}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {t.amountKg.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <PriorityLabel level={t.urgency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
