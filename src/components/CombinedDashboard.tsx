import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Download,
  Filter,
  MapPin,
  Plus,
  Recycle,
  RotateCcw,
  Route,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  AREAS,
  AREA_COORDS,
  CityGraph,
  CityReport,
  MAX_AREAS,
  QUEUE_CAPACITY,
  WasteRecord,
  areaIndex,
  buildScheduler,
  priorityText,
} from '../engine/urbanaEngine';
import { AuthUser } from '../services/authClient';
import { GlassIcon } from './GlassIcon';
import { PriorityLabel, StatusLabel } from './PriorityLabel';
import { Tilt3DCard } from './Tilt3DCard';

export type ActiveTab =
  | 'overview'
  | 'customer'
  | 'citypulse'
  | 'wastex'
  | 'scheduler'
  | 'roads'
  | 'admin'
  | 'about';

interface CombinedDashboardProps {
  currentUser: AuthUser | null;
  reports: CityReport[];
  wasteRecords: WasteRecord[];
  graph: CityGraph;
  queueSize: number;
  undoSize: number;
  isDark?: boolean;
  onExportCsv: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

const SHORT_ZONES = ['Shb', 'Zro', 'Rlg', 'Lxm', 'Crt', 'Kzl', 'Tlm', 'Vdr'];
const ZONE_CODES = ['SB', 'ZP', 'RG', 'LX', 'CT', 'KZ', 'TM', 'VD'];

export function CombinedDashboard({
  currentUser,
  reports,
  wasteRecords,
  graph,
  queueSize,
  undoSize,
  isDark = false,
  onExportCsv,
  onNavigate,
}: CombinedDashboardProps) {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [zonePage, setZonePage] = useState<0 | 1>(0);
  const [barMetric, setBarMetric] = useState<'waste' | 'reports'>('waste');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityKind, setActivityKind] = useState<'all' | 'issue' | 'waste'>('all');

  const stats = useMemo(() => {
    const zoneFilteredReports =
      selectedZone === 'all' ? reports : reports.filter((r) => r.area === selectedZone);
    const zoneFilteredWaste =
      selectedZone === 'all' ? wasteRecords : wasteRecords.filter((w) => w.area === selectedZone);

    let cityPending = 0;
    let cityDone = 0;
    let cityCritical = 0;
    const areaCounts = Array(MAX_AREAS).fill(0);
    const areaPendingCounts = Array(MAX_AREAS).fill(0);
    const areaCriticalFlags = Array(MAX_AREAS).fill(false);

    for (const r of reports) {
      const idx = areaIndex(r.area);
      if (idx >= 0) {
        areaCounts[idx]++;
        if (!r.resolved) {
          areaPendingCounts[idx]++;
          if (r.priority === 4) areaCriticalFlags[idx] = true;
        }
      }
    }

    for (const r of zoneFilteredReports) {
      if (r.resolved) cityDone++;
      else {
        cityPending++;
        if (r.priority === 4) cityCritical++;
      }
    }

    let wastePending = 0;
    let wasteDone = 0;
    let totalKg = 0;
    let pendingKgSum = 0;
    let wasteUrgent = 0;
    const areaWasteKg = Array(MAX_AREAS).fill(0);
    const areaPendingWasteKg = Array(MAX_AREAS).fill(0);

    for (const w of wasteRecords) {
      const idx = areaIndex(w.area);
      if (idx >= 0) {
        areaWasteKg[idx] += w.amountKg;
        if (!w.collected) areaPendingWasteKg[idx] += w.amountKg;
      }
    }

    for (const w of zoneFilteredWaste) {
      totalKg += w.amountKg;
      if (w.collected) wasteDone++;
      else {
        wastePending++;
        pendingKgSum += w.amountKg;
        if (w.urgency >= 3) wasteUrgent++;
      }
    }

    const resolutionRate =
      zoneFilteredReports.length > 0
        ? Math.round((cityDone / zoneFilteredReports.length) * 100)
        : 100;

    const nextPickup = buildScheduler(zoneFilteredWaste).getOrderedList()[0] ?? null;

    // Combine recent activities for searchable bottom table
    const combinedActivities = [
      ...zoneFilteredReports.map((r) => ({
        key: `issue-${r.id}`,
        idLabel: `ISS_${r.id}`,
        numericId: r.id,
        kind: 'issue' as const,
        title: `${r.category} Report`,
        description: r.description,
        area: r.area,
        dateLabel: r.createdAt || 'Starter',
        metricLabel: priorityText(r.priority),
        done: r.resolved,
        doneText: 'Resolved',
        pendingText: 'Pending',
        tab: 'citypulse' as ActiveTab,
      })),
      ...zoneFilteredWaste.map((w) => ({
        key: `waste-${w.id}`,
        idLabel: `WST_${w.id}`,
        numericId: w.id,
        kind: 'waste' as const,
        title: `${w.wasteType} Pickup`,
        description: w.notes || `${w.amountKg} kg scheduled load`,
        area: w.area,
        dateLabel: w.createdAt || 'Starter',
        metricLabel: `${w.amountKg.toLocaleString()} kg`,
        done: w.collected,
        doneText: 'Collected',
        pendingText: 'Queued',
        tab: 'wastex' as ActiveTab,
      })),
    ].sort((a, b) => b.numericId - a.numericId);

    return {
      zoneFilteredReports,
      zoneFilteredWaste,
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
      areaCriticalFlags,
      areaWasteKg,
      areaPendingWasteKg,
      resolutionRate,
      nextPickup,
      combinedActivities,
    };
  }, [reports, wasteRecords, selectedZone]);

