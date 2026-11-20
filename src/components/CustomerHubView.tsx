import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Navigation,
  Plus,
  Recycle,
  ShieldAlert,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  AREAS,
  AreaName,
  CITY_CATEGORIES,
  CityCategory,
  CityGraph,
  CityReport,
  MAX_RECORDS,
  PriorityLevel,
  WASTE_TYPES,
  WasteRecord,
  WasteType,
  areaIndex,
} from '../engine/urbanaEngine';
import { AuthUser, SystemSettings } from '../services/authClient';
import { ConfirmDialog } from './ConfirmDialog';
import { GlassIcon } from './GlassIcon';
import { PriorityLabel, StatusLabel } from './PriorityLabel';
import { Tilt3DCard } from './Tilt3DCard';

interface CustomerHubViewProps {
  currentUser: AuthUser | null;
  systemSettings: SystemSettings;
  reports: CityReport[];
  wasteRecords: WasteRecord[];
  graph: CityGraph;
  onAddReport: (data: Omit<CityReport, 'id' | 'resolved'>) => void;
  onDeleteOwnReport: (id: number) => void;
  onAddWaste: (data: Omit<WasteRecord, 'id' | 'collected'>) => void;
  onDeleteOwnWaste: (id: number) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export function CustomerHubView({
  currentUser,
  systemSettings,
  reports,
  wasteRecords,
  graph,
  onAddReport,
  onDeleteOwnReport,
  onAddWaste,
  onDeleteOwnWaste,
  onOpenAuth,
}: CustomerHubViewProps) {
  const [formTab, setFormTab] = useState<'issue' | 'waste'>('issue');

  // Issue submission state
  const [issueArea, setIssueArea] = useState<AreaName>('Shaheb Bazar');
  const [category, setCategory] = useState<CityCategory>('Traffic');
  const [priority, setPriority] = useState<PriorityLevel>(3);
  const [description, setDescription] = useState('');
  const [issueError, setIssueError] = useState('');

  // Waste request state
  const [wasteArea, setWasteArea] = useState<AreaName>('Shaheb Bazar');
  const [wasteType, setWasteType] = useState<WasteType>('Household');
  const [amountKg, setAmountKg] = useState('150');
  const [urgency, setUrgency] = useState<PriorityLevel>(2);
  const [notes, setNotes] = useState('');
  const [wasteError, setWasteError] = useState('');

  // Route finder state
  const [fromArea, setFromArea] = useState<number>(0);
  const [toArea, setToArea] = useState<number>(5);

  const [cancelTarget, setCancelTarget] = useState<
    { kind: 'issue'; item: CityReport } | { kind: 'waste'; item: WasteRecord } | null
  >(null);

  const myReports = useMemo(() => {
    if (!currentUser) return reports.slice(-6).reverse();
    const owned = reports.filter(
      (r) =>
        r.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        r.submittedBy === currentUser.name,
    );
    return owned.length > 0 ? [...owned].reverse() : [];
  }, [reports, currentUser]);

  const myWaste = useMemo(() => {
    if (!currentUser) return wasteRecords.slice(-6).reverse();
    const owned = wasteRecords.filter(
      (w) =>
        w.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        w.submittedBy === currentUser.name,
    );
    return owned.length > 0 ? [...owned].reverse() : [];
  }, [wasteRecords, currentUser]);

  const routeResult = graph.shortestPath(fromArea, toArea);

  function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!systemSettings.intakeOpen) {
      setIssueError('Report submissions are temporarily paused.');
      return;
    }
    if (!description.trim()) {
      setIssueError('Please add a short description so our crew can find the location.');
      return;
    }
    setIssueError('');
    onAddReport({ area: issueArea, category, description, priority });
    setDescription('');
  }

  function handleWasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!systemSettings.intakeOpen) {
      setWasteError('Waste pickup requests are temporarily paused.');
      return;
    }
    const kg = parseInt(amountKg, 10);
    if (Number.isNaN(kg) || kg < 1 || kg > 100000) {
      setWasteError('Estimated weight must be between 1 and 100,000 kg.');
      return;
    }
    setWasteError('');
    onAddWaste({
      area: wasteArea,
      wasteType,
      amountKg: kg,
      urgency,
      notes,
    });
    setNotes('');
    setAmountKg('150');
  }

  const canModifyItem = (ownerEmail?: string, submittedBy?: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    return (
      ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
      submittedBy === currentUser.name
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Report an issue, request a pickup and track progress
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            Citizen Services
          </h1>
        </div>

        {!currentUser ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl transition-colors whitespace-nowrap"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
            <UserCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>
              Signed in as <strong className="text-slate-900 dark:text-zinc-100">{currentUser.name}</strong> ·{' '}
              {currentUser.role}
            </span>
          </div>
        )}
      </div>

      {/* Admin Notice / Intake Status */}
      {(systemSettings.maintenanceBanner || !systemSettings.intakeOpen) && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border flex items-start gap-3 text-xs ${
            systemSettings.intakeOpen
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            {!systemSettings.intakeOpen && (
              <div className="font-semibold">
                New submissions are temporarily paused for scheduled maintenance.
              </div>
            )}
            {systemSettings.maintenanceBanner && <div>{systemSettings.maintenanceBanner}</div>}
          </div>
        </div>
      )}

      {/* Main Split: Customer Request Builder + Rajshahi Route Finder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <Tilt3DCard className="group lg:col-span-7 p-6 flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <GlassIcon tone="emerald" size="md">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Submit a Request
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Sent directly to the responsible city team
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormTab('issue')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    formTab === 'issue'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  City Issue
                </button>
                <button
                  type="button"
                  onClick={() => setFormTab('waste')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    formTab === 'waste'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Waste Pickup
                </button>
              </div>
            </div>

            {formTab === 'issue' ? (
              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cust-area" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Rajshahi Area
                    </label>
                    <select
                      id="cust-area"
                      value={issueArea}
                      onChange={(e) => setIssueArea(e.target.value as AreaName)}
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
                    <label htmlFor="cust-cat" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Category
                    </label>
                    <select
                      id="cust-cat"
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
                    <label htmlFor="cust-prio" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Urgency
                    </label>
                    <select
                      id="cust-prio"
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
                  <label htmlFor="cust-desc" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Problem Details
                  </label>
                  <input
                    id="cust-desc"
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (issueError) setIssueError('');
                    }}
                    placeholder="Street, nearby landmark and what you noticed"
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  />
                  {issueError && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1" role="alert">
                      {issueError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    {reports.length}/{MAX_RECORDS} slots used
                  </span>
                  <button
                    type="submit"
                    disabled={!systemSettings.intakeOpen || reports.length >= MAX_RECORDS}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleWasteSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="cust-w-area" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Area
                    </label>
                    <select
                      id="cust-w-area"
                      value={wasteArea}
                      onChange={(e) => setWasteArea(e.target.value as AreaName)}
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
                    <label htmlFor="cust-w-type" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Waste Type
                    </label>
                    <select
                      id="cust-w-type"
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
                    <label htmlFor="cust-w-kg" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Amount (kg)
                    </label>
                    <input
                      id="cust-w-kg"
                      type="number"
                      min={1}
                      max={100000}
                      value={amountKg}
                      onChange={(e) => {
                        setAmountKg(e.target.value);
                        if (wasteError) setWasteError('');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="cust-w-urg" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Urgency
                    </label>
                    <select
                      id="cust-w-urg"
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
                  <label htmlFor="cust-w-notes" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Pickup Landmark (optional)
                  </label>
                  <input
                    id="cust-w-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate number, lane or nearby landmark"
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  />
                  {wasteError && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1" role="alert">
                      {wasteError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    {wasteRecords.length}/{MAX_RECORDS} slots used
                  </span>
                  <button
                    type="submit"
                    disabled={!systemSettings.intakeOpen || wasteRecords.length >= MAX_RECORDS}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Request Waste Pickup
                  </button>
                </div>
              </form>
            )}
          </div>
        </Tilt3DCard>

        {/* Citizen Shortest Route Finder */}
        <Tilt3DCard variant="light" className="group lg:col-span-5 p-6 flex flex-col justify-between gap-4">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <GlassIcon tone="emerald" size="md">
                <Navigation className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Route Finder
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Find the shortest road route between two zones
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cust-from" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Origin
                </label>
                <select
                  id="cust-from"
                  value={fromArea}
                  onChange={(e) => setFromArea(Number(e.target.value))}
                  className="w-full h-10 px-2.5 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                >
                  {AREAS.map((a, idx) => (
                    <option key={a} value={idx}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cust-to" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Destination
                </label>
                <select
                  id="cust-to"
                  value={toArea}
                  onChange={(e) => setToArea(Number(e.target.value))}
                  className="w-full h-10 px-2.5 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg"
                >
                  {AREAS.map((a, idx) => (
                    <option key={a} value={idx}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-2">
              {routeResult.found ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Shortest Distance</span>
                    <span className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {routeResult.totalKm} km
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                    {routeResult.path.map((idx) => AREAS[idx]).join(' -> ')}
                  </div>
                </>
              ) : (
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                  No connected route between {AREAS[fromArea]} and {AREAS[toArea]}.
                </p>
              )}
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span>Open issues in this zone:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
              {reports.filter((r) => !r.resolved && areaIndex(r.area) === toArea).length} pending
            </span>
          </div>
        </Tilt3DCard>
      </div>

      {/* Customer Requests Tracking Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone="amber" size="sm">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {currentUser ? 'My Reports' : 'Recent Reports'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {currentUser
                    ? `Tracked for ${currentUser.name}`
                    : 'Sign in to manage your own requests'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-zinc-400">{myReports.length}</span>
          </div>

          {myReports.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">No civic reports submitted yet.</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Reports you submit will appear here with their current status.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {myReports.map((r) => {
                const editable = !r.resolved && canModifyItem(r.ownerEmail, r.submittedBy);
                return (
                  <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-zinc-100">
                        <span className="font-mono">#{r.id}</span>
                        <span>{r.area}</span>
                        <span className="text-slate-400 dark:text-zinc-500">·</span>
                        <span className="text-slate-600 dark:text-zinc-400">{r.category}</span>
                      </div>
                      <p className="text-slate-600 dark:text-zinc-400 truncate">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <PriorityLabel level={r.priority} />
                      <StatusLabel done={r.resolved} />
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget({ kind: 'issue', item: r })}
                          aria-label={`Cancel report ${r.id}`}
                          className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone="emerald" size="sm">
                <Recycle className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {currentUser ? 'My Pickup Requests' : 'Recent Pickup Requests'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {currentUser
                    ? `Tracked for ${currentUser.name}`
                    : 'Scheduled by urgency and volume'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-zinc-400">{myWaste.length}</span>
          </div>

          {myWaste.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">No waste pickup requests yet.</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Pickup requests you submit will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {myWaste.map((w) => {
                const editable = !w.collected && canModifyItem(w.ownerEmail, w.submittedBy);
                return (
                  <div key={w.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-zinc-100">
                        <span className="font-mono">#{w.id}</span>
                        <span>{w.area}</span>
                        <span className="text-slate-400 dark:text-zinc-500">·</span>
                        <span className="font-mono tabular-nums">{w.amountKg} kg</span>
                        <span className="text-slate-500 dark:text-zinc-400">{w.wasteType}</span>
                      </div>
                      <p className="text-slate-500 dark:text-zinc-400 truncate">{w.notes || 'Standard collection bin'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1 font-medium">
                        {w.collected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            <span className="text-emerald-700 dark:text-emerald-400">Collected</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            <span className="text-amber-700 dark:text-amber-400">Scheduled</span>
                          </>
                        )}
                      </span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget({ kind: 'waste', item: w })}
                          aria-label={`Cancel waste request ${w.id}`}
                          className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={`Cancel Request #${cancelTarget?.item.id ?? ''}?`}
        description="Your pending request will be withdrawn. This cannot be undone."
        confirmLabel="Remove Request"
        tone="danger"
        onConfirm={() => {
          if (!cancelTarget) return;
          if (cancelTarget.kind === 'issue') onDeleteOwnReport(cancelTarget.item.id);
          else onDeleteOwnWaste(cancelTarget.item.id);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
