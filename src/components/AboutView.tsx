import {
  ArrowRight,
  Building2,
  Cpu,
  Layers,
  MapPin,
  Recycle,
  Route,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AREAS, MAX_AREAS, MAX_RECORDS, QUEUE_CAPACITY, UNDO_CAPACITY } from '../engine/urbanaEngine';
import { ActiveTab } from './CombinedDashboard';
import { GlassIcon, GlassTone } from './GlassIcon';
import { Tilt3DCard } from './Tilt3DCard';

interface AboutViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

const MODULES: Array<{
  tab: ActiveTab;
  title: string;
  ds: string;
  summary: string;
  tone: GlassTone;
  icon: typeof ShieldAlert;
}> = [
  {
    tab: 'citypulse',
    title: 'CITYPULSE',
    ds: 'Linked List · Hash Index · Queue · Undo Stack · Trie',
    summary:
      'Logs municipal complaints (Traffic, Road Damage, Waterlogging, Pollution, Street Light, Other), processes them in FIFO queue order, and supports instant undo.',
    tone: 'blue',
    icon: ShieldAlert,
  },
  {
    tab: 'wastex',
    title: 'WASTEX',
    ds: 'Singly Linked List · O(1) Hash Index (211 buckets)',
    summary:
      'Tracks waste collection points across Rajshahi by waste category, estimated weight in kg, urgency level, and completion state.',
    tone: 'emerald',
    icon: Recycle,
  },
  {
    tab: 'scheduler',
    title: 'Heap Scheduler',
    ds: '1-Based Binary Max-Heap + What-If Clone',
    summary:
      'Prioritizes pending pickups by urgency, then weight, then ID, with an interactive binary tree view and safe What-If simulation.',
    tone: 'amber',
    icon: Layers,
  },
  {
    tab: 'roads',
    title: 'Road Network',
    ds: '8×8 Adjacency Matrix · Dijkstra · Kruskal MST',
    summary:
      'Plans shortest municipal routes between Rajshahi areas and computes the minimum-distance spanning road plan using Union-Find.',
    tone: 'slate',
    icon: Route,
  },
];

const DATA_STRUCTURES = [
  {
    name: 'RecordList + IdIndex',
    role: 'Primary storage & ID lookup',
    detail: `Singly linked list (max ${MAX_RECORDS}) paired with 211-bucket separate-chaining hash table`,
    complexity: 'O(1) avg lookup',
  },
  {
    name: 'ComplaintQueue',
    role: 'FIFO citizen ticket intake',
    detail: `Fixed ${QUEUE_CAPACITY}-slot circular array tracking front, rear, and count modulo capacity`,
    complexity: 'O(1) enqueue / dequeue',
  },
  {
    name: 'UndoStack',
    role: 'CityPulse change recovery',
    detail: `LIFO snapshot stack (max ${UNDO_CAPACITY}) saving before-states for add, modify, and delete`,
    complexity: 'O(1) push / pop',
  },
  {
    name: 'AreaTrie',
    role: 'Zone prefix autocomplete',
    detail: 'Character trie over all 8 Rajshahi area names supporting normalized prefix traversal',
    complexity: 'O(L) prefix search',
  },
  {
    name: 'WasteMaxHeap',
    role: 'Dispatch priority engine',
    detail: '1-based binary max-heap comparing Urgency -> Amount (kg) -> Smaller ID',
    complexity: 'O(log n) push / extract',
  },
  {
    name: 'CityGraph',
    role: 'Municipal road topology',
    detail: `Symmetric ${MAX_AREAS}×${MAX_AREAS} weighted matrix with Dijkstra routing and Kruskal + Union-Find MST`,
    complexity: 'O(V²) / O(E log E)',
  },
];

export function AboutView({ onNavigate }: AboutViewProps) {
  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            System Architecture &amp; Overview · Rajshahi
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            About URBANA
          </h1>
        </div>
        <button
          onClick={() => onNavigate('overview')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl transition-colors w-fit whitespace-nowrap"
        >
          <span>Back to Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Concise Intro + Team & Scope */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Tilt3DCard as="section" className="group lg:col-span-7 p-6 flex flex-col justify-between gap-5">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
              <GlassIcon tone="emerald" size="lg">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                  URBANA — Smart City Management System
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Data-structure-driven civic operations control room for Rajshahi City
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              URBANA unifies civic issue resolution, solid-waste collection tracking, priority dispatch
              scheduling, and municipal road routing into one live workspace. Every action runs directly on
              classic C++ data structures ported to TypeScript with instant visual feedback and automatic
              local persistence.
            </p>
          </div>

          <div className="relative z-10 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-400 dark:text-zinc-500">City Scope</div>
              <div className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">{MAX_AREAS} Rajshahi Zones</div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-zinc-500">Modules</div>
              <div className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">4 Integrated Views</div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-zinc-500">Record Cap</div>
              <div className="font-semibold font-mono tabular-nums text-slate-900 dark:text-zinc-100 mt-0.5">{MAX_RECORDS} / list</div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-zinc-500">Persistence</div>
              <div className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">Auto LocalStorage</div>
            </div>
          </div>
        </Tilt3DCard>

        <Tilt3DCard as="section" className="group lg:col-span-5 p-6 space-y-4">
          <div className="relative z-10 flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <GlassIcon tone="slate" size="md">
              <Users className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Team AetherCore</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">CSE 2103 · Data Structures Lab</p>
            </div>
          </div>

          <div className="relative z-10 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-medium text-slate-700 dark:text-zinc-300">Covered Municipal Zones</span>
              <span className="font-mono tabular-nums">Index 0–7</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AREAS.map((area, idx) => (
                <div
                  key={area}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300"
                >
                  <MapPin className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">{idx}</span>
                  <span className="font-medium truncate">{area}</span>
                </div>
              ))}
            </div>
          </div>
        </Tilt3DCard>
      </div>

      {/* 4 Core Modules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Core Operational Modules</h2>
          <span className="text-xs text-slate-500 dark:text-zinc-400">Click any module to open</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Tilt3DCard key={mod.tab} className="group p-5 flex flex-col justify-between gap-4">
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <GlassIcon tone={mod.tone} size="md">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </GlassIcon>
                    <button
                      onClick={() => onNavigate(mod.tab)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{mod.title}</h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">{mod.ds}</p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{mod.summary}</p>
                </div>
              </Tilt3DCard>
            );
          })}
        </div>
      </section>

      {/* Data Structures & Algorithms Summary */}
      <Tilt3DCard as="section" className="group p-5 sm:p-6">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <GlassIcon tone="emerald" size="md">
              <Cpu className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Engine Data Structures &amp; Algorithms
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Concise reference of the algorithms powering URBANA
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">6 Core Structures</span>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {DATA_STRUCTURES.map((item) => (
            <div
              key={item.name}
              className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold font-mono text-slate-900 dark:text-zinc-100">{item.name}</span>
                <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {item.complexity}
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{item.role}</div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      </Tilt3DCard>
    </div>
  );
}
