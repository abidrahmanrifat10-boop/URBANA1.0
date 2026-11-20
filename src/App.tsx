/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Recycle,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AreaTrie,
  CityGraph,
  CityReport,
  ComplaintQueue,
  PriorityLevel,
  RecordList,
  UndoStack,
  WasteRecord,
  getDemoCityReports,
  getDemoWasteRecords,
  parseCityReports,
  parseWasteRecords,
  priorityText,
  sanitizePipeText,
  serializeCityReports,
  serializeWasteRecords,
  statusText,
} from './engine/urbanaEngine';
import { ActiveTab, CombinedDashboard } from './components/CombinedDashboard';
import { CityPulseView } from './components/CityPulseView';
import { WasteXView } from './components/WasteXView';
import { SchedulerView } from './components/SchedulerView';
import { RoadNetworkView } from './components/RoadNetworkView';
import { CustomerHubView } from './components/CustomerHubView';
import { AdminPanelView } from './components/AdminPanelView';
import { AboutView } from './components/AboutView';
import { AuthModal } from './components/AuthModal';
import {
  AuthUser,
  SystemSettings,
  fetchSystemStatus,
  logoutAccount,
  recordAdminAudit,
} from './services/authClient';

const STORAGE_KEYS = {
  city: 'urbana_citypulse_reports_v1',
  waste: 'urbana_wastex_records_v1',
  roads: 'urbana_roads_v1',
  theme: 'urbana_theme_v1',
};

type ThemeMode = 'white' | 'black';

interface NavItemDef {
  id: ActiveTab;
  label: string;
  group: 'OVERVIEW' | 'OPERATIONS' | 'SYSTEM';
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'overview', label: 'Dashboard', group: 'OVERVIEW', icon: LayoutDashboard },
  { id: 'customer', label: 'Citizen Services', group: 'OVERVIEW', icon: Users },
  { id: 'citypulse', label: 'CityPulse', group: 'OVERVIEW', icon: ShieldAlert },
  { id: 'wastex', label: 'WasteX', group: 'OVERVIEW', icon: Recycle },
  { id: 'scheduler', label: 'Scheduler', group: 'OPERATIONS', icon: Layers },
  { id: 'roads', label: 'Road Network', group: 'OPERATIONS', icon: Route },
  { id: 'admin', label: 'Administration', group: 'SYSTEM', icon: ShieldCheck, adminOnly: true },
  { id: 'about', label: 'About', group: 'SYSTEM', icon: Info },
];

const NAV_GROUPS: Array<NavItemDef['group']> = ['OVERVIEW', 'OPERATIONS', 'SYSTEM'];

