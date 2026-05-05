import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

type Branch = { id: string; code: string; name: string };

type CashRow = {
  id: string;
  date: string;
  source: string;
  amount: number;
};

type ExpenseRow = {
  id: string;
  date: string;
  source: string;
  amount: number;
};

type HuidRow = {
  id: string;
  date: string;
  source: string;
  quantity: number;
  amount: number;
};

type RefineryRow = {
  id: string;
  date: string;
  source: string;
  grossG: number;
  pureG: number;
};

type BankRow = {
  id: string;
  date: string;
  account: string;
  debit: number;
  credit: number;
};

type MarketDueRow = {
  id: string;
  party: string;
  dueAmount: number;
};

type CorporateExpenseRow = {
  id: string;
  head: string;
  amount: number;
};

type BusinessRecord = {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  month: number;
  year: number;
  name: string;
  createdAt: string;
  cashRows: CashRow[];
  expenseRows: ExpenseRow[];
  huidRows: HuidRow[];
  refineryRows: RefineryRow[];
  bankRows: BankRow[];
  marketDueRows: MarketDueRow[];
  corporateExpenseRows: CorporateExpenseRow[];
  exportFileName?: string;
  exportContentType?: string;
  hasExportAttachment?: boolean;
  exportGeneratedAt?: string;
};

type SheetName =
  | 'Basic Info'
  | 'Cash Part'
  | 'Expenses Details'
  | 'Refinery Part'
  | 'Bank Sheet'
  | 'HUID Billing Details'
  | 'Market Due List'
  | 'Corporate Expenses';

const KEY = 'nexus.react.records.business.v1';
const LAST_EXPORT_KEY = 'nexus.react.records.lastExport.v1';
const REC_BASE = '/api/records/api/v1/records';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const ADM_BRANCHES = '/api/admin/api/v1/admin/branches';

type BusinessRecordApi = {
  id: string;
  branchRef: string;
  branchCode: string;
  branchName: string;
  month: number;
  year: number;
  name: string;
  cashRows: string;
  expenseRows: string;
  huidRows: string;
  refineryRows: string;
  bankRows: string;
  marketDueRows: string;
  corporateExpenseRows: string;
  exportFileName?: string;
  exportContentType?: string;
  hasExportAttachment?: boolean;
  exportGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const BRANCHES: Branch[] = [];

const SHEETS: SheetName[] = [
  'Basic Info',
  'Cash Part',
  'Expenses Details',
  'Refinery Part',
  'Bank Sheet',
  'HUID Billing Details',
  'Market Due List',
  'Corporate Expenses',
];

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function readRecords(): BusinessRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as BusinessRecord[];
  } catch {
    return [];
  }
}

function parseRows<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapBusinessRecordApi(raw: BusinessRecordApi): BusinessRecord {
  return {
    id: raw.id,
    branchId: raw.branchRef,
    branchCode: raw.branchCode,
    branchName: raw.branchName,
    month: raw.month,
    year: raw.year,
    name: raw.name,
    createdAt: raw.createdAt,
    cashRows: parseRows<CashRow>(raw.cashRows),
    expenseRows: parseRows<ExpenseRow>(raw.expenseRows),
    huidRows: parseRows<HuidRow>(raw.huidRows),
    refineryRows: parseRows<RefineryRow>(raw.refineryRows),
    bankRows: parseRows<BankRow>(raw.bankRows),
    marketDueRows: parseRows<MarketDueRow>(raw.marketDueRows),
    corporateExpenseRows: parseRows<CorporateExpenseRow>(raw.corporateExpenseRows),
    exportFileName: raw.exportFileName,
    exportContentType: raw.exportContentType,
    hasExportAttachment: raw.hasExportAttachment,
    exportGeneratedAt: raw.exportGeneratedAt,
  };
}

function writeRecords(v: BusinessRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(v));
}

function formatName(branchName: string, year: number, month: number) {
  return `BR/${branchName}/${year}-${String(month).padStart(2, '0')}`;
}

