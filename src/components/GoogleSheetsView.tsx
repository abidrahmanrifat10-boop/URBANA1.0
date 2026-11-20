import { useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  AREAS,
  CityReport,
  WasteRecord,
  priorityText,
  statusText,
} from '../engine/urbanaEngine';
import { buildSafeSpreadsheetUrl } from '../services/googleSheets';
import { ConfirmDialog } from './ConfirmDialog';
import { GlassIcon } from './GlassIcon';
import { Tilt3DCard } from './Tilt3DCard';

interface GoogleSheetsViewProps {
  reports: CityReport[];
  wasteRecords: WasteRecord[];
  googleUser: FirebaseUser | null;
  hasGoogleToken: boolean;
  spreadsheetId: string;
  spreadsheetTitle: string;
  lastSyncAt: string | null;
  isBusy: boolean;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}

const COLS_CITY = ['A · ID', 'B · Date', 'C · Area', 'D · Category', 'E · Priority', 'F · Status', 'G · Description', 'H · Submitted By'];
const COLS_WASTE = ['A · ID', 'B · Date', 'C · Area', 'D · Waste Type', 'E · Kg', 'F · Urgency', 'G · Status', 'H · Notes', 'I · Submitted By'];
const COLS_SUMMARY = ['A · Metric / Area', 'B · Value / CityPulse', 'C · Module / Waste Pts', 'D · Notes / Waste kg'];

