import { useMemo, useState } from 'react';
import { GitBranch, Navigation, Plus, Route, Search, Trash2 } from 'lucide-react';
import {
  AREAS,
  AREA_COORDS,
  CityGraph,
  DijkstraResult,
  KruskalResult,
} from '../engine/urbanaEngine';
import { ConfirmDialog } from './ConfirmDialog';
import { GlassIcon } from './GlassIcon';
import { Tilt3DCard } from './Tilt3DCard';

interface RoadNetworkViewProps {
  graph: CityGraph;
  isDark?: boolean;
  isAdmin?: boolean;
  onAddRoad: (a: number, b: number, km: number) => void;
  onUpdateRoad: (a: number, b: number, km: number) => void;
  onDeleteRoad: (a: number, b: number) => void;
  onLoadDemoRoads: () => void;
}

export function RoadNetworkView({
  graph,
  isDark = false,
  isAdmin = false,
  onAddRoad,
  onUpdateRoad,
  onDeleteRoad,
  onLoadDemoRoads,
}: RoadNetworkViewProps) {
  const [mode, setMode] = useState<'dijkstra' | 'kruskal'>('dijkstra');

  // Dijkstra selection
  const [startArea, setStartArea] = useState(0); // Shaheb Bazar
  const [destArea, setDestArea] = useState(7); // Vodra
  const [clickPickStep, setClickPickStep] = useState<'start' | 'dest'>('start');

  // Road CRUD selection
  const [roadA, setRoadA] = useState(0);
  const [roadB, setRoadB] = useState(1);
  const [roadKm, setRoadKm] = useState('2');
  const [directSearchResult, setDirectSearchResult] = useState<string | null>(null);

  // Confirmations
  const [pendingDeleteEdge, setPendingDeleteEdge] = useState<{ a: number; b: number; km: number } | null>(null);
  const [confirmResetRoads, setConfirmResetRoads] = useState(false);

  const edges = graph.listEdges();
  const matrix = graph.getMatrix();
  const dijkstra: DijkstraResult = useMemo(
    () => graph.shortestPath(startArea, destArea),
    [graph, startArea, destArea, edges.length],
  );
  const kruskal: KruskalResult = useMemo(
    () => graph.minimumRoadPlan(),
    [graph, edges.length],
  );

  function isEdgeInDijkstra(a: number, b: number): boolean {
    if (!dijkstra.found) return false;
    for (let i = 0; i < dijkstra.path.length - 1; i++) {
      const u = dijkstra.path[i];
      const v = dijkstra.path[i + 1];
      if ((u === a && v === b) || (u === b && v === a)) return true;
    }
    return false;
  }

  function isEdgeInKruskal(a: number, b: number): boolean {
    return kruskal.edges.some(
      (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    );
  }

  function handleRoadAction(action: 'add' | 'update' | 'delete' | 'search') {
    const km = parseInt(roadKm, 10);
    if (roadA === roadB) {
      setDirectSearchResult('First and second areas must be different.');
      return;
    }
    if (action === 'search') {
      const w = graph.weight(roadA, roadB);
      setDirectSearchResult(
        w > 0
          ? `Direct road ${AREAS[roadA]} <--> ${AREAS[roadB]}: ${w} km`
          : `No direct road between ${AREAS[roadA]} and ${AREAS[roadB]}.`,
      );
      return;
    }
    if (action === 'delete') {
      const w = graph.weight(roadA, roadB);
      if (w <= 0) {
        setDirectSearchResult(`No direct road exists between ${AREAS[roadA]} and ${AREAS[roadB]}.`);
        return;
      }
      setPendingDeleteEdge({ a: roadA, b: roadB, km: w });
      return;
    }
    if (Number.isNaN(km) || km < 1 || km > 10000) {
      setDirectSearchResult('Distance must be between 1 and 10,000 km.');
      return;
    }
    if (action === 'add') {
      if (graph.hasRoad(roadA, roadB)) {
        setDirectSearchResult(`Road already exists (${graph.weight(roadA, roadB)} km). Use Update to change distance.`);
        return;
      }
      onAddRoad(roadA, roadB, km);
    } else {
      if (!graph.hasRoad(roadA, roadB)) {
        setDirectSearchResult(`No direct road between ${AREAS[roadA]} and ${AREAS[roadB]}. Use Add first.`);
        return;
      }
      onUpdateRoad(roadA, roadB, km);
    }
    setDirectSearchResult(null);
  }

  function handleNodeSelect(idx: number) {
    if (mode === 'dijkstra') {
      if (clickPickStep === 'start') {
        setStartArea(idx);
        setClickPickStep('dest');
      } else {
        setDestArea(idx);
        setClickPickStep('start');
      }
    } else {
      if (clickPickStep === 'start') {
        setRoadA(idx);
        setClickPickStep('dest');
      } else {
        if (idx !== roadA) setRoadB(idx);
        setClickPickStep('start');
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Road Network · Routes between city zones
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            Route Planner
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-xl">
            <button
              onClick={() => setMode('dijkstra')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                mode === 'dijkstra'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Shortest Route
            </button>
            <button
              onClick={() => setMode('kruskal')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                mode === 'kruskal'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Minimum Road Plan
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={() => setConfirmResetRoads(true)}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl whitespace-nowrap shrink-0"
            >
              Restore Default Roads
            </button>
          )}
        </div>
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Spatial Graph Canvas */}
        <section className="group lg:col-span-7 surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone="emerald" size="sm">
                <Route className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Rajshahi Road Map
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {mode === 'dijkstra'
                    ? `Click nodes to set ${clickPickStep === 'start' ? 'Start' : 'Destination'} · ${AREAS[startArea]} → ${AREAS[destArea]}`
                    : 'Click nodes to select Road endpoints · Highlighting Kruskal MST edges'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-zinc-400">
              {edges.length} road(s)
            </span>
          </div>

          <div className="mt-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2">
            <svg viewBox="0 0 760 420" className="w-full h-64 sm:h-80">
              {edges.map((e) => {
                const p1 = AREA_COORDS[AREAS[e.a]];
                const p2 = AREA_COORDS[AREAS[e.b]];
                const highlighted =
                  mode === 'dijkstra'
                    ? isEdgeInDijkstra(e.a, e.b)
                    : isEdgeInKruskal(e.a, e.b);
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;

                return (
                  <g key={`road-${e.a}-${e.b}`}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={
                        highlighted
                          ? '#10B981'
                          : isDark
                            ? '#27272A'
                            : '#CBD5E1'
                      }
                      strokeWidth={highlighted ? 3.5 : 1.75}
                    />
                    <rect
                      x={mx - 16}
                      y={my - 10}
                      width={32}
                      height={20}
                      rx={4}
                      fill={
                        highlighted
                          ? isDark
                            ? '#FFFFFF'
                            : '#0F172A'
                          : isDark
                            ? '#18181B'
                            : '#FFFFFF'
                      }
                      stroke={
                        highlighted
                          ? isDark
                            ? '#FFFFFF'
                            : '#0F172A'
                          : isDark
                            ? '#3F3F46'
                            : '#CBD5E1'
                      }
                    />
                    <text
                      x={mx}
                      y={my + 4}
                      textAnchor="middle"
                      className={`font-mono text-[10px] font-semibold ${
                        highlighted
                          ? 'fill-white dark:fill-zinc-950'
                          : 'fill-slate-700 dark:fill-zinc-300'
                      }`}
                    >
                      {e.km}km
                    </text>
                  </g>
                );
              })}

              {AREAS.map((area, idx) => {
                const pt = AREA_COORDS[area];
                const isStart = mode === 'dijkstra' && idx === startArea;
                const isDest = mode === 'dijkstra' && idx === destArea;
                const inPath = mode === 'dijkstra' && dijkstra.path.includes(idx);

                return (
                  <g
                    key={area}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select area ${area} (index ${idx})`}
                    onClick={() => handleNodeSelect(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNodeSelect(idx);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={16}
                      fill={
                        isStart
                          ? isDark
                            ? '#FFFFFF'
                            : '#18181B'
                          : isDest
                            ? '#059669'
                            : inPath
                              ? isDark
                                ? '#064E3B'
                                : '#ECFDF5'
                              : isDark
                                ? '#18181B'
                                : '#FFFFFF'
                      }
                      stroke={
                        isStart
                          ? isDark
                            ? '#FFFFFF'
                            : '#18181B'
                          : isDest || inPath
                            ? '#10B981'
                            : isDark
                              ? '#52525B'
                              : '#64748B'
                      }
                      strokeWidth={2.2}
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 4}
                      textAnchor="middle"
                      className={`font-mono text-[11px] font-bold ${
                        isStart
                          ? 'fill-white dark:fill-zinc-950'
                          : isDest
                            ? 'fill-white'
                            : 'fill-slate-900 dark:fill-zinc-100'
                      }`}
                    >
                      {idx}
                    </text>
                    <text
                      x={pt.x}
                      y={pt.y + 32}
                      textAnchor="middle"
                      className="fill-slate-800 dark:fill-zinc-200 text-[12px] font-semibold"
                    >
                      {area}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Right Controls */}
        <div className="lg:col-span-5 space-y-5">
          {mode === 'dijkstra' ? (
            <Tilt3DCard as="section" className="group p-5 space-y-4" maxTilt={2}>
              <div className="relative z-10 flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <GlassIcon tone="emerald" size="sm">
                  <Navigation className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Dijkstra Shortest Route</h2>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rn-start" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Start Area
                  </label>
                  <select
                    id="rn-start"
                    value={startArea}
                    onChange={(e) => setStartArea(Number(e.target.value))}
                    className="w-full h-9 px-2.5 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  >
                    {AREAS.map((a, idx) => (
                      <option key={a} value={idx}>
                        [{idx}] {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rn-dest" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Destination Area
                  </label>
                  <select
                    id="rn-dest"
                    value={destArea}
                    onChange={(e) => setDestArea(Number(e.target.value))}
                    className="w-full h-9 px-2.5 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  >
                    {AREAS.map((a, idx) => (
                      <option key={a} value={idx}>
                        [{idx}] {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {dijkstra.found ? (
                <div className="relative z-10 p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-zinc-400">Total Distance</span>
                    <span className="font-mono tabular-nums text-base font-bold text-emerald-700 dark:text-emerald-400">
                      {dijkstra.totalKm} km
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                    {dijkstra.path.map((idx, i) => (
                      <span key={idx}>
                        {AREAS[idx]}
                        {i < dijkstra.path.length - 1 ? ' → ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative z-10 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium">
                  No connected route between {AREAS[startArea]} and {AREAS[destArea]}.
                </div>
              )}
            </Tilt3DCard>
          ) : (
            <Tilt3DCard as="section" className="group p-5 space-y-4" maxTilt={2}>
              <div className="relative z-10 flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <GlassIcon tone="emerald" size="sm">
                  <GitBranch className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Minimum Road Plan (Kruskal + Union-Find)
                </h2>
              </div>

              <div className="relative z-10 p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  {kruskal.fullyConnected
                    ? 'All areas connected'
                    : `Network not fully connected (${kruskal.used} roads)`}
                </span>
                <span className="font-mono tabular-nums text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {kruskal.totalKm} km
                </span>
              </div>

              <div className="relative z-10 space-y-1.5 max-h-44 overflow-y-auto">
                {kruskal.edges.map((e) => (
                  <div
                    key={`mst-${e.a}-${e.b}`}
                    className="flex items-center justify-between text-xs px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg"
                  >
                    <span className="text-slate-800 dark:text-zinc-200">
                      {AREAS[e.a]} &lt;--&gt; {AREAS[e.b]}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
                      {e.km} km
                    </span>
                  </div>
                ))}
              </div>
            </Tilt3DCard>
          )}

          {/* Road Management CRUD (Sole Admin Only) */}
          {isAdmin ? (
            <section className="surface-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-100 dark:border-zinc-800">
                Manage Road Connections
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="rc-a" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                    First Area
                  </label>
                  <select
                    id="rc-a"
                    value={roadA}
                    onChange={(e) => {
                      setRoadA(Number(e.target.value));
                      setDirectSearchResult(null);
                    }}
                    className="w-full h-9 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  >
                    {AREAS.map((a, idx) => (
                      <option key={a} value={idx}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rc-b" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                    Second Area
                  </label>
                  <select
                    id="rc-b"
                    value={roadB}
                    onChange={(e) => {
                      setRoadB(Number(e.target.value));
                      setDirectSearchResult(null);
                    }}
                    className="w-full h-9 px-2 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  >
                    {AREAS.map((a, idx) => (
                      <option key={a} value={idx}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rc-km" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                    Distance (km)
                  </label>
                  <input
                    id="rc-km"
                    type="number"
                    min={1}
                    max={10000}
                    value={roadKm}
                    onChange={(e) => {
                      setRoadKm(e.target.value);
                      setDirectSearchResult(null);
                    }}
                    className="w-full h-9 px-2 text-xs font-mono tabular-nums bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleRoadAction('add')}
                  className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
                <button
                  onClick={() => handleRoadAction('update')}
                  className="py-2 px-2 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  Update
                </button>
                <button
                  onClick={() => handleRoadAction('search')}
                  className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Search</span>
                </button>
                <button
                  onClick={() => handleRoadAction('delete')}
                  className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>

              {directSearchResult && (
                <p className="text-xs text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2" role="status">
                  {directSearchResult}
                </p>
              )}
            </section>
          ) : (
            <section className="surface-card p-4 text-xs text-slate-600 dark:text-zinc-400">
              Choose a start and destination to see the shortest route.
            </section>
          )}
        </div>
      </div>

      {/* Bottom Row: All Roads Table + 8x8 Adjacency Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 surface-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">All Active Road Connections</h2>
          </div>
          {edges.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-zinc-400">No active road connections.</p>
              <button
                onClick={onLoadDemoRoads}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                Restore Default Roads
              </button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
              {edges.map((e) => (
                <div
                  key={`row-${e.a}-${e.b}`}
                  className="px-5 py-2.5 flex items-center justify-between text-xs"
                >
                  <span className="text-slate-800 dark:text-zinc-200 font-medium">
                    {AREAS[e.a]} &lt;--&gt; {AREAS[e.b]}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
                      {e.km} km
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => setPendingDeleteEdge(e)}
                        title="Delete road"
                        aria-label={`Delete road between ${AREAS[e.a]} and ${AREAS[e.b]}`}
                        className="p-1 text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 surface-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              8×8 Adjacency Matrix (0 = No Direct Road)
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 shrink-0">Symmetric road[i][j]</span>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-center border-collapse font-mono tabular-nums text-xs">
              <thead>
                <tr>
                  <th className="p-1.5 text-left text-slate-500 dark:text-zinc-400 font-medium sticky left-0 bg-white dark:bg-[#111316] z-10">
                    Area
                  </th>
                  {AREAS.map((a, i) => (
                    <th key={a} className="p-1.5 text-slate-600 dark:text-zinc-400 font-semibold" title={a}>
                      [{i}]
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={AREAS[i]} className="border-t border-slate-100 dark:border-zinc-800">
                    <td className="p-1.5 text-left font-sans text-slate-700 dark:text-zinc-300 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-[#111316] z-10">
                      [{i}] {AREAS[i]}
                    </td>
                    {row.map((val, j) => (
                      <td
                        key={j}
                        className={`p-1.5 ${
                          i === j
                            ? 'text-slate-300 dark:text-zinc-700 bg-slate-50 dark:bg-zinc-900'
                            : val > 0
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/50 dark:bg-emerald-950/30'
                              : 'text-slate-300 dark:text-zinc-700'
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Confirm Delete Road */}
      <ConfirmDialog
        open={pendingDeleteEdge !== null}
        title="Delete Road Connection?"
        description={
          pendingDeleteEdge
            ? `Remove the ${pendingDeleteEdge.km} km direct road between ${AREAS[pendingDeleteEdge.a]} and ${AREAS[pendingDeleteEdge.b]}? Shortest routes and Kruskal MST will recalculate immediately.`
            : ''
        }
        confirmLabel="Delete Road"
        tone="danger"
        onConfirm={() => {
          if (pendingDeleteEdge) {
            onDeleteRoad(pendingDeleteEdge.a, pendingDeleteEdge.b);
          }
        }}
        onCancel={() => setPendingDeleteEdge(null)}
      />

      {/* Confirm Restore Default Roads */}
      <ConfirmDialog
        open={confirmResetRoads}
        title="Restore default road network?"
        description="This restores the 12 default road links and removes any custom changes."
        confirmLabel="Reset Roads"
        tone="warning"
        onConfirm={onLoadDemoRoads}
        onCancel={() => setConfirmResetRoads(false)}
      />
    </div>
  );
}
