import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

type LaserStage = 'DRAFT' | 'MARKING' | 'DONE';

type LaserItem = {
  id: string;
  name: string;
  qty: number;
};

type MarkingLine = {
  id: string;
  itemId: string;
  itemName: string;
  pieceNo: number;
  totalRemarked: number;
};

type LaserTransactionType = 'Non-HUID' | 'Seal' | 'General';

type LaserTransaction = {
  id: string;
  orderId: string;
  type: LaserTransactionType;
  nonHuidQty: number;
  sealQty: number;
  totalMarkings: number;
  createdAt: string;
};

type LaserReport = {
  id: string;
  fileName: string;
  totalPartNum: number;
  currentPartNumber: number;
  previousPartNumber: number;
  difference: number; // Current - Previous
  date: string;
  createdAt: string;
};

type ValidationRecord = {
  date: string;
  softwareCount: number;
  machinePartNumber: number;
  previousPartNumber: number;
  reportDifference: number;
  validationDifference: number; // Software - Machine
  huidMarkings: number;
  refreshedAt: string;
};

type HmRequest = {
  status?: string;
  createdAt?: string;
  huidMarkingStartedAt?: string;
  tagIds?: Record<string, string>;
};

type LaserJob = {
  id: string;
  orderId: string;
  metalType: string;
  branch: string;
  customer: string;
  markingType: string;
  items: LaserItem[];
  totalMarkings: number;
  stage: LaserStage;
  markingLines: MarkingLine[];
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
};

const JOBS_KEY = 'nexus.react.laser.jobs.v1'; // hybrid: backend primary, localStorage for active
const TXN_KEY = 'nexus.react.laser.transactions.v1';
const REPORTS_KEY = 'nexus.react.laser.reports.v1';
const VALIDATION_KEY = 'nexus.react.laser.validation.v1';
const HM_REQS_KEY = 'nexus.react.hm.requests.v1';
const LASER_BASE = '/api/laser/api/v1/laser';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function beStatusToStage(status: string): LaserStage {
  if (status === 'IN_PROGRESS' || status === 'IN_QUEUE') return 'MARKING';
  if (status === 'COMPLETED' || status === 'DELIVERED') return 'DONE';
  return 'DRAFT';
}
function mapLaserJob(b: any): LaserJob {
  let r: any = {};
  try { r = JSON.parse(b.remarks || '{}'); } catch {}
  const items: LaserItem[] = (r.items || []).map((i: any) => ({ id: i.id || b.id, name: i.n || '', qty: Number(i.q) || 0 }));
  const totalMarkings = items.reduce((s, i) => s + i.qty, 0) || Number(b.pieceCount) || 0;
  return {
    id: b.id, orderId: b.jobNumber || b.id,
    metalType: r.mt || '', branch: r.br || '', customer: r.cu || '',
    markingType: r.mkt || b.markingText || '', items, totalMarkings,
    stage: r.stg ? r.stg as LaserStage : beStatusToStage(b.status),
    markingLines: [], transactionId: r.txnId,
    createdAt: b.createdAt || new Date().toISOString(),
    updatedAt: b.updatedAt || new Date().toISOString(),
  };
}

