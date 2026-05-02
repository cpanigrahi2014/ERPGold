import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import { PageHeader, Stat } from '@/components/Bits';
import { api } from '@/lib/api';

type Metal = 'GOLD' | 'SILVER' | 'PLATINUM';
type TestType = '' | 'XRF' | 'FIRE_ASSAY' | 'SILVER_TITRATION';
type JobStatus =
  | 'DRAFT'
  | 'XRF_STAGE'
  | 'FIRE_ASSAY_STAGE'
  | 'SILVER_TITRATION_STAGE'
  | 'BILLING_STAGE'
  | 'DONE'
  | 'CANCELLED';

type XrfTemplate = 'ALL' | 'FINE';

type XrfParsedRow = {
  rowNo: number;
  gold: number;
  silver: number;
  platinum: number;
};

type ItemLine = {
  id: string;
  metal: Metal;
  qty: number;
  purity: string;
  testType: TestType;
  weightClaimed: string;
  weightRecorded: string;
};

type TestingJob = {
  id: string;
  orderId: string | null;
  customerId: string;
  customerNo: string;
  customerName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  status: JobStatus;
  lines: ItemLine[];
  xrfReadings?: Record<string, number[]>;
  fireAssayReadings?: Record<string, number[]>;
  fireAssayRemarks?: Record<string, 'Pass' | 'Fail'>;
  silverTitrationMean?: number;
  createdAt: string;
  startedAt?: string;
  closedAt?: string;
  backendJobId?: string;  // persisted server UUID after first POST /jobs
};

type Branch = { id: string; code: string; name: string };
type Customer = { id: string; no: string; name: string };

const KEY = 'nexus.react.testing.jobs.v1';
const RATE_PER_ITEM = 75;
const TEST_BASE = '/api/testing/api/v1/testing';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function toBackendMethod(lines: ItemLine[]): string {
  if (lines.some(l => l.testType === 'XRF')) return 'XRF';
  if (lines.some(l => l.testType === 'FIRE_ASSAY')) return 'FIRE_ASSAY';
  return 'TITRATION'; // SILVER_TITRATION maps to TITRATION in backend enum
}

const BRANCHES: Branch[] = [
  { id: 'b1', code: 'MUM', name: 'Mumbai' },
  { id: 'b2', code: 'BLR', name: 'Bengaluru' },
  { id: 'b3', code: 'DEL', name: 'Delhi' },
];

const CUSTOMERS: Customer[] = [
  { id: 'c1', no: '001', name: 'Acme Jewels' },
  { id: 'c2', no: '002', name: 'Royal Gold' },
  { id: 'c3', no: '003', name: 'Silver Star' },
];

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function readJobs(): TestingJob[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as TestingJob[];
  } catch {
    return [];
  }
}

function writeJobs(v: TestingJob[]) {
  localStorage.setItem(KEY, JSON.stringify(v));
}

function lineWeightBadge(claimed: string, recorded: string): 'MATCH' | 'MISMATCH' | 'PENDING' {
  const c = Number(claimed);
  const r = Number(recorded);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return 'PENDING';
  return Math.abs(c - r) < 0.0001 ? 'MATCH' : 'MISMATCH';
}

function testOptionsForMetal(metal: Metal): TestType[] {
  if (metal === 'PLATINUM') return ['', 'XRF'];
  return ['', 'XRF', 'FIRE_ASSAY', 'SILVER_TITRATION'];
}

function stageLabel(status: JobStatus) {
  const m: Record<JobStatus, string> = {
    DRAFT: 'Draft',
    XRF_STAGE: 'XRF',
    FIRE_ASSAY_STAGE: 'Fire Assay',
    SILVER_TITRATION_STAGE: 'Silver Titration',
    BILLING_STAGE: 'Billing',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  };
  return m[status];
}

function jobHas(job: TestingJob, t: TestType) {
  return job.lines.some((l) => l.testType === t);
}

function initialStage(job: TestingJob): JobStatus {
  if (jobHas(job, 'XRF')) return 'XRF_STAGE';
  if (jobHas(job, 'FIRE_ASSAY')) return 'FIRE_ASSAY_STAGE';
  if (jobHas(job, 'SILVER_TITRATION')) return 'SILVER_TITRATION_STAGE';
  return 'XRF_STAGE';
}

function nextFromXrf(job: TestingJob): JobStatus {
  if (jobHas(job, 'FIRE_ASSAY')) return 'FIRE_ASSAY_STAGE';
  if (jobHas(job, 'SILVER_TITRATION')) return 'SILVER_TITRATION_STAGE';
  return 'BILLING_STAGE';
}

function nextFromFire(job: TestingJob): JobStatus {
  if (jobHas(job, 'SILVER_TITRATION')) return 'SILVER_TITRATION_STAGE';
  return 'BILLING_STAGE';
}

function parsePurityThreshold(line: ItemLine): number {
  const p = (line.purity || '').toUpperCase();
  if (p.includes('K22') || p === '22' || p.includes('916')) return 916.667;
  if (p.includes('K18') || p === '18' || p.includes('750')) return 750;
  return 916.667;
}

function parseExpText(text: string, template: XrfTemplate): XrfParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tail = lines.slice(-8);

  return tail.map((line, idx) => {
    const nums = (line.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => Number.isFinite(n));
    const a = nums[0] ?? 0;
    const b = nums[1] ?? 0;
    const c = nums[2] ?? 0;
    if (template === 'ALL') {
      return { rowNo: idx + 1, gold: a, silver: b, platinum: c };
    }
    return { rowNo: idx + 1, gold: b, silver: a, platinum: c };
  });
}

