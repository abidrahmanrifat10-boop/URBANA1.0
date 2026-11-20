import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Layers,
  MapPin,
  Plus,
  Recycle,
  Route,
  ShieldAlert,
} from 'lucide-react';
import {
  AREAS,
  AREA_COORDS,
  CITY_CATEGORIES,
  CityGraph,
  CityReport,
  MAX_AREAS,
  QUEUE_CAPACITY,
  WasteRecord,
  areaIndex,
  buildScheduler,
  priorityText,
} from '../engine/urbanaEngine';
import { GlassIcon } from './GlassIcon';
import { PriorityLabel } from './PriorityLabel';
import { StatCard } from './StatCard';
import { Tilt3DCard } from './Tilt3DCard';

export type ActiveTab =
  | 'overview'
  | 'citypulse'
  | 'wastex'
  | 'scheduler'
  | 'roads'
  | 'sheets'
  | 'about';

interface CombinedDashboardProps {
  reports: CityReport[];
  wasteRecords: WasteRecord[];
  graph: CityGraph;
  queueSize: number;
  undoSize: number;
  onNavigate: (tab: ActiveTab) => void;
}

export function CombinedDashboard({
  reports,
  wasteRecords,
  graph,
  queueSize,
  undoSize,
  onNavigate,
}: CombinedDashboardProps) {
  const [areaMetric, setAreaMetric] = useState<'reports' | 'waste'>('reports');
  const [hoveredAreaIdx, setHoveredAreaIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    let cityPending = 0;
    let cityDone = 0;
    let cityCritical = 0;
    const areaCounts = Array(MAX_AREAS).fill(0);
    const areaPendingCounts = Array(MAX_AREAS).fill(0);
    const categoryCounts = new Map<string, number>();
    for (const c of CITY_CATEGORIES) categoryCounts.set(c, 0);

    for (const r of reports) {
      if (r.resolved) cityDone++;
      else {
        cityPending++;
        if (r.priority === 4) cityCritical++;
      }
      const idx = areaIndex(r.area);
      if (idx >= 0) {
        areaCounts[idx]++;
        if (!r.resolved) areaPendingCounts[idx]++;
      }
      categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
    }

    let wastePending = 0;
    let wasteDone = 0;
    let totalKg = 0;
    let pendingKgSum = 0;
    let wasteUrgent = 0;
    const areaWasteKg = Array(MAX_AREAS).fill(0);
    for (const w of wasteRecords) {
      totalKg += w.amountKg;
      if (w.collected) wasteDone++;
      else {
        wastePending++;
        pendingKgSum += w.amountKg;
        if (w.urgency >= 3) wasteUrgent++;
        const idx = areaIndex(w.area);
        if (idx >= 0) areaWasteKg[idx] += w.amountKg;
      }
    }

    const maxAreaCount = Math.max(...areaCounts, 1);
    const maxAreaWasteKg = Math.max(...areaWasteKg, 1);
    const heap = buildScheduler(wasteRecords);
    const orderedPickups = heap.getOrderedList();
    const nextPickup = orderedPickups[0] ?? null;

    const urgentReports = reports
      .filter((r) => !r.resolved)
      .sort((a, b) => b.priority - a.priority || a.id - b.id)
      .slice(0, 3);

    const resolutionRate =
      reports.length > 0 ? Math.round((cityDone / reports.length) * 100) : 100;
    const collectionRate =
      wasteRecords.length > 0 ? Math.round((wasteDone / wasteRecords.length) * 100) : 100;
    const queueLoadPct = Math.round((queueSize / QUEUE_CAPACITY) * 100);

    return {
      cityPending,
      cityDone,
      cityCritical,
      wastePending,
      wasteDone,
      totalKg,
      pendingKgSum,
      wasteUrgent,
      areaCounts,
      areaPendingCounts,
      areaWasteKg,
      maxAreaCount,
      maxAreaWasteKg,
      nextPickup,
      topPickups: orderedPickups.slice(0, 3),
      urgentReports,
      categoryCounts: Array.from(categoryCounts.entries()),
      resolutionRate,
      collectionRate,
      queueLoadPct,
    };
  }, [reports, wasteRecords, queueSize]);

  const roadEdges = graph.listEdges();
  const mst = graph.minimumRoadPlan();
  const matrix = graph.getMatrix();

  const inspectedAreaIdx = hoveredAreaIdx ?? 0;
  const inspectedLinksCount = matrix[inspectedAreaIdx]?.filter((w) => w > 0).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Executive Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Rajshahi Smart City Operations · Team AetherCore
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Combined City Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('citypulse')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New City Report</span>
          </button>
          <button
            onClick={() => onNavigate('wastex')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Recycle className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span>Log Waste Point</span>
          </button>
          <button
            onClick={() => onNavigate('sheets')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span>Google Sheet</span>
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Info className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>About URBANA</span>
          </button>
        </div>
      </div>

      {/* Operational Health Summary Strip */}
      <Tilt3DCard className="group p-4 sm:px-5" maxTilt={2.2}>
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-100">
          <div className="flex items-center gap-3 pt-1 sm:pt-0">
            <GlassIcon tone="blue" size="md">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">Issue Resolution</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {stats.resolutionRate}%{' '}
                <span className="font-sans font-normal text-xs text-slate-500">
                  ({stats.cityDone}/{reports.length})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 lg:pl-4">
            <GlassIcon tone="emerald" size="md">
              <Recycle className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">Waste Clearance</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {stats.collectionRate}%{' '}
                <span className="font-sans font-normal text-xs text-slate-500">
                  ({stats.pendingKgSum.toLocaleString()} kg pending)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 lg:pl-4">
            <GlassIcon tone="amber" size="md">
              <Activity className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">FIFO Queue &amp; Undo</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {queueSize}/{QUEUE_CAPACITY}{' '}
                <span className="font-sans font-normal text-xs text-slate-500">
                  ({stats.queueLoadPct}% · {undoSize} undo)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 lg:pl-4">
            <GlassIcon tone="slate" size="md">
              <Route className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">Road Connectivity</div>
              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {mst.fullyConnected ? '8/8 Zones' : `${mst.used + 1}/8 Zones`}{' '}
                <span className="font-sans font-normal text-xs text-slate-500">
                  ({roadEdges.length} links)
                </span>
              </div>
            </div>
          </div>
        </div>
      </Tilt3DCard>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="CITYPULSE Reports"
          value={reports.length}
          suffix="total logged"
          icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-amber-700 font-medium">
                {stats.cityPending} pending
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-700 font-medium">
                {stats.cityDone} completed
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-red-700 font-semibold">
                {stats.cityCritical} critical
              </span>
            </div>
          }
        />

        <StatCard
          label="WASTEX Collection"
          value={stats.totalKg.toLocaleString()}
          suffix="kg recorded"
          icon={<Recycle className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-slate-900 font-medium">
                {wasteRecords.length} points
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-amber-700 font-medium">
                {stats.wastePending} pending
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-red-700 font-semibold">
                {stats.wasteUrgent} high+
              </span>
            </div>
          }
        />

        <StatCard
          label="Max-Heap Top Priority"
          value={stats.nextPickup ? `#${stats.nextPickup.id}` : '—'}
          suffix={stats.nextPickup ? stats.nextPickup.area : 'All collected'}
          icon={<Layers className="w-4 h-4" aria-hidden="true" />}
          iconTone="amber"
          footer={
            stats.nextPickup ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono tabular-nums truncate">
                  {stats.nextPickup.amountKg} kg · Urgency {stats.nextPickup.urgency}/4
                </span>
                <button
                  onClick={() => onNavigate('scheduler')}
                  className="text-blue-700 font-medium hover:underline whitespace-nowrap shrink-0"
                >
                  Open Scheduler
                </button>
              </div>
            ) : (
              <span className="text-slate-500">Heap is currently empty.</span>
            )
          }
        />

        <StatCard
          label="Road Network (Kruskal MST)"
          value={mst.totalKm}
          suffix="km optimal span"
          icon={<Route className="w-4 h-4" aria-hidden="true" />}
          iconTone="slate"
          footer={
            <div className="flex items-center justify-between gap-2">
              <span>
                {mst.fullyConnected ? 'All 8 areas connected' : `${mst.used}/7 MST links`}
              </span>
              <button
                onClick={() => onNavigate('roads')}
                className="text-blue-700 font-medium hover:underline whitespace-nowrap shrink-0"
              >
                Route Planner
              </button>
            </div>
          }
        />
      </div>

      {/* Main 2-column split: Interactive Area Breakdown + Rajshahi Topology Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <Tilt3DCard as="section" className="group lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between" maxTilt={2.2}>
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <GlassIcon tone="blue" size="md">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Zone Load Across Rajshahi
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    8 municipal zones · toggle metric to compare demand
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setAreaMetric('reports')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    areaMetric === 'reports'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Reports
                </button>
                <button
                  onClick={() => setAreaMetric('waste')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    areaMetric === 'waste'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending kg
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {AREAS.map((area, idx) => {
                const count = stats.areaCounts[idx];
                const pendingKg = stats.areaWasteKg[idx];
                const pct =
                  areaMetric === 'reports'
                    ? Math.round((count / stats.maxAreaCount) * 100)
                    : Math.round((pendingKg / stats.maxAreaWasteKg) * 100);
                const valZero = areaMetric === 'reports' ? count === 0 : pendingKg === 0;
                return (
                  <div
                    key={area}
                    onMouseEnter={() => setHoveredAreaIdx(idx)}
                    className="space-y-1 sm:space-y-0 sm:grid sm:grid-cols-12 sm:items-center sm:gap-3 text-sm rounded-md px-1 -mx-1 py-0.5 hover:bg-slate-50/90 transition-colors"
                  >
                    <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">[{idx}]</span>
                        <span className="font-medium text-slate-800 truncate">{area}</span>
                      </div>
                      <span className="sm:hidden font-mono tabular-nums text-xs text-slate-600">
                        <strong className="text-slate-900">{count}</strong> rpt · {pendingKg} kg
                      </span>
                    </div>
                    <div className="sm:col-span-5">
                      <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            areaMetric === 'reports' ? 'bg-blue-700' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${valZero ? 0 : Math.max(pct, 6)}%` }}
                        />
                      </div>
                    </div>
                    <div className="hidden sm:block sm:col-span-3 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{count}</span> rpt ·{' '}
                      <span>{pendingKg}</span> kg
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              Capacity: {reports.length}/500 CityPulse · {wasteRecords.length}/500 WasteX
            </span>
            <button
              onClick={() => onNavigate('citypulse')}
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>Manage Reports</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </Tilt3DCard>

        <Tilt3DCard as="section" className="group lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between" maxTilt={2.2}>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <GlassIcon tone="slate" size="md">
                  <Route className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Rajshahi Area Network
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    MST links highlighted · hover nodes to inspect
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('roads')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
              >
                <span>Open Graph</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-md p-2">
              <svg viewBox="0 0 760 420" className="w-full h-56" role="img" aria-label="Rajshahi city area road network">
                {roadEdges.map((e) => {
                  const p1 = AREA_COORDS[AREAS[e.a]];
                  const p2 = AREA_COORDS[AREAS[e.b]];
                  const isMst = mst.edges.some(
                    (m) => (m.a === e.a && m.b === e.b) || (m.a === e.b && m.b === e.a),
                  );
                  return (
                    <line
                      key={`${e.a}-${e.b}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isMst ? '#1D4ED8' : '#CBD5E1'}
                      strokeWidth={isMst ? 2.5 : 1.5}
                    />
                  );
                })}
                {AREAS.map((area, idx) => {
                  const pt = AREA_COORDS[area];
                  const hasCritical = reports.some(
                    (r) => !r.resolved && r.area === area && r.priority === 4,
                  );
                  const isInspected = inspectedAreaIdx === idx;
                  return (
                    <g
                      key={area}
                      onMouseEnter={() => setHoveredAreaIdx(idx)}
                      onClick={() => onNavigate('roads')}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isInspected ? 14.5 : 12}
                        fill={hasCritical ? '#FEF2F2' : isInspected ? '#EFF6FF' : '#FFFFFF'}
                        stroke={hasCritical ? '#DC2626' : '#1D4ED8'}
                        strokeWidth={isInspected ? 2.5 : 2}
                      />
                      <text
                        x={pt.x}
                        y={pt.y + 4}
                        textAnchor="middle"
                        className="fill-slate-900 font-mono text-[11px] font-semibold"
                      >
                        {idx}
                      </text>
                      <text
                        x={pt.x}
                        y={pt.y + 27}
                        textAnchor="middle"
                        className="fill-slate-700 text-[12px] font-medium"
                      >
                        {area}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Live Zone Inspection Bar */}
            <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-md flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">
                [{inspectedAreaIdx}] {AREAS[inspectedAreaIdx]}
              </span>
              <span className="font-mono tabular-nums text-slate-600">
                {stats.areaPendingCounts[inspectedAreaIdx]} open rpt · {stats.areaWasteKg[inspectedAreaIdx]} kg ·{' '}
                {inspectedLinksCount} roads
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => onNavigate('citypulse')}
              className="px-4 py-2.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap"
            >
              Open CityPulse
            </button>
            <button
              onClick={() => onNavigate('scheduler')}
              className="px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              Open Scheduler
            </button>
          </div>
        </Tilt3DCard>
      </div>

      {/* Executive Bottom Row: Priority Watchlist + Issue Category Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Tilt3DCard as="section" className="group lg:col-span-7 p-5 sm:p-6" maxTilt={2.2}>
          <div className="relative z-10 flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <GlassIcon tone="amber" size="md">
                <Layers className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Priority Dispatch Watchlist
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Top pending CityPulse issues &amp; next Max-Heap waste pickups
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('scheduler')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              <span>Full Queue</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Top Pending Issues</div>
              {stats.urgentReports.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">All CityPulse reports resolved.</p>
              ) : (
                stats.urgentReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        <span className="font-mono">#{r.id}</span> · {r.area}
                      </div>
                      <div className="text-slate-500 truncate mt-0.5">{r.description}</div>
                    </div>
                    <PriorityLabel level={r.priority} />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Next Heap Pickups</div>
              {stats.topPickups.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">All WasteX points collected.</p>
              ) : (
                stats.topPickups.map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        <span className="font-mono text-blue-700">#{idx + 1}</span> · ID{' '}
                        <span className="font-mono">{w.id}</span> ({w.area})
                      </div>
                      <div className="text-slate-500 truncate mt-0.5 font-mono tabular-nums">
                        {w.wasteType} · {w.amountKg} kg · {priorityText(w.urgency)}
                      </div>
                    </div>
                    <PriorityLabel level={w.urgency} />
                  </div>
                ))
              )}
            </div>
          </div>
        </Tilt3DCard>

        <Tilt3DCard as="section" className="group lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between" maxTilt={2.2}>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <GlassIcon tone="blue" size="md">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Issue Category Distribution
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Logged CityPulse incidents by municipal sector
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {stats.categoryCounts.map(([cat, cnt]) => {
                const pct = reports.length > 0 ? Math.round((cnt / reports.length) * 100) : 0;
                return (
                  <div key={cat} className="grid grid-cols-12 items-center gap-2 text-xs">
                    <span className="col-span-4 font-medium text-slate-700 truncate">{cat}</span>
                    <div className="col-span-6 h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-slate-800 transition-all duration-200"
                        style={{ width: `${cnt === 0 ? 0 : Math.max(pct, 6)}%` }}
                      />
                    </div>
                    <span className="col-span-2 text-right font-mono tabular-nums text-slate-700">
                      {cnt}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">Team AetherCore · CSE 2103 Lab</span>
            <button
              onClick={() => onNavigate('about')}
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              <span>System Details</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </Tilt3DCard>
      </div>
    </div>
  );
}