function ymdParts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function dateRange(start: string, end: string): string[] {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const out: string[] = [];
  const d = new Date(s);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function hashCode(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function makeLiveSource(branchCode: string, date: string) {
  const seed = hashCode(`${branchCode}-${date}`);
  const cash = (seed % 9000) + 1000;
  const expense = (seed % 1200) + 200;
  const huidQty = (seed % 20) + 1;
  const huidAmount = huidQty * 95;
  const gross = ((seed % 2000) + 500) / 10;
  const pure = Number((gross * 0.916).toFixed(3));

  return {
    cash,
    expense,
    huidQty,
    huidAmount,
    refineryGross: Number(gross.toFixed(3)),
    refineryPure: pure,
  };
}

function createRecord(branch: Branch, month: number, year: number): BusinessRecord {
  return {
    id: uuid(),
    branchId: branch.id,
    branchCode: branch.code,
    branchName: branch.name,
    month,
    year,
    name: formatName(branch.name, year, month),
    createdAt: new Date().toISOString(),
    cashRows: [],
    expenseRows: [],
    huidRows: [],
    refineryRows: [],
    bankRows: [],
    marketDueRows: [],
    corporateExpenseRows: [],
  };
}

export default function BusinessRecordsDesk() {
  const [records, setRecords] = useState<BusinessRecord[]>(() => readRecords());
  const [branches, setBranches] = useState<Branch[]>(BRANCHES);

  useEffect(() => {
    api<any[]>(ADM_BRANCHES)
      .then(data => setBranches(data.filter((b: any) => b.active).map((b: any) => ({ id: b.id, code: b.code, name: b.name }))))
      .catch(() => {});
    api<BusinessRecordApi[]>(`${REC_BASE}/business-records`)
      .then((rows) => {
        const mapped = rows.map(mapBusinessRecordApi);
        setRecords(mapped);
      })
      .catch(() => {
        // Keep local fallback if backend is temporarily unavailable.
      });
  }, []);

  const [createBranchId, setCreateBranchId] = useState('');
  const [createMonth, setCreateMonth] = useState('1');
  const [createYear, setCreateYear] = useState('2026');

  const [twBranchId, setTwBranchId] = useState('');
  const [twStartDate, setTwStartDate] = useState('2026-01-01');
  const [twEndDate, setTwEndDate] = useState('2026-01-01');

  const [exBranchId, setExBranchId] = useState('');
  const [exStartDate, setExStartDate] = useState('2026-01-01');
  const [exEndDate, setExEndDate] = useState('2026-01-31');

  const [selectedId, setSelectedId] = useState('');
  const [editingCash, setEditingCash] = useState<Record<string, string>>({});

  const selected = useMemo(() => records.find((r) => r.id === selectedId) || null, [records, selectedId]);

  useEffect(() => {
    writeRecords(records);
  }, [records]);

  async function createMonthlyRecord() {
    const branch = branches.find((b) => b.id === createBranchId);
    const month = Number(createMonth);
    const year = Number(createYear);

    if (!branch) {
      toast.err('Branch is required.');
      return;
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      toast.err('Month must be 1 to 12.');
      return;
    }
    if (!Number.isFinite(year) || year < 2000) {
      toast.err('Year is invalid.');
      return;
    }

    const duplicate = records.find((r) => r.branchId === branch.id && r.month === month && r.year === year);
    if (duplicate) {
      toast.err('Duplicate rejected: only one record per branch + month + year is allowed.');
      return;
    }

    let created: BusinessRecordApi;
    try {
      created = await api<BusinessRecordApi>(`${REC_BASE}/business-records`, {
        method: 'POST',
        body: JSON.stringify({
          branchRef: branch.id,
          branchCode: branch.code,
          branchName: branch.name,
          month,
          year,
          name: formatName(branch.name, year, month),
        }),
      });
    } catch (e: any) {
      toast.err(e.message || 'Failed to create monthly record');
      return;
    }

    const rec = mapBusinessRecordApi(created);
    setRecords((prev) => [rec, ...prev]);
    setSelectedId(rec.id);
    // Post a daybook entry for this record creation
    api(`${REC_BASE}/daybook`, {
      method: 'POST',
      body: JSON.stringify({ entryDate: `${year}-${String(month).padStart(2,'0')}-01`, branchId: NIL_UUID, module: 'RECORDS', txnType: 'MONTHLY_OPEN', referenceNo: rec.name, referenceId: rec.id, partyId: NIL_UUID, partyName: branch.name, narration: `Monthly record opened: ${rec.name}`, metalInG: 0, metalOutG: 0, amountIn: 0, amountOut: 0 }),
    }).catch(() => {});
    toast.ok(`Business Record created: ${rec.name}`);
  }

  function upsertMonthlyRecord(branch: Branch, month: number, year: number, base: BusinessRecord[]) {
    const existing = base.find((r) => r.branchId === branch.id && r.month === month && r.year === year);
    if (existing) return existing;
    return createRecord(branch, month, year);
  }

  async function runTransfer() {
    const branch = branches.find((b) => b.id === twBranchId);
    if (!branch) {
      toast.err('Transfer wizard needs a branch.');
      return;
    }
    if (!twStartDate || !twEndDate || twStartDate > twEndDate) {
      toast.err('Date range is invalid.');
      return;
    }

    const days = dateRange(twStartDate, twEndDate);
    const daySet = new Set(days);

    let next = [...records];
    const touched: Record<string, BusinessRecord> = {};

    // Build/reuse month records touched by range.
    for (const day of days) {
      const { y, m } = ymdParts(day);
      const key = `${branch.id}-${y}-${m}`;
      if (touched[key]) continue;

      let rec = next.find((r) => r.branchId === branch.id && r.month === m && r.year === y);
      if (!rec) {
        try {
          const created = await api<BusinessRecordApi>(`${REC_BASE}/business-records`, {
            method: 'POST',
            body: JSON.stringify({
              branchRef: branch.id,
              branchCode: branch.code,
              branchName: branch.name,
              month: m,
              year: y,
              name: formatName(branch.name, y, m),
            }),
          });
          rec = mapBusinessRecordApi(created);
          next = [rec, ...next];
        } catch {
          rec = createRecord(branch, m, y);
          next = [rec, ...next];
        }
      }
      touched[key] = rec;
    }

    // Idempotency: delete rows in same date window, then rebuild.
    next = next.map((r) => {
      if (r.branchId !== branch.id) return r;
      const recKey = `${r.branchId}-${r.year}-${r.month}`;
      if (!touched[recKey]) return r;

      const filteredCash = r.cashRows.filter((x) => !daySet.has(x.date));
      const filteredExp = r.expenseRows.filter((x) => !daySet.has(x.date));
      const filteredHuid = r.huidRows.filter((x) => !daySet.has(x.date));
      const filteredRefinery = r.refineryRows.filter((x) => !daySet.has(x.date));
      const filteredBank = r.bankRows.filter((x) => !daySet.has(x.date));

      return {
        ...r,
        cashRows: filteredCash,
        expenseRows: filteredExp,
        huidRows: filteredHuid,
        refineryRows: filteredRefinery,
        bankRows: filteredBank,
      };
    });

    // Rebuild from deterministic live-source simulation.
    for (const day of days) {
      const { y, m } = ymdParts(day);
      const rec = next.find((r) => r.branchId === branch.id && r.year === y && r.month === m);
      if (!rec) continue;
      const src = makeLiveSource(branch.code, day);

      rec.cashRows.push({ id: uuid(), date: day, source: 'LIVE_CASH', amount: src.cash });
      rec.expenseRows.push({ id: uuid(), date: day, source: 'LIVE_EXPENSE', amount: src.expense });
      rec.huidRows.push({ id: uuid(), date: day, source: 'LIVE_HUID', quantity: src.huidQty, amount: src.huidAmount });
      rec.refineryRows.push({ id: uuid(), date: day, source: 'LIVE_REFINERY', grossG: src.refineryGross, pureG: src.refineryPure });
      rec.bankRows.push({ id: uuid(), date: day, account: 'Main', debit: src.expense, credit: src.cash });
    }

    setRecords([...next]);

    // Persist touched records to backend.
    for (const rec of next.filter((r) => r.branchId === branch.id)) {
      const recKey = `${rec.branchId}-${rec.year}-${rec.month}`;
      if (!touched[recKey]) continue;
      await api(`${REC_BASE}/business-records/${rec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          cashRows: JSON.stringify(rec.cashRows),
          expenseRows: JSON.stringify(rec.expenseRows),
          huidRows: JSON.stringify(rec.huidRows),
          refineryRows: JSON.stringify(rec.refineryRows),
          bankRows: JSON.stringify(rec.bankRows),
        }),
      }).catch(() => {});
    }

    // Post summary daybook entries to backend (one per day, fire-and-forget)
    const branchRef = branches.find((b) => b.id === twBranchId);
    if (branchRef) {
      const days2 = dateRange(twStartDate, twEndDate);
      for (const day of days2) {
        const src = makeLiveSource(branchRef.code, day);
        api(`${REC_BASE}/daybook`, {
          method: 'POST',
          body: JSON.stringify({ entryDate: day, branchId: NIL_UUID, module: 'RECORDS', txnType: 'DAILY_TRANSFER', referenceNo: `TW-${day}`, referenceId: NIL_UUID, partyId: NIL_UUID, partyName: branchRef.name, narration: `Daily transfer ${day}`, metalInG: src.refineryPure, metalOutG: 0, amountIn: src.cash, amountOut: src.expense }),
        }).catch(() => {});
      }
    }

    toast.ok('Transfer completed. Data rebuilt from live-source models for selected date range.');
  }

  async function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function inferFileNameFromDisposition(disposition: string | null, fallback: string) {
    if (!disposition) return fallback;
    const m = disposition.match(/filename="?([^";]+)"?/i);
    return m && m[1] ? m[1] : fallback;
  }

  async function refreshRecords() {
    const rows = await api<BusinessRecordApi[]>(`${REC_BASE}/business-records`);
    setRecords(rows.map(mapBusinessRecordApi));
  }

  async function runExportWizard(branchCode: string, fromDate: string, toDate: string) {
    if (!branchCode) {
      toast.err('Export requires a branch filter.');
      return;
    }
    if (!fromDate || !toDate || fromDate > toDate) {
      toast.err('Export date range is invalid.');
      return;
    }

    const res = await fetch(`${REC_BASE}/business-records/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchCode, fromDate, toDate }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Export failed');
    }

    const blob = await res.blob();
    const fileName = inferFileNameFromDisposition(
      res.headers.get('Content-Disposition'),
      `records_${branchCode}_${fromDate}_${toDate}.xlsx`,
    );

    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify({ fileName, branchCode, fromDate, toDate, at: new Date().toISOString() }));
    await downloadBlob(blob, fileName);
    await refreshRecords().catch(() => {});
    toast.ok('Workbook built in memory, stored as attachment, and downloaded.');
  }

  async function exportRecord(rec: BusinessRecord) {
    const fromDate = `${rec.year}-${String(rec.month).padStart(2, '0')}-01`;
    const last = new Date(rec.year, rec.month, 0).getDate();
    const toDate = `${rec.year}-${String(rec.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    await runExportWizard(rec.branchCode, fromDate, toDate);
  }

  async function reDownloadExport(rec: BusinessRecord) {
    const res = await fetch(`${REC_BASE}/business-records/${rec.id}/export/download`);
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Download failed');
    }
    const blob = await res.blob();
    const fileName = inferFileNameFromDisposition(
      res.headers.get('Content-Disposition'),
      rec.exportFileName || `${rec.name.replaceAll('/', '_')}.xlsx`,
    );
    await downloadBlob(blob, fileName);
    toast.ok('Attachment downloaded from record.');
  }

  async function onWizardExportClick() {
    const b = branches.find((x) => x.id === exBranchId);
    if (!b) {
      toast.err('Select a branch for export.');
      return;
    }
    await runExportWizard(b.code, exStartDate, exEndDate);
  }

  async function saveCashEdit(rowId: string) {
    if (!selected) return;
    const nextValue = Number(editingCash[rowId]);
    if (!Number.isFinite(nextValue)) {
      toast.err('Cash row value is invalid.');
      return;
    }

    const nextRows = selected.cashRows.map((c) => (c.id === rowId ? { ...c, amount: nextValue } : c));

    setRecords((prev) => prev.map((r) => (
      r.id === selected.id ? { ...r, cashRows: nextRows } : r
    )));

    await api(`${REC_BASE}/business-records/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ cashRows: JSON.stringify(nextRows) }),
    }).catch(() => {});

    toast.ok('Manual correction saved.');
  }

  const createNamePreview = useMemo(() => {
    const branch = branches.find((b) => b.id === createBranchId);
    const month = Number(createMonth || '1');
    const year = Number(createYear || '2026');
    if (!branch) return '';
    return formatName(branch.name, year, month);
  }, [createBranchId, createMonth, createYear, branches]);

  const recordsByDate = useMemo(() => {
    if (!selected) return [] as string[];
    return Array.from(new Set(selected.cashRows.map((r) => r.date))).sort();
  }, [selected]);

  return (
    <div>
      <PageHeader title="Business Records Desk" subtitle="Monthly Records · Transfer Wizard · Notebook Edits · Export" />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Monthly Records" value={records.length} accent="bg-gradient-to-br from-sky-500 to-indigo-500" />
        <Stat label="Cash Rows" value={records.reduce((s, r) => s + r.cashRows.length, 0)} accent="bg-gradient-to-br from-sky-500 to-indigo-500" />
        <Stat label="Expense Rows" value={records.reduce((s, r) => s + r.expenseRows.length, 0)} accent="bg-gradient-to-br from-sky-500 to-indigo-500" />
        <Stat label="HUID Rows" value={records.reduce((s, r) => s + r.huidRows.length, 0)} accent="bg-gradient-to-br from-sky-500 to-indigo-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Create Monthly Record</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Branch
              <select id="brCreateBranch" className="input" value={createBranchId} onChange={(e) => setCreateBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Month
              <input id="brCreateMonth" className="input" type="number" min="1" max="12" value={createMonth} onChange={(e) => setCreateMonth(e.target.value)} />
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Year
              <input id="brCreateYear" className="input" type="number" min="2000" value={createYear} onChange={(e) => setCreateYear(e.target.value)} />
            </label>
          </div>

          <p className="text-xs text-nexus-muted mt-2">Auto Name: <span id="brNamePreview" className="text-white">{createNamePreview || '—'}</span></p>

          <div className="mt-3">
            <button id="brCreateBtn" className="btn-primary" onClick={createMonthlyRecord}>Create Business Record</button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Transfer Data Wizard</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Branch
              <select id="brTwBranch" className="input" value={twBranchId} onChange={(e) => setTwBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Start Date
              <input id="brTwStart" className="input" type="date" value={twStartDate} onChange={(e) => setTwStartDate(e.target.value)} />
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">End Date
              <input id="brTwEnd" className="input" type="date" value={twEndDate} onChange={(e) => setTwEndDate(e.target.value)} />
            </label>
          </div>

          <div className="mt-3">
            <button id="brTwRun" className="btn-primary" onClick={runTransfer}>Run Transfer</button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Export Wizard</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Branch
              <select id="brExBranch" className="input" value={exBranchId} onChange={(e) => setExBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">Start Date
              <input id="brExStart" className="input" type="date" value={exStartDate} onChange={(e) => setExStartDate(e.target.value)} />
            </label>
            <label className="text-xs text-nexus-muted flex flex-col gap-1">End Date
              <input id="brExEnd" className="input" type="date" value={exEndDate} onChange={(e) => setExEndDate(e.target.value)} />
            </label>
          </div>
          <div className="mt-3">
            <button id="brExRun" className="btn-primary" onClick={() => onWizardExportClick().catch((e) => toast.err(e.message || 'Export failed'))}>Export</button>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">Monthly Records</h3>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Branch</th><th>Month</th><th>Year</th><th>Cash</th><th>Expenses</th><th>HUID</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={8} className="text-center text-nexus-muted">No business records</td></tr>}
              {records.map((r) => (
                <tr key={r.id}>
                  <td id={`brRecordName-${r.id}`}>{r.name}</td>
                  <td>{r.branchCode}</td>
                  <td>{r.month}</td>
                  <td>{r.year}</td>
                  <td id={`brCashCount-${r.id}`}>{r.cashRows.length}</td>
                  <td>{r.expenseRows.length}</td>
                  <td id={`brHuidCount-${r.id}`}>{r.huidRows.length}</td>
                  <td className="flex gap-2">
                    <button id={`brOpen-${r.id}`} className="btn" onClick={() => setSelectedId(r.id)}>Open</button>
                    <button id={`brExport-${r.id}`} className="btn" onClick={() => exportRecord(r).catch((e) => toast.err(e.message || 'Export failed'))}>Export</button>
                    {r.hasExportAttachment && (
                      <button id={`brExportDownload-${r.id}`} className="btn" onClick={() => reDownloadExport(r).catch((e) => toast.err(e.message || 'Download failed'))}>Re-download</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-1">Notebook Pages — {selected.name}</h3>
          <p className="text-xs text-nexus-muted mb-3">Transferred rows are editable for manual correction.</p>

          <div className="grid md:grid-cols-8 gap-2 mb-3 text-xs">
            {SHEETS.map((s) => (
              <div key={s} className="px-2 py-1 rounded border border-nexus-line text-nexus-muted">{s}</div>
            ))}
          </div>

          <h4 className="text-sm font-semibold mb-2">Cash Part</h4>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Source</th><th>Amount</th><th>Actions</th></tr></thead>
              <tbody>
                {selected.cashRows.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No cash rows</td></tr>}
                {selected.cashRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.source}</td>
                    <td>
                      <input
                        id={`brCashAmount-${row.id}`}
                        className="input"
                        type="number"
                        value={editingCash[row.id] ?? String(row.amount)}
                        onChange={(e) => setEditingCash((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button id={`brCashSave-${row.id}`} className="btn" onClick={() => saveCashEdit(row.id)}>Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p id="brRecordDays" className="text-xs text-nexus-muted mt-3">Dates in record: {recordsByDate.join(', ') || '—'}</p>
        </div>
      )}
    </div>
  );
}