const BRANCHES = ['MUM', 'BLR', 'DEL'];
const METALS = ['Gold', 'Silver', 'Platinum'];
const MARKING_TYPES = ['HUID', 'Non-HUID Engraving', 'Seal', 'Logo'];

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function now() {
  return new Date().toISOString();
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function persist<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nextSeq(jobs: LaserJob[]): number {
  return jobs.reduce((max, job) => {
    const parts = job.orderId.split('-');
    if (parts.length < 4) return max;
    const seq = Number(parts[2]);
    if (Number.isNaN(seq)) return max;
    return Math.max(max, seq);
  }, 0) + 1;
}

function buildOrderId(seq: number, totalMarkings: number): string {
  return `WH-HM-${String(seq).padStart(4, '0')}-${String(totalMarkings).padStart(3, '0')}`;
}

function markingTypeToTransactionType(markingType: string): LaserTransactionType {
  const value = markingType.toLowerCase();
  if (value.includes('non-huid')) return 'Non-HUID';
  if (value.includes('seal')) return 'Seal';
  return 'General';
}

export default function LaserMarkingDesk() {
  const [jobs, setJobs] = useState<LaserJob[]>(() => read<LaserJob[]>(JOBS_KEY, []));

  // Load jobs from backend on mount, merge with localStorage active jobs
  useEffect(() => {
    api<any[]>(`${LASER_BASE}/jobs`)
      .then(data => {
        const beJobs = data.map(mapLaserJob);
        setJobs(prev => {
          const active = prev.filter(j => j.stage !== 'DONE');
          const beIds = new Set(beJobs.map(j => j.id));
          // For active jobs already in backend, merge markingLines from localStorage
          const merged = beJobs.map(bj => {
            const local = active.find(lj => lj.id === bj.id);
            return local ? { ...bj, markingLines: local.markingLines, stage: local.stage } : bj;
          });
          const localOnlyActive = active.filter(j => !beIds.has(j.id));
          const result = [...merged, ...localOnlyActive];
          persist(JOBS_KEY, result);
          return result;
        });
      })
      .catch(() => {});
  }, []);

  const [transactions, setTransactions] = useState<LaserTransaction[]>(() => read<LaserTransaction[]>(TXN_KEY, []));
  const [reports, setReports] = useState<LaserReport[]>(() => read<LaserReport[]>(REPORTS_KEY, []));

  // Load transactions from backend on mount
  useEffect(() => {
    api<any[]>(`${LASER_BASE}/transactions`)
      .then(data => {
        const transformed: LaserTransaction[] = data.map((t: any) => {
          const typeMap: Record<string, LaserTransactionType> = {
            'NON_HUID': 'Non-HUID',
            'SEAL': 'Seal',
            'GENERAL': 'General'
          };
          return {
            id: t.id,
            orderId: t.orderId,
            type: typeMap[t.type] || 'General',
            nonHuidQty: t.nonHuidQty,
            sealQty: t.sealQty,
            totalMarkings: t.totalMarkings,
            createdAt: t.createdAt || new Date().toISOString(),
          };
        });
        setTransactions(transformed);
        persist(TXN_KEY, transformed);
      })
      .catch(() => {});
  }, []);

  // Load reports from backend on mount
  useEffect(() => {
    api<any[]>(`${LASER_BASE}/reports`)
      .then(data => {
        const transformed = data.map((r: any) => ({
          id: r.id,
          fileName: r.fileName,
          totalPartNum: r.totalPartNum,
          currentPartNumber: r.currentPartNumber,
          previousPartNumber: r.previousPartNumber,
          difference: r.difference,
          date: r.reportDate,
          createdAt: r.createdAt || new Date().toISOString(),
        }));
        setReports(transformed);
        persist(REPORTS_KEY, transformed);
      })
      .catch(() => {});
  }, []);

  const [validations, setValidations] = useState<ValidationRecord[]>(() => read<ValidationRecord[]>(VALIDATION_KEY, []));

  const [activeTab, setActiveTab] = useState<'reception' | 'marking' | 'transactions' | 'reports' | 'validation'>('reception');
  const [selectedMarkingJobId, setSelectedMarkingJobId] = useState<string>('');
  const [reportFile, setReportFile] = useState<File | null>(null);

  const [metalType, setMetalType] = useState('');
  const [branch, setBranch] = useState('BLR');
  const [customer, setCustomer] = useState('');
  const [markingType, setMarkingType] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [items, setItems] = useState<LaserItem[]>([]);

  const [errors, setErrors] = useState<{ metalType?: string }>({});

  const totalMarkings = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items],
  );

  const orderIdPreview = useMemo(
    () => buildOrderId(nextSeq(jobs), totalMarkings),
    [jobs, totalMarkings],
  );

  const selectedMarkingJob = useMemo(
    () => jobs.find((job) => job.id === selectedMarkingJobId) ?? null,
    [jobs, selectedMarkingJobId],
  );

  const todayValidation = useMemo(
    () => validations.find((v) => v.date === todayYmd()) ?? null,
    [validations],
  );

  const stats = useMemo(() => ({
    total: jobs.length,
    draft: jobs.filter((j) => j.stage === 'DRAFT').length,
    marking: jobs.filter((j) => j.stage === 'MARKING').length,
    done: jobs.filter((j) => j.stage === 'DONE').length,
  }), [jobs]);

  function saveJobs(next: LaserJob[]) {
    setJobs(next);
    persist(JOBS_KEY, next);
  }

  function saveTransactions(next: LaserTransaction[]) {
    setTransactions(next);
    persist(TXN_KEY, next);
  }

  function saveReports(next: LaserReport[]) {
    setReports(next);
    persist(REPORTS_KEY, next);
  }

  function saveValidations(next: ValidationRecord[]) {
    setValidations(next);
    persist(VALIDATION_KEY, next);
  }

  function getTodaySoftwareCount(): number {
    const today = todayYmd();
    return transactions
      .filter((t) => t.createdAt.startsWith(today))
      .reduce((sum, t) => sum + t.totalMarkings, 0);
  }

  function getTodayHuidCountFromHallmarking(): number {
    const today = todayYmd();
    const hmReqs = read<HmRequest[]>(HM_REQS_KEY, []);
    return hmReqs
      .filter((r) => {
        if (r.status !== 'COMPLETE') return false;
        const createdToday = (r.createdAt || '').startsWith(today);
        const huidStartedToday = (r.huidMarkingStartedAt || '').startsWith(today);
        return createdToday || huidStartedToday;
      })
      .reduce((sum, r) => sum + Object.keys(r.tagIds || {}).length, 0);
  }

  function refreshValidation() {
    const date = todayYmd();
    const softwareCount = getTodaySoftwareCount();
    const huidMarkings = getTodayHuidCountFromHallmarking();

    const existing = validations.find((v) => v.date === date);
    const machinePartNumber = existing?.machinePartNumber ?? 0;
    const previousPartNumber = existing?.previousPartNumber ?? 0;
    const reportDifference = existing?.reportDifference ?? (machinePartNumber - previousPartNumber);

    const refreshed: ValidationRecord = {
      date,
      softwareCount,
      machinePartNumber,
      previousPartNumber,
      reportDifference,
      validationDifference: softwareCount - machinePartNumber,
      huidMarkings,
      refreshedAt: now(),
    };

    const next = existing
      ? validations.map((v) => (v.date === date ? refreshed : v))
      : [...validations, refreshed];

    saveValidations(next);
  }

  useEffect(() => {
    if (activeTab === 'validation') {
      refreshValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, transactions]);

  function resetForm() {
    setMetalType('');
    setBranch('BLR');
    setCustomer('');
    setMarkingType('');
    setItemName('');
    setItemQty('1');
    setItems([]);
    setErrors({});
  }

  function addItemLine() {
    const qty = Number(itemQty);
    if (!itemName.trim()) {
      toast.err('Item name is required');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.err('Item Qty must be a positive integer');
      return;
    }

    setItems((prev) => [
      ...prev,
      { id: uuid(), name: itemName.trim(), qty },
    ]);
    setItemName('');
    setItemQty('1');
  }

  async function createDraftJob() {
    if (!metalType) {
      setErrors({ metalType: 'Metal Type is required.' });
      toast.err('Metal Type is required.');
      return;
    }
    setErrors({});
    if (!branch || !customer.trim() || !markingType || items.length === 0 || totalMarkings <= 0) {
      toast.err('Fill all mandatory fields and add at least one item line');
      return;
    }
    const seq = nextSeq(jobs);
    const orderId = buildOrderId(seq, totalMarkings);
    const remarksData = { stg: 'DRAFT', mt: metalType, br: branch, cu: customer.trim(), mkt: markingType, items: items.map(i => ({ id: i.id, n: i.name, q: i.qty })) };
    let backendId: string;
    try {
      const created = await api<any>(`${LASER_BASE}/jobs`, {
        method: 'POST',
        body: JSON.stringify({ jobNumber: orderId, branchId: NIL_UUID, customerId: NIL_UUID, receivedDate: new Date().toISOString().slice(0, 10), pieceCount: totalMarkings, markingText: markingType, remarks: JSON.stringify(remarksData) }),
      });
      backendId = created.id;
    } catch (e: any) { toast.err(e.message || 'Failed to save job'); return; }

    const job: LaserJob = { id: backendId, orderId, metalType, branch, customer: customer.trim(), markingType, items, totalMarkings, stage: 'DRAFT', markingLines: [], createdAt: now(), updatedAt: now() };
    saveJobs([...jobs, job]);
    toast.ok(`Laser job ${orderId} saved in Draft`);
    resetForm();
  }

  async function startMarking(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const lines: MarkingLine[] = [];
    job.items.forEach((item) => {
      for (let piece = 1; piece <= item.qty; piece += 1) {
        lines.push({ id: uuid(), itemId: item.id, itemName: item.name, pieceNo: piece, totalRemarked: 1 });
      }
    });

    const next = jobs.map((j) => j.id === jobId ? { ...j, stage: 'MARKING' as LaserStage, markingLines: lines, updatedAt: now() } : j);
    saveJobs(next);
    setActiveTab('marking');
    setSelectedMarkingJobId(jobId);
    // Update backend status
    api(`${LASER_BASE}/jobs/${jobId}/status?status=IN_PROGRESS`, { method: 'PATCH' }).catch(() => {});
    toast.ok(`Start Marking: ${lines.length} marking lines generated`);
  }

  function updateRemarked(jobId: string, lineId: string, value: string) {
    const parsed = Number(value);
    const next = jobs.map((job) => {
      if (job.id !== jobId) return job;
      return {
        ...job,
        markingLines: job.markingLines.map((line) => {
          if (line.id !== lineId) return line;
          return {
            ...line,
            totalRemarked: Number.isNaN(parsed) ? 0 : parsed,
          };
        }),
        updatedAt: now(),
      };
    });
    saveJobs(next);
  }

  function saveMarkingLines(jobId: string) {
    let resetApplied = false;
    const next = jobs.map((job) => {
      if (job.id !== jobId) return job;
      return {
        ...job,
        markingLines: job.markingLines.map((line) => {
          if (line.totalRemarked <= 0) {
            resetApplied = true;
            return { ...line, totalRemarked: 1 };
          }
          return line;
        }),
        updatedAt: now(),
      };
    });

    saveJobs(next);
    if (resetApplied) {
      toast.warn('Total Remarked cannot be zero. Reset to 1.');
    } else {
      toast.ok('Marking lines saved');
    }
  }

  async function completeMarking(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const typeEnum = job.markingType.toLowerCase().includes('non-huid') ? 'NON_HUID' : job.markingType.toLowerCase().includes('seal') ? 'SEAL' : 'GENERAL';
    const type = typeEnum === 'NON_HUID' ? 'Non-HUID' : typeEnum === 'SEAL' ? 'Seal' : 'General';
    
    let txnId: string;
    try {
      const created = await api<any>(`${LASER_BASE}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          orderId: job.orderId,
          type: typeEnum,
          nonHuidQty: typeEnum === 'NON_HUID' ? job.totalMarkings : 0,
          sealQty: typeEnum === 'SEAL' ? job.totalMarkings : 0,
          totalMarkings: job.totalMarkings,
        }),
      });
      txnId = created.id;
    } catch (e: any) { toast.err(e.message || 'Failed to save transaction'); return; }

    const tx: LaserTransaction = { id: txnId, orderId: job.orderId, type, nonHuidQty: typeEnum === 'NON_HUID' ? job.totalMarkings : 0, sealQty: typeEnum === 'SEAL' ? job.totalMarkings : 0, totalMarkings: job.totalMarkings, createdAt: now() };

    const nextTx = [...transactions, tx];
    saveTransactions(nextTx);

    const nextJobs = jobs.map((j) => j.id === jobId ? { ...j, stage: 'DONE' as LaserStage, transactionId: txnId, updatedAt: now() } : j);
    saveJobs(nextJobs);

    // Update backend: PATCH status to COMPLETED and POST marks
    try {
      await api(`${LASER_BASE}/jobs/${jobId}/status?status=COMPLETED`, { method: 'PATCH' });
      for (const line of job.markingLines) {
        await api(`${LASER_BASE}/marks`, { method: 'POST', body: JSON.stringify({ jobId, pieceNo: line.pieceNo, engravedText: line.itemName, operatorName: '' }) }).catch(() => {});
      }
    } catch (_) {}

    toast.ok(`Marking completed. Transaction type: ${tx.type}`);
  }

  async function saveMarkcfgReport() {
    if (!reportFile) {
      toast.err('Upload a valid .markcfg file');
      return;
    }

    if (!reportFile.name.toLowerCase().endsWith('.markcfg')) {
      toast.err('Only .markcfg files are supported');
      return;
    }

    const text = await reportFile.text();
    const match = text.match(/TOTALPARTNUM\s*[:=]\s*(\d+)/i) || text.match(/TOTALPARTNUM[^\d]*(\d+)/i);
    if (!match) {
      toast.err('TOTALPARTNUM not found in file');
      return;
    }

    const currentPartNumber = Number(match[1]);
    if (!Number.isFinite(currentPartNumber)) {
      toast.err('Invalid TOTALPARTNUM value');
      return;
    }

    const prevCurrent = reports.length > 0 ? reports[reports.length - 1].currentPartNumber : 0;
    const difference = currentPartNumber - prevCurrent;
    const date = todayYmd();

    let reportId: string;
    try {
      const created = await api<any>(`${LASER_BASE}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: reportFile.name,
          totalPartNum: currentPartNumber,
          currentPartNumber,
          previousPartNumber: prevCurrent,
          difference,
          reportDate: date,
        }),
      });
      reportId = created.id;
    } catch (e: any) { toast.err(e.message || 'Failed to save report'); return; }

    const report: LaserReport = {
      id: reportId,
      fileName: reportFile.name,
      totalPartNum: currentPartNumber,
      currentPartNumber,
      previousPartNumber: prevCurrent,
      difference,
      date,
      createdAt: now(),
    };

    const nextReports = [...reports, report];
    saveReports(nextReports);

    const softwareCount = getTodaySoftwareCount();
    const huidMarkings = getTodayHuidCountFromHallmarking();

    const updatedValidation: ValidationRecord = {
      date,
      softwareCount,
      machinePartNumber: currentPartNumber,
      previousPartNumber: prevCurrent,
      reportDifference: difference,
      validationDifference: softwareCount - currentPartNumber,
      huidMarkings,
      refreshedAt: now(),
    };

    const existing = validations.find((v) => v.date === date);
    const nextValidations = existing
      ? validations.map((v) => (v.date === date ? updatedValidation : v))
      : [...validations, updatedValidation];
    saveValidations(nextValidations);

    setReportFile(null);
    toast.ok(`Report saved. TOTALPARTNUM=${currentPartNumber}, Difference=${difference}`);
  }

  return (
    <div>
      <PageHeader title="Laser Marking Desk" subtitle="Reception -> Marking -> Done" />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Total" value={stats.total} accent="bg-gradient-to-br from-fuchsia-500 to-rose-600" />
        <Stat label="Draft" value={stats.draft} accent="bg-gradient-to-br from-fuchsia-500 to-rose-600" />
        <Stat label="Marking" value={stats.marking} accent="bg-gradient-to-br from-fuchsia-500 to-rose-600" />
        <Stat label="Done" value={stats.done} accent="bg-gradient-to-br from-fuchsia-500 to-rose-600" />
      </div>

      <div className="flex gap-2 mb-4">
        <button id="lmTab-reception" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'reception' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('reception')}>
          Reception
        </button>
        <button id="lmTab-marking" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'marking' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('marking')}>
          Marking
        </button>
        <button id="lmTab-transactions" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'transactions' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('transactions')}>
          Transactions
        </button>
        <button id="lmTab-reports" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'reports' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('reports')}>
          Reports
        </button>
        <button id="lmTab-validation" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'validation' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('validation')}>
          Validation
        </button>
      </div>

      {activeTab === 'reception' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Reception Desk - New Laser Job</h3>

            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Metal Type*</label>
                <select id="lmMetalType" className="input" value={metalType} onChange={(e) => setMetalType(e.target.value)}>
                  <option value="">- Select -</option>
                  {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors.metalType && <div id="lmMetalTypeError" className="text-xs text-red-400 mt-1">{errors.metalType}</div>}
              </div>
              <div>
                <label className="label">Branch*</label>
                <select id="lmBranch" className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Customer*</label>
                <input id="lmCustomer" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer Name" />
              </div>
              <div>
                <label className="label">Type of Marking*</label>
                <select id="lmMarkingType" className="input" value={markingType} onChange={(e) => setMarkingType(e.target.value)}>
                  <option value="">- Select -</option>
                  {MARKING_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="card p-3 mb-3">
              <h4 className="text-xs font-semibold mb-2">Item Lines</h4>
              <div className="grid md:grid-cols-4 gap-3 mb-2">
                <div className="md:col-span-2">
                  <label className="label">Item Name</label>
                  <input id="lmItemName" className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item A" />
                </div>
                <div>
                  <label className="label">Qty</label>
                  <input id="lmItemQty" className="input" type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} min={1} />
                </div>
                <div className="flex items-end">
                  <button id="lmAddItem" className="btn-primary w-full" onClick={addItemLine}>Add Item</button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Item</th><th>Qty</th></tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={2} className="text-center text-nexus-muted">No item lines</td></tr>}
                    {items.map((item) => (
                      <tr key={item.id} id={`lmItemRow-${item.id}`}>
                        <td>{item.name}</td>
                        <td>{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mb-3 text-sm">
              <div id="lmTotalMarkingsPreview" className="p-2 rounded border border-nexus-line">Total Markings: <strong>{totalMarkings}</strong></div>
              <div id="lmOrderIdPreview" className="p-2 rounded border border-nexus-line">Order ID Preview: <strong>{orderIdPreview}</strong></div>
              <div className="p-2 rounded border border-nexus-line">Format: WH-HM-XXXX-YYY</div>
            </div>

            <button id="lmSaveDraft" className="btn-primary" onClick={createDraftJob}>Save Draft</button>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Laser Jobs Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Metal</th>
                    <th>Branch</th>
                    <th>Customer</th>
                    <th>Marking Type</th>
                    <th>Total Markings</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 && <tr><td colSpan={8} className="text-center text-nexus-muted">No jobs</td></tr>}
                  {jobs.map((job) => (
                    <tr key={job.id} id={`lmJobRow-${job.id}`}>
                      <td id={`lmOrderId-${job.id}`} className="font-mono text-xs">{job.orderId}</td>
                      <td>{job.metalType}</td>
                      <td>{job.branch}</td>
                      <td>{job.customer}</td>
                      <td id={`lmMarkingType-${job.id}`}>{job.markingType}</td>
                      <td id={`lmMarkings-${job.id}`}>{job.totalMarkings}</td>
                      <td id={`lmStage-${job.id}`}>{job.stage}</td>
                      <td>
                        {job.stage === 'DRAFT' && (
                          <button id={`lmStartMarking-${job.id}`} className="btn text-xs" onClick={() => startMarking(job.id)}>
                            Start Marking
                          </button>
                        )}
                        {job.stage === 'DONE' && (
                          <button id={`lmDone-${job.id}`} className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Marking Completed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'marking' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Marking Tab</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Select Job in Marking</label>
                <select id="lmMarkingJobSelect" className="input" value={selectedMarkingJobId} onChange={(e) => setSelectedMarkingJobId(e.target.value)}>
                  <option value="">- Select -</option>
                  {jobs.filter((j) => j.stage === 'MARKING').map((j) => (
                    <option key={j.id} value={j.id}>{j.orderId} - {j.customer}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedMarkingJob && <div className="text-sm text-nexus-muted">No marking job selected.</div>}

            {selectedMarkingJob && (
              <div>
                <div className="text-sm mb-3">Job: <strong>{selectedMarkingJob.orderId}</strong> | Type: <strong>{selectedMarkingJob.markingType}</strong></div>
                <div className="table-wrap mb-3">
                  <table className="tbl">
                    <thead>
                      <tr><th>Item</th><th>Piece</th><th>Total Remarked</th></tr>
                    </thead>
                    <tbody>
                      {selectedMarkingJob.markingLines.map((line) => (
                        <tr key={line.id} id={`lmLine-${line.id}`}>
                          <td>{line.itemName}</td>
                          <td id={`lmPieceLabel-${line.id}`}>Piece {line.pieceNo}</td>
                          <td>
                            <input
                              id={`lmRemarked-${line.id}`}
                              className="input"
                              type="number"
                              min={0}
                              value={line.totalRemarked}
                              onChange={(e) => updateRemarked(selectedMarkingJob.id, line.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button id={`lmSaveMarkingLines-${selectedMarkingJob.id}`} className="btn" onClick={() => saveMarkingLines(selectedMarkingJob.id)}>
                    Save Marking Lines
                  </button>
                  <button id={`lmMarkingCompleted-${selectedMarkingJob.id}`} className="btn-primary bg-emerald-600 hover:bg-emerald-500" onClick={() => completeMarking(selectedMarkingJob.id)}>
                    Marking Completed
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Laser Transactions</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>Non-HUID Qty</th>
                  <th>Seal Qty</th>
                  <th>Total Markings</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && <tr><td colSpan={7} className="text-center text-nexus-muted">No transactions</td></tr>}
                {transactions.map((tx) => (
                  <tr key={tx.id} id={`lmTxnRow-${tx.id}`}>
                    <td className="font-mono text-xs">{tx.id.slice(0, 8)}...</td>
                    <td id={`lmTxnOrderId-${tx.id}`} className="font-mono text-xs">{tx.orderId}</td>
                    <td id={`lmTxnType-${tx.id}`}>{tx.type}</td>
                    <td id={`lmTxnNonHuidQty-${tx.id}`}>{tx.nonHuidQty}</td>
                    <td id={`lmTxnSealQty-${tx.id}`}>{tx.sealQty}</td>
                    <td id={`lmTxnTotal-${tx.id}`}>{tx.totalMarkings}</td>
                    <td className="text-xs text-nexus-muted">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Reports - New</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="label">Upload .markcfg file</label>
                <input
                  id="lmReportFile"
                  className="input"
                  type="file"
                  accept=".markcfg"
                  onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex items-end">
                <button id="lmReportSave" className="btn-primary w-full" onClick={saveMarkcfgReport}>
                  Save Report
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Report Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>TOTALPARTNUM</th>
                    <th>Previous</th>
                    <th>Difference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No reports uploaded</td></tr>}
                  {reports.map((r) => (
                    <tr key={r.id} id={`lmReportRow-${r.id}`}>
                      <td id={`lmReportFileName-${r.id}`}>{r.fileName}</td>
                      <td id={`lmReportTotalPartNum-${r.id}`}>{r.totalPartNum}</td>
                      <td id={`lmReportPreviousPartNum-${r.id}`}>{r.previousPartNumber}</td>
                      <td id={`lmReportDifference-${r.id}`}>{r.difference}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Validation Dashboard</h3>
              <button id="lmValidationRefresh" className="btn" onClick={refreshValidation}>Refresh Validation</button>
            </div>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div id="lmValSoftwareCard" className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
                <div className="text-xs text-nexus-muted">Total Markings (Software)</div>
                <div id="lmValSoftwareCount" className="text-xl font-semibold text-emerald-300">{todayValidation?.softwareCount ?? 0}</div>
              </div>
              <div id="lmValMachineCard" className="p-3 rounded-lg border border-red-500/40 bg-red-500/10">
                <div className="text-xs text-nexus-muted">Total Part Number (Machine)</div>
                <div id="lmValMachineCount" className="text-xl font-semibold text-red-300">{todayValidation?.machinePartNumber ?? 0}</div>
              </div>
              <div id="lmValDiffCard" className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
                <div className="text-xs text-nexus-muted">Difference (Software - Machine)</div>
                <div id="lmValDifference" className="text-xl font-semibold text-amber-300">{todayValidation?.validationDifference ?? 0}</div>
              </div>
              <div id="lmValHuidCard" className="p-3 rounded-lg border border-sky-500/40 bg-sky-500/10">
                <div className="text-xs text-nexus-muted">HUID Markings (Hallmarking)</div>
                <div id="lmValHuidCount" className="text-xl font-semibold text-sky-300">{todayValidation?.huidMarkings ?? 0}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div id="lmValDate" className="p-2 rounded border border-nexus-line">Date: <strong>{todayValidation?.date ?? todayYmd()}</strong></div>
              <div id="lmValReportDiff" className="p-2 rounded border border-nexus-line">Report Difference (Current - Previous): <strong>{todayValidation?.reportDifference ?? 0}</strong></div>
              <div id="lmValRefreshedAt" className="p-2 rounded border border-nexus-line">Last Refreshed: <strong>{todayValidation ? new Date(todayValidation.refreshedAt).toLocaleString() : '-'}</strong></div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Validation Records</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Software</th>
                    <th>Machine</th>
                    <th>Difference</th>
                    <th>HUID</th>
                    <th>Refreshed</th>
                  </tr>
                </thead>
                <tbody>
                  {validations.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No validation records</td></tr>}
                  {validations.map((v) => (
                    <tr key={v.date} id={`lmValidationRow-${v.date}`}>
                      <td>{v.date}</td>
                      <td>{v.softwareCount}</td>
                      <td>{v.machinePartNumber}</td>
                      <td id={`lmValidationDifference-${v.date}`}>{v.validationDifference}</td>
                      <td>{v.huidMarkings}</td>
                      <td className="text-xs text-nexus-muted">{new Date(v.refreshedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
