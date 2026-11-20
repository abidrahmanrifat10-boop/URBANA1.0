/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Info,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Recycle,
  Route,
  ShieldAlert,
  UserCheck,
  UserPlus,
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
  sanitizePipeText,
  serializeCityReports,
  serializeWasteRecords,
} from './engine/urbanaEngine';
import { ActiveTab, CombinedDashboard } from './components/CombinedDashboard';
import { CityPulseView } from './components/CityPulseView';
import { WasteXView } from './components/WasteXView';
import { SchedulerView } from './components/SchedulerView';
import { RoadNetworkView } from './components/RoadNetworkView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { AboutView } from './components/AboutView';
import { AuthModal } from './components/AuthModal';
import { GlassIcon, GlassTone } from './components/GlassIcon';
import {
  AuthUser,
  fetchUserSheetConfig,
  logoutAccount,
  saveUserSheetConfig,
} from './services/authClient';
import {
  appendCityReportRow,
  appendWasteRecordRow,
  createUrbanaSpreadsheet,
  getGoogleAccessToken,
  getSpreadsheetInfo,
  initGoogleSheetsAuth,
  signInWithGoogleSheets,
  signOutGoogleSheets,
  syncAllToSpreadsheet,
} from './services/googleSheets';

const STORAGE_KEYS = {
  city: 'urbana_citypulse_reports_v1',
  waste: 'urbana_wastex_records_v1',
  roads: 'urbana_roads_v1',
  sheetMeta: 'urbana_sheet_meta_v1',
};

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  subtitle: string;
  tone: GlassTone;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Combined Dashboard', subtitle: 'Overview & Area Stats', tone: 'blue', icon: LayoutDashboard },
  { id: 'citypulse', label: 'CITYPULSE', subtitle: 'Issue Queue & Undo', tone: 'blue', icon: ShieldAlert },
  { id: 'wastex', label: 'WASTEX', subtitle: 'Waste Collection Log', tone: 'emerald', icon: Recycle },
  { id: 'scheduler', label: 'Heap Scheduler', subtitle: 'Max-Heap & What-If', tone: 'amber', icon: Layers },
  { id: 'roads', label: 'Road Network', subtitle: 'Dijkstra & Kruskal MST', tone: 'slate', icon: Route },
  { id: 'sheets', label: 'Google Sheet', subtitle: 'Excel Sync & Export', tone: 'emerald', icon: FileSpreadsheet },
  { id: 'about', label: 'About URBANA', subtitle: 'System & Team Details', tone: 'blue', icon: Info },
];

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
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [, setTick] = useState(0);

  // Account auth state (session token lives strictly in memory in authClient.ts)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');

  // Google Sheets state (access token lives strictly in memory in googleSheets.ts)
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isSheetBusy, setIsSheetBusy] = useState(false);

  const forceSync = () => setTick((t) => t + 1);

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEYS.city, serializeCityReports(cityListRef.current.toArray()));
      localStorage.setItem(STORAGE_KEYS.waste, serializeWasteRecords(wasteListRef.current.toArray()));
      localStorage.setItem(STORAGE_KEYS.roads, graphRef.current.serialize());
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }

  function persistLocalSheetMeta(id: string, title: string, syncEnabled: boolean) {
    try {
      if (!id) {
        localStorage.removeItem(STORAGE_KEYS.sheetMeta);
      } else {
        localStorage.setItem(
          STORAGE_KEYS.sheetMeta,
          JSON.stringify({ spreadsheetId: id, spreadsheetTitle: title, autoSync: syncEnabled }),
        );
      }
    } catch {
      // Ignore storage quota errors
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

  // Listen for Firebase Google Sheets auth state changes
  useEffect(() => {
    const unsubscribe = initGoogleSheetsAuth(
      (user) => {
        setGoogleUser(user);
        setHasGoogleToken(Boolean(getGoogleAccessToken()));
      },
      () => {
        setGoogleUser(null);
        setHasGoogleToken(false);
      },
    );
    return () => unsubscribe();
  }, []);

  // Initial load mirroring C++ main()
  useEffect(() => {
    try {
      const savedCity = localStorage.getItem(STORAGE_KEYS.city);
      const savedWaste = localStorage.getItem(STORAGE_KEYS.waste);
      const savedRoads = localStorage.getItem(STORAGE_KEYS.roads);
      const savedSheetMeta = localStorage.getItem(STORAGE_KEYS.sheetMeta);

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

      if (savedSheetMeta) {
        const parsedMeta = JSON.parse(savedSheetMeta) as {
          spreadsheetId?: string;
          spreadsheetTitle?: string;
        };
        if (parsedMeta.spreadsheetId) {
          setSpreadsheetId(parsedMeta.spreadsheetId);
          setSpreadsheetTitle(parsedMeta.spreadsheetTitle || 'URBANA Smart City Sheet');
        }
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

  function currentActorLabel(): string {
    return currentUser?.name || googleUser?.displayName || 'Citizen / Operator';
  }

  // ---------------- ACCOUNT HANDLERS ----------------

  async function handleAuthSuccess(user: AuthUser, mode: 'login' | 'register') {
    setCurrentUser(user);
    setAuthModalOpen(false);
    showToast(
      mode === 'register'
        ? `Account created! Welcome, ${user.name}.`
        : `Signed in as ${user.name}.`,
      'success',
    );
    try {
      const serverCfg = await fetchUserSheetConfig();
      if (serverCfg?.spreadsheetId) {
        setSpreadsheetId(serverCfg.spreadsheetId);
        setSpreadsheetTitle(serverCfg.spreadsheetTitle);
        persistLocalSheetMeta(serverCfg.spreadsheetId, serverCfg.spreadsheetTitle, true);
      } else if (spreadsheetId) {
        await saveUserSheetConfig({ spreadsheetId, spreadsheetTitle, autoSync: true });
      }
    } catch {
      // Non-fatal if sheet config sync fails
    }
  }

  async function handleSignOutAccount() {
    await logoutAccount();
    setCurrentUser(null);
    showToast('Signed out of your URBANA account.', 'info');
  }

  // ---------------- GOOGLE SHEETS HANDLERS ----------------

  async function saveSheetLink(id: string, title: string) {
    setSpreadsheetId(id);
    setSpreadsheetTitle(title);
    persistLocalSheetMeta(id, title, true);
    if (currentUser) {
      try {
        await saveUserSheetConfig({ spreadsheetId: id, spreadsheetTitle: title, autoSync: true });
      } catch {
        // Ignore non-fatal server preference save error
      }
    }
  }

  async function ensureLinkedSpreadsheet(): Promise<string> {
    if (spreadsheetId) {
      try {
        const info = await getSpreadsheetInfo(spreadsheetId);
        if (info.title !== spreadsheetTitle) {
          await saveSheetLink(info.spreadsheetId, info.title);
        }
        return info.spreadsheetId;
      } catch {
        // Fall through to create a fresh sheet if the old one was deleted
      }
    }
    const created = await createUrbanaSpreadsheet(
      cityListRef.current.toArray(),
      wasteListRef.current.toArray(),
    );
    await saveSheetLink(created.spreadsheetId, created.title);
    setLastSyncAt(nowTime());
    return created.spreadsheetId;
  }

  async function handleGoogleSignIn() {
    setIsSheetBusy(true);
    try {
      const { user } = await signInWithGoogleSheets();
      setGoogleUser(user);
      setHasGoogleToken(true);
      await ensureLinkedSpreadsheet();
      showToast(
        `Google Sheet connected (${user.email || user.displayName || 'Google'}). Every new report now auto-saves.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed.', 'error');
    } finally {
      setIsSheetBusy(false);
    }
  }

  async function handleGoogleSignOut() {
    setIsSheetBusy(true);
    try {
      await signOutGoogleSheets();
      setGoogleUser(null);
      setHasGoogleToken(false);
      showToast('Disconnected Google Sheets session.', 'info');
    } finally {
      setIsSheetBusy(false);
    }
  }

  async function handleSyncAllToSheet() {
    setIsSheetBusy(true);
    try {
      const id = await ensureLinkedSpreadsheet();
      await syncAllToSpreadsheet(
        id,
        cityListRef.current.toArray(),
        wasteListRef.current.toArray(),
      );
      setLastSyncAt(nowTime());
      showToast('All CityPulse & WasteX records synced to Google Sheet.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to sync to Google Sheet.', 'error');
    } finally {
      setIsSheetBusy(false);
    }
  }

  // ---------------- CITYPULSE HANDLERS ----------------

  function handleAddCityReport(data: Omit<CityReport, 'id' | 'resolved'>) {
    const list = cityListRef.current;
    if (list.full()) {
      showToast('Report storage full (500 records maximum).', 'error');
      return;
    }
    const report: CityReport = {
      id: nextCityIdRef.current,
      area: data.area,
      category: data.category,
      description: sanitizePipeText(data.description),
      priority: data.priority,
      resolved: false,
      submittedBy: currentActorLabel(),
      createdAt: todayStamp(),
    };
    if (!list.insert(report)) {
      showToast('Could not add report due to duplicate ID.', 'error');
      return;
    }
    undoRef.current.push({ type: 'ACT_ADD', before: report, timestamp: nowTime() });
    const queued = queueRef.current.enqueue(report.id);
    nextCityIdRef.current++;
    commitAndSync();

    if (hasGoogleToken) {
      void (spreadsheetId
        ? appendCityReportRow(spreadsheetId, report)
        : ensureLinkedSpreadsheet())
        .then(() => {
          setLastSyncAt(nowTime());
          showToast(`City report #${report.id} logged & saved to Google Sheet.`, 'success');
        })
        .catch(() => {
          showToast(`Report #${report.id} saved locally (reconnect Google Sheet to sync).`, 'info');
        });
      return;
    }

    showToast(
      queued
        ? `City report added. ID: ${report.id}`
        : `City report ${report.id} saved (complaint queue full).`,
      queued ? 'success' : 'info',
    );
  }

  function handleUpdateCityReport(id: number, description: string, priority: PriorityLevel) {
    const node = cityListRef.current.find(id);
    if (!node) {
      showToast(`Report ${id} not found.`, 'error');
      return;
    }
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.description = sanitizePipeText(description);
    node.data.priority = priority;
    commitAndSync();
    showToast(`Updated report ${id}.`, 'success');
  }

  function handleToggleCityResolved(id: number, resolved: boolean) {
    const node = cityListRef.current.find(id);
    if (!node || node.data.resolved === resolved) return;
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.resolved = resolved;
    let queuedNote = '';
    if (!resolved) {
      if (!queueRef.current.contains(id)) {
        const ok = queueRef.current.enqueue(id);
        queuedNote = ok ? ' and re-enqueued in FIFO' : ' (queue full)';
      } else {
        queuedNote = ' (already in queue)';
      }
    }
    commitAndSync();
    showToast(`Report ${id} marked ${resolved ? 'Completed' : `Pending${queuedNote}`}.`, 'success');
  }

  function handleDeleteCityReport(id: number) {
    const node = cityListRef.current.find(id);
    if (!node) {
      showToast(`Report ${id} not found.`, 'error');
      return;
    }
    undoRef.current.push({ type: 'ACT_DELETE', before: { ...node.data }, timestamp: nowTime() });
    cityListRef.current.remove(id);
    commitAndSync();
    showToast(`Report ${id} deleted (undo available).`, 'info');
  }

  function handleProcessNextComplaint() {
    const id = queueRef.current.dequeue();
    if (id === null) {
      showToast('Complaint queue is empty.', 'info');
      return;
    }
    const node = cityListRef.current.find(id);
    if (!node) {
      commitAndSync();
      showToast(`Queued ID ${id} no longer exists. Skipped.`, 'info');
      return;
    }
    if (node.data.resolved) {
      commitAndSync();
      showToast(`Queued ID ${id} was already completed. Skipped.`, 'info');
      return;
    }
    undoRef.current.push({ type: 'ACT_MODIFY', before: { ...node.data }, timestamp: nowTime() });
    node.data.resolved = true;
    commitAndSync();
    showToast(`Processed ID ${id} (${node.data.area}, ${node.data.category}) -> Completed.`, 'success');
  }

  function handleUndoLastCityAction() {
    const action = undoRef.current.pop();
    if (!action) {
      showToast('Nothing to undo.', 'info');
      return;
    }
    if (action.type === 'ACT_ADD') {
      cityListRef.current.remove(action.before.id);
      showToast(`Undo: removed report ${action.before.id}.`, 'info');
    } else if (action.type === 'ACT_MODIFY') {
      const node = cityListRef.current.find(action.before.id);
      if (node) {
        const wasResolved = node.data.resolved;
        node.data = { ...action.before };
        if (wasResolved && !action.before.resolved && !queueRef.current.contains(action.before.id)) {
          queueRef.current.enqueue(action.before.id);
        }
      }
      showToast(`Undo: restored report ${action.before.id}.`, 'info');
    } else {
      const ok = cityListRef.current.insert(action.before);
      if (ok && !action.before.resolved && !queueRef.current.contains(action.before.id)) {
        queueRef.current.enqueue(action.before.id);
      }
      showToast(
        ok ? `Undo: restored deleted report ${action.before.id}.` : 'Cannot undo: storage full.',
        ok ? 'success' : 'error',
      );
    }
    commitAndSync();
  }

  // ---------------- WASTEX & SCHEDULER HANDLERS ----------------

  function handleAddWaste(data: Omit<WasteRecord, 'id' | 'collected'>) {
    const list = wasteListRef.current;
    if (list.full()) {
      showToast('Waste storage full (500 records maximum).', 'error');
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
      submittedBy: currentActorLabel(),
      createdAt: todayStamp(),
    };
    if (list.insert(record)) {
      nextWasteIdRef.current++;
      commitAndSync();

      if (hasGoogleToken) {
        void (spreadsheetId
          ? appendWasteRecordRow(spreadsheetId, record)
          : ensureLinkedSpreadsheet())
          .then(() => {
            setLastSyncAt(nowTime());
            showToast(`Waste point #${record.id} added & saved to Google Sheet.`, 'success');
          })
          .catch(() => {
            showToast(`Waste point #${record.id} saved locally (reconnect Google Sheet to sync).`, 'info');
          });
        return;
      }

      showToast(`Waste point added. ID: ${record.id}`, 'success');
    } else {
      showToast('Could not add waste record.', 'error');
    }
  }

  function handleUpdateWaste(id: number, amountKg: number, urgency: PriorityLevel, notes: string) {
    const node = wasteListRef.current.find(id);
    if (!node) {
      showToast(`Waste record ${id} not found.`, 'error');
      return;
    }
    node.data.amountKg = amountKg;
    node.data.urgency = urgency;
    node.data.notes = sanitizePipeText(notes);
    commitAndSync();
    showToast(`Updated waste record ${id}.`, 'success');
  }

  function handleToggleWasteCollected(id: number, collected: boolean) {
    const node = wasteListRef.current.find(id);
    if (!node) return;
    node.data.collected = collected;
    commitAndSync();
    showToast(`Waste point ${id} marked ${collected ? 'Collected' : 'Pending'}.`, 'success');
  }

  function handleDeleteWaste(id: number) {
    if (wasteListRef.current.remove(id)) {
      commitAndSync();
      showToast(`Waste record ${id} deleted.`, 'info');
    } else {
      showToast(`Waste record ${id} not found.`, 'error');
    }
  }

  function handleProcessNextPickup(id: number) {
    const node = wasteListRef.current.find(id);
    if (!node) return;
    node.data.collected = true;
    commitAndSync();
    showToast(`Collected ID ${id} (${node.data.area}).`, 'success');
  }

  // ---------------- ROAD GRAPH HANDLERS ----------------

  function handleAddRoad(a: number, b: number, km: number) {
    if (graphRef.current.addRoad(a, b, km)) {
      commitAndSync();
      showToast(`Road saved (${km} km).`, 'success');
    } else {
      showToast('Invalid road connection or distance.', 'error');
    }
  }

  function handleUpdateRoad(a: number, b: number, km: number) {
    if (graphRef.current.updateRoad(a, b, km)) {
      commitAndSync();
      showToast(`Road distance updated (${km} km).`, 'success');
    } else {
      showToast('Road not found.', 'error');
    }
  }

  function handleDeleteRoad(a: number, b: number) {
    if (graphRef.current.deleteRoad(a, b)) {
      commitAndSync();
      showToast('Road connection deleted.', 'info');
    } else {
      showToast('Road not found.', 'error');
    }
  }

  function handleLoadDemoRoads() {
    graphRef.current.loadDemo();
    commitAndSync();
    showToast('Restored 12 demo Rajshahi road links.', 'success');
  }

  const reports = cityListRef.current.toArray();
  const wasteRecords = wasteListRef.current.toArray();
  const queueSnapshot = queueRef.current.getSnapshot();
  const undoItems = undoRef.current.getItems();
  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Workspace Sidebar (256px) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                U
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                URBANA
              </span>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 pt-5 pb-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Control Modules
            </p>
          </div>

          <nav className="px-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <GlassIcon
                    tone={isActive ? item.tone : 'slate'}
                    size="sm"
                    active={isActive}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </GlassIcon>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account & Team Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          {currentUser ? (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOutAccount()}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors"
              >
                <LogOut className="w-3 h-3" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                  setMobileNavOpen(false);
                }}
                className="inline-flex items-center justify-center gap-1 py-2 px-2 text-[11px] font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3 h-3" aria-hidden="true" />
                <span>Sign Up</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                  setMobileNavOpen(false);
                }}
                className="inline-flex items-center justify-center gap-1 py-2 px-2 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3 h-3" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-0.5">
            <div className="font-semibold text-slate-800">Team AetherCore</div>
            <div>Rajshahi Smart City · CSE 2103</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Translucent Top Header */}
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-md lg:hidden shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">URBANA</span>
              <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:inline shrink-0" aria-hidden="true" />
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('sheets')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                hasGoogleToken && spreadsheetId
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>{hasGoogleToken && spreadsheetId ? 'Sheet Linked' : 'Google Sheet'}</span>
            </button>

            {currentUser ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 text-xs text-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                <span className="font-medium max-w-[120px] truncate">{currentUser.name}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create Account</span>
              </button>
            )}
          </div>
        </header>

        {/* Action Toast Banner */}
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
              className={`mx-4 sm:mx-6 lg:mx-8 mt-4 px-4 py-2.5 text-xs rounded-md border flex items-center justify-between gap-4 shadow-xs ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : toast.type === 'info'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {toast.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                ) : toast.type === 'info' ? (
                  <Info className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                )}
                <span className="font-medium truncate">{toast.message}</span>
              </div>
              <button
                onClick={() => setToast(null)}
                className="opacity-70 hover:opacity-100 shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {!isHydrated ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-64 bg-slate-200 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg" />
                ))}
              </div>
              <div className="h-80 bg-white border border-slate-200 rounded-lg" />
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
                  reports={reports}
                  wasteRecords={wasteRecords}
                  graph={graphRef.current}
                  queueSize={queueSnapshot.count}
                  undoSize={undoItems.length}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'citypulse' && (
                <CityPulseView
                  reports={reports}
                  queueSnapshot={queueSnapshot}
                  undoItems={undoItems}
                  areaTrie={trieRef.current}
                  onAddReport={handleAddCityReport}
                  onUpdateReport={handleUpdateCityReport}
                  onToggleResolved={handleToggleCityResolved}
                  onDeleteReport={handleDeleteCityReport}
                  onProcessNextComplaint={handleProcessNextComplaint}
                  onUndoLastAction={handleUndoLastCityAction}
                  onTraceSearchById={(id) => cityListRef.current.traceFind(id)}
                />
              )}

              {activeTab === 'wastex' && (
                <WasteXView
                  records={wasteRecords}
                  onAddWaste={handleAddWaste}
                  onUpdateWaste={handleUpdateWaste}
                  onToggleCollected={handleToggleWasteCollected}
                  onDeleteWaste={handleDeleteWaste}
                  onTraceSearchById={(id) => wasteListRef.current.traceFind(id)}
                />
              )}

              {activeTab === 'scheduler' && (
                <SchedulerView
                  wasteRecords={wasteRecords}
                  onProcessNextPickup={handleProcessNextPickup}
                />
              )}

              {activeTab === 'roads' && (
                <RoadNetworkView
                  graph={graphRef.current}
                  onAddRoad={handleAddRoad}
                  onUpdateRoad={handleUpdateRoad}
                  onDeleteRoad={handleDeleteRoad}
                  onLoadDemoRoads={handleLoadDemoRoads}
                />
              )}

              {activeTab === 'sheets' && (
                <GoogleSheetsView
                  reports={reports}
                  wasteRecords={wasteRecords}
                  googleUser={googleUser}
                  hasGoogleToken={hasGoogleToken}
                  spreadsheetId={spreadsheetId}
                  spreadsheetTitle={spreadsheetTitle}
                  lastSyncAt={lastSyncAt}
                  isBusy={isSheetBusy}
                  onGoogleSignIn={handleGoogleSignIn}
                  onGoogleSignOut={handleGoogleSignOut}
                  onSyncAll={handleSyncAllToSheet}
                />
              )}

              {activeTab === 'about' && <AboutView onNavigate={setActiveTab} />}
            </motion.div>
          )}
        </main>
      </div>

      {/* Create Account / Sign In Modal */}
      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user, mode) => void handleAuthSuccess(user, mode)}
      />
    </div>
  );
}