export function GoogleSheetsView({
  reports,
  wasteRecords,
  googleUser,
  hasGoogleToken,
  spreadsheetId,
  spreadsheetTitle,
  lastSyncAt,
  isBusy,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncAll,
}: GoogleSheetsViewProps) {
  const [sheetTab, setSheetTab] = useState<'city' | 'waste' | 'summary'>('city');
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

  const summaryData = useMemo(() => {
    const cityPending = reports.filter((r) => !r.resolved).length;
    const cityDone = reports.length - cityPending;
    const cityCritical = reports.filter((r) => !r.resolved && r.priority === 4).length;
    const wasteKg = wasteRecords.reduce((s, w) => s + w.amountKg, 0);
    const wastePending = wasteRecords.filter((w) => !w.collected).length;
    const wasteDone = wasteRecords.length - wastePending;

    const areaRows = AREAS.map((area) => ({
      area,
      reports: reports.filter((r) => r.area === area).length,
      wastePts: wasteRecords.filter((w) => w.area === area).length,
      wasteKg: wasteRecords
        .filter((w) => w.area === area)
        .reduce((s, w) => s + w.amountKg, 0),
    }));

    return {
      metrics: [
        ['Total CityPulse Reports', reports.length, 'CityPulse', '=COUNTA(\'CityPulse Reports\'!A2:A)'],
        ['Pending City Issues', cityPending, 'CityPulse', '=COUNTIF(\'CityPulse Reports\'!F2:F,"Pending")'],
        ['Completed City Issues', cityDone, 'CityPulse', '=COUNTIF(\'CityPulse Reports\'!F2:F,"Completed")'],
        ['Critical Pending Issues', cityCritical, 'CityPulse', '=COUNTIFS(E2:E,"Critical",F2:F,"Pending")'],
        ['Total WasteX Points', wasteRecords.length, 'WasteX', '=COUNTA(\'WasteX Collection\'!A2:A)'],
        ['Total Waste Volume (kg)', wasteKg, 'WasteX', '=SUM(\'WasteX Collection\'!E2:E)'],
        ['Pending Waste Points', wastePending, 'WasteX', '=COUNTIF(\'WasteX Collection\'!G2:G,"Pending")'],
        ['Collected Waste Points', wasteDone, 'WasteX', '=COUNTIF(\'WasteX Collection\'!G2:G,"Collected")'],
      ],
      areaRows,
    };
  }, [reports, wasteRecords]);

  function handleDownloadExcelCsv() {
    const esc = (v: string | number) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const lines: string[] = [];
    lines.push('URBANA — CITYPULSE REPORTS');
    lines.push(['Report ID', 'Date', 'Area', 'Category', 'Priority', 'Status', 'Description', 'Submitted By'].map(esc).join(','));
    for (const r of reports) {
      lines.push(
        [
          r.id,
          r.createdAt || '',
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
    lines.push('URBANA — WASTEX COLLECTION');
    lines.push(['Waste ID', 'Date', 'Area', 'Waste Type', 'Amount (kg)', 'Urgency', 'Status', 'Notes', 'Submitted By'].map(esc).join(','));
    for (const w of wasteRecords) {
      lines.push(
        [
          w.id,
          w.createdAt || '',
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
  }

  const safeSheetUrl = spreadsheetId ? buildSafeSpreadsheetUrl(spreadsheetId) : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            GOOGLE SHEETS EXCEL LEDGER · Automatic Report Logging
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Google Sheets Excel Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadExcelCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span>Export Excel CSV</span>
          </button>

          {safeSheetUrl && (
            <a
              href={safeSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open in Google Sheets</span>
            </a>
          )}
        </div>
      </div>

      {/* Zero-Config Google Sheets Auto-Save Card */}
      <Tilt3DCard as="section" className="group p-5 sm:p-6" maxTilt={1.8}>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5 min-w-0">
            <GlassIcon tone="emerald" size="lg">
              <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
            </GlassIcon>
            <div className="min-w-0 space-y-1">
              {hasGoogleToken && googleUser ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Auto-Saving Active to Google Sheets
                    </h2>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{googleUser.email}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Every CityPulse issue or WasteX point you submit is saved automatically in{' '}
                    <strong className="text-slate-900">
                      {spreadsheetTitle || 'URBANA Smart City — Rajshahi Master Log'}
                    </strong>
                    {lastSyncAt ? ` · Last saved ${lastSyncAt}` : ''}.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Connect Google Once — Every Report Saves Automatically
                  </h2>
                  <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                    Sign in with Google once and URBANA automatically creates your formatted Excel-style
                    Google Sheet (CityPulse Reports, WasteX Collection, and Summary Dashboard). After
                    that, any problem reported is saved there automatically without extra steps.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasGoogleToken && googleUser ? (
              <>
                {spreadsheetId && (
                  <button
                    type="button"
                    onClick={() => setConfirmSyncOpen(true)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{isBusy ? 'Syncing...' : 'Sync All Rows'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onGoogleSignOut()}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              /* Official Google Sign-In Button Style */
              <button
                type="button"
                onClick={() => void onGoogleSignIn()}
                disabled={isBusy}
                className="inline-flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 border border-[#747775] rounded-md text-[#1F1F1F] text-sm font-medium shadow-xs transition-colors disabled:opacity-55 whitespace-nowrap"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isBusy ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>
      </Tilt3DCard>

      {/* Live Excel-Style Workbook Preview */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSheetTab('city')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sheetTab === 'city' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CityPulse Reports ({reports.length})
            </button>
            <button
              type="button"
              onClick={() => setSheetTab('waste')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sheetTab === 'waste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              WasteX Collection ({wasteRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setSheetTab('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sheetTab === 'summary' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Summary Formulas
            </button>
          </div>

          <span className="text-xs text-slate-500">
            Excel-formatted preview synced with URBANA live records
          </span>
        </div>

        <div className="overflow-x-auto">
          {sheetTab === 'city' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blue-700 text-white font-semibold">
                  <th className="py-2.5 px-3 border-r border-blue-600 w-10 text-center font-mono">#</th>
                  {COLS_CITY.map((col) => (
                    <th key={col} className="py-2.5 px-3 border-r border-blue-600 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reports.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-400 bg-slate-50">
                      {i + 2}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums font-semibold text-slate-900">
                      {r.id}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {r.createdAt || 'Starter'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800 whitespace-nowrap">
                      {r.area}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                      {r.category}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium whitespace-nowrap">
                      {priorityText(r.priority)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                      {statusText(r.resolved)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 min-w-[220px]">
                      {r.description}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {r.submittedBy || 'URBANA Control'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {sheetTab === 'waste' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-700 text-white font-semibold">
                  <th className="py-2.5 px-3 border-r border-emerald-600 w-10 text-center font-mono">#</th>
                  {COLS_WASTE.map((col) => (
                    <th key={col} className="py-2.5 px-3 border-r border-emerald-600 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {wasteRecords.map((w, i) => (
                  <tr key={w.id} className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-400 bg-slate-50">
                      {i + 2}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums font-semibold text-slate-900">
                      {w.id}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {w.createdAt || 'Starter'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800 whitespace-nowrap">
                      {w.area}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                      {w.wasteType}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums text-right text-slate-900">
                      {w.amountKg}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                      {priorityText(w.urgency)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                      {w.collected ? 'Collected' : 'Pending'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 min-w-[200px]">
                      {w.notes || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {w.submittedBy || 'URBANA Control'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {sheetTab === 'summary' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="py-2.5 px-3 border-r border-slate-700 w-10 text-center font-mono">#</th>
                  {COLS_SUMMARY.map((col) => (
                    <th key={col} className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summaryData.metrics.map(([label, val, mod, formula], i) => (
                  <tr key={String(label)} className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-400 bg-slate-50">
                      {i + 3}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800">{label}</td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums font-bold text-blue-700">
                      {val}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-600">{mod}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{formula}</td>
                  </tr>
                ))}
                <tr className="bg-blue-700 text-white font-semibold">
                  <td className="py-2 px-3 border-r border-blue-600 text-center font-mono">12</td>
                  <td className="py-2 px-3 border-r border-blue-600">Area-Wise Breakdown</td>
                  <td className="py-2 px-3 border-r border-blue-600">CityPulse Reports</td>
                  <td className="py-2 px-3 border-r border-blue-600">WasteX Points</td>
                  <td className="py-2 px-3">Total Waste (kg)</td>
                </tr>
                {summaryData.areaRows.map((row, idx) => (
                  <tr key={row.area} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-400 bg-slate-50">
                      {idx + 13}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800">{row.area}</td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums text-slate-900">
                      {row.reports}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums text-slate-900">
                      {row.wastePts}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-900">
                      {row.wasteKg.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Mandatory Confirmation Dialog Before Overwriting/Syncing Existing Sheet */}
      <ConfirmDialog
        open={confirmSyncOpen}
        title="Sync All URBANA Records to Google Sheet?"
        description={`This will update "${spreadsheetTitle || 'your connected Google Sheet'}" with ${reports.length} CityPulse reports, ${wasteRecords.length} WasteX points, and the Summary Dashboard formulas. Existing rows in those tabs will be replaced with the current live URBANA ledger.`}
        confirmLabel="Sync All to Sheet"
        tone="warning"
        onConfirm={() => {
          void onSyncAll();
        }}
        onCancel={() => setConfirmSyncOpen(false)}
      />
    </div>
  );
}