  const mst = graph.minimumRoadPlan();
  const roadEdges = graph.listEdges();

  const barValues = barMetric === 'waste' ? stats.areaWasteKg : stats.areaCounts;
  const barMax = Math.max(...barValues, 1);
  const peakBarIdx = barValues.indexOf(Math.max(...barValues));
  const selectedZoneIdx = selectedZone !== 'all' ? areaIndex(selectedZone) : -1;
  const focusedBarIdx =
    hoveredBarIdx !== null
      ? hoveredBarIdx
      : selectedZoneIdx >= 0
        ? selectedZoneIdx
        : peakBarIdx;

  const visibleZoneStart = zonePage * 4;
  const visibleZoneIndices = [
    visibleZoneStart,
    visibleZoneStart + 1,
    visibleZoneStart + 2,
    visibleZoneStart + 3,
  ];

  const filteredActivities = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return stats.combinedActivities
      .filter((item) => {
        if (activityKind !== 'all' && item.kind !== activityKind) return false;
        if (!q) return true;
        return (
          item.idLabel.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.area.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [stats.combinedActivities, activitySearch, activityKind]);

  return (
    <div className="space-y-6">
      {/* OripioFin Overview Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            {currentUser
              ? `${currentUser.role} summary across Rajshahi civic reports, WasteX pickups, and MST routes`
              : 'Here is the live summary of Rajshahi smart city data'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              aria-label="Filter dashboard by Rajshahi zone"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="h-9 pl-3 pr-8 text-xs font-medium bg-white dark:bg-[#111316] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs transition-colors"
            >
              <option value="all">All 8 Zones</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {selectedZone !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedZone('all')}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-white dark:bg-[#111316] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium bg-white dark:bg-[#111316] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl shadow-xs transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Row 1: 3 Summary Cards (OripioFin: Emerald Hero Card + 2 Clean Monochrome Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Card 1: Featured Emerald Summary Card */}
        <Tilt3DCard
          variant="emerald"
          className="group lg:col-span-4 p-5 sm:p-6 text-white flex flex-col justify-between"
          maxTilt={2.6}
        >
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <GlassIcon tone="emerald" variant="dark" size="md">
                <Activity className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <div className="text-sm font-semibold text-white">City Resolution</div>
                <div className="text-xs text-emerald-100/80">
                  {selectedZone === 'all' ? 'All 8 Rajshahi Zones' : selectedZone}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-100/80">
              Q {queueSize}/{QUEUE_CAPACITY}
            </span>
          </div>

          <div className="relative z-10 mt-5 flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-[34px] font-bold font-mono tabular-nums tracking-tight text-white">
              {stats.resolutionRate}%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[11px] font-mono tabular-nums text-emerald-50">
              +{stats.cityDone}/{stats.zoneFilteredReports.length}
              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('citypulse')}
            className="relative z-10 mt-5 pt-3.5 border-t border-white/15 flex items-center justify-between text-xs font-medium text-emerald-50 hover:text-white transition-colors"
          >
            <span>See details · {stats.cityCritical} critical</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </Tilt3DCard>

        {/* Card 2: Pending Waste Load */}
        <Tilt3DCard
          className="group lg:col-span-4 p-5 sm:p-6 flex flex-col justify-between"
          maxTilt={2.4}
        >
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <GlassIcon tone="emerald" size="md">
                <Recycle className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Pending Waste Load
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  WasteX Priority Dispatch Queue
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
              {stats.wastePending} open
            </span>
          </div>

          <div className="relative z-10 mt-5 flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-[34px] font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-zinc-100">
              {stats.pendingKgSum.toLocaleString()} <span className="text-lg font-semibold">kg</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {stats.wasteUrgent} urgent
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('wastex')}
            className="relative z-10 mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            <span>
              View summary · {stats.nextPickup ? `Next #${stats.nextPickup.id}` : 'Heap clear'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </Tilt3DCard>

        {/* Card 3: Road Network MST */}
        <Tilt3DCard
          className="group lg:col-span-4 p-5 sm:p-6 flex flex-col justify-between"
          maxTilt={2.4}
        >
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <GlassIcon tone="slate" size="md">
                <Route className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Road Network MST
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  Kruskal Spanning Plan · {roadEdges.length} Links
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
              {undoSize} undo
            </span>
          </div>

          <div className="relative z-10 mt-5 flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-[34px] font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-zinc-100">
              {mst.totalKm} <span className="text-lg font-semibold">km</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono tabular-nums text-slate-700 dark:text-zinc-300">
              {mst.fullyConnected ? '8/8 linked' : `${mst.used}/7 links`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('roads')}
            className="relative z-10 mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            <span>Analyze route performance</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </Tilt3DCard>
      </div>

      {/* Row 2: Left 2x2 Rajshahi Zones Wallet Grid + Right Zone Demand Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: 2x2 Rajshahi Zones Grid */}
        <Tilt3DCard
          as="section"
          className="group lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between"
          maxTilt={2}
        >
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Rajshahi Zones
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Zones {visibleZoneStart + 1}–{visibleZoneStart + 4} of 8 · Click zone to filter
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setZonePage((p) => (p === 0 ? 1 : 0))}
                className="h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {zonePage === 0 ? 'Zones 5–8' : 'Zones 1–4'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('customer')}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Report</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleZoneIndices.map((idx) => {
              const areaName = AREAS[idx];
              const isSelected = selectedZone === areaName;
              const openIssues = stats.areaPendingCounts[idx];
              const pendingKg = stats.areaPendingWasteKg[idx];
              const hasCritical = stats.areaCriticalFlags[idx];
              return (
                <button
                  key={areaName}
                  type="button"
                  onClick={() =>
                    setSelectedZone((cur) => (cur === areaName ? 'all' : areaName))
                  }
                  onMouseEnter={() => setHoveredBarIdx(idx)}
                  onMouseLeave={() => setHoveredBarIdx(null)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-50/70 dark:bg-zinc-900/70 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-mono font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
                        {ZONE_CODES[idx]}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                        {areaName}
                      </span>
                    </span>
                    <MapPin
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-zinc-500'
                      }`}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-2.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {pendingKg.toLocaleString()} kg
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                    {openIssues} open issue{openIssues === 1 ? '' : 's'} · {stats.areaCounts[idx]} total
                  </div>

                  <div className="mt-2">
                    <span
                      className={`text-[11px] font-semibold ${
                        hasCritical
                          ? 'text-red-600 dark:text-red-400'
                          : openIssues > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      {hasCritical ? 'Critical Alert' : openIssues > 0 ? 'Active' : 'Clear'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Tilt3DCard>

        {/* Right: Emerald-Gradient Rounded Bar Chart with Floating Callout */}
        <Tilt3DCard
          as="section"
          className="group lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between"
          maxTilt={2}
        >
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                Zone Demand Across Rajshahi
              </p>
              <div className="text-2xl sm:text-[28px] font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
                {barMetric === 'waste'
                  ? `${stats.totalKg.toLocaleString()} kg`
                  : `${stats.zoneFilteredReports.length} Reports`}
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-full border border-slate-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setBarMetric('waste')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                  barMetric === 'waste'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                }`}
              >
                Waste kg
              </button>
              <button
                type="button"
                onClick={() => setBarMetric('reports')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                  barMetric === 'reports'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                }`}
              >
                Issues
              </button>
            </div>
          </div>

          {/* Interactive SVG Chart + Floating Peak/Hover Callout */}
          <div className="relative z-10 mt-5">
            {/* Floating Callout Tooltip Pill */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-md text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {AREAS[focusedBarIdx]}
                  </div>
                  <div className="font-mono tabular-nums font-semibold mt-0.5">
                    {stats.areaWasteKg[focusedBarIdx].toLocaleString()} kg ·{' '}
                    {stats.areaCounts[focusedBarIdx]} issue
                    {stats.areaCounts[focusedBarIdx] === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="h-6 w-px bg-white/15 dark:bg-black/15" aria-hidden="true" />
                <div className="font-mono tabular-nums text-[11px] text-emerald-300 dark:text-emerald-700 font-semibold">
                  {stats.areaPendingCounts[focusedBarIdx]} open
                </div>
              </div>

              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Hover or click any zone bar
              </span>
            </div>

            <svg
              viewBox="0 0 560 190"
              className="w-full h-44 sm:h-48 overflow-visible"
              role="img"
              aria-label="Rajshahi zone demand bar chart"
            >
              <defs>
                <linearGradient id="oripioEmeraldBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="55%" stopColor="#0F7A50" />
                  <stop offset="100%" stopColor={isDark ? '#064E3B' : '#A7F3D0'} stopOpacity={isDark ? '0.9' : '0.35'} />
                </linearGradient>
              </defs>

              {/* Horizontal Subtle Grid Lines */}
              {[0, 1, 2, 3].map((row) => {
                const yPos = 24 + row * 40;
                return (
                  <line
                    key={row}
                    x1={12}
                    y1={yPos}
                    x2={548}
                    y2={yPos}
                    stroke={isDark ? '#27272A' : '#EEF2F6'}
                    strokeWidth="1"
                  />
                );
              })}

              {AREAS.map((area, idx) => {
                const val = barValues[idx];
                const barH = val === 0 ? 12 : Math.max(22, Math.round((val / barMax) * 124));
                const x = 18 + idx * 66;
                const y = 152 - barH;
                const isFocused = idx === focusedBarIdx;

                return (
                  <g
                    key={area}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                    onClick={() => setSelectedZone((cur) => (cur === area ? 'all' : area))}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={y}
                      width="46"
                      height={barH}
                      rx="10"
                      fill={
                        isFocused
                          ? 'url(#oripioEmeraldBar)'
                          : isDark
                            ? '#1F242B'
                            : '#E9EEF2'
                      }
                      className="transition-all duration-150"
                    />
                    {isFocused && (
                      <circle
                        cx={x + 23}
                        cy={y + 6}
                        r="4.5"
                        fill="#10B981"
                        stroke={isDark ? '#09090B' : '#FFFFFF'}
                        strokeWidth="2.5"
                      />
                    )}
                    <text
                      x={x + 23}
                      y={174}
                      textAnchor="middle"
                      className={`font-mono text-[11px] ${
                        isFocused
                          ? 'fill-slate-900 dark:fill-zinc-100 font-semibold'
                          : 'fill-slate-400 dark:fill-zinc-500'
                      }`}
                    >
                      {SHORT_ZONES[idx]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Tilt3DCard>
      </div>

      {/* Row 3: Searchable & Filterable Recent Activities Table (OripioFin style) + Compact Road Topology Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="surface-card lg:col-span-8 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                Recent Activities
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Latest municipal reports &amp; WasteX pickups
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Search ID or zone..."
                  aria-label="Search recent activities"
                  className="h-9 w-44 sm:w-52 pl-8 pr-3 text-xs bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-200 dark:border-zinc-800 rounded-xl"
                />
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl">
                <Filter className="w-3 h-3 text-slate-400 dark:text-zinc-500 ml-1.5 mr-0.5" aria-hidden="true" />
                {(['all', 'issue', 'waste'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActivityKind(k)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg capitalize transition-colors ${
                      activityKind === k
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                No activities match your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivitySearch('');
                  setActivityKind('all');
                  setSelectedZone('all');
                }}
                className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4">Record ID</th>
                    <th className="py-3 px-4">Zone</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
                  {filteredActivities.map((item) => (
                    <tr
                      key={item.key}
                      onClick={() => onNavigate(item.tab)}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <GlassIcon
                            tone={item.kind === 'issue' ? 'amber' : 'emerald'}
                            size="xs"
                          >
                            {item.kind === 'issue' ? (
                              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <Recycle className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </GlassIcon>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                        {item.idLabel}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                        {item.area}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {item.dateLabel}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.kind === 'issue' ? (
                          <PriorityLabel
                            level={
                              item.metricLabel === 'Critical'
                                ? 4
                                : item.metricLabel === 'High'
                                  ? 3
                                  : item.metricLabel === 'Medium'
                                    ? 2
                                    : 1
                            }
                          />
                        ) : (
                          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
                            {item.metricLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel done={item.done} doneText={item.doneText} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Companion Card: Live Rajshahi Topology Map */}
        <Tilt3DCard
          as="section"
          className="group lg:col-span-4 p-5 flex flex-col justify-between gap-4"
          maxTilt={2}
        >
          <div className="relative z-10 flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Rajshahi Road Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Click any zone node to inspect routes
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('roads')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Open Graph
            </button>
          </div>

          <div className="relative z-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-2">
            <svg viewBox="0 0 760 420" className="w-full h-48" role="img" aria-label="Rajshahi road topology">
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
                    stroke={isMst ? '#10B981' : isDark ? '#27272A' : '#CBD5E1'}
                    strokeWidth={isMst ? 3 : 1.5}
                  />
                );
              })}
              {AREAS.map((area, idx) => {
                const pt = AREA_COORDS[area];
                const hasCritical = stats.areaCriticalFlags[idx];
                const isSelected = selectedZone === area;
                return (
                  <g
                    key={area}
                    onClick={() => setSelectedZone((cur) => (cur === area ? 'all' : area))}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 16 : 12.5}
                      fill={
                        hasCritical
                          ? isDark
                            ? '#450A0A'
                            : '#FEF2F2'
                          : isSelected
                            ? '#10B981'
                            : isDark
                              ? '#18181B'
                              : '#FFFFFF'
                      }
                      stroke={hasCritical ? '#EF4444' : '#10B981'}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 4}
                      textAnchor="middle"
                      className={`font-mono text-[11px] font-semibold ${
                        isSelected ? 'fill-white' : 'fill-slate-900 dark:fill-zinc-100'
                      }`}
                    >
                      {idx}
                    </text>
                    <text
                      x={pt.x}
                      y={pt.y + 29}
                      textAnchor="middle"
                      className="fill-slate-700 dark:fill-zinc-300 text-[12px] font-medium"
                    >
                      {area}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('scheduler')}
              className="py-2 px-3 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap"
            >
              Max-Heap Queue
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="py-2 px-3 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl transition-colors whitespace-nowrap"
            >
              About URBANA
            </button>
          </div>
        </Tilt3DCard>
      </div>
    </div>
  );
}
