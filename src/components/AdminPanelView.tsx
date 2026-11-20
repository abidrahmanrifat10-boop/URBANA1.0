import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  ClipboardList,
  Layers,
  Lock,
  Play,
  Recycle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  CityReport,
  QueueSnapshot,
  WasteRecord,
  buildScheduler,
} from '../engine/urbanaEngine';
import {
  AuditEntry,
  AuthUser,
  SystemSettings,
  deleteCustomerAccount,
  fetchAdminOverview,
  updateAdminSettings,
  updateCustomerStatus,
} from '../services/authClient';
import { ConfirmDialog } from './ConfirmDialog';
import { GlassIcon } from './GlassIcon';
import { PriorityLabel, StatusLabel } from './PriorityLabel';
import { Tilt3DCard } from './Tilt3DCard';

type AdminSectionTab = 'governance' | 'operations' | 'customers' | 'audit';

interface AdminPanelViewProps {
  currentUser: AuthUser | null;
  adminName: string | null;
  reports: CityReport[];
  wasteRecords: WasteRecord[];
  queueSnapshot: QueueSnapshot;
  systemSettings: SystemSettings;
  onSettingsUpdated: (settings: SystemSettings) => void;
  onOpenSignIn: () => void;
  onProcessNextComplaint: () => void;
  onToggleCityResolved: (id: number, resolved: boolean) => void;
  onDeleteCityReport: (id: number) => void;
  onProcessNextPickup: (id: number) => void;
  onToggleWasteCollected: (id: number, collected: boolean) => void;
  onDeleteWasteRecord: (id: number) => void;
  onLoadDemoRoads: () => void;
  onRecordAudit: (action: string, target: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminPanelView({
  currentUser,
  adminName,
  reports,
  wasteRecords,
  queueSnapshot,
  systemSettings,
  onSettingsUpdated,
  onOpenSignIn,
  onProcessNextComplaint,
  onToggleCityResolved,
  onDeleteCityReport,
  onProcessNextPickup,
  onToggleWasteCollected,
  onDeleteWasteRecord,
  onLoadDemoRoads,
  onRecordAudit,
  onNotify,
}: AdminPanelViewProps) {
  const isAdmin = currentUser?.role === 'Admin';

  const [sectionTab, setSectionTab] = useState<AdminSectionTab>('governance');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [bannerDraft, setBannerDraft] = useState(systemSettings.maintenanceBanner);
  const [customerSearch, setCustomerSearch] = useState('');
  const [opsSearch, setOpsSearch] = useState('');
  const [opsFilter, setOpsFilter] = useState<'all' | 'issues' | 'waste'>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);

  useEffect(() => {
    setBannerDraft(systemSettings.maintenanceBanner);
  }, [systemSettings.maintenanceBanner]);

  async function loadOverview() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await fetchAdminOverview();
      setUsers(data.users);
      setAuditLog(data.auditLog);
      onSettingsUpdated(data.settings);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to load administration data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      void loadOverview();
    }
  }, [isAdmin]);

  const customers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'Customer')
        .filter((u) => {
          const q = customerSearch.trim().toLowerCase();
          if (!q) return true;
          return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        }),
    [users, customerSearch],
  );

  const reportCountByEmail = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      if (r.ownerEmail) {
        const key = r.ownerEmail.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    for (const w of wasteRecords) {
      if (w.ownerEmail) {
        const key = w.ownerEmail.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [reports, wasteRecords]);

  const topPickup = useMemo(() => buildScheduler(wasteRecords).getOrderedList()[0] ?? null, [wasteRecords]);

  const pendingReportsCount = reports.filter((r) => !r.resolved).length;
  const pendingWasteCount = wasteRecords.filter((w) => !w.collected).length;

  const filteredIssues = useMemo(() => {
    if (opsFilter === 'waste') return [];
    const q = opsSearch.trim().toLowerCase();
    return [...reports].reverse().filter((r) => {
      if (!q) return true;
      return (
        String(r.id).includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [reports, opsFilter, opsSearch]);

  const filteredWaste = useMemo(() => {
    if (opsFilter === 'issues') return [];
    const q = opsSearch.trim().toLowerCase();
    return [...wasteRecords].reverse().filter((w) => {
      if (!q) return true;
      return (
        String(w.id).includes(q) ||
        w.area.toLowerCase().includes(q) ||
        w.wasteType.toLowerCase().includes(q) ||
        (w.notes || '').toLowerCase().includes(q)
      );
    });
  }, [wasteRecords, opsFilter, opsSearch]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Tilt3DCard className="group p-6 sm:p-8 text-center space-y-5" maxTilt={2.2}>
          <div className="relative z-10 flex justify-center">
            <GlassIcon tone="emerald" size="lg">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </GlassIcon>
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Administration
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Restricted Access
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              This area is reserved for the city administrator. Sign in with the administrator
              account to manage reports, pickups, user accounts and system settings.
              {adminName ? ` Administrator: ${adminName}.` : ''}
            </p>
            {currentUser && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 inline-block mt-2">
                You are signed in as {currentUser.name}. Use Citizen Services to submit requests.
              </p>
            )}
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap"
            >
              {currentUser ? 'Switch to Administrator Account' : 'Administrator Sign In'}
            </button>
          </div>
        </Tilt3DCard>
      </div>
    );
  }

  async function handleToggleIntake() {
    setSavingSettings(true);
    try {
      const res = await updateAdminSettings({ intakeOpen: !systemSettings.intakeOpen });
      onSettingsUpdated(res.settings);
      setAuditLog(res.auditLog);
      onNotify(
        res.settings.intakeOpen
          ? 'Citizen submissions are now open.'
          : 'Citizen submissions are paused.',
        'info',
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update intake mode.', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleToggleEscalate() {
    setSavingSettings(true);
    try {
      const res = await updateAdminSettings({
        autoEscalateCritical: !systemSettings.autoEscalateCritical,
      });
      onSettingsUpdated(res.settings);
      setAuditLog(res.auditLog);
      onNotify('Auto-escalation setting updated.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update setting.', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveBanner(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await updateAdminSettings({ maintenanceBanner: bannerDraft });
      onSettingsUpdated(res.settings);
      setAuditLog(res.auditLog);
      onNotify('Public notice saved.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save notice.', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleToggleCustomerStatus(user: AuthUser) {
    setBusyUserId(user.id);
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await updateCustomerStatus(user.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.user : u)));
      setAuditLog(res.auditLog);
      onNotify(
        nextStatus === 'suspended'
          ? `Suspended ${user.name}'s customer access.`
          : `Reactivated ${user.name}'s customer account.`,
        'info',
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update customer status.', 'error');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteCustomer(user: AuthUser) {
    setBusyUserId(user.id);
    try {
      const res = await deleteCustomerAccount(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setAuditLog(res.auditLog);
      onNotify(`Removed customer account (${user.email}).`, 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove customer.', 'error');
    } finally {
      setBusyUserId(null);
    }
  }

  const tabs: Array<{ id: AdminSectionTab; label: string; count?: number }> = [
    { id: 'governance', label: 'Policy & Dispatch' },
    { id: 'operations', label: 'Issues & Waste', count: pendingReportsCount + pendingWasteCount },
    { id: 'customers', label: 'Customers', count: customers.length },
    { id: 'audit', label: 'Audit Trail', count: auditLog.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Signed in as {currentUser.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-1">
            Administration
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl transition-colors w-fit whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Single-Place Internal Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 rounded-2xl w-fit">
        {tabs.map((tab) => {
          const active = sectionTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                active
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                    active
                      ? 'bg-white/15 dark:bg-zinc-900/15 text-white dark:text-zinc-950'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sectionTab === 'governance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Sole Admin Seat Card */}
          <Tilt3DCard variant="emerald" className="group lg:col-span-5 p-6 text-white flex flex-col justify-between gap-5">
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <GlassIcon tone="emerald" variant="dark" size="md">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <span className="text-xs font-mono text-emerald-100">1 / 1 Admin Seat</span>
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{currentUser.name}</h2>
                <p className="text-xs text-emerald-100/80 mt-0.5">{currentUser.email}</p>
              </div>
              <p className="text-xs text-emerald-50/90 leading-relaxed">
                Manage report queues, waste collection, road links, intake settings and citizen accounts.
              </p>
            </div>

            <div className="relative z-10 pt-4 border-t border-white/15 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-emerald-100/75">Customers</div>
                <div className="text-base font-bold font-mono tabular-nums mt-0.5">{customers.length}</div>
              </div>
              <div>
                <div className="text-emerald-100/75">FIFO Queue</div>
                <div className="text-base font-bold font-mono tabular-nums mt-0.5">{queueSnapshot.count}</div>
              </div>
              <div>
                <div className="text-emerald-100/75">Open Waste</div>
                <div className="text-base font-bold font-mono tabular-nums mt-0.5">{pendingWasteCount}</div>
              </div>
            </div>
          </Tilt3DCard>

          {/* Citywide Governance Controls */}
          <Tilt3DCard className="group lg:col-span-7 p-6 flex flex-col justify-between gap-4">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <GlassIcon tone="emerald" size="sm">
                    <Activity className="w-4 h-4" aria-hidden="true" />
                  </GlassIcon>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Intake Settings
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Changes apply immediately to citizen submissions
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Customer Report Intake</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {systemSettings.intakeOpen ? 'Customers can submit reports' : 'Submissions paused'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleIntake()}
                    disabled={savingSettings}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      systemSettings.intakeOpen
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                        : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    {systemSettings.intakeOpen ? 'Open' : 'Paused'}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Critical Priority Rule</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {systemSettings.autoEscalateCritical ? 'Urgent issues flagged top' : 'Standard queue order'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleEscalate()}
                    disabled={savingSettings}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      systemSettings.autoEscalateCritical
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {systemSettings.autoEscalateCritical ? 'Enabled' : 'Standard'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveBanner} className="space-y-2">
                <label htmlFor="admin-banner-input" className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                  Public Notice
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="admin-banner-input"
                    type="text"
                    value={bannerDraft}
                    onChange={(e) => setBannerDraft(e.target.value)}
                    maxLength={180}
                    placeholder="Optional notice shown to citizens"
                    className="flex-1 h-10 px-3 text-sm bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 h-10 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Save Notice
                  </button>
                </div>
              </form>
            </div>

            <div className="relative z-10 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onProcessNextComplaint();
                  onRecordAudit('Processed FIFO complaint', `Queue remaining: ${Math.max(0, queueSnapshot.count - 1)}`);
                }}
                disabled={queueSnapshot.count === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Process FIFO Complaint ({queueSnapshot.count})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!topPickup) return;
                  onProcessNextPickup(topPickup.id);
                  onRecordAudit('Dispatched Max-Heap pickup', `ID #${topPickup.id} (${topPickup.area})`);
                }}
                disabled={!topPickup}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>{topPickup ? `Dispatch Heap #${topPickup.id}` : 'Heap Empty'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLoadDemoRoads();
                  onRecordAudit('Restored Rajshahi road network', '12 base links');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-[#111316] border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Road Graph</span>
              </button>
            </div>
          </Tilt3DCard>
        </div>
      )}

      {sectionTab === 'operations' && (
        <div className="space-y-5">
          {/* Operations Filter Bar */}
          <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-xl">
                {(['all', 'issues', 'waste'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOpsFilter(k)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                      opsFilter === k
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onProcessNextComplaint}
                disabled={queueSnapshot.count === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 rounded-xl transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Next FIFO ({queueSnapshot.count})</span>
              </button>
              <button
                type="button"
                onClick={() => topPickup && onProcessNextPickup(topPickup.id)}
                disabled={!topPickup}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-45 rounded-xl transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>{topPickup ? `Next Heap #${topPickup.id}` : 'Heap Empty'}</span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
              <input
                type="text"
                value={opsSearch}
                onChange={(e) => setOpsSearch(e.target.value)}
                placeholder="Search ID, area, notes..."
                aria-label="Search operations records"
                className="w-full h-9 pl-8 pr-3 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          {filteredIssues.length > 0 && (
            <div className="surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2.5">
                <GlassIcon tone="amber" size="sm">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  City Issue Reports ({filteredIssues.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 font-semibold text-slate-600 dark:text-zinc-400">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Area</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Admin Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredIssues.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/60">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-zinc-100">#{r.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">{r.area}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{r.category}</td>
                        <td className="py-3 px-4 whitespace-nowrap"><PriorityLabel level={r.priority} /></td>
                        <td className="py-3 px-4 whitespace-nowrap"><StatusLabel done={r.resolved} /></td>
                        <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 max-w-xs truncate">{r.description}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleCityResolved(r.id, !r.resolved)}
                              className="px-2.5 py-1.5 rounded-lg font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
                            >
                              {r.resolved ? 'Reopen' : 'Resolve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCityReport(r.id)}
                              aria-label={`Delete issue ${r.id}`}
                              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredWaste.length > 0 && (
            <div className="surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2.5">
                <GlassIcon tone="emerald" size="sm">
                  <Recycle className="w-4 h-4" aria-hidden="true" />
                </GlassIcon>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Waste Collection Queue ({filteredWaste.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 font-semibold text-slate-600 dark:text-zinc-400">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Area</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredWaste.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/60">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-zinc-100">#{w.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">{w.area}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 whitespace-nowrap">{w.wasteType}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                          {w.amountKg.toLocaleString()} kg
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap"><PriorityLabel level={w.urgency} /></td>
                        <td className="py-3 px-4 whitespace-nowrap"><StatusLabel done={w.collected} doneText="Collected" /></td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleWasteCollected(w.id, !w.collected)}
                              className="px-2.5 py-1.5 rounded-lg font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
                            >
                              {w.collected ? 'Reopen' : 'Mark Collected'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteWasteRecord(w.id)}
                              aria-label={`Delete waste point ${w.id}`}
                              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredIssues.length === 0 && filteredWaste.length === 0 && (
            <div className="surface-card p-10 text-center text-xs text-slate-500 dark:text-zinc-400">
              No issue reports or waste records match your search.
            </div>
          )}
        </div>
      )}

      {sectionTab === 'customers' && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <GlassIcon tone="emerald" size="sm">
                <Users className="w-4 h-4" aria-hidden="true" />
              </GlassIcon>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Customer Accounts ({customers.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Suspend or remove citizen accounts
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" aria-hidden="true" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                aria-label="Search customer accounts"
                className="w-full h-9 pl-8 pr-3 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                {users.filter((u) => u.role === 'Customer').length === 0
                  ? 'No customer accounts registered yet.'
                  : 'No customers match your search.'}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Citizens who create an account will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reports</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {customers.map((c) => {
                    const count = reportCountByEmail.get(c.email.toLowerCase()) ?? 0;
                    const busy = busyUserId === c.id;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-zinc-100">{c.name}</div>
                          <div className="text-slate-500 dark:text-zinc-400">{c.email}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {c.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Suspended</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                          {count}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleCustomerStatus(c)}
                              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                c.status === 'active'
                                  ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-950'
                                  : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                              }`}
                            >
                              {c.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeleteTarget(c)}
                              aria-label={`Remove ${c.name}`}
                              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sectionTab === 'audit' && (
        <div className="surface-card p-5 flex flex-col">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <GlassIcon tone="slate" size="sm">
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
            </GlassIcon>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Admin Audit Trail</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Server-persisted sole administrator control log</p>
            </div>
          </div>

          <div className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
            {auditLog.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 py-8 text-center">
                Administrator actions will be recorded here.
              </p>
            ) : (
              auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 text-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate">{entry.action}</div>
                    <div className="text-slate-600 dark:text-zinc-400 truncate">
                      {entry.target} · <span className="text-slate-400 dark:text-zinc-500">{entry.actor}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Remove Customer ${deleteTarget?.name ?? ''}?`}
        description={`This permanently removes ${deleteTarget?.email ?? ''} from URBANA. They will no longer be able to sign in unless they register again.`}
        confirmLabel="Remove Account"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) void handleDeleteCustomer(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