const DEFAULT_SETTINGS: SystemSettings = {
  intakeOpen: true,
  maintenanceBanner: '',
  autoEscalateCritical: true,
  updatedAt: '',
  updatedBy: 'System',
};

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const cityListRef = useRef(new RecordList<CityReport>());
  const wasteListRef = useRef(new RecordList<WasteRecord>());
  const graphRef = useRef(new CityGraph());
  const queueRef = useRef(new ComplaintQueue());
  const undoRef = useRef(new UndoStack());
  const trieRef = useRef(new AreaTrie());

  const nextCityIdRef = useRef(1001);
  const nextWasteIdRef = useRef(5001);

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [, setTick] = useState(0);

  // Dual Theme State: 'white' (Light) | 'black' (Dark OLED)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme);
      return stored === 'black' ? 'black' : 'white';
    } catch {
      return 'white';
    }
  });
  const isDark = theme === 'black';

  // Single-Admin + Customer auth state (Bearer token held strictly in memory in authClient.ts)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [adminClaimed, setAdminClaimed] = useState(true);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = currentUser?.role === 'Admin';

  const forceSync = () => setTick((t) => t + 1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'black');
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEYS.city, serializeCityReports(cityListRef.current.toArray()));
      localStorage.setItem(STORAGE_KEYS.waste, serializeWasteRecords(wasteListRef.current.toArray()));
      localStorage.setItem(STORAGE_KEYS.roads, graphRef.current.serialize());
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }

  function commitAndSync() {
    persistState();
    forceSync();
  }

  function showToast(message: string, type: ToastNotification['type'] = 'success') {
    setToast({ id: Date.now(), type, message });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch non-sensitive system access info (whether 1/1 Admin seat is claimed + intake settings)
  async function refreshSystemStatus() {
    try {
      const status = await fetchSystemStatus();
      setAdminClaimed(status.adminClaimed);
      setAdminName(status.adminName);
      setSystemSettings(status.settings);
    } catch {
      // Non-fatal if server offline during static preview
    }
  }

  useEffect(() => {
    void refreshSystemStatus();
  }, []);

  // Initial load mirroring C++ main()
  useEffect(() => {
    try {
      const savedCity = localStorage.getItem(STORAGE_KEYS.city);
      const savedWaste = localStorage.getItem(STORAGE_KEYS.waste);
      const savedRoads = localStorage.getItem(STORAGE_KEYS.roads);

      if (savedCity !== null) {
        const parsed = parseCityReports(savedCity);
        cityListRef.current.clear();
        for (const r of parsed.reports) cityListRef.current.insert(r);
        nextCityIdRef.current = parsed.nextId;
      } else {
        for (const r of getDemoCityReports()) {
          cityListRef.current.insert(r);
          if (r.id >= nextCityIdRef.current) nextCityIdRef.current = r.id + 1;
        }
      }

      if (savedWaste !== null) {
        const parsed = parseWasteRecords(savedWaste);
        wasteListRef.current.clear();
        for (const w of parsed.records) wasteListRef.current.insert(w);
        nextWasteIdRef.current = parsed.nextId;
      } else {
        for (const w of getDemoWasteRecords()) {
          wasteListRef.current.insert(w);
          if (w.id >= nextWasteIdRef.current) nextWasteIdRef.current = w.id + 1;
        }
      }

      if (savedRoads !== null) {
        graphRef.current.loadFromText(savedRoads);
      } else {
        graphRef.current.loadDemo();
      }
    } catch {
      cityListRef.current.clear();
      wasteListRef.current.clear();
      for (const r of getDemoCityReports()) {
        cityListRef.current.insert(r);
        if (r.id >= nextCityIdRef.current) nextCityIdRef.current = r.id + 1;
      }
      for (const w of getDemoWasteRecords()) {
        wasteListRef.current.insert(w);
        if (w.id >= nextWasteIdRef.current) nextWasteIdRef.current = w.id + 1;
      }
      graphRef.current.loadDemo();
    }

    queueRef.current.clear();
    for (const r of cityListRef.current.toArray()) {
      if (!r.resolved) queueRef.current.enqueue(r.id);
    }

    setIsHydrated(true);
    forceSync();
  }, []);

  function nowTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function todayStamp(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  function logAdminOp(action: string, target: string) {
    if (!isAdmin) return;
    void recordAdminAudit(action, target).catch(() => {
      // Non-fatal
    });
  }

  function requireAdminGuard(actionLabel: string): boolean {
    if (isAdmin) return true;
    showToast(
      `Administrator access is required to ${actionLabel}.`,
      'error',
    );
    setAuthModalMode('login');
    setAuthModalOpen(true);
    return false;
  }

  // ---------------- ACCOUNT HANDLERS ----------------

  function handleAuthSuccess(user: AuthUser, mode: 'login' | 'register') {
    setCurrentUser(user);
    setAuthModalOpen(false);
    void refreshSystemStatus();
    if (user.role === 'Admin') {
      showToast(`Welcome back, ${user.name}.`, 'success');
      setActiveTab('admin');
    } else {
      showToast(
        mode === 'register'
          ? `Your account is ready. Welcome, ${user.name}.`
          : `Signed in as ${user.name}.`,
        'success',
      );
      if (activeTab === 'admin') setActiveTab('customer');
    }
  }

  async function handleSignOutAccount() {
    await logoutAccount();
    setCurrentUser(null);
    if (activeTab === 'admin') setActiveTab('overview');
    showToast('You have been signed out.', 'info');
  }

  function handleExportReportCsv() {
    if (!requireAdminGuard('export reports')) return;
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push('URBANA RAJSHAHI SMART CITY REPORT');
    lines.push(['Report ID', 'Date', 'Area', 'Category', 'Priority', 'Status', 'Description', 'Submitted By'].map(esc).join(','));
    for (const r of cityListRef.current.toArray()) {
      lines.push(
        [
          r.id,
          r.createdAt || 'Starter',
          r.area,
          r.category,
          priorityText(r.priority),
          statusText(r.resolved),
          r.description,
          r.submittedBy || 'URBANA Control',
        ]
          .map(esc)
          .join(','),
      );
    }
    lines.push('');
    lines.push('WASTEX COLLECTION LOG');
    lines.push(['Waste ID', 'Date', 'Area', 'Type', 'Amount (kg)', 'Urgency', 'Status', 'Notes', 'Submitted By'].map(esc).join(','));
    for (const w of wasteListRef.current.toArray()) {
      lines.push(
        [
          w.id,
          w.createdAt || 'Starter',
          w.area,
          w.wasteType,
          w.amountKg,
          priorityText(w.urgency),
          w.collected ? 'Collected' : 'Pending',
          w.notes || '',
          w.submittedBy || 'URBANA Control',
        ]
          .map(esc)
          .join(','),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `URBANA_Rajshahi_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report exported.', 'success');
  }

  // ---------------- CITYPULSE HANDLERS ----------------

  function handleAddCityReport(data: Omit<CityReport, 'id' | 'resolved'>) {
    if (!systemSettings.intakeOpen && !isAdmin) {
      showToast('New submissions are paused at the moment. Please try again later.', 'error');
      return;
    }
    const list = cityListRef.current;
    if (list.full()) {
      showToast('Report limit reached (500 records).', 'error');
      return;
    }
    const report: CityReport = {
      id: nextCityIdRef.current,
      area: data.area,
      category: data.category,
      description: sanitizePipeText(data.description),
      priority: data.priority,
      resolved: false,
      submittedBy: currentUser?.name || 'Customer',
      ownerEmail: currentUser?.email,
      createdAt: todayStamp(),
    };
    if (!list.insert(report)) {
      showToast('This report could not be saved. Please try again.', 'error');
      return;
    }
    undoRef.current.push({ type: 'ACT_ADD', before: report, timestamp: nowTime() });
    const queued = queueRef.current.enqueue(report.id);
    nextCityIdRef.current++;
    commitAndSync();
    if (isAdmin) logAdminOp('Logged city report', `#${report.id} (${report.area})`);

    showToast(
      queued
        ? `Report #${report.id} submitted. Our team will review it shortly.`
        : `Report #${report.id} saved. The review queue is currently full.`,
      queued ? 'success' : 'info',
    );
  }

  function handleUpdateCityReport(id: number, description: string, priority: PriorityLevel) {
    if (!requireAdminGuard('edit city reports')) return;
    const node = cityListRef.current.find(id);
    if (!node) {
      showToast(`Report #${id} was not found.`, 'error');
      return;
    }
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.description = sanitizePipeText(description);
    node.data.priority = priority;
    commitAndSync();
    logAdminOp('Updated city report', `#${id}`);
    showToast(`Report #${id} updated.`, 'success');
  }

  function handleToggleCityResolved(id: number, resolved: boolean) {
    if (!requireAdminGuard('change report completion status')) return;
    const node = cityListRef.current.find(id);
    if (!node || node.data.resolved === resolved) return;
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.resolved = resolved;
    let queuedNote = '';
    if (!resolved) {
      if (!queueRef.current.contains(id)) {
        const ok = queueRef.current.enqueue(id);
        queuedNote = ok ? ' and returned to the review queue' : ' (queue full)';
      } else {
        queuedNote = ' (already in queue)';
      }
    }
    commitAndSync();
    logAdminOp(resolved ? 'Resolved city report' : 'Reopened city report', `#${id}`);
    showToast(`Report #${id} marked ${resolved ? 'resolved' : `pending${queuedNote}`}.`, 'success');
  }

  function handleDeleteCityReport(id: number, allowOwner = false) {
    const node = cityListRef.current.find(id);
    if (!node) {
      showToast(`Report #${id} was not found.`, 'error');
      return;
    }
    const ownsReport =
      allowOwner &&
      currentUser &&
      !node.data.resolved &&
      (node.data.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        node.data.submittedBy === currentUser.name);

    if (!isAdmin && !ownsReport) {
      requireAdminGuard('delete city reports');
      return;
    }
    undoRef.current.push({ type: 'ACT_DELETE', before: { ...node.data }, timestamp: nowTime() });
    cityListRef.current.remove(id);
    commitAndSync();
    if (isAdmin) logAdminOp('Deleted city report', `#${id}`);
    showToast(`Report #${id} removed.`, 'info');
  }

  function handleProcessNextComplaint() {
    if (!requireAdminGuard('process the review queue')) return;
    const id = queueRef.current.dequeue();
    if (id === null) {
      showToast('There are no reports waiting for review.', 'info');
      return;
    }
    const node = cityListRef.current.find(id);
    if (!node) {
      commitAndSync();
      showToast(`Report #${id} no longer exists and was skipped.`, 'info');
      return;
    }
    if (node.data.resolved) {
      commitAndSync();
      showToast(`Report #${id} was already resolved and was skipped.`, 'info');
      return;
    }
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.resolved = true;
    commitAndSync();
    logAdminOp('Processed FIFO complaint', `#${id} (${node.data.area})`);
    showToast(`Report #${id} (${node.data.category}, ${node.data.area}) resolved.`, 'success');
  }

  function handleUndoLastCityAction() {
    if (!requireAdminGuard('undo city report actions')) return;
    const action = undoRef.current.pop();
    if (!action) {
      showToast('There is nothing to undo.', 'info');
      return;
    }
    if (action.type === 'ACT_ADD') {
      cityListRef.current.remove(action.before.id);
      showToast(`Undone: report #${action.before.id} removed.`, 'info');
    } else if (action.type === 'ACT_MODIFY') {
      const node = cityListRef.current.find(action.before.id);
      if (node) {
        const wasResolved = node.data.resolved;
        node.data = { ...action.before };
        if (wasResolved && !action.before.resolved && !queueRef.current.contains(action.before.id)) {
          queueRef.current.enqueue(action.before.id);
        }
      }
      showToast(`Undone: report #${action.before.id} restored.`, 'info');
    } else {
      const ok = cityListRef.current.insert(action.before);
      if (ok && !action.before.resolved && !queueRef.current.contains(action.before.id)) {
        queueRef.current.enqueue(action.before.id);
      }
      showToast(
        ok ? `Undone: report #${action.before.id} restored.` : 'Unable to undo: storage limit reached.',
        ok ? 'success' : 'error',
      );
    }
    commitAndSync();
    logAdminOp('Undo action', `${action.type} #${action.before.id}`);
  }

  // ---------------- WASTEX & SCHEDULER HANDLERS ----------------

  function handleAddWaste(data: Omit<WasteRecord, 'id' | 'collected'>) {
    if (!systemSettings.intakeOpen && !isAdmin) {
      showToast('Pickup requests are paused at the moment. Please try again later.', 'error');
      return;
    }
    const list = wasteListRef.current;
    if (list.full()) {
      showToast('Pickup limit reached (500 records).', 'error');
      return;
    }
    const record: WasteRecord = {
      id: nextWasteIdRef.current,
      area: data.area,
      wasteType: data.wasteType,
      amountKg: data.amountKg,
      urgency: data.urgency,
      notes: sanitizePipeText(data.notes),
      collected: false,
      submittedBy: currentUser?.name || 'Customer',
      ownerEmail: currentUser?.email,
      createdAt: todayStamp(),
    };
    if (list.insert(record)) {
      nextWasteIdRef.current++;
      commitAndSync();
      if (isAdmin) logAdminOp('Added waste point', `#${record.id} (${record.area})`);
      showToast(`Pickup request #${record.id} scheduled.`, 'success');
    } else {
      showToast('This pickup request could not be saved.', 'error');
    }
  }

  function handleUpdateWaste(id: number, amountKg: number, urgency: PriorityLevel, notes: string) {
    if (!requireAdminGuard('edit waste collection records')) return;
    const node = wasteListRef.current.find(id);
    if (!node) {
      showToast(`Pickup #${id} was not found.`, 'error');
      return;
    }
    node.data.amountKg = amountKg;
    node.data.urgency = urgency;
    node.data.notes = sanitizePipeText(notes);
    commitAndSync();
    logAdminOp('Updated waste point', `#${id}`);
    showToast(`Pickup #${id} updated.`, 'success');
  }

  function handleToggleWasteCollected(id: number, collected: boolean) {
    if (!requireAdminGuard('mark waste pickups collected')) return;
    const node = wasteListRef.current.find(id);
    if (!node) return;
    node.data.collected = collected;
    commitAndSync();
    logAdminOp(collected ? 'Collected waste point' : 'Reopened waste point', `#${id}`);
    showToast(`Pickup #${id} marked ${collected ? 'collected' : 'pending'}.`, 'success');
  }

  function handleDeleteWaste(id: number, allowOwner = false) {
    const node = wasteListRef.current.find(id);
    if (!node) {
      showToast(`Pickup #${id} was not found.`, 'error');
      return;
    }
    const ownsRecord =
      allowOwner &&
      currentUser &&
      !node.data.collected &&
      (node.data.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        node.data.submittedBy === currentUser.name);

    if (!isAdmin && !ownsRecord) {
      requireAdminGuard('delete waste records');
      return;
    }
    if (wasteListRef.current.remove(id)) {
      commitAndSync();
      if (isAdmin) logAdminOp('Deleted waste point', `#${id}`);
      showToast(`Pickup #${id} deleted.`, 'info');
    }
  }

  function handleProcessNextPickup(id: number) {
    if (!requireAdminGuard('dispatch waste pickups')) return;
    const node = wasteListRef.current.find(id);
    if (!node) return;
    node.data.collected = true;
    commitAndSync();
    logAdminOp('Dispatched Max-Heap pickup', `#${id} (${node.data.area})`);
    showToast(`Pickup #${id} in ${node.data.area} marked collected.`, 'success');
  }

  // ---------------- ROAD GRAPH HANDLERS ----------------

  function handleAddRoad(a: number, b: number, km: number) {
    if (!requireAdminGuard('modify city road links')) return;
    if (graphRef.current.addRoad(a, b, km)) {
      commitAndSync();
      logAdminOp('Saved road link', `${a}<->${b} (${km} km)`);
      showToast(`Road link saved (${km} km).`, 'success');
    } else {
      showToast('Please check the selected areas and distance.', 'error');
    }
  }

  function handleUpdateRoad(a: number, b: number, km: number) {
    if (!requireAdminGuard('update city road distances')) return;
    if (graphRef.current.updateRoad(a, b, km)) {
      commitAndSync();
      logAdminOp('Updated road distance', `${a}<->${b} (${km} km)`);
      showToast(`Road distance updated (${km} km).`, 'success');
    } else {
      showToast('That road link does not exist.', 'error');
    }
  }

  function handleDeleteRoad(a: number, b: number) {
    if (!requireAdminGuard('delete city road links')) return;
    if (graphRef.current.deleteRoad(a, b)) {
      commitAndSync();
      logAdminOp('Deleted road link', `${a}<->${b}`);
      showToast('Road link removed.', 'info');
    } else {
      showToast('That road link does not exist.', 'error');
    }
  }

  function handleLoadDemoRoads() {
    if (!requireAdminGuard('reset the road network')) return;
    graphRef.current.loadDemo();
    commitAndSync();
    logAdminOp('Reset road network', '12 Rajshahi links');
    showToast('Default road network restored.', 'success');
  }

  const reports = cityListRef.current.toArray();
  const wasteRecords = wasteListRef.current.toArray();
  const queueSnapshot = queueRef.current.getSnapshot();
  const undoItems = undoRef.current.getItems();

  const pendingReportsCount = reports.filter((r) => !r.resolved).length;
  const pendingWasteCount = wasteRecords.filter((w) => !w.collected).length;

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  const filteredNavItems = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return visibleNavItems;
    return visibleNavItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
    );
  }, [sidebarSearch, visibleNavItems]);

  const activeNavMeta = visibleNavItems.find((item) => item.id === activeTab) ?? visibleNavItems[0];

  function renderSidebarContent(isMobile = false) {
    return (
      <div className="flex flex-col justify-between h-full">
        <div className="space-y-5">
          {/* Brand Row */}
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                if (isMobile) setMobileNavOpen(false);
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-sm">
                UR
              </span>
              <div>
                <div className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100 leading-none">
                  URBANA
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Rajshahi City Services
                </div>
              </div>
            </button>

            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search Modules Input (OripioFin ⌘K style) */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5"
              aria-hidden="true"
            />
            <input
              ref={!isMobile ? searchInputRef : undefined}
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredNavItems.length > 0) {
                  setActiveTab(filteredNavItems[0].id);
                  if (isMobile) setMobileNavOpen(false);
                }
              }}
              placeholder="Search modules"
              aria-label="Search URBANA modules"
              className="w-full h-9 pl-8 pr-12 text-xs bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-slate-200 dark:border-zinc-800 rounded-xl"
            />
            <span className="pointer-events-none absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded">
              ⌘K
            </span>
          </div>

          {/* Grouped Navigation */}
          <nav aria-label={isMobile ? 'Mobile Navigation' : 'Primary Navigation'} className="space-y-4">
            {NAV_GROUPS.map((group) => {
              const items = filteredNavItems.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-zinc-500 uppercase">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const badgeCount =
                        item.id === 'citypulse'
                          ? pendingReportsCount
                          : item.id === 'wastex'
                            ? pendingWasteCount
                            : null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            if (isMobile) setMobileNavOpen(false);
                          }}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-100'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>

                          <span className="flex items-center gap-1.5 shrink-0">
                            {badgeCount !== null && badgeCount > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                                  isActive
                                    ? 'bg-white/15 dark:bg-zinc-900/15 text-white dark:text-zinc-950'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                }`}
                              >
                                {badgeCount}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Session Status Card (No duplicate Admin Plan buttons) */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-zinc-800">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
            {currentUser ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {isAdmin ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{currentUser.name}</span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                    {isAdmin ? 'Admin' : 'Citizen'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {currentUser.email}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleSignOutAccount();
                    if (isMobile) setMobileNavOpen(false);
                  }}
                  className="w-full py-1.5 px-2 text-[11px] font-medium bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Citizen Account
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                    Create an account to submit requests and follow their progress.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('register');
                      setAuthModalOpen(true);
                      if (isMobile) setMobileNavOpen(false);
                    }}
                    className="py-1.5 px-2 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors whitespace-nowrap"
                  >
                    Sign Up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      setAuthModalOpen(true);
                      if (isMobile) setMobileNavOpen(false);
                    }}
                    className="py-1.5 px-2 text-[11px] font-medium bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F8] dark:bg-[#09090B] text-slate-900 dark:text-zinc-100 flex overflow-x-hidden transition-colors duration-150">
      {/* Desktop Fixed Left Sidebar (OripioFin style) */}
      <aside
        aria-label="Primary Sidebar"
        className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col bg-white dark:bg-[#0C0E12] border-r border-slate-200 dark:border-zinc-800/90 p-4 sticky top-0 h-screen overflow-y-auto"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Slide-Over Sidebar */}
      <aside
        aria-label="Mobile Sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0C0E12] border-r border-slate-200 dark:border-zinc-800 p-4 overflow-y-auto transition-transform duration-150 lg:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Top Utility Bar */}
        <header className="h-16 bg-white dark:bg-[#0C0E12] border-b border-slate-200 dark:border-zinc-800/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Left: Mobile Toggle + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 -ml-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 whitespace-nowrap"
              >
                URBANA
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          {/* Right: 2-Theme Switcher (White | Black) + Auth Chip + Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* White & Black Theme Switcher */}
            <div
              role="group"
              aria-label="Theme selector"
              className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
            >
              <button
                type="button"
                onClick={() => setTheme('white')}
                aria-pressed={theme === 'white'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  theme === 'white'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">White</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('black')}
                aria-pressed={theme === 'black'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  theme === 'black'
                    ? 'bg-zinc-950 text-white border border-zinc-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Black</span>
              </button>
            </div>

            {currentUser ? (
              <div className="hidden sm:inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
                {isAdmin ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                )}
                <span className="font-medium text-slate-800 dark:text-zinc-200 max-w-[100px] truncate">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOutAccount()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                activeTab === 'overview' && isAdmin
                  ? handleExportReportCsv()
                  : setActiveTab('customer')
              }
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
            >
              {activeTab === 'overview' && isAdmin ? (
                <>
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Export Report</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">New Request</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Toast Banner */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                role="status"
                aria-live="polite"
                className={`mb-5 px-4 py-2.5 text-xs rounded-xl border flex items-center justify-between gap-4 shadow-sm ${
                  toast.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
                    : toast.type === 'info'
                      ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-200 text-white dark:text-zinc-950'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {toast.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                  ) : toast.type === 'info' ? (
                    <Info className="w-4 h-4 text-emerald-400 dark:text-emerald-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-medium truncate">{toast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="opacity-70 hover:opacity-100 shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!isHydrated ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-44 bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 rounded-2xl"
                  />
                ))}
              </div>
              <div className="h-80 bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 rounded-2xl" />
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'overview' && (
                <CombinedDashboard
                  currentUser={currentUser}
                  reports={reports}
                  wasteRecords={wasteRecords}
                  graph={graphRef.current}
                  queueSize={queueSnapshot.count}
                  undoSize={undoItems.length}
                  isDark={isDark}
                  onExportCsv={isAdmin ? handleExportReportCsv : undefined}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'customer' && (
                <CustomerHubView
                  currentUser={currentUser}
                  systemSettings={systemSettings}
                  reports={reports}
                  wasteRecords={wasteRecords}
                  graph={graphRef.current}
                  onAddReport={handleAddCityReport}
                  onDeleteOwnReport={(id) => handleDeleteCityReport(id, true)}
                  onAddWaste={handleAddWaste}
                  onDeleteOwnWaste={(id) => handleDeleteWaste(id, true)}
                  onOpenAuth={(mode) => {
                    setAuthModalMode(mode);
                    setAuthModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'citypulse' && (
                <CityPulseView
                  isAdmin={isAdmin}
                  reports={reports}
                  queueSnapshot={queueSnapshot}
                  undoItems={undoItems}
                  areaTrie={trieRef.current}
                  onAddReport={handleAddCityReport}
                  onUpdateReport={handleUpdateCityReport}
                  onToggleResolved={handleToggleCityResolved}
                  onDeleteReport={(id) => handleDeleteCityReport(id, false)}
                  onProcessNextComplaint={handleProcessNextComplaint}
                  onUndoLastAction={handleUndoLastCityAction}
                  onTraceSearchById={(id) => cityListRef.current.traceFind(id)}
                />
              )}

              {activeTab === 'wastex' && (
                <WasteXView
                  isAdmin={isAdmin}
                  records={wasteRecords}
                  onAddWaste={handleAddWaste}
                  onUpdateWaste={handleUpdateWaste}
                  onToggleCollected={handleToggleWasteCollected}
                  onDeleteWaste={(id) => handleDeleteWaste(id, false)}
                  onTraceSearchById={(id) => wasteListRef.current.traceFind(id)}
                />
              )}

              {activeTab === 'scheduler' && (
                <SchedulerView
                  wasteRecords={wasteRecords}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  onProcessNextPickup={handleProcessNextPickup}
                />
              )}

              {activeTab === 'roads' && (
                <RoadNetworkView
                  graph={graphRef.current}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  onAddRoad={handleAddRoad}
                  onUpdateRoad={handleUpdateRoad}
                  onDeleteRoad={handleDeleteRoad}
                  onLoadDemoRoads={handleLoadDemoRoads}
                />
              )}

              {activeTab === 'admin' && isAdmin && (
                <AdminPanelView
                  currentUser={currentUser}
                  adminName={adminName}
                  reports={reports}
                  wasteRecords={wasteRecords}
                  queueSnapshot={queueSnapshot}
                  systemSettings={systemSettings}
                  onSettingsUpdated={setSystemSettings}
                  onOpenSignIn={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  onProcessNextComplaint={handleProcessNextComplaint}
                  onToggleCityResolved={handleToggleCityResolved}
                  onDeleteCityReport={(id) => handleDeleteCityReport(id, false)}
                  onProcessNextPickup={handleProcessNextPickup}
                  onToggleWasteCollected={handleToggleWasteCollected}
                  onDeleteWasteRecord={(id) => handleDeleteWaste(id, false)}
                  onLoadDemoRoads={handleLoadDemoRoads}
                  onRecordAudit={logAdminOp}
                  onNotify={showToast}
                />
              )}

              {activeTab === 'admin' && !isAdmin && (
                <CombinedDashboard
                  currentUser={currentUser}
                  reports={reports}
                  wasteRecords={wasteRecords}
                  graph={graphRef.current}
                  queueSize={queueSnapshot.count}
                  undoSize={undoItems.length}
                  isDark={isDark}
                  onExportCsv={isAdmin ? handleExportReportCsv : undefined}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'about' && <AboutView onNavigate={setActiveTab} />}
            </motion.div>
          )}
        </main>
      </div>

      {/* Create Customer Account / Sign In Modal */}
      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        adminClaimed={adminClaimed}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
