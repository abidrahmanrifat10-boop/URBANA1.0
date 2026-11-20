import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AREAS,
  CityReport,
  WasteRecord,
  priorityText,
  statusText,
} from '../engine/urbanaEngine';

export const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'] as const;

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
for (const scope of SHEETS_SCOPES) {
  googleProvider.addScope(scope);
}

// Keep Google OAuth access token strictly in memory (never in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface GoogleSheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetNames: string[];
}

export function initGoogleSheetsAuth(
  onAuthenticated: (user: User, token: string) => void,
  onSignedOut: () => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthenticated(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) cachedAccessToken = null;
      onSignedOut();
    }
  });
}

export async function signInWithGoogleSheets(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Sheets permission token. Please try again.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleSheets(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{15,120}$/.test(trimmed)) return trimmed;
  return null;
}

export function buildSafeSpreadsheetUrl(spreadsheetId: string): string {
  const clean = spreadsheetId.replace(/[^a-zA-Z0-9-_]/g, '');
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

async function sheetsFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Sheets session expired. Please sign in with Google again.');
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const apiMsg = body?.error?.message;
    throw new Error(typeof apiMsg === 'string' ? apiMsg : `Google Sheets API error (${res.status})`);
  }
  return body as T;
}

export async function getSpreadsheetInfo(spreadsheetId: string): Promise<GoogleSheetMetadata> {
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title`,
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'URBANA Smart City Sheet',
    spreadsheetUrl: data.spreadsheetUrl || buildSafeSpreadsheetUrl(data.spreadsheetId),
    sheetNames: (data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  };
}

function formatCityReportRow(r: CityReport): Array<string | number> {
  return [
    r.id,
    r.createdAt || new Date().toLocaleDateString('en-GB'),
    r.area,
    r.category,
    priorityText(r.priority),
    statusText(r.resolved),
    r.description,
    r.submittedBy || 'URBANA Control',
  ];
}

function formatWasteRecordRow(w: WasteRecord): Array<string | number> {
  return [
    w.id,
    w.createdAt || new Date().toLocaleDateString('en-GB'),
    w.area,
    w.wasteType,
    w.amountKg,
    priorityText(w.urgency),
    w.collected ? 'Collected' : 'Pending',
    w.notes || '—',
    w.submittedBy || 'URBANA Control',
  ];
}

const CITY_HEADERS = [
  'Report ID',
  'Logged Date',
  'Rajshahi Area',
  'Category',
  'Priority',
  'Status',
  'Description',
  'Submitted By',
];

const WASTE_HEADERS = [
  'Waste ID',
  'Logged Date',
  'Rajshahi Area',
  'Waste Type',
  'Amount (kg)',
  'Urgency',
  'Status',
  'Notes',
  'Submitted By',
];

function buildSummaryRows(): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['URBANA — Rajshahi Smart City Excel Summary', '', '', ''],
    ['Metric', 'Formula / Live Value', 'Module', 'Notes'],
    ['Total CityPulse Reports', '=COUNTA(\'CityPulse Reports\'!A2:A)', 'CityPulse', 'Auto-updated count'],
    ['Pending City Issues', '=COUNTIF(\'CityPulse Reports\'!F2:F, "Pending")', 'CityPulse', 'Active queue'],
    ['Completed City Issues', '=COUNTIF(\'CityPulse Reports\'!F2:F, "Completed")', 'CityPulse', 'Resolved'],
    ['Critical Pending Issues', '=COUNTIFS(\'CityPulse Reports\'!E2:E, "Critical", \'CityPulse Reports\'!F2:F, "Pending")', 'CityPulse', 'Priority 4'],
    ['Total WasteX Points', '=COUNTA(\'WasteX Collection\'!A2:A)', 'WasteX', 'Logged points'],
    ['Total Waste Volume (kg)', '=SUM(\'WasteX Collection\'!E2:E)', 'WasteX', 'Combined kg'],
    ['Pending Waste Points', '=COUNTIF(\'WasteX Collection\'!G2:G, "Pending")', 'WasteX', 'Scheduled in Heap'],
    ['Collected Waste Points', '=COUNTIF(\'WasteX Collection\'!G2:G, "Collected")', 'WasteX', 'Completed'],
    ['', '', '', ''],
    ['Area-Wise Breakdown', 'CityPulse Reports', 'WasteX Points', 'Total Waste (kg)'],
  ];

  AREAS.forEach((area, i) => {
    const rowNum = i + 13;
    rows.push([
      area,
      `=COUNTIF('CityPulse Reports'!C2:C, A${rowNum})`,
      `=COUNTIF('WasteX Collection'!C2:C, A${rowNum})`,
      `=SUMIF('WasteX Collection'!C2:C, A${rowNum}, 'WasteX Collection'!E2:E)`,
    ]);
  });

  return rows;
}

async function applyExcelFormatting(
  spreadsheetId: string,
  sheetIds: { summaryId: number; cityId: number; wasteId: number },
) {
  const headerStyle = {
    backgroundColor: { red: 0.114, green: 0.306, blue: 0.847 }, // #1D4ED8 Cobalt
    textFormat: {
      foregroundColor: { red: 1, green: 1, blue: 1 },
      bold: true,
      fontSize: 10,
    },
    horizontalAlignment: 'LEFT',
    verticalAlignment: 'MIDDLE',
  };

  const requests = [
    // Bold Cobalt header on CityPulse Reports (row 0)
    {
      repeatCell: {
        range: { sheetId: sheetIds.cityId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: headerStyle },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Bold Emerald header on WasteX Collection (row 0)
    {
      repeatCell: {
        range: { sheetId: sheetIds.wasteId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            ...headerStyle,
            backgroundColor: { red: 0.016, green: 0.471, blue: 0.341 }, // #047857 Emerald
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Summary Dashboard title banner (row 0) & subheaders (row 1, row 11)
    {
      repeatCell: {
        range: { sheetId: sheetIds.summaryId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.059, green: 0.09, blue: 0.165 }, // #0F172A Slate 900
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 12 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: sheetIds.summaryId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
        cell: { userEnteredFormat: headerStyle },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: sheetIds.summaryId, startRowIndex: 11, endRowIndex: 12, startColumnIndex: 0, endColumnIndex: 4 },
        cell: { userEnteredFormat: headerStyle },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Auto-resize columns cleanly across all 3 tabs
    ...[sheetIds.summaryId, sheetIds.cityId, sheetIds.wasteId].map((sheetId) => ({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 },
      },
    })),
  ];

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    },
  );
}

export async function createUrbanaSpreadsheet(
  reports: CityReport[],
  wasteRecords: WasteRecord[],
): Promise<GoogleSheetMetadata> {
  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: 'URBANA Smart City — Rajshahi Master Log',
      },
      sheets: [
        {
          properties: {
            title: 'CityPulse Reports',
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'WasteX Collection',
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Summary Dashboard',
            gridProperties: { frozenRowCount: 2 },
          },
        },
      ],
    }),
  });

  const spreadsheetId = created.spreadsheetId;
  const citySheet = created.sheets.find((s) => s.properties.title === 'CityPulse Reports');
  const wasteSheet = created.sheets.find((s) => s.properties.title === 'WasteX Collection');
  const summarySheet = created.sheets.find((s) => s.properties.title === 'Summary Dashboard');

  // Populate all 3 tabs using values:batchUpdate
  const cityValues = [CITY_HEADERS, ...reports.map(formatCityReportRow)];
  const wasteValues = [WASTE_HEADERS, ...wasteRecords.map(formatWasteRecordRow)];
  const summaryValues = buildSummaryRows();

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: "'CityPulse Reports'!A1", values: cityValues },
          { range: "'WasteX Collection'!A1", values: wasteValues },
          { range: "'Summary Dashboard'!A1", values: summaryValues },
        ],
      }),
    },
  );

  if (citySheet && wasteSheet && summarySheet) {
    await applyExcelFormatting(spreadsheetId, {
      cityId: citySheet.properties.sheetId,
      wasteId: wasteSheet.properties.sheetId,
      summaryId: summarySheet.properties.sheetId,
    });
  }

  return {
    spreadsheetId,
    title: created.properties.title,
    spreadsheetUrl: created.spreadsheetUrl || buildSafeSpreadsheetUrl(spreadsheetId),
    sheetNames: created.sheets.map((s) => s.properties.title),
  };
}

export async function syncAllToSpreadsheet(
  spreadsheetId: string,
  reports: CityReport[],
  wasteRecords: WasteRecord[],
): Promise<GoogleSheetMetadata> {
  const info = await getSpreadsheetInfo(spreadsheetId);
  const cityTab = info.sheetNames.includes('CityPulse Reports')
    ? 'CityPulse Reports'
    : info.sheetNames[0] || 'CityPulse Reports';
  const wasteTab = info.sheetNames.includes('WasteX Collection')
    ? 'WasteX Collection'
    : null;
  const summaryTab = info.sheetNames.includes('Summary Dashboard')
    ? 'Summary Dashboard'
    : null;

  const rangesToClear = [`'${cityTab}'!A1:Z2000`];
  if (wasteTab) rangesToClear.push(`'${wasteTab}'!A1:Z2000`);
  if (summaryTab) rangesToClear.push(`'${summaryTab}'!A1:Z100`);

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: rangesToClear }),
    },
  );

  const data: Array<{ range: string; values: Array<Array<string | number>> }> = [
    { range: `'${cityTab}'!A1`, values: [CITY_HEADERS, ...reports.map(formatCityReportRow)] },
  ];
  if (wasteTab) {
    data.push({
      range: `'${wasteTab}'!A1`,
      values: [WASTE_HEADERS, ...wasteRecords.map(formatWasteRecordRow)],
    });
  }
  if (summaryTab) {
    data.push({ range: `'${summaryTab}'!A1`, values: buildSummaryRows() });
  }

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
    },
  );

  return info;
}

export async function appendCityReportRow(
  spreadsheetId: string,
  report: CityReport,
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId);
  const targetTab = info.sheetNames.includes('CityPulse Reports')
    ? 'CityPulse Reports'
    : info.sheetNames[0];
  if (!targetTab) throw new Error('Target spreadsheet has no visible sheets.');

  const range = encodeURIComponent(`'${targetTab}'!A:H`);
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [formatCityReportRow(report)],
      }),
    },
  );
}

export async function appendWasteRecordRow(
  spreadsheetId: string,
  record: WasteRecord,
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId);
  const targetTab = info.sheetNames.includes('WasteX Collection')
    ? 'WasteX Collection'
    : info.sheetNames[0];
  if (!targetTab) throw new Error('Target spreadsheet has no visible sheets.');

  const range = encodeURIComponent(`'${targetTab}'!A:I`);
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [formatWasteRecordRow(record)],
      }),
    },
  );
}