export default function TestingDesk() {
  const [jobs, setJobs] = useState<TestingJob[]>(() => readJobs());
  const [selectedId, setSelectedId] = useState('');
  const [stageTab, setStageTab] = useState<'service' | 'xrf' | 'fire'>('service');

  const [xrfPopupOpen, setXrfPopupOpen] = useState(false);
  const [xrfTemplate, setXrfTemplate] = useState<XrfTemplate>('ALL');
  const [xrfFileName, setXrfFileName] = useState('');
  const [xrfTemplateWarning, setXrfTemplateWarning] = useState('');
  const [xrfParsedRows, setXrfParsedRows] = useState<XrfParsedRow[]>([]);
  const [xrfSelectedRows, setXrfSelectedRows] = useState<Record<number, boolean>>({});

  const [firePopupOpen, setFirePopupOpen] = useState(false);
  const [fireSampleCount, setFireSampleCount] = useState(2);
  const [fireSamples, setFireSamples] = useState<string[]>(['', '']);
  const [fireManualMean, setFireManualMean] = useState('');
  const [fireToleranceWarn, setFireToleranceWarn] = useState('');

  const [titrPopupOpen, setTitrPopupOpen] = useState(false);
  const [titrSampleCount, setTitrSampleCount] = useState(2);
  const [titrActNorm, setTitrActNorm] = useState('1');
  const [titrWeights, setTitrWeights] = useState<string[]>(['', '']);
  const [titrVolumes, setTitrVolumes] = useState<string[]>(['', '']);

  const selected = useMemo(() => jobs.find((j) => j.id === selectedId) || null, [jobs, selectedId]);
  const formReadOnly = selected ? selected.status !== 'DRAFT' : false;

  // Idempotent backend sync: creates job on first call, updates on subsequent ones.
  // Syncs fineness results and issues a certificate when backendStatus is CERTIFIED.
  async function syncTestJobToBackend(job: TestingJob, backendStatus: 'IN_PROGRESS' | 'CERTIFIED' | 'CANCELLED') {
    try {
      let backendId = job.backendJobId;
      if (!backendId) {
        const method = toBackendMethod(job.lines);
        const sampleCount = job.lines.reduce((s, l) => s + l.qty, 0);
        const grossWeight = job.lines.reduce((s, l) => s + Number(l.weightClaimed || 0), 0);
        const created = await api<any>(`${TEST_BASE}/jobs`, {
          method: 'POST',
          body: JSON.stringify({
            jobNumber: (job.orderId || job.id.slice(0, 20)) + '-' + Date.now().toString(36),
            branchId: NIL_UUID,
            customerId: NIL_UUID,
            method,
            sampleCount,
            grossWeight,
            remarks: JSON.stringify({ cnm: job.customerName, bc: job.branchCode }),
          }),
        });
        backendId = created.id as string;
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, backendJobId: backendId } : j));
      }
      if (backendStatus !== 'IN_PROGRESS') {
        await api(`${TEST_BASE}/jobs/${backendId}/status?status=${backendStatus === 'CERTIFIED' ? 'IN_PROGRESS' : backendStatus}`, { method: 'PATCH' }).catch(() => {});
      }
      if (backendStatus === 'CERTIFIED') {
        // POST fineness readings as results, then issue certificate
        const allReadings: Array<{ lineId: string; readings: number[] }> = [];
        Object.entries(job.xrfReadings || {}).forEach(([id, r]) => allReadings.push({ lineId: id, readings: r }));
        Object.entries(job.fireAssayReadings || {}).forEach(([id, r]) => allReadings.push({ lineId: id, readings: r }));
        if (job.silverTitrationMean != null) {
          const titrLine = job.lines.find(l => l.testType === 'SILVER_TITRATION');
          if (titrLine) allReadings.push({ lineId: titrLine.id, readings: [job.silverTitrationMean] });
        }
        let sampleNo = 1;
        for (const { lineId, readings } of allReadings) {
          const line = job.lines.find(l => l.id === lineId);
          for (const fineness of readings) {
            if (Number.isFinite(fineness)) {
              await api(`${TEST_BASE}/results`, {
                method: 'POST',
                body: JSON.stringify({
                  jobId: backendId,
                  sampleNo: sampleNo++,
                  sampleWeight: Number(line?.weightClaimed || 0) || null,
                  fineness,
                }),
              }).catch(() => {});
            }
          }
        }
        // Issue certificate (upsert — backend is idempotent)
        await api(`${TEST_BASE}/certificates`, {
          method: 'POST',
          body: JSON.stringify({ jobId: backendId, issuedByName: 'SYSTEM', remarks: job.orderId }),
        }).catch(() => {});
      }
    } catch (_) {}
  }

  const drafts = useMemo(() => jobs.filter((j) => j.status === 'DRAFT'), [jobs]);
  const active = useMemo(
    () => jobs.filter((j) => ['XRF_STAGE', 'FIRE_ASSAY_STAGE', 'SILVER_TITRATION_STAGE', 'BILLING_STAGE'].includes(j.status)),
    [jobs],
  );
  const reference = useMemo(() => jobs.filter((j) => j.status === 'DONE' || j.status === 'CANCELLED'), [jobs]);

  useEffect(() => {
    writeJobs(jobs);
  }, [jobs]);

  function newJob() {
    const line: ItemLine = {
      id: uuid(),
      metal: 'GOLD',
      qty: 1,
      purity: '',
      testType: '',
      weightClaimed: '',
      weightRecorded: '',
    };
    const j: TestingJob = {
      id: uuid(),
      orderId: null,
      customerId: '',
      customerNo: '',
      customerName: '',
      branchId: '',
      branchCode: '',
      branchName: '',
      status: 'DRAFT',
      lines: [line],
      xrfReadings: {},
      fireAssayReadings: {},
      createdAt: new Date().toISOString(),
    };
    setJobs((prev) => [j, ...prev]);
    setSelectedId(j.id);
    setStageTab('service');
  }

  function setSelectedPatch(patch: Partial<TestingJob>) {
    if (!selected) return;
    setJobs((prev) => prev.map((j) => (j.id === selected.id ? { ...j, ...patch } : j)));
  }

  const previewOrderId = useMemo(() => {
    if (!selected) return '';
    if (!selected.branchCode || !selected.customerNo) return '';
    const seq = jobs.filter((j) => j.branchCode === selected.branchCode && j.customerNo === selected.customerNo).length;
    return `${selected.branchCode}-TS-${selected.customerNo}-${String(seq || 1).padStart(3, '0')}`;
  }, [selected, jobs]);

  useEffect(() => {
    if (!selected || formReadOnly) return;
    if (previewOrderId && selected.orderId !== previewOrderId) {
      setSelectedPatch({ orderId: previewOrderId });
    }
  }, [previewOrderId]);

  function setBranch(branchId: string) {
    if (!selected || formReadOnly) return;
    const b = BRANCHES.find((x) => x.id === branchId);
    if (!b) return;
    setSelectedPatch({ branchId: b.id, branchCode: b.code, branchName: b.name });
  }

  function setCustomer(customerId: string) {
    if (!selected || formReadOnly) return;
    const c = CUSTOMERS.find((x) => x.id === customerId);
    if (!c) return;
    setSelectedPatch({ customerId: c.id, customerNo: c.no, customerName: c.name });
  }

  function addLine() {
    if (!selected || formReadOnly) return;
    setSelectedPatch({
      lines: [
        ...selected.lines,
        {
          id: uuid(),
          metal: 'GOLD',
          qty: 1,
          purity: '',
          testType: '',
          weightClaimed: '',
          weightRecorded: '',
        },
      ],
    });
  }

  function patchLine(lineId: string, patch: Partial<ItemLine>) {
    if (!selected || formReadOnly) return;
    setSelectedPatch({ lines: selected.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) });
  }

  function onMetalChange(line: ItemLine, metal: Metal) {
    if (!selected || formReadOnly) return;
    const options = testOptionsForMetal(metal);
    let testType = line.testType;
    if (!options.includes(testType)) {
      testType = '';
      toast.warn('Invalid test for selected metal. Test cleared.');
    }
    patchLine(line.id, { metal, testType });
  }

  function onTestChange(line: ItemLine, testType: TestType) {
    if (!selected || formReadOnly) return;

    if (line.metal === 'PLATINUM' && testType && testType !== 'XRF') {
      toast.err('Invalid combination: Platinum only permits XRF');
      patchLine(line.id, { testType: '' });
      return;
    }
    if (testType === 'FIRE_ASSAY' && line.metal === 'SILVER') {
      toast.warn('Fire Assay requires Gold. Metal auto-changed to Gold.');
      patchLine(line.id, { metal: 'GOLD', testType: 'FIRE_ASSAY' });
      return;
    }
    if (testType === 'SILVER_TITRATION' && line.metal === 'GOLD') {
      toast.warn('Gold cannot use Silver Titration. Test cleared and metal auto-changed to Silver.');
      patchLine(line.id, { metal: 'SILVER', testType: '' });
      return;
    }

    patchLine(line.id, { testType });
  }

  function startTesting() {
    if (!selected || formReadOnly) return;
    if (!selected.customerId || !selected.branchId || !selected.orderId) {
      toast.err('Customer, Branch and Order ID are mandatory');
      return;
    }
    if (selected.lines.length === 0) { toast.err('Add at least one item line'); return; }
    const missing = selected.lines.filter((l) => !l.testType);
    if (missing.length > 0) { toast.err('Validation error: all items must have a test type'); return; }
    const stage = initialStage(selected);
    const started = { ...selected, status: stage, startedAt: new Date().toISOString() };
    setSelectedPatch({ status: stage, startedAt: started.startedAt });
    setStageTab(stage === 'XRF_STAGE' ? 'xrf' : stage === 'FIRE_ASSAY_STAGE' ? 'fire' : 'service');
    toast.ok(`Testing started. Job moved to ${stageLabel(stage)} stage.`);
    syncTestJobToBackend(started, 'IN_PROGRESS');
  }

  function patchReadings(kind: 'xrfReadings' | 'fireAssayReadings', lineId: string, pieceIdx: number, v: string) {
    if (!selected) return;
    const n = Number(v);
    const map = { ...(selected[kind] || {}) };
    const arr = [...(map[lineId] || [])];
    arr[pieceIdx] = Number.isFinite(n) ? n : NaN;
    map[lineId] = arr;
    setSelectedPatch({ [kind]: map } as Partial<TestingJob>);
  }

  function validateXrfComplete(job: TestingJob) {
    const xrfLines = job.lines.filter((l) => l.testType === 'XRF');
    const readings = job.xrfReadings || {};
    for (const l of xrfLines) {
      const arr = readings[l.id] || [];
      if (arr.length < l.qty) return false;
      for (let i = 0; i < l.qty; i += 1) {
        if (!Number.isFinite(arr[i])) return false;
      }
    }
    return true;
  }

  function validateFireComplete(job: TestingJob) {
    const lines = job.lines.filter((l) => l.testType === 'FIRE_ASSAY');
    const readings = job.fireAssayReadings || {};
    for (const l of lines) {
      const arr = readings[l.id] || [];
      if (arr.length < l.qty) return false;
      for (let i = 0; i < l.qty; i += 1) {
        if (!Number.isFinite(arr[i])) return false;
      }
    }
    return true;
  }

  function approveAndNext() {
    if (!selected) return;
    if (selected.status === 'XRF_STAGE') {
      if (!validateXrfComplete(selected)) {
        toast.err('Validation error: all XRF items must have readings for all pieces');
        return;
      }
      const next = nextFromXrf(selected);
      setSelectedPatch({ status: next });
      toast.ok(`Moved to ${stageLabel(next)}`);
      return;
    }

    if (selected.status === 'FIRE_ASSAY_STAGE') {
      if (!validateFireComplete(selected)) {
        toast.err('Validation error: all Fire Assay items must have readings for all pieces');
        return;
      }
      const next = nextFromFire(selected);
      setSelectedPatch({ status: next });
      toast.ok(`Moved to ${stageLabel(next)}`);
      return;
    }

    if (selected.status === 'SILVER_TITRATION_STAGE') {
      setSelectedPatch({ status: 'BILLING_STAGE' });
      toast.ok('Moved to Billing');
      return;
    }

    if (selected.status === 'BILLING_STAGE') {
      const donePatch = { status: 'DONE' as JobStatus, closedAt: new Date().toISOString() };
      const doneJob = { ...selected, ...donePatch };
      setSelectedPatch(donePatch);
      toast.ok('Job completed — syncing certificate to backend…');
      syncTestJobToBackend(doneJob, 'CERTIFIED');
    }
  }

  function cancelFromXrf() {
    if (!selected || selected.status !== 'XRF_STAGE') return;
    const cancelPatch = { status: 'CANCELLED' as JobStatus, closedAt: new Date().toISOString() };
    const cancelledJob = { ...selected, ...cancelPatch };
    setSelectedPatch(cancelPatch);
    toast.warn('Job cancelled and moved to reference');
    syncTestJobToBackend(cancelledJob, 'CANCELLED');
  }

  function onXrfTemplateChange(v: XrfTemplate) {
    setXrfTemplate(v);
    if (xrfParsedRows.length > 0 || xrfFileName) {
      setXrfFileName('');
      setXrfParsedRows([]);
      setXrfSelectedRows({});
      setXrfTemplateWarning('');
      toast.info('Template changed. Previous uploaded file and parsed rows were cleared. Re-upload required.');
    }
  }

  async function onXrfFileUpload(file: File | null) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'exp') {
      toast.err('Invalid file type. Only .EXP files are accepted.');
      return;
    }

    const expectedPrefix = xrfTemplate === 'ALL' ? 'A' : 'F';
    const actualPrefix = (file.name[0] || '').toUpperCase();
    if (actualPrefix !== expectedPrefix) {
      const msg = `Template/file mismatch: selected ${xrfTemplate} but uploaded ${file.name}. Parsing continues with ${xrfTemplate} column order.`;
      setXrfTemplateWarning(msg);
      toast.warn(msg);
    } else {
      setXrfTemplateWarning('');
    }

    const text = await file.text();
    const rows = parseExpText(text, xrfTemplate);
    setXrfFileName(file.name);
    setXrfParsedRows(rows);
    const preSelect: Record<number, boolean> = {};
    rows.forEach((_, idx) => { preSelect[idx] = idx < 2; });
    setXrfSelectedRows(preSelect);
    toast.ok('Parsed last 8 rows from .EXP file. First 2 rows selected by default.');
  }

  function applyXrfSelection() {
    if (!selected) return;
    if (xrfParsedRows.length === 0) {
      toast.err('Upload and parse an .EXP file first.');
      return;
    }
    const picked = xrfParsedRows.filter((_, idx) => !!xrfSelectedRows[idx]);
    if (picked.length === 0) {
      toast.err('Validation error: at least one XRF row must be selected for averaging.');
      return;
    }

    const xrfLines = selected.lines.filter((l) => l.testType === 'XRF');
    if (xrfLines.length === 0) {
      toast.err('No XRF item found in this job.');
      return;
    }

    const avgByMetal = {
      GOLD: picked.reduce((s, r) => s + r.gold, 0) / picked.length,
      SILVER: picked.reduce((s, r) => s + r.silver, 0) / picked.length,
      PLATINUM: picked.reduce((s, r) => s + r.platinum, 0) / picked.length,
    };

    const next = { ...(selected.xrfReadings || {}) };
    xrfLines.forEach((line) => {
      const value = Number(avgByMetal[line.metal as Metal].toFixed(3));
      next[line.id] = Array.from({ length: line.qty }).map(() => value);
    });
    setSelectedPatch({ xrfReadings: next });
    setXrfPopupOpen(false);
    toast.ok('Averaged XRF rows applied to all XRF item pieces.');
  }

  function openFirePopup() {
    setFireToleranceWarn('');
    setFirePopupOpen(true);
  }

  function calcFireMean(): number | null {
    const nums = fireSamples.slice(0, fireSampleCount).map((v) => Number(v));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    return nums.reduce((a, b) => a + b, 0) / fireSampleCount;
  }

  function saveFireAssayResult() {
    if (!selected) return;
    const meanCalc = calcFireMean();
    if (meanCalc === null || !Number.isFinite(meanCalc)) {
      toast.err('Enter valid Fire Assay sample fineness values first.');
      return;
    }

    const edited = Number(fireManualMean || String(meanCalc));
    if (!Number.isFinite(edited)) {
      toast.err('Mean Fineness value is invalid.');
      return;
    }

    if (Math.abs(edited - meanCalc) > 0.5) {
      const msg = 'Manual Mean Fineness edit must stay within +/-0.5 of calculated mean.';
      setFireToleranceWarn(msg);
      toast.err(msg);
      return;
    }

    const fireLines = selected.lines.filter((l) => l.testType === 'FIRE_ASSAY');
    const readings = { ...(selected.fireAssayReadings || {}) };
    const remarks = { ...(selected.fireAssayRemarks || {}) };
    fireLines.forEach((line) => {
      readings[line.id] = Array.from({ length: line.qty }).map(() => Number(edited.toFixed(3)));
      const threshold = parsePurityThreshold(line);
      remarks[line.id] = edited >= threshold ? 'Pass' : 'Fail';
    });

    setSelectedPatch({ fireAssayReadings: readings, fireAssayRemarks: remarks });
    setFirePopupOpen(false);
    toast.ok('Fire Assay results saved.');
  }

  function ensureLen(values: string[], len: number) {
    if (values.length === len) return values;
    if (values.length > len) return values.slice(0, len);
    return [...values, ...Array.from({ length: len - values.length }).map(() => '')];
  }

  function calcTitrFineness(weight: string, volume: string, actNorm: string): number | null {
    const w = Number(weight);
    const v = Number(volume);
    const n = Number(actNorm);
    if (!Number.isFinite(w) || !Number.isFinite(v) || !Number.isFinite(n) || w === 0) return null;
    return (v * n) / w;
  }

  function saveTitrationResult() {
    if (!selected) return;
    const vals: number[] = [];
    for (let i = 0; i < titrSampleCount; i += 1) {
      const f = calcTitrFineness(titrWeights[i] || '', titrVolumes[i] || '', titrActNorm);
      if (!Number.isFinite(f)) {
        toast.err('All Silver Titration sample rows must have valid Weight and Volume.');
        return;
      }
      vals.push(f as number);
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    setSelectedPatch({ silverTitrationMean: Number(mean.toFixed(6)) });
    setTitrPopupOpen(false);
    toast.ok('Silver Titration results saved.');
  }

  const stageTabs = useMemo(() => {
    if (!selected || selected.status === 'DRAFT') return [] as Array<'service' | 'xrf' | 'fire'>;
    const tabs: Array<'service' | 'xrf' | 'fire'> = ['service'];
    tabs.push('xrf');
    const fireInFlow = selected.lines.some((l) => l.testType === 'FIRE_ASSAY');
    if (
      fireInFlow
      && ['FIRE_ASSAY_STAGE', 'SILVER_TITRATION_STAGE', 'BILLING_STAGE', 'DONE', 'CANCELLED'].includes(selected.status)
    ) {
      tabs.push('fire');
    }
    return tabs;
  }, [selected]);

  const billingAmount = selected ? selected.lines.reduce((sum, l) => sum + l.qty, 0) * RATE_PER_ITEM : 0;

  return (
    <div>
      <PageHeader title="Purity Testing Desk" subtitle="Reception · XRF · Fire Assay · Titration" />

      <div className="grid grid-cols-6 gap-2 mb-5">
        <Stat label="Draft" value={drafts.length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="In XRF" value={jobs.filter((j) => j.status === 'XRF_STAGE').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="In Fire Assay" value={jobs.filter((j) => j.status === 'FIRE_ASSAY_STAGE').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="In Titration" value={jobs.filter((j) => j.status === 'SILVER_TITRATION_STAGE').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="In Billing" value={jobs.filter((j) => j.status === 'BILLING_STAGE').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Done / Cancelled" value={reference.length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
      </div>

      <div className="sticky top-0 z-10 mb-4 rounded-lg border border-nexus-line bg-nexus-bg/90 backdrop-blur p-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-nexus-muted">Order ID</div>
          <div id="tsOrderIdSticky" className="text-sm font-semibold text-white">
            {selected?.orderId || 'Auto-generated after Branch + Customer'}
          </div>
        </div>
        <div className="flex gap-2">
          <button id="tsNew" className="btn" onClick={newJob}>New</button>
          <button id="tsStart" className="btn-primary" onClick={startTesting} disabled={!selected || formReadOnly}>Start Testing</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Reception Desk</h3>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Order ID</th><th>Customer</th><th>Branch</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {drafts.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No draft jobs in Reception Desk</td></tr>}
                {drafts.map((j) => (
                  <tr key={j.id}>
                    <td>{j.orderId || 'Pending'}</td>
                    <td>{j.customerName || '-'}</td>
                    <td>{j.branchCode || '-'}</td>
                    <td>{stageLabel(j.status)}</td>
                    <td><button id={`tsOpenDraft-${j.id}`} className="btn" onClick={() => { setSelectedId(j.id); setStageTab('service'); }}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Order ID</th><th>Customer</th><th>Stage</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {active.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No active jobs</td></tr>}
                {active.map((j) => (
                  <motion.tr key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{j.orderId || '-'}</td>
                    <td>{j.customerName || '-'}</td>
                    <td>{stageLabel(j.status)}</td>
                    <td><button id={`tsOpenActive-${j.id}`} className="btn" onClick={() => { setSelectedId(j.id); setStageTab('service'); }}>View</button></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Order ID</th><th>Customer</th><th>Final Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {reference.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No reference jobs</td></tr>}
                {reference.map((j) => (
                  <tr key={j.id}>
                    <td>{j.orderId || '-'}</td>
                    <td>{j.customerName || '-'}</td>
                    <td>{stageLabel(j.status)}</td>
                    <td><button id={`tsOpenRef-${j.id}`} className="btn" onClick={() => { setSelectedId(j.id); setStageTab('service'); }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Job Form</h3>
          {!selected && <p className="text-xs text-nexus-muted">Click New to create a testing job.</p>}

          {selected && (
            <>
              {formReadOnly && (
                <p id="tsReadonlyMsg" className="text-xs text-amber-300">This job already left Draft. Fields are read-only (history only).</p>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-xs text-nexus-muted flex flex-col gap-1">
                  Customer
                  <select id="tsCustomer" className="input" disabled={formReadOnly} value={selected.customerId} onChange={(e) => setCustomer(e.target.value)}>
                    <option value="">Select customer</option>
                    {CUSTOMERS.map((c) => <option key={c.id} value={c.id}>{c.no} - {c.name}</option>)}
                  </select>
                </label>

                <label className="text-xs text-nexus-muted flex flex-col gap-1">
                  Branch
                  <select id="tsBranch" className="input" disabled={formReadOnly} value={selected.branchId} onChange={(e) => setBranch(e.target.value)}>
                    <option value="">Select branch</option>
                    {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Metal</th><th>Qty</th><th>Purity</th><th>Test</th><th>Weight Claimed</th><th>Weight Recorded</th><th>Weight Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l) => {
                      const check = lineWeightBadge(l.weightClaimed, l.weightRecorded);
                      return (
                        <tr key={l.id}>
                          <td>
                            <select id={`tsMetal-${l.id}`} className="input" disabled={formReadOnly} value={l.metal} onChange={(e) => onMetalChange(l, e.target.value as Metal)}>
                              <option value="GOLD">Gold</option>
                              <option value="SILVER">Silver</option>
                              <option value="PLATINUM">Platinum</option>
                            </select>
                          </td>
                          <td><input id={`tsQty-${l.id}`} className="input" type="number" min={1} disabled={formReadOnly} value={l.qty} onChange={(e) => patchLine(l.id, { qty: Number(e.target.value || 1) })} /></td>
                          <td><input id={`tsPurity-${l.id}`} className="input" disabled={formReadOnly} value={l.purity} onChange={(e) => patchLine(l.id, { purity: e.target.value })} placeholder="e.g. 916" /></td>
                          <td>
                            <select id={`tsTest-${l.id}`} className="input" disabled={formReadOnly} value={l.testType} onChange={(e) => onTestChange(l, e.target.value as TestType)}>
                              {testOptionsForMetal(l.metal).map((t) => (
                                <option key={t || 'none'} value={t}>{t || 'Select test'}</option>
                              ))}
                            </select>
                          </td>
                          <td><input id={`tsClaimed-${l.id}`} className="input" type="number" step="0.0001" disabled={formReadOnly} value={l.weightClaimed} onChange={(e) => patchLine(l.id, { weightClaimed: e.target.value })} /></td>
                          <td><input id={`tsRecorded-${l.id}`} className="input" type="number" step="0.0001" disabled={formReadOnly} value={l.weightRecorded} onChange={(e) => patchLine(l.id, { weightRecorded: e.target.value })} /></td>
                          <td>
                            {check === 'PENDING' && <span className="text-xs text-nexus-muted">Pending</span>}
                            {check === 'MATCH' && <span id={`tsWeightBadge-${l.id}`} className="inline-flex px-2 py-0.5 rounded-full text-xs border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">Match</span>}
                            {check === 'MISMATCH' && <span id={`tsWeightBadge-${l.id}`} className="inline-flex px-2 py-0.5 rounded-full text-xs border border-red-500/40 bg-red-500/15 text-red-300">Mismatch</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button id="tsAddLine" className="btn" onClick={addLine} disabled={formReadOnly}>+ Add Item</button>

              {selected.status !== 'DRAFT' && (
                <div className="mt-4 border border-nexus-line rounded-lg p-3">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {stageTabs.includes('service') && (
                      <button id="tsTabService" className={`px-3 py-1.5 rounded-lg border text-xs ${stageTab === 'service' ? 'border-nexus-accent text-white' : 'border-nexus-line text-nexus-muted'}`} onClick={() => setStageTab('service')}>
                        Service Items
                      </button>
                    )}
                    {stageTabs.includes('xrf') && (
                      <button id="tsTabXrf" className={`px-3 py-1.5 rounded-lg border text-xs ${stageTab === 'xrf' ? 'border-nexus-accent text-white' : 'border-nexus-line text-nexus-muted'}`} onClick={() => setStageTab('xrf')}>
                        XRF Results
                      </button>
                    )}
                    {stageTabs.includes('fire') && (
                      <button id="tsTabFire" className={`px-3 py-1.5 rounded-lg border text-xs ${stageTab === 'fire' ? 'border-nexus-accent text-white' : 'border-nexus-line text-nexus-muted'}`} onClick={() => setStageTab('fire')}>
                        Fire Assay Results
                      </button>
                    )}
                  </div>

                  {selected.status === 'XRF_STAGE' && stageTab === 'xrf' && (
                    <div className="space-y-3">
                      <p className="text-xs text-nexus-muted">Enter XRF readings for all pieces before Approve & Next.</p>
                      <div className="flex gap-2">
                        <button id="tsXrfOpenPopup" className="btn" onClick={() => setXrfPopupOpen(true)}>Open XRF Popup</button>
                        <span className="text-xs text-nexus-muted self-center">Upload .EXP, select rows, and apply average.</span>
                      </div>
                      {selected.lines.filter((l) => l.testType === 'XRF').map((l) => (
                        <div key={l.id} className="p-2 rounded border border-nexus-line">
                          <div className="text-xs text-nexus-muted mb-2">Item ({l.metal}) · Qty {l.qty}</div>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: l.qty }).map((_, idx) => (
                              <input
                                key={idx}
                                id={`tsXrf-${l.id}-${idx}`}
                                className="input text-xs"
                                type="number"
                                step="0.001"
                                value={(selected.xrfReadings?.[l.id] || [])[idx] ?? ''}
                                onChange={(e) => patchReadings('xrfReadings', l.id, idx, e.target.value)}
                                placeholder={`Piece ${idx + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button id="tsApproveNext" className="btn-primary" onClick={approveAndNext}>Approve & Next</button>
                        <button id="tsCancel" className="btn" onClick={cancelFromXrf}>Cancel</button>
                      </div>

                      {xrfPopupOpen && (
                        <div id="tsXrfPopup" className="border border-nexus-line rounded-lg p-3 bg-nexus-panel/60 space-y-3">
                          <h4 className="text-sm font-semibold">XRF Popup</h4>
                          <div className="grid md:grid-cols-3 gap-3">
                            <label className="text-xs text-nexus-muted flex flex-col gap-1">
                              Template
                              <select id="tsXrfTemplate" className="input" value={xrfTemplate} onChange={(e) => onXrfTemplateChange(e.target.value as XrfTemplate)}>
                                <option value="ALL">ALL</option>
                                <option value="FINE">FINE</option>
                              </select>
                            </label>
                            <label className="text-xs text-nexus-muted flex flex-col gap-1">
                              Upload .EXP
                              <input id="tsXrfUpload" className="input" type="file" onChange={(e) => void onXrfFileUpload(e.target.files?.[0] || null)} />
                            </label>
                            <div className="text-xs text-nexus-muted self-end" id="tsXrfFileName">{xrfFileName || 'No file selected'}</div>
                          </div>

                          {xrfTemplateWarning && <p id="tsXrfTemplateWarn" className="text-xs text-amber-300">{xrfTemplateWarning}</p>}

                          <div className="table-wrap">
                            <table className="tbl">
                              <thead>
                                <tr><th>Pick</th><th>Row</th><th>Gold</th><th>Silver</th><th>Platinum</th></tr>
                              </thead>
                              <tbody>
                                {xrfParsedRows.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">Upload an .EXP file to parse last 8 rows</td></tr>}
                                {xrfParsedRows.map((r, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <input
                                        id={`tsXrfPick-${idx}`}
                                        type="checkbox"
                                        checked={!!xrfSelectedRows[idx]}
                                        onChange={(e) => setXrfSelectedRows((prev) => ({ ...prev, [idx]: e.target.checked }))}
                                      />
                                    </td>
                                    <td>{r.rowNo}</td>
                                    <td id={`tsXrfGold-${idx}`}>{r.gold}</td>
                                    <td id={`tsXrfSilver-${idx}`}>{r.silver}</td>
                                    <td id={`tsXrfPlatinum-${idx}`}>{r.platinum}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex gap-2">
                            <button id="tsXrfDone" className="btn-primary" onClick={applyXrfSelection}>Done</button>
                            <button className="btn" onClick={() => setXrfPopupOpen(false)}>Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selected.status === 'FIRE_ASSAY_STAGE' && stageTab === 'fire' && (
                    <div className="space-y-3">
                      <p className="text-xs text-nexus-muted">Enter Fire Assay readings, then approve.</p>
                      <div className="flex gap-2">
                        <button id="tsFireOpenPopup" className="btn" onClick={openFirePopup}>Open Fire Assay Popup</button>
                      </div>
                      {selected.lines.filter((l) => l.testType === 'FIRE_ASSAY').map((l) => (
                        <div key={l.id} className="p-2 rounded border border-nexus-line">
                          <div className="text-xs text-nexus-muted mb-2">Item ({l.metal}) · Qty {l.qty}</div>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: l.qty }).map((_, idx) => (
                              <input
                                key={idx}
                                id={`tsFire-${l.id}-${idx}`}
                                className="input text-xs"
                                type="number"
                                step="0.001"
                                value={(selected.fireAssayReadings?.[l.id] || [])[idx] ?? ''}
                                onChange={(e) => patchReadings('fireAssayReadings', l.id, idx, e.target.value)}
                                placeholder={`Piece ${idx + 1}`}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-nexus-muted mt-2">Remarks: <span id={`tsFireRemark-${l.id}`}>{selected.fireAssayRemarks?.[l.id] || '—'}</span></div>
                        </div>
                      ))}

                      {firePopupOpen && (
                        <div id="tsFirePopup" className="border border-nexus-line rounded-lg p-3 bg-nexus-panel/60 space-y-3">
                          <h4 className="text-sm font-semibold">Fire Assay Popup</h4>
                          <label className="text-xs text-nexus-muted flex flex-col gap-1">
                            No. of Samples
                            <input
                              id="tsFireSampleCount"
                              className="input w-32"
                              type="number"
                              min={1}
                              value={fireSampleCount}
                              onChange={(e) => {
                                const n = Math.max(1, Number(e.target.value || 1));
                                setFireSampleCount(n);
                                setFireSamples((prev) => ensureLen(prev, n));
                              }}
                            />
                          </label>
                          <div className="grid md:grid-cols-3 gap-2">
                            {Array.from({ length: fireSampleCount }).map((_, i) => (
                              <label key={i} className="text-xs text-nexus-muted flex flex-col gap-1">
                                Sample {i + 1} Fineness
                                <input
                                  id={`tsFireSample-${i}`}
                                  className="input"
                                  type="number"
                                  step="0.001"
                                  value={fireSamples[i] || ''}
                                  onChange={(e) => setFireSamples((prev) => {
                                    const next = ensureLen(prev, fireSampleCount);
                                    next[i] = e.target.value;
                                    return [...next];
                                  })}
                                />
                              </label>
                            ))}
                          </div>
                          <div className="grid md:grid-cols-2 gap-2">
                            <div className="text-xs text-nexus-muted">Calculated Mean Fineness: <span id="tsFireCalcMean">{calcFireMean()?.toFixed(3) || '—'}</span></div>
                            <label className="text-xs text-nexus-muted flex flex-col gap-1">
                              Manual Mean Fineness (allowed +/-0.5)
                              <input id="tsFireManualMean" className="input" type="number" step="0.001" value={fireManualMean} onChange={(e) => setFireManualMean(e.target.value)} />
                            </label>
                          </div>
                          {fireToleranceWarn && <p id="tsFireToleranceWarn" className="text-xs text-red-300">{fireToleranceWarn}</p>}
                          <div className="flex gap-2">
                            <button id="tsFireSave" className="btn-primary" onClick={saveFireAssayResult}>Save</button>
                            <button className="btn" onClick={() => setFirePopupOpen(false)}>Close</button>
                          </div>
                        </div>
                      )}

                      <button id="tsApproveNext" className="btn-primary" onClick={approveAndNext}>Approve & Next</button>
                    </div>
                  )}

                  {selected.status === 'SILVER_TITRATION_STAGE' && (
                    <div className="space-y-2">
                      <p className="text-xs text-nexus-muted">Silver Titration stage ready.</p>
                      <button id="tsTitrOpenPopup" className="btn" onClick={() => setTitrPopupOpen(true)}>Open Titration Popup</button>
                      {titrPopupOpen && (
                        <div id="tsTitrPopup" className="border border-nexus-line rounded-lg p-3 bg-nexus-panel/60 space-y-3">
                          <h4 className="text-sm font-semibold">Silver Titration Popup</h4>
                          <div className="grid md:grid-cols-3 gap-2">
                            <label className="text-xs text-nexus-muted flex flex-col gap-1">
                              No. of Samples
                              <input
                                id="tsTitrSampleCount"
                                className="input"
                                type="number"
                                min={1}
                                value={titrSampleCount}
                                onChange={(e) => {
                                  const n = Math.max(1, Number(e.target.value || 1));
                                  setTitrSampleCount(n);
                                  setTitrWeights((prev) => ensureLen(prev, n));
                                  setTitrVolumes((prev) => ensureLen(prev, n));
                                }}
                              />
                            </label>
                            <label className="text-xs text-nexus-muted flex flex-col gap-1">
                              Act Norm
                              <input id="tsTitrActNorm" className="input" type="number" step="0.0001" value={titrActNorm} onChange={(e) => setTitrActNorm(e.target.value)} />
                            </label>
                          </div>
                          <div className="table-wrap">
                            <table className="tbl">
                              <thead>
                                <tr><th>Sample</th><th>Weight of Sample</th><th>Volume</th><th>Fineness</th></tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: titrSampleCount }).map((_, i) => {
                                  const f = calcTitrFineness(titrWeights[i] || '', titrVolumes[i] || '', titrActNorm);
                                  return (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td><input id={`tsTitrWeight-${i}`} className="input" type="number" step="0.0001" value={titrWeights[i] || ''} onChange={(e) => setTitrWeights((prev) => { const n = ensureLen(prev, titrSampleCount); n[i] = e.target.value; return [...n]; })} /></td>
                                      <td><input id={`tsTitrVolume-${i}`} className="input" type="number" step="0.0001" value={titrVolumes[i] || ''} onChange={(e) => setTitrVolumes((prev) => { const n = ensureLen(prev, titrSampleCount); n[i] = e.target.value; return [...n]; })} /></td>
                                      <td id={`tsTitrFineness-${i}`}>{Number.isFinite(f) ? f?.toFixed(6) : '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-xs text-nexus-muted">
                            Mean Fineness: <span id="tsTitrMean">{(() => {
                              const vals = Array.from({ length: titrSampleCount }).map((_, i) => calcTitrFineness(titrWeights[i] || '', titrVolumes[i] || '', titrActNorm)).filter((v) => Number.isFinite(v)) as number[];
                              if (vals.length !== titrSampleCount) return '—';
                              return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(6);
                            })()}</span>
                          </div>
                          <div className="flex gap-2">
                            <button id="tsTitrSave" className="btn-primary" onClick={saveTitrationResult}>Save</button>
                            <button className="btn" onClick={() => setTitrPopupOpen(false)}>Close</button>
                          </div>
                        </div>
                      )}
                      {Number.isFinite(selected.silverTitrationMean) && (
                        <p className="text-xs text-nexus-muted">Saved Mean Fineness: <span id="tsTitrSavedMean">{selected.silverTitrationMean}</span></p>
                      )}
                      <button id="tsApproveNext" className="btn-primary" onClick={approveAndNext}>Approve & Next</button>
                    </div>
                  )}

                  {selected.status === 'BILLING_STAGE' && (
                    <div className="space-y-2">
                      <p id="tsBillingSummary" className="text-xs text-nexus-muted">Billing amount based on total pieces: {billingAmount}</p>
                      <button id="tsApproveNext" className="btn-primary" onClick={approveAndNext}>Approve & Next</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
