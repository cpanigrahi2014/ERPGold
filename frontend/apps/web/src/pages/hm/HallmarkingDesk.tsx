import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { PageHeader, Stat } from '@/components/Bits';

type HmJob = {
  id: string;
  jobNumber?: string;
  kind?: string;
  purityLabel?: string;
  pieceCount?: number;
  grossWeight?: number;
  status?: string;
};

type RequestStatus = 'DRAFT' | 'AT_QUALITY_MANAGER' | 'XRF_TESTING' | 'SAMPLING' | 'FIRE_ASSAY' | 'HUID_PRINTING' | 'FINAL_WEIGHTING' | 'COMPLETE' | 'CANCELLED';
type WeightStatus = 'OK' | 'WARNING';

type DeliveryOrderStatus = 'AWAITING_PICKUP' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
type ReturnStatus = 'CREATED' | 'DELIVERED';

type XrfVerd = 'PASS' | 'FAIL';

type XrfLineResult = {
  testedKarat: number;
  purityPct: number;
  verdict: XrfVerd;
  expFileName: string | null;
  submittedAt: string;
};

type FireAssayLineResult = {
  testedPurityPct: number;
  verdict: XrfVerd;
  submittedAt: string;
};

type RequestLine = {
  id: string;
  itemCategory: string;
  declaredQty: number;
  declaredWeight: number;
  observedWeight: number;
  weightStatus: WeightStatus;
};

type HmRequest = {
  id: string;
  requestNumber: string;
  bisRequestNumber: string | null;
  customerName: string;
  material: string;
  ahcCenter: string;
  lines: RequestLine[];
  weightStatus: WeightStatus;
  status: RequestStatus;
  createdAt: string;
  qmJobNumber?: string;
  tagIds?: Record<string, string>;       // lineId → HUID tag
  xrfResults?: Record<string, XrfLineResult>; // lineId → XRF result
  xrfAborted?: boolean;                       // true when Abort Process used
  fireAssayLineIds?: string[];
  fireAssayResults?: Record<string, FireAssayLineResult>;
  fireAssayAborted?: boolean;
  huidRemarking?: boolean;
  huidMarkingStartedAt?: string;
  huidMarkedBy?: string;
  finalWeights?: Record<string, number>;      // lineId → final weight
  backendJobId?: string;                        // server-side HmJob UUID
};

type LaserHuidDispatch = {
  count: number;
  date: string;
  sentAt: string;
  mode: 'MANUAL' | 'AUTO_10PM';
};

type DeliveryOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryType: 'PICKUP' | 'DISPATCH';
  remarks?: string | null;
  status: DeliveryOrderStatus;
  createdAt: string;
  customerGrossWeight?: number;
  customerNetWeight?: number;
  hasScaleImage?: boolean;
  hasReceiptImage?: boolean;
  phcQuantity?: number;
  phcGrossWeight?: number;
  declaredPurity?: string;
};

type DeliveryReturn = {
  id: string;
  returnNumber: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string;
  deliveryDetails?: string | null;
  remarks?: string | null;
  status: ReturnStatus;
  deliveryDate: string | null;
  createdAt: string;
};

const REQS_KEY = 'nexus.react.hm.requests.v1';
const DELIVERY_KEY = 'nexus.react.hm.delivery.orders.v1';
const DELIVERY_RETURNS_KEY = 'nexus.react.hm.delivery.returns.v1';
const LASER_HUID_DISPATCH_KEY = 'nexus.react.hm.laser.huid-count.v1';
const LAST_AUTO_HUID_DATE_KEY = 'nexus.react.hm.huid.auto-last-date.v1';
const HM_BILL_RATE_PER_ITEM = 100;
const HM_BASE = '/api/hm/api/v1/hm';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function readRequests(): HmRequest[] {
  try {
    return JSON.parse(localStorage.getItem(REQS_KEY) || '[]') as HmRequest[];
  } catch {
    return [];
  }
}

function writeRequests(list: HmRequest[]) {
  localStorage.setItem(REQS_KEY, JSON.stringify(list));
}

function readDeliveryOrders(): DeliveryOrder[] {
  try {
    return JSON.parse(localStorage.getItem(DELIVERY_KEY) || '[]') as DeliveryOrder[];
  } catch {
    return [];
  }
}

function writeDeliveryOrders(list: DeliveryOrder[]) {
  localStorage.setItem(DELIVERY_KEY, JSON.stringify(list));
}

function readDeliveryReturns(): DeliveryReturn[] {
  try {
    return JSON.parse(localStorage.getItem(DELIVERY_RETURNS_KEY) || '[]') as DeliveryReturn[];
  } catch {
    return [];
  }
}

function writeDeliveryReturns(list: DeliveryReturn[]) {
  localStorage.setItem(DELIVERY_RETURNS_KEY, JSON.stringify(list));
}

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function reqNumber(list: HmRequest[]) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const today = list.filter((x) => x.requestNumber.startsWith(`HMR-${ymd}-`));
  const n = today.reduce((mx, x) => {
    const v = Number(x.requestNumber.split('-').pop());
    return Number.isFinite(v) ? Math.max(mx, v) : mx;
  }, 0);
  return `HMR-${ymd}-${String(n + 1).padStart(3, '0')}`;
}

function seq(prefix: string, numbers: string[]) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const same = numbers.filter((n) => n.startsWith(`${prefix}-${ymd}-`));
  const maxN = same.reduce((mx, n) => {
    const v = Number(n.split('-').pop());
    return Number.isFinite(v) ? Math.max(mx, v) : mx;
  }, 0);
  return `${prefix}-${ymd}-${String(maxN + 1).padStart(3, '0')}`;
}

function lineWeightStatus(declaredWeight: number, observedWeight: number): WeightStatus {
  return Math.abs(declaredWeight - observedWeight) > 0.5 ? 'WARNING' : 'OK';
}

function reqWeightStatus(lines: RequestLine[]): WeightStatus {
  return lines.some((l) => l.weightStatus === 'WARNING') ? 'WARNING' : 'OK';
}

// BIS purity thresholds (%) per material
const PURITY_THRESHOLD: Record<string, number> = {
  GOLD: 91.6,
  SILVER: 92.5,
  PLATINUM: 95.0,
};

function karatToPurityPct(karat: number): number {
  return parseFloat(((karat / 24) * 100).toFixed(3));
}

function xrfVerdict(purityPct: number, material: string): XrfVerd {
  const threshold = PURITY_THRESHOLD[material.toUpperCase()] ?? 91.6;
  return purityPct >= threshold ? 'PASS' : 'FAIL';
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    DRAFT: 'Draft',
    AT_QUALITY_MANAGER: 'At QM',
    XRF_TESTING: 'XRF Testing',
    SAMPLING: 'Sampling',
    FIRE_ASSAY: 'Fire Assay',
    HUID_PRINTING: 'HUID Printing',
    FINAL_WEIGHTING: 'Final Weighting',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled',
  };
  return m[s] ?? s;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function frontendToBackendStatus(status: RequestStatus): string {
  switch (status) {
    case 'DRAFT':
    case 'AT_QUALITY_MANAGER':
    case 'XRF_TESTING': return 'RECEIVED';
    case 'SAMPLING':
    case 'FIRE_ASSAY': return 'SAMPLED';
    case 'HUID_PRINTING': return 'TESTED';
    case 'FINAL_WEIGHTING': return 'MARKED';
    case 'COMPLETE': return 'DISPATCHED';
    default: return 'RECEIVED';
  }
}

function buildWorkflowData(req: HmRequest): Record<string, unknown> {
  return {
    localId: req.id,
    requestNumber: req.requestNumber,
    bisRequestNumber: req.bisRequestNumber,
    customerName: req.customerName,
    material: req.material,
    ahcCenter: req.ahcCenter,
    lines: req.lines,
    weightStatus: req.weightStatus,
    frontendStatus: req.status,
    qmJobNumber: req.qmJobNumber,
    tagIds: req.tagIds,
    xrfResults: req.xrfResults,
    xrfAborted: req.xrfAborted,
    fireAssayLineIds: req.fireAssayLineIds,
    fireAssayResults: req.fireAssayResults,
    fireAssayAborted: req.fireAssayAborted,
    huidRemarking: req.huidRemarking,
    huidMarkingStartedAt: req.huidMarkingStartedAt,
    huidMarkedBy: req.huidMarkedBy,
    finalWeights: req.finalWeights,
    createdAt: req.createdAt,
  };
}

function mapJobToRequest(job: any): HmRequest | null {
  try {
    if (!job.workflowData) return null;
    const wf = JSON.parse(job.workflowData);
    if (!wf.requestNumber) return null;
    return {
      id: wf.localId || job.id,
      backendJobId: job.id,
      requestNumber: wf.requestNumber,
      bisRequestNumber: wf.bisRequestNumber ?? null,
      customerName: wf.customerName || '',
      material: wf.material || 'GOLD',
      ahcCenter: wf.ahcCenter || '',
      lines: wf.lines || [],
      weightStatus: wf.weightStatus || 'OK',
      status: wf.frontendStatus || 'DRAFT',
      createdAt: wf.createdAt || job.createdAt || new Date().toISOString(),
      qmJobNumber: wf.qmJobNumber,
      tagIds: wf.tagIds,
      xrfResults: wf.xrfResults,
      xrfAborted: wf.xrfAborted,
      fireAssayLineIds: wf.fireAssayLineIds,
      fireAssayResults: wf.fireAssayResults,
      fireAssayAborted: wf.fireAssayAborted,
      huidRemarking: wf.huidRemarking,
      huidMarkingStartedAt: wf.huidMarkingStartedAt,
      huidMarkedBy: wf.huidMarkedBy,
      finalWeights: wf.finalWeights,
    };
  } catch {
    return null;
  }
}

export default function HallmarkingDesk() {
  const [tab, setTab] = useState<'requests' | 'jobs' | 'delivery' | 'qm' | 'xrf' | 'sampling' | 'fire_assay' | 'huid' | 'final_weighting'>('requests');
  const [jobs, setJobs] = useState<HmJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobStatus, setJobStatus] = useState('');

  const [requests, setRequests] = useState<HmRequest[]>(() => readRequests());
  const [selectedId, setSelectedId] = useState<string>('');

  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>(() => readDeliveryOrders());
  const [deliveryReturns, setDeliveryReturns] = useState<DeliveryReturn[]>(() => readDeliveryReturns());
  const [deliverySubtab, setDeliverySubtab] = useState<'orders' | 'pickups' | 'returns'>('orders');

  const [doCustomerName, setDoCustomerName] = useState('');
  const [doDeliveryType, setDoDeliveryType] = useState<'PICKUP' | 'DISPATCH'>('PICKUP');
  const [doRemarks, setDoRemarks] = useState('');
  const [doFilter, setDoFilter] = useState('');
  const [doCurrentId, setDoCurrentId] = useState('');
  const [doPickupGross, setDoPickupGross] = useState('');
  const [doPickupNet, setDoPickupNet] = useState('');
  const [doScaleImage, setDoScaleImage] = useState<File | null>(null);
  const [doReceiptImage, setDoReceiptImage] = useState<File | null>(null);
  const [doPhcQty, setDoPhcQty] = useState('');
  const [doPhcGross, setDoPhcGross] = useState('');
  const [doPhcPurity, setDoPhcPurity] = useState('');

  const [retOrderId, setRetOrderId] = useState('');
  const [retCustomerName, setRetCustomerName] = useState('');
  const [retDeliveryDetails, setRetDeliveryDetails] = useState('');
  const [retRemarks, setRetRemarks] = useState('');

  // Quality Manager desk state
  const [qmSelectedId, setQmSelectedId] = useState('');
  const [qmJobNumber, setQmJobNumber] = useState('');
  const [qmTagInputs, setQmTagInputs] = useState<Record<string, string>>({});

  // XRF Testing desk state
  const [xrfSelectedId, setXrfSelectedId] = useState('');
  const [xrfKarats, setXrfKarats] = useState<Record<string, string>>({});   // lineId → karat string
  const [xrfExpFiles, setXrfExpFiles] = useState<Record<string, string>>({}); // lineId → filename

  // Final Weighting desk state
  const [fwSelectedId, setFwSelectedId] = useState('');
  const [fwWeights, setFwWeights] = useState<Record<string, string>>({});
  const [billSelectedId, setBillSelectedId] = useState('');

  // Sampling desk state
  const [samplingSelectedId, setSamplingSelectedId] = useState('');
  const [samplingChecked, setSamplingChecked] = useState<Record<string, boolean>>({});

  // Fire Assay desk state
  const [fireSelectedId, setFireSelectedId] = useState('');
  const [firePurityInputs, setFirePurityInputs] = useState<Record<string, string>>({});

  // HUID printing desk state
  const [huidSelectedId, setHuidSelectedId] = useState('');
  const [huidRemarking, setHuidRemarking] = useState(false);
  const [laserDispatch, setLaserDispatch] = useState<LaserHuidDispatch | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(LASER_HUID_DISPATCH_KEY) || 'null') as LaserHuidDispatch | null;
    } catch {
      return null;
    }
  });

  const [bisRequestNumber, setBisRequestNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [material, setMaterial] = useState('GOLD');
  const [ahcCenter, setAhcCenter] = useState('');

  const [itemCategory, setItemCategory] = useState('RING');
  const [declaredQty, setDeclaredQty] = useState(1);
  const [declaredWeight, setDeclaredWeight] = useState('');
  const [observedWeight, setObservedWeight] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [lines, setLines] = useState<RequestLine[]>([]);

  const currentLineStatus = useMemo<WeightStatus>(() => {
    const d = Number(declaredWeight);
    const o = Number(observedWeight);
    if (!Number.isFinite(d) || !Number.isFinite(o)) return 'OK';
    return lineWeightStatus(d, o);
  }, [declaredWeight, observedWeight]);

  useEffect(() => {
    writeRequests(requests);
  }, [requests]);

  // Load HM requests from backend on mount
  useEffect(() => {
    let mounted = true;
    api<any[]>(`${HM_BASE}/jobs`).then((data) => {
      if (!mounted || !Array.isArray(data)) return;
      const fromServer = data.map(mapJobToRequest).filter(Boolean) as HmRequest[];
      if (fromServer.length === 0) return;
      setRequests((prev) => {
        const serverLocalIds = new Set(fromServer.map((r) => r.id));
        const serverBackendIds = new Set(fromServer.map((r) => r.backendJobId).filter(Boolean));
        const localOnly = prev.filter(
          (r) => !serverLocalIds.has(r.id) && (!r.backendJobId || !serverBackendIds.has(r.backendJobId))
        );
        return [...fromServer, ...localOnly];
      });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    writeDeliveryOrders(deliveryOrders);
  }, [deliveryOrders]);

  useEffect(() => {
    writeDeliveryReturns(deliveryReturns);
  }, [deliveryReturns]);

  // Load delivery orders from backend on mount
  useEffect(() => {
    let mounted = true;
    api<any[]>(`${HM_BASE}/delivery-orders`).then((data) => {
      if (!mounted || !Array.isArray(data)) return;
      const fromServer: DeliveryOrder[] = data.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        deliveryType: o.deliveryType as 'PICKUP' | 'DISPATCH',
        remarks: o.remarks,
        status: o.status as DeliveryOrderStatus,
        createdAt: o.createdAt,
        customerGrossWeight: o.customerGrossWeight ?? undefined,
        customerNetWeight: o.customerNetWeight ?? undefined,
        phcQuantity: o.phcQuantity ?? undefined,
        phcGrossWeight: o.phcGrossWeight ?? undefined,
        declaredPurity: o.declaredPurity ?? undefined,
      }));
      setDeliveryOrders((prev) => {
        const ids = new Set(fromServer.map((o) => o.id));
        const localOnly = prev.filter((o) => !ids.has(o.id));
        return [...fromServer, ...localOnly];
      });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Load delivery returns from backend on mount
  useEffect(() => {
    let mounted = true;
    api<any[]>(`${HM_BASE}/delivery-orders/returns`).then((data) => {
      if (!mounted || !Array.isArray(data)) return;
      const fromServer: DeliveryReturn[] = data.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        customerName: r.customerName,
        deliveryDetails: r.deliveryDetails,
        remarks: r.remarks,
        status: r.status as ReturnStatus,
        deliveryDate: r.deliveryDate,
        createdAt: r.createdAt,
      }));
      setDeliveryReturns((prev) => {
        const ids = new Set(fromServer.map((r) => r.id));
        const localOnly = prev.filter((r) => !ids.has(r.id));
        return [...fromServer, ...localOnly];
      });
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (tab !== 'jobs') return;
    let mounted = true;
    async function load() {
      setLoadingJobs(true);
      try {
        const url = '/api/hm/api/v1/hm/jobs' + (jobStatus ? `?status=${jobStatus}` : '');
        const data = await api<HmJob[]>(url);
        if (mounted) setJobs(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (mounted) setJobs([]);
        toast.err(`HM Jobs: ${e?.message || e}`);
      } finally {
        if (mounted) setLoadingJobs(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [tab, jobStatus]);

  // Fire-and-forget sync of a request to the backend HmJob record
  function syncToBackend(req: HmRequest) {
    const wfData = JSON.stringify(buildWorkflowData(req));
    const backendStatus = frontendToBackendStatus(req.status);
    const body = JSON.stringify({ status: backendStatus, workflowData: wfData });
    if (req.backendJobId) {
      api(`${HM_BASE}/jobs/${req.backendJobId}`, { method: 'PATCH', body }).catch(() => {});
    } else {
      // Create backend job, then update backendJobId in state
      const totalPieces = req.lines.reduce((s, l) => s + l.declaredQty, 0) || 1;
      const totalGross = req.lines.reduce((s, l) => s + l.declaredWeight, 0) || 0;
      api<any>(`${HM_BASE}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          jobNumber: req.qmJobNumber || req.requestNumber,
          branchId: NIL_UUID, jewellerId: NIL_UUID,
          kind: 'HUID', purityLabel: req.material,
          pieceCount: totalPieces, grossWeight: totalGross,
          workflowData: wfData,
        }),
      }).then((job) => {
        setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, backendJobId: job.id } : r));
        // Now update status
        api(`${HM_BASE}/jobs/${job.id}`, { method: 'PATCH', body }).catch(() => {});
      }).catch(() => {});
    }
  }

  async function cancelRequest(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    if (req.backendJobId) {
      try {
        await api<any>(`${HM_BASE}/jobs/${req.backendJobId}/status?status=CANCELLED`, { method: 'PATCH' });
      } catch (e: any) {
        toast.err(`Failed to cancel on server: ${e?.message || e}`);
        return;
      }
    }
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'CANCELLED' } : r));
    if (selectedId === id) setSelectedId('');
    toast.ok('Request cancelled');
  }

  async function deleteRequest(id: string) {
    if (!confirm('Delete this request permanently? This cannot be undone.')) return;
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    if (req.backendJobId) {
      try {
        await api<any>(`${HM_BASE}/jobs/${req.backendJobId}`, { method: 'DELETE' });
      } catch (e: any) {
        toast.err(`Failed to delete on server: ${e?.message || e}`);
        return;
      }
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId('');
    toast.ok('Request deleted');
  }

  function clearForm() {
    setSelectedId('');
    setBisRequestNumber('');
    setCustomerName('');
    setMaterial('GOLD');
    setAhcCenter('');
    setItemCategory('RING');
    setDeclaredQty(1);
    setDeclaredWeight('');
    setObservedWeight('');
    setLines([]);
  }

  function addLine() {
    const d = Number(declaredWeight);
    const o = Number(observedWeight);
    if (!itemCategory || !declaredQty || !Number.isFinite(d) || !Number.isFinite(o)) {
      toast.err('Item Category, Declared Qty, Declared Weight and Observed Weight are mandatory');
      return;
    }
    const ws = lineWeightStatus(d, o);
    const line: RequestLine = {
      id: uuid(),
      itemCategory,
      declaredQty,
      declaredWeight: d,
      observedWeight: o,
      weightStatus: ws,
    };
    setLines((prev) => [...prev, line]);
    if (ws === 'WARNING') toast.warn('Weight discrepancy warning (> 0.5g)');
    else toast.ok('Item line added');
  }

  function coreValidate() {
    if (!customerName || !material || !ahcCenter) {
      toast.err('Customer Name, Material and AHC Center are mandatory');
      return false;
    }
    if (lines.length === 0) {
      toast.err('Add at least one item line');
      return false;
    }
    return true;
  }

  function saveDraft() {
    if (!coreValidate()) return;
    if (selectedId) {
      const existing = requests.find((r) => r.id === selectedId);
      if (existing) {
        const updated: HmRequest = {
          ...existing,
          bisRequestNumber: bisRequestNumber || null,
          customerName, material, ahcCenter, lines,
          weightStatus: reqWeightStatus(lines),
        };
        setRequests((prev) => prev.map((r) => r.id === selectedId ? updated : r));
        syncToBackend(updated);
        setRequestModalOpen(false);
        toast.ok('HM Request saved in Draft');
        return;
      }
    }
    const created: HmRequest = {
      id: uuid(),
      requestNumber: reqNumber(requests),
      bisRequestNumber: bisRequestNumber || null,
      customerName, material, ahcCenter, lines,
      weightStatus: reqWeightStatus(lines),
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    setSelectedId(created.id);
    setRequests((prev) => [created, ...prev]);
    syncToBackend(created);
    setRequestModalOpen(false);
    toast.ok('HM Request created in Draft');
  }

  function sendToQualityManager() {
    if (!coreValidate()) return;
    if (!bisRequestNumber) {
      toast.err('BIS Request Number is mandatory.');
      return;
    }
    const existing = selectedId ? requests.find((r) => r.id === selectedId) : null;
    if (existing) {
      const updated: HmRequest = {
        ...existing,
        bisRequestNumber: bisRequestNumber || null,
        customerName, material, ahcCenter, lines,
        weightStatus: reqWeightStatus(lines),
        status: 'AT_QUALITY_MANAGER',
      };
      setRequests((prev) => prev.map((r) => r.id === existing.id ? updated : r));
      syncToBackend(updated);
      setRequestModalOpen(false);
      if (updated.weightStatus === 'WARNING') {
        toast.warn('Submitted with weight discrepancy warning to Quality Manager');
      } else {
        toast.ok('HM Request submitted to Quality Manager');
      }
    } else {
      // Create new request directly at AT_QUALITY_MANAGER
      const created: HmRequest = {
        id: uuid(),
        requestNumber: reqNumber(requests),
        bisRequestNumber: bisRequestNumber || null,
        customerName, material, ahcCenter, lines,
        weightStatus: reqWeightStatus(lines),
        status: 'AT_QUALITY_MANAGER',
        createdAt: new Date().toISOString(),
      };
      setSelectedId(created.id);
      setRequests((prev) => [created, ...prev]);
      syncToBackend(created);
      setRequestModalOpen(false);
      if (created.weightStatus === 'WARNING') {
        toast.warn('Submitted with weight discrepancy warning to Quality Manager');
      } else {
        toast.ok('HM Request submitted to Quality Manager');
      }
    }
  }

  function openRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setSelectedId(r.id);
    setBisRequestNumber(r.bisRequestNumber || '');
    setCustomerName(r.customerName);
    setMaterial(r.material);
    setAhcCenter(r.ahcCenter);
    setLines(r.lines || []);
    setRequestModalOpen(true);
  }

  function openNewRequestModal() {
    clearForm();
    setRequestModalOpen(true);
  }

  async function createDeliveryOrder() {
    const domCustomer = (document.getElementById('doNewCustName') as HTMLInputElement | null)?.value || '';
    const domRemarks = (document.getElementById('doRemarks') as HTMLInputElement | null)?.value || '';
    const customer = (doCustomerName || domCustomer).trim();
    const remarks = (doRemarks || domRemarks).trim();

    if (!customer) {
      toast.err('Customer Name is required');
      return;
    }
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: customer,
          deliveryType: doDeliveryType,
          remarks: remarks || null,
        }),
      });
      const order: DeliveryOrder = {
        id: data.id,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        deliveryType: data.deliveryType,
        remarks: data.remarks,
        status: data.status,
        createdAt: data.createdAt,
      };
      setDeliveryOrders((prev) => [order, ...prev]);
      setDoCustomerName('');
      setDoRemarks('');
      toast.ok(`Order ${order.orderNumber} created — Status: Awaiting Pickup`);
    } catch (e: any) {
      toast.err(`Failed to create delivery order: ${e?.message || e}`);
    }
  }

  const filteredOrders = useMemo(() => {
    return doFilter ? deliveryOrders.filter((o) => o.status === doFilter) : deliveryOrders;
  }, [deliveryOrders, doFilter]);

  const currentOrder = useMemo(() => deliveryOrders.find((o) => o.id === doCurrentId) || null, [deliveryOrders, doCurrentId]);
  const myPickups = useMemo(() => deliveryOrders.filter((o) => o.status === 'AWAITING_PICKUP'), [deliveryOrders]);

  async function markAsPickedUp() {
    if (!currentOrder) return;
    if (!doPickupGross || !doPickupNet) {
      toast.err('Customer Gross Weight and Net Weight are required');
      return;
    }
    if (!doScaleImage || !doReceiptImage) {
      toast.err('Both weighing-machine and receipt images are required');
      return;
    }
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders/${currentOrder.id}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({
          customerGrossWeight: Number(doPickupGross),
          customerNetWeight: Number(doPickupNet),
        }),
      });
      setDeliveryOrders((prev) => prev.map((o) => o.id !== currentOrder.id ? o : {
        ...o,
        customerGrossWeight: data.customerGrossWeight,
        customerNetWeight: data.customerNetWeight,
        hasScaleImage: true,
        hasReceiptImage: true,
        status: 'IN_TRANSIT',
      }));
      setDoPickupGross('');
      setDoPickupNet('');
      setDoScaleImage(null);
      setDoReceiptImage(null);
      toast.ok('Order moved to In Transit — PHC entry is now available');
    } catch (e: any) {
      toast.err(`Failed to mark as picked up: ${e?.message || e}`);
    }
  }

  async function markAsReceived() {
    if (!currentOrder) return;
    if (!doPhcQty || !doPhcGross || !doPhcPurity.trim()) {
      toast.err('PHC Quantity, PHC Gross Weight and Declared Purity are mandatory');
      return;
    }
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders/${currentOrder.id}/receive`, {
        method: 'PATCH',
        body: JSON.stringify({
          phcQuantity: Number(doPhcQty),
          phcGrossWeight: Number(doPhcGross),
          declaredPurity: doPhcPurity.trim(),
        }),
      });
      setDeliveryOrders((prev) => prev.map((o) => o.id !== currentOrder.id ? o : {
        ...o,
        phcQuantity: data.phcQuantity,
        phcGrossWeight: data.phcGrossWeight,
        declaredPurity: data.declaredPurity,
        status: 'RECEIVED',
      }));
      setDoPhcQty('');
      setDoPhcGross('');
      setDoPhcPurity('');
      setDoCurrentId('');
      // Auto-create a DRAFT HM Request from the received delivery order
      const phcQtyNum = Number(doPhcQty);
      const phcGrossNum = Number(doPhcGross);
      const newLine: RequestLine = {
        id: uuid(),
        itemCategory: 'JEWELLERY',
        declaredQty: phcQtyNum,
        declaredWeight: phcGrossNum,
        observedWeight: phcGrossNum,
        weightStatus: 'OK',
      };
      const newReq: HmRequest = {
        id: uuid(),
        requestNumber: reqNumber(requests),
        bisRequestNumber: null,
        customerName: currentOrder.customerName,
        material: doPhcPurity.trim() || 'GOLD',
        ahcCenter: '',
        lines: [newLine],
        weightStatus: 'OK',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      };
      setRequests((prev) => [newReq, ...prev]);
      syncToBackend(newReq);
      setTab('requests');
      setSelectedId(newReq.id);
      setBisRequestNumber('');
      setCustomerName(newReq.customerName);
      setMaterial(newReq.material);
      setAhcCenter('');
      setLines([newLine]);
      setRequestModalOpen(true);
      toast.ok('Order marked as Received — HM Request created in Draft');
    } catch (e: any) {
      toast.err(`Failed to mark as received: ${e?.message || e}`);
    }
  }

  async function createReturnOrder() {
    const fromOrder = retOrderId ? deliveryOrders.find((o) => o.id === retOrderId) : null;
    const customer = (fromOrder?.customerName || retCustomerName).trim();
    if (!customer) {
      toast.err('Customer Name is required for return order');
      return;
    }
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders/returns`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: customer,
          orderId: fromOrder?.id || null,
          orderNumber: fromOrder?.orderNumber || null,
          deliveryDetails: retDeliveryDetails.trim() || null,
          remarks: retRemarks.trim() || null,
        }),
      });
      const ret: DeliveryReturn = {
        id: data.id,
        returnNumber: data.returnNumber,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        deliveryDetails: data.deliveryDetails,
        remarks: data.remarks,
        status: data.status,
        deliveryDate: data.deliveryDate,
        createdAt: data.createdAt,
      };
      setDeliveryReturns((prev) => [ret, ...prev]);
      setRetOrderId('');
      setRetCustomerName('');
      setRetDeliveryDetails('');
      setRetRemarks('');
      toast.ok(`Return order ${ret.returnNumber} created`);
    } catch (e: any) {
      toast.err(`Failed to create return order: ${e?.message || e}`);
    }
  }

  async function cancelDeliveryOrder(id: string) {
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders/${id}/cancel`, { method: 'PATCH' });
      setDeliveryOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: data.status } : o));
      if (doCurrentId === id) setDoCurrentId('');
      toast.ok('Delivery order cancelled');
    } catch (e: any) {
      toast.err(`Failed to cancel order: ${e?.message || e}`);
    }
  }

  async function markReturnDelivered(id: string) {
    try {
      const data = await api<any>(`${HM_BASE}/delivery-orders/returns/${id}/deliver`, { method: 'PATCH' });
      setDeliveryReturns((prev) => prev.map((r) => r.id === id ? {
        ...r,
        status: 'DELIVERED',
        deliveryDate: data.deliveryDate,
      } : r));
      toast.ok('Return marked as Delivery');
    } catch (e: any) {
      toast.err(`Failed to mark return as delivered: ${e?.message || e}`);
    }
  }

  // ── Quality Manager Desk ─────────────────────────────────────────────

  const qmRequests = useMemo(() => requests.filter((r) => r.status === 'AT_QUALITY_MANAGER' || r.status === 'XRF_TESTING'), [requests]);
  const qmSelected = useMemo(() => requests.find((r) => r.id === qmSelectedId) || null, [requests, qmSelectedId]);

  function openQmRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setQmSelectedId(id);
    setQmJobNumber(r.qmJobNumber || '');
    // pre-fill existing tag ids if any
    setQmTagInputs(r.tagIds ? { ...r.tagIds } : {});
  }

  function generateTagIds() {
    if (!qmSelected) return;
    const tags: Record<string, string> = {};
    qmSelected.lines.forEach((l, i) => {
      tags[l.id] = `HUID-${qmSelected.requestNumber}-${String(i + 1).padStart(3, '0')}`;
    });
    setQmTagInputs(tags);
    toast.ok('Tag IDs generated for all item lines');
  }

  function sendToXrfTesting() {
    if (!qmSelected) return;
    if (!qmJobNumber.trim()) {
      toast.err('Job Number is required before sending to XRF Testing');
      return;
    }
    const missingTags = qmSelected.lines.filter((l) => !qmTagInputs[l.id]?.trim());
    if (missingTags.length > 0) {
      toast.err(`${missingTags.length} item line(s) are missing Tag IDs — use Generate Tag IDs first`);
      return;
    }
    const updated: HmRequest = { ...qmSelected, qmJobNumber: qmJobNumber.trim(), tagIds: { ...qmTagInputs }, status: 'XRF_TESTING' };
    setRequests((prev) => prev.map((r) => r.id === qmSelected.id ? updated : r));
    syncToBackend(updated);
    toast.ok(`Request ${qmSelected.requestNumber} sent to XRF Testing`);
    setQmSelectedId('');
    setQmJobNumber('');
    setQmTagInputs({});
  }

  // ── XRF Testing Desk ──────────────────────────────────────────────────

  const xrfRequests = useMemo(
    () => requests.filter((r) => r.status === 'XRF_TESTING' || !!r.xrfResults),
    [requests],
  );
  const xrfSelected = useMemo(() => requests.find((r) => r.id === xrfSelectedId) || null, [requests, xrfSelectedId]);

  function openXrfRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setXrfSelectedId(id);
    setXrfKarats({});
    setXrfExpFiles({});
  }

  function submitXrfResults() {
    if (!xrfSelected) return;
    const missing = xrfSelected.lines.filter((l) => !xrfKarats[l.id] || !xrfExpFiles[l.id]);
    if (missing.length > 0) {
      toast.err(`${missing.length} line(s) are missing Tested Karat or .exp file`);
      return;
    }
    const results: Record<string, XrfLineResult> = {};
    let anyFail = false;
    xrfSelected.lines.forEach((l) => {
      const karat = parseFloat(xrfKarats[l.id]);
      if (!Number.isFinite(karat) || karat <= 0 || karat > 24) {
        throw new Error(`Invalid karat for line ${l.itemCategory}`);
      }
      const purityPct = karatToPurityPct(karat);
      const verdict = xrfVerdict(purityPct, xrfSelected.material);
      if (verdict === 'FAIL') anyFail = true;
      results[l.id] = {
        testedKarat: karat,
        purityPct,
        verdict,
        expFileName: xrfExpFiles[l.id] || null,
        submittedAt: new Date().toISOString(),
      };
    });

    const passCount = Object.values(results).filter((r) => r.verdict === 'PASS').length;
    const failCount = Object.values(results).filter((r) => r.verdict === 'FAIL').length;

    const xrfUpdated: HmRequest = { ...xrfSelected, xrfResults: results, status: 'SAMPLING' };
    setRequests((prev) => prev.map((r) => r.id === xrfSelected.id ? xrfUpdated : r));
    syncToBackend(xrfUpdated);
    if (anyFail) {
      toast.warn(`XRF results submitted — ${passCount} PASS, ${failCount} FAIL. Failed items logged. Use Abort Process to skip to Final Weighting.`);
    } else {
      toast.ok(`XRF results submitted — all ${passCount} item(s) PASSED. Ready for Sampling.`);
    }
    setXrfSelectedId('');
    setXrfKarats({});
    setXrfExpFiles({});
  }

  function abortXrfProcess(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    const aborted: HmRequest = { ...r, xrfAborted: true, status: 'FINAL_WEIGHTING' };
    setRequests((prev) => prev.map((req) => req.id === id ? aborted : req));
    syncToBackend(aborted);
    toast.warn(`Process aborted for ${r.requestNumber} — jumped directly to Final Weighting`);
    if (xrfSelectedId === id) {
      setXrfSelectedId('');
      setXrfKarats({});
      setXrfExpFiles({});
    }
  }

  // ── Final Weighting Desk ─────────────────────────────────────────────

  const fwRequests = useMemo(() => requests.filter((r) => r.status === 'FINAL_WEIGHTING'), [requests]);
  const completedRequests = useMemo(() => requests.filter((r) => r.status === 'COMPLETE'), [requests]);
  const fwSelected = useMemo(() => requests.find((r) => r.id === fwSelectedId) || null, [requests, fwSelectedId]);
  const billSelected = useMemo(() => requests.find((r) => r.id === billSelectedId) || null, [requests, billSelectedId]);
  const samplingRequests = useMemo(() => requests.filter((r) => r.status === 'SAMPLING'), [requests]);
  const samplingSelected = useMemo(() => requests.find((r) => r.id === samplingSelectedId) || null, [requests, samplingSelectedId]);
  const fireRequests = useMemo(() => requests.filter((r) => r.status === 'FIRE_ASSAY'), [requests]);
  const fireSelected = useMemo(() => requests.find((r) => r.id === fireSelectedId) || null, [requests, fireSelectedId]);
  const huidRequests = useMemo(() => requests.filter((r) => r.status === 'HUID_PRINTING'), [requests]);
  const huidSelected = useMemo(() => requests.find((r) => r.id === huidSelectedId) || null, [requests, huidSelectedId]);

  const dailyHuidCount = useMemo(() => {
    const d = todayYmd();
    return requests
      .filter((r) => (r.huidMarkingStartedAt || '').startsWith(d))
      .reduce((sum, r) => sum + Object.keys(r.tagIds || {}).length, 0);
  }, [requests]);

  function openSamplingRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setSamplingSelectedId(id);
    const checks: Record<string, boolean> = {};
    r.lines.forEach((l) => {
      checks[l.id] = false;
    });
    setSamplingChecked(checks);
  }

  function sendToFireAssay() {
    if (!samplingSelected) return;
    const selectedLineIds = samplingSelected.lines
      .filter((l) => samplingChecked[l.id])
      .map((l) => l.id);

    if (selectedLineIds.length === 0) {
      toast.err('Select at least one XRF-passed item for Fire Assay');
      return;
    }

    const invalid = selectedLineIds.filter((id) => samplingSelected.xrfResults?.[id]?.verdict !== 'PASS');
    if (invalid.length > 0) {
      toast.err('Failed XRF items cannot be selected for Fire Assay');
      return;
    }

    const fireUpdated: HmRequest = { ...samplingSelected, fireAssayLineIds: selectedLineIds, status: 'FIRE_ASSAY' };
    setRequests((prev) => prev.map((r) => r.id === samplingSelected.id ? fireUpdated : r));
    syncToBackend(fireUpdated);
    toast.ok(`Moved ${selectedLineIds.length} item(s) to Fire Assay`);
    setSamplingSelectedId('');
    setSamplingChecked({});
  }

  function openFireRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setFireSelectedId(id);
    const inputs: Record<string, string> = {};
    (r.fireAssayLineIds || []).forEach((lineId) => {
      inputs[lineId] = r.fireAssayResults?.[lineId]?.testedPurityPct?.toString() || '';
    });
    setFirePurityInputs(inputs);
  }

  function submitFireAssayResults() {
    if (!fireSelected) return;
    const lineIds = fireSelected.fireAssayLineIds || [];
    const missing = lineIds.filter((id) => !firePurityInputs[id]);
    if (missing.length > 0) {
      toast.err(`${missing.length} Fire Assay result(s) are missing`);
      return;
    }

    const threshold = PURITY_THRESHOLD[fireSelected.material.toUpperCase()] ?? 91.6;
    const results: Record<string, FireAssayLineResult> = {};
    let anyFail = false;

    lineIds.forEach((id) => {
      const purity = Number(firePurityInputs[id]);
      if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
        throw new Error('Invalid Fire Assay purity value');
      }
      const verdict: XrfVerd = purity >= threshold ? 'PASS' : 'FAIL';
      if (verdict === 'FAIL') anyFail = true;
      results[id] = {
        testedPurityPct: purity,
        verdict,
        submittedAt: new Date().toISOString(),
      };
    });

    setRequests((prev) => prev.map((r) => r.id === fireSelected.id
      ? { ...r, fireAssayResults: results, status: anyFail ? 'FIRE_ASSAY' : 'HUID_PRINTING' }
      : r,
    ));

    if (anyFail) {
      toast.warn('Fire Assay has failed item(s). Use Abort Process to skip HUID and move to Final Weighting.');
    } else {
      toast.ok('Fire Assay passed. Request moved to HUID Printing.');
      setFireSelectedId('');
      setFirePurityInputs({});
    }
    syncToBackend({ ...fireSelected, fireAssayResults: results, status: anyFail ? 'FIRE_ASSAY' : 'HUID_PRINTING' });
  }

  function abortFireAssayProcess(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    const faAborted: HmRequest = { ...r, fireAssayAborted: true, status: 'FINAL_WEIGHTING' };
    setRequests((prev) => prev.map((req) => req.id === id ? faAborted : req));
    syncToBackend(faAborted);
    toast.warn(`Fire Assay aborted for ${r.requestNumber} — moved to Final Weighting`);
  }

  function openHuidRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setHuidSelectedId(id);
    setHuidRemarking(!!r.huidRemarking);
  }

  function startHuidMarking() {
    if (!huidSelected) return;
    const huidStarted: HmRequest = {
      ...huidSelected,
      huidRemarking,
      huidMarkingStartedAt: new Date().toISOString(),
      huidMarkedBy: 'CURRENT_USER',
    };
    setRequests((prev) => prev.map((r) => r.id === huidSelected.id ? huidStarted : r));
    syncToBackend(huidStarted);
    toast.ok(`HUID marking started${huidRemarking ? ' with Remarking enabled' : ''}`);
  }

  function moveHuidToFinalWeighting() {
    if (!huidSelected) return;
    const r = requests.find((x) => x.id === huidSelected.id);
    if (!r?.huidMarkingStartedAt) {
      toast.err('Start Marking before moving to Final Weighting');
      return;
    }
    const huidDone: HmRequest = { ...r, status: 'FINAL_WEIGHTING' };
    setRequests((prev) => prev.map((req) => req.id === huidSelected.id ? huidDone : req));
    syncToBackend(huidDone);
    toast.ok('Moved to Final Weighting');
    setHuidSelectedId('');
  }

  function dispatchHuidCount(mode: 'MANUAL' | 'AUTO_10PM') {
    const payload: LaserHuidDispatch = {
      count: dailyHuidCount,
      date: todayYmd(),
      sentAt: new Date().toISOString(),
      mode,
    };
    localStorage.setItem(LASER_HUID_DISPATCH_KEY, JSON.stringify(payload));
    setLaserDispatch(payload);
    if (mode === 'MANUAL') toast.ok(`Sent daily HUID count (${payload.count}) to Laser Module`);
    else toast.ok(`Auto-sent daily HUID count (${payload.count}) to Laser Module at 10 PM`);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const today = todayYmd();
      const last = localStorage.getItem(LAST_AUTO_HUID_DATE_KEY) || '';
      if (now.getHours() === 22 && last !== today) {
        localStorage.setItem(LAST_AUTO_HUID_DATE_KEY, today);
        dispatchHuidCount('AUTO_10PM');
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [dailyHuidCount]);

  function openFwRequest(id: string) {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setFwSelectedId(id);
    const pre: Record<string, string> = {};
    r.lines.forEach((l) => { pre[l.id] = r.finalWeights?.[l.id]?.toString() ?? ''; });
    setFwWeights(pre);
  }

  async function submitFinalWeights() {
    if (!fwSelected) return;
    const missing = fwSelected.lines.filter((l) => !fwWeights[l.id]);
    if (missing.length > 0) {
      toast.err(`Final weight is required for all ${missing.length} item line(s)`);
      return;
    }
    const weights: Record<string, number> = {};
    fwSelected.lines.forEach((l) => { weights[l.id] = parseFloat(fwWeights[l.id]); });
    const completed: HmRequest = { ...fwSelected, finalWeights: weights, status: 'COMPLETE' };
    setRequests((prev) => prev.map((r) => r.id === fwSelected.id ? completed : r));
    toast.ok(`Final weights recorded for ${fwSelected.requestNumber} — status: Complete`);
    // Sync COMPLETE status + workflowData; if already has backendJobId, also create dispatch record
    const backendId = fwSelected.backendJobId;
    if (backendId) {
      syncToBackend(completed);
      const totalPieces = completed.lines.reduce((s, l) => s + l.declaredQty, 0);
      api(`${HM_BASE}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ jobId: backendId, receivedByName: 'SYSTEM', pieceCount: totalPieces, remarks: completed.requestNumber }),
      }).catch(() => {});
    } else {
      syncToBackend(completed);
    }
    setFwSelectedId('');
    setFwWeights({});
  }

  return (
    <div>
      <PageHeader
        title="Hallmarking Desk"
        subtitle="React implementation of HM Jobs and HM Requests workflows"
      />

      <div className="grid grid-cols-9 gap-2 mb-5">
        <Stat label="Total Requests" value={requests.length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="At QM" value={requests.filter((r) => r.status === 'AT_QUALITY_MANAGER').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="XRF Testing" value={requests.filter((r) => r.status === 'XRF_TESTING').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Sampling" value={requests.filter((r) => r.status === 'SAMPLING').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Fire Assay" value={requests.filter((r) => r.status === 'FIRE_ASSAY').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="HUID Printing" value={requests.filter((r) => r.status === 'HUID_PRINTING').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Final Weighting" value={requests.filter((r) => r.status === 'FINAL_WEIGHTING').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Completed" value={requests.filter((r) => r.status === 'COMPLETE').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Warnings" value={requests.filter((r) => r.weightStatus === 'WARNING').length} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('requests')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'requests' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          HM Requests
        </button>
        <button onClick={() => setTab('jobs')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'jobs' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          HM Jobs
        </button>
        <button onClick={() => setTab('delivery')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'delivery' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          Delivery Desk
        </button>
        <button id="tabQm" onClick={() => setTab('qm')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'qm' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          Quality Manager Desk
        </button>
        <button id="tabXrf" onClick={() => setTab('xrf')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'xrf' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          XRF Testing
        </button>
        <button id="tabSampling" onClick={() => setTab('sampling')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'sampling' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          Sampling Desk
        </button>
        <button id="tabFireAssay" onClick={() => setTab('fire_assay')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'fire_assay' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          Fire Assay Desk
        </button>
        <button id="tabHuid" onClick={() => setTab('huid')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'huid' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          HUID Printing Desk
        </button>
        <button id="tabFw" onClick={() => setTab('final_weighting')} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === 'final_weighting' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
          Final Weighting
        </button>
      </div>

      {tab === 'xrf' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">XRF Testing Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Material</th><th>Items</th><th>Job #</th><th>Stage</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {xrfRequests.length === 0 && <tr><td colSpan={7} className="text-center text-nexus-muted">No XRF records found</td></tr>}
                  {xrfRequests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.customerName}</td>
                      <td>{r.material}</td>
                      <td>{r.lines.length}</td>
                      <td>{r.qmJobNumber || '—'}</td>
                      <td><span className="inline-flex px-2 py-1 rounded-full text-xs border border-blue-500/40 bg-blue-500/15 text-blue-300">{statusLabel(r.status)}</span></td>
                      <td className="flex gap-2">
                        <button id={`xrfOpen-${r.id}`} className="btn" onClick={() => openXrfRequest(r.id)}>Open</button>
                        {r.status === 'XRF_TESTING' && <button id={`xrfAbort-${r.id}`} className="btn" onClick={() => abortXrfProcess(r.id)}>Abort Process</button>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {xrfSelected && xrfSelected.status === 'XRF_TESTING' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">XRF Entry — {xrfSelected.requestNumber}</h3>
              <p className="text-xs text-nexus-muted mb-1">Customer: {xrfSelected.customerName} · Material: {xrfSelected.material} · Job #: {xrfSelected.qmJobNumber}</p>
              <p className="text-xs text-amber-300 mb-3">Purity threshold for {xrfSelected.material}: {PURITY_THRESHOLD[xrfSelected.material.toUpperCase()] ?? 91.6}% — system auto-calculates from Tested Karat</p>

              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>HUID Tag</th><th>Category</th><th>Qty</th><th>Observed Wt</th>
                      <th>Tested Karat*</th><th>Purity %</th><th>Verdict</th><th>.exp File*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xrfSelected.lines.map((l, i) => {
                      const karat = parseFloat(xrfKarats[l.id] || '0');
                      const purityPct = karat > 0 ? karatToPurityPct(karat) : null;
                      const verdict = purityPct !== null ? xrfVerdict(purityPct, xrfSelected.material) : null;
                      return (
                        <tr key={l.id}>
                          <td>{i + 1}</td>
                          <td className="text-xs">{xrfSelected.tagIds?.[l.id] || '—'}</td>
                          <td>{l.itemCategory}</td>
                          <td>{l.declaredQty}</td>
                          <td>{l.observedWeight.toFixed(4)}</td>
                          <td>
                            <input
                              id={`xrfKarat-${l.id}`}
                              className="input text-xs w-20"
                              type="number"
                              step="0.01"
                              min="1" max="24"
                              value={xrfKarats[l.id] || ''}
                              onChange={(e) => setXrfKarats((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              placeholder="22.00"
                            />
                          </td>
                          <td id={`xrfPurity-${l.id}`} className="text-xs">
                            {purityPct !== null ? `${purityPct}%` : '—'}
                          </td>
                          <td>
                            {verdict && (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                                verdict === 'PASS'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}>{verdict}</span>
                            )}
                          </td>
                          <td>
                            <input
                              id={`xrfExp-${l.id}`}
                              className="input text-xs"
                              type="file"
                              accept=".exp,.EXP"
                              onChange={(e) => {
                                const fn = e.target.files?.[0]?.name || '';
                                setXrfExpFiles((prev) => ({ ...prev, [l.id]: fn }));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button id="xrfSubmit" className="btn-primary" onClick={submitXrfResults}>Submit XRF Results</button>
                <button id="xrfAbortInline" className="btn" onClick={() => abortXrfProcess(xrfSelected.id)}>Abort Process → Final Weighting</button>
              </div>
            </div>
          )}

          {xrfSelected && xrfSelected.status !== 'XRF_TESTING' && (
            <div className="card p-4 border border-nexus-line">
              <h3 className="text-sm font-semibold mb-1">XRF Record (Read-only) — {xrfSelected.requestNumber}</h3>
              <p className="text-xs text-amber-300 mb-3">This record has moved to {statusLabel(xrfSelected.status)}. XRF fields are locked; historical values can be viewed only.</p>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Tag</th><th>Category</th><th>Tested Karat</th><th>Purity %</th><th>Verdict</th><th>.exp File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xrfSelected.lines.map((l, i) => {
                      const xr = xrfSelected.xrfResults?.[l.id];
                      return (
                        <tr key={l.id}>
                          <td>{i + 1}</td>
                          <td className="text-xs">{xrfSelected.tagIds?.[l.id] || '—'}</td>
                          <td>{l.itemCategory}</td>
                          <td>{xr?.testedKarat ?? '—'}</td>
                          <td>{xr ? `${xr.purityPct}%` : '—'}</td>
                          <td>{xr?.verdict || '—'}</td>
                          <td className="text-xs">{xr?.expFileName || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sampling' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Sampling Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Material</th><th>Items</th><th>Failed Items</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {samplingRequests.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No requests at Sampling stage</td></tr>}
                  {samplingRequests.map((r) => {
                    const failCount = Object.values(r.xrfResults || {}).filter((x) => x.verdict === 'FAIL').length;
                    return (
                      <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td>{r.requestNumber}</td>
                        <td>{r.customerName}</td>
                        <td>{r.material}</td>
                        <td>{r.lines.length}</td>
                        <td>{failCount}</td>
                        <td className="flex gap-2">
                          <button id={`samplingOpen-${r.id}`} className="btn" onClick={() => openSamplingRequest(r.id)}>Open</button>
                          {failCount > 0 && (
                            <button id={`samplingAbort-${r.id}`} className="btn" onClick={() => abortXrfProcess(r.id)}>Abort Process</button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {samplingSelected && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">Sampling Selection — {samplingSelected.requestNumber}</h3>
              <p className="text-xs text-nexus-muted mb-3">Items that failed XRF are greyed out and cannot be selected. Only PASS items can be sent to Fire Assay.</p>

              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Tag</th><th>Category</th><th>XRF Purity</th><th>Verdict</th><th>Selectable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samplingSelected.lines.map((l, i) => {
                      const xrf = samplingSelected.xrfResults?.[l.id];
                      const failed = xrf?.verdict === 'FAIL';
                      return (
                        <tr key={l.id} className={failed ? 'opacity-50' : ''}>
                          <td>{i + 1}</td>
                          <td className="text-xs">{samplingSelected.tagIds?.[l.id] || '—'}</td>
                          <td>{l.itemCategory}</td>
                          <td>{xrf ? `${xrf.purityPct}%` : '—'}</td>
                          <td>
                            {xrf ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                                xrf.verdict === 'PASS'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}>{xrf.verdict}</span>
                            ) : '—'}
                          </td>
                          <td>
                            <input
                              id={`samplingChk-${l.id}`}
                              type="checkbox"
                              checked={!!samplingChecked[l.id]}
                              onChange={(e) => setSamplingChecked((prev) => ({ ...prev, [l.id]: e.target.checked }))}
                              disabled={failed}
                              className="accent-nexus-accent"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <button id="samplingSendFire" className="btn-primary" onClick={sendToFireAssay}>Send Selected to Fire Assay</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'fire_assay' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Fire Assay Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Material</th><th>Items For Assay</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fireRequests.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No requests at Fire Assay</td></tr>}
                  {fireRequests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.customerName}</td>
                      <td>{r.material}</td>
                      <td>{(r.fireAssayLineIds || []).length}</td>
                      <td>{statusLabel(r.status)}</td>
                      <td className="flex gap-2">
                        <button id={`fireOpen-${r.id}`} className="btn" onClick={() => openFireRequest(r.id)}>Open</button>
                        <button id={`fireAbort-${r.id}`} className="btn" onClick={() => abortFireAssayProcess(r.id)}>Abort Process</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {fireSelected && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">Fire Assay Entry — {fireSelected.requestNumber}</h3>
              <p className="text-xs text-amber-300 mb-3">Enter Fire Assay purity %. Failed Fire Assay can be aborted to skip HUID and jump to Final Weighting.</p>

              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Tag</th><th>Category</th><th>XRF Verdict</th><th>Fire Assay Purity %*</th><th>Fire Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fireSelected.fireAssayLineIds || []).map((lineId, i) => {
                      const line = fireSelected.lines.find((l) => l.id === lineId);
                      if (!line) return null;
                      const purity = Number(firePurityInputs[lineId]);
                      const threshold = PURITY_THRESHOLD[fireSelected.material.toUpperCase()] ?? 91.6;
                      const verdict = Number.isFinite(purity) && purity > 0 ? (purity >= threshold ? 'PASS' : 'FAIL') : null;
                      return (
                        <tr key={lineId}>
                          <td>{i + 1}</td>
                          <td className="text-xs">{fireSelected.tagIds?.[lineId] || '—'}</td>
                          <td>{line.itemCategory}</td>
                          <td>{fireSelected.xrfResults?.[lineId]?.verdict || '—'}</td>
                          <td>
                            <input
                              id={`firePurity-${lineId}`}
                              className="input text-xs w-24"
                              type="number"
                              min="1"
                              max="100"
                              step="0.001"
                              value={firePurityInputs[lineId] || ''}
                              onChange={(e) => setFirePurityInputs((prev) => ({ ...prev, [lineId]: e.target.value }))}
                              placeholder="91.600"
                            />
                          </td>
                          <td>
                            {verdict && (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                                verdict === 'PASS'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}>{verdict}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button id="fireSubmit" className="btn-primary" onClick={submitFireAssayResults}>Submit Fire Assay Results</button>
                <button id="fireAbortInline" className="btn" onClick={() => abortFireAssayProcess(fireSelected.id)}>Abort Process</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'huid' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">HUID Printing Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Items</th><th>Tags</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {huidRequests.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No requests ready for HUID Printing</td></tr>}
                  {huidRequests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.customerName}</td>
                      <td>{r.lines.length}</td>
                      <td>{Object.keys(r.tagIds || {}).length}</td>
                      <td>{statusLabel(r.status)}</td>
                      <td><button id={`huidOpen-${r.id}`} className="btn" onClick={() => openHuidRequest(r.id)}>Open</button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {huidSelected && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">HUID Marking — {huidSelected.requestNumber}</h3>
              <p className="text-xs text-nexus-muted mb-3">Check Remarking when applicable, then start marking and move to Final Weighting.</p>
              <label className="inline-flex items-center gap-2 text-sm text-nexus-muted mb-3">
                <input id="huidRemarking" type="checkbox" checked={huidRemarking} onChange={(e) => setHuidRemarking(e.target.checked)} />
                Remarking
              </label>
              <div className="flex gap-2">
                <button id="huidStart" className="btn-primary" onClick={startHuidMarking}>Start Marking</button>
                <button id="huidMoveFw" className="btn" onClick={moveHuidToFinalWeighting}>Move to Final Weighting</button>
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Send Daily HUID Count</h3>
            <p id="huidDailyCount" className="text-sm text-nexus-muted mb-3">Total for today: {dailyHuidCount}</p>
            <button id="huidSendLaser" className="btn-primary" onClick={() => dispatchHuidCount('MANUAL')}>Send to Laser Module</button>

            <div className="mt-4 text-xs text-nexus-muted">
              <p className="font-semibold text-white/80 mb-1">Laser Module Inbox (simulated)</p>
              <p id="laserDispatchInfo">
                {laserDispatch
                  ? `Received count ${laserDispatch.count} for ${laserDispatch.date} at ${new Date(laserDispatch.sentAt).toLocaleTimeString()} (${laserDispatch.mode})`
                  : 'No HUID count received yet'}
              </p>
              <p className="mt-1">Auto schedule: sends once daily at 10:00 PM while app session is active.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'final_weighting' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Final Weighting Queue</h3>
            <p className="text-xs text-nexus-muted mb-3">All items — both XRF-passed and XRF-failed — appear here so their final weight can be recorded.</p>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Material</th><th>Items</th><th>Aborted?</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fwRequests.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No requests at Final Weighting</td></tr>}
                  {fwRequests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.customerName}</td>
                      <td>{r.material}</td>
                      <td>{r.lines.length}</td>
                      <td>
                        {r.xrfAborted && <span className="text-amber-300 text-xs">Yes — XRF Aborted</span>}
                        {r.fireAssayAborted && <span className="text-amber-300 text-xs">Yes — Fire Assay Aborted</span>}
                        {!r.xrfAborted && !r.fireAssayAborted && '—'}
                      </td>
                      <td><button id={`fwOpen-${r.id}`} className="btn" onClick={() => openFwRequest(r.id)}>Open</button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {fwSelected && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">Final Weighting — {fwSelected.requestNumber}</h3>
              <p className="text-xs text-nexus-muted mb-1">Customer: {fwSelected.customerName} · Material: {fwSelected.material}</p>
              {fwSelected.xrfAborted && (
                <p className="text-xs text-amber-300 mb-2">⚠ XRF process was aborted — Sampling and Fire Assay stages skipped</p>
              )}
              {fwSelected.fireAssayAborted && (
                <p className="text-xs text-amber-300 mb-3">⚠ Fire Assay process was aborted — HUID Marking skipped</p>
              )}

              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>HUID Tag</th><th>Category</th><th>Qty</th><th>XRF Verdict</th><th>Purity %</th><th>Final Weight (g)*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fwSelected.lines.map((l, i) => {
                      const xrf = fwSelected.xrfResults?.[l.id];
                      return (
                        <tr key={l.id}>
                          <td>{i + 1}</td>
                          <td className="text-xs">{fwSelected.tagIds?.[l.id] || '—'}</td>
                          <td>{l.itemCategory}</td>
                          <td>{l.declaredQty}</td>
                          <td>
                            {xrf ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                                xrf.verdict === 'PASS'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}>{xrf.verdict}</span>
                            ) : fwSelected.xrfAborted ? <span className="text-amber-300 text-xs">Aborted</span> : '—'}
                          </td>
                          <td>{xrf ? `${xrf.purityPct}%` : '—'}</td>
                          <td>
                            <input
                              id={`fwWeight-${l.id}`}
                              className="input text-xs w-24"
                              type="number"
                              step="0.0001"
                              value={fwWeights[l.id] || ''}
                              onChange={(e) => setFwWeights((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              placeholder="0.0000"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button id="fwSubmit" className="btn-primary" onClick={submitFinalWeights}>Move to Completed</button>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Completed Orders</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th><th>Customer</th><th>Total Items</th><th>Rejected</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRequests.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No completed orders yet</td></tr>}
                  {completedRequests.map((r) => {
                    const rejected = Object.values(r.xrfResults || {}).filter((x) => x.verdict === 'FAIL').length;
                    return (
                      <tr key={r.id}>
                        <td>{r.requestNumber}</td>
                        <td>{r.customerName}</td>
                        <td>{r.lines.length}</td>
                        <td>{rejected}</td>
                        <td><button id={`billOpen-${r.id}`} className="btn" onClick={() => setBillSelectedId(r.id)}>View Bill</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {billSelected && billSelected.status === 'COMPLETE' && (
              <div className="mt-4 border border-nexus-line rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">Billing Summary — {billSelected.requestNumber}</h4>
                <div className="grid md:grid-cols-2 gap-2 text-xs text-nexus-muted">
                  <p id="billTotalItems">Total Items in HM Request: {billSelected.lines.length}</p>
                  <p id="billRejectedItems">Rejected Items: {Object.values(billSelected.xrfResults || {}).filter((x) => x.verdict === 'FAIL').length}</p>
                  <p>Rate Per Item: {HM_BILL_RATE_PER_ITEM}</p>
                  <p id="billableItems">Billable Items: {billSelected.lines.length} (includes rejected)</p>
                  <p id="billAmount" className="text-white font-semibold">Total Amount: {billSelected.lines.length * HM_BILL_RATE_PER_ITEM}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'qm' && (
        <div className="space-y-4">
          {/* HM-011: info banner — manual creation not allowed */}
          <div className="card p-4 border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-lg">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-300">Manual creation not permitted</p>
                <p className="text-xs text-nexus-muted mt-0.5">QM records are auto-created by the system when an HM Request is submitted via <em>Save and Send to Quality Manager</em>. You cannot create a QM record directly here.</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Quality Manager Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th>
                    <th>BIS Request #</th>
                    <th>Customer</th>
                    <th>Material</th>
                    <th>Items</th>
                    <th>Weight</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qmRequests.length === 0 && <tr><td colSpan={8} className="text-center text-nexus-muted">No requests at Quality Manager — submit an HM Request first. Requests at later stages (XRF, Sampling, etc.) are shown on their respective desks.</td></tr>}
                  {qmRequests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.bisRequestNumber || <span className="text-red-300">—</span>}</td>
                      <td>{r.customerName}</td>
                      <td>{r.material}</td>
                      <td>{r.lines.length}</td>
                      <td>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${r.weightStatus === 'WARNING' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}>
                          {r.weightStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${
                          r.status === 'XRF_TESTING'
                            ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                            : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        }`}>
                          {r.status === 'XRF_TESTING' ? 'XRF Testing' : 'At Quality Manager'}
                        </span>
                      </td>
                      <td>
                        <button id={`qmOpen-${r.id}`} className="btn" onClick={() => openQmRequest(r.id)}>Open</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {qmSelected && qmSelected.status === 'AT_QUALITY_MANAGER' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">QM Processing — {qmSelected.requestNumber}</h3>
              <p className="text-xs text-nexus-muted mb-4">Customer: {qmSelected.customerName} · Material: {qmSelected.material} · AHC: {qmSelected.ahcCenter}</p>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <Field label="Job Number*">
                  <input
                    id="qmJobNumber"
                    className="input"
                    value={qmJobNumber}
                    onChange={(e) => setQmJobNumber(e.target.value)}
                    placeholder="JOB-20260501-001"
                  />
                </Field>
                <div className="flex items-end">
                  <button id="qmGenerateTags" className="btn" onClick={generateTagIds}>
                    Generate Tag IDs for All Items
                  </button>
                </div>
              </div>

              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Declared Wt</th>
                      <th>Observed Wt</th>
                      <th>Wt Status</th>
                      <th>HUID Tag ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qmSelected.lines.map((l, i) => (
                      <tr key={l.id}>
                        <td>{i + 1}</td>
                        <td>{l.itemCategory}</td>
                        <td>{l.declaredQty}</td>
                        <td>{l.declaredWeight.toFixed(4)}</td>
                        <td>{l.observedWeight.toFixed(4)}</td>
                        <td>
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${l.weightStatus === 'WARNING' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}>
                            {l.weightStatus}
                          </span>
                        </td>
                        <td>
                          <input
                            id={`qmTag-${l.id}`}
                            className="input text-xs"
                            value={qmTagInputs[l.id] || ''}
                            onChange={(e) => setQmTagInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                            placeholder="HUID-..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button id="qmSendXrf" className="btn-primary" onClick={sendToXrfTesting}>
                Send to XRF Testing
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">HM Request Entry</h3>
                <p className="text-xs text-nexus-muted mt-1">Use modal form for new request and edits.</p>
              </div>
              <button className="btn-primary" onClick={openNewRequestModal}>+ Add New HM Request</button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Requests</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Request #</th>
                    <th>BIS Request #</th>
                    <th>Customer</th>
                    <th>Material</th>
                    <th>AHC</th>
                    <th>Items</th>
                    <th>Weight</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-nexus-muted">No hallmarking requests</td></tr>
                  )}
                  {requests.map((r) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{r.requestNumber}</td>
                      <td>{r.bisRequestNumber || <span className="text-red-300">Missing</span>}</td>
                      <td>{r.customerName}</td>
                      <td>{r.material}</td>
                      <td>{r.ahcCenter}</td>
                      <td>{r.lines.length}</td>
                      <td>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${r.weightStatus === 'WARNING' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}>
                          {r.weightStatus}
                        </span>
                      </td>
                      <td>{statusLabel(r.status)}</td>
                      <td className="flex gap-2">
                        <button className="btn" onClick={() => openRequest(r.id)}>Open</button>
                        {r.status === 'DRAFT' && <button className="btn" onClick={() => { openRequest(r.id); setTimeout(sendToQualityManager, 0); }}>Send</button>}
                        {r.status !== 'COMPLETE' && r.status !== 'CANCELLED' && (
                          <button className="btn" onClick={() => cancelRequest(r.id)}>Cancel</button>
                        )}
                        <button className="btn" onClick={() => deleteRequest(r.id)}>Delete</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedId && (() => {
              const sr = requests.find((r) => r.id === selectedId);
              const failed = sr
                ? sr.lines
                    .map((l) => ({ line: l, xrf: sr.xrfResults?.[l.id] }))
                    .filter((x) => x.xrf?.verdict === 'FAIL')
                : [];
              if (!sr || failed.length === 0) return null;
              return (
                <div className="mt-4 border border-red-500/30 rounded-lg p-3 bg-red-500/5">
                  <h4 className="text-xs font-semibold text-red-300 mb-2">Rejected Items Log (XRF Failed)</h4>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Tag</th><th>Category</th><th>Observed Wt</th><th>Purity %</th><th>Verdict</th><th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failed.map((x) => (
                          <tr key={x.line.id}>
                            <td className="text-xs">{sr.tagIds?.[x.line.id] || '—'}</td>
                            <td>{x.line.itemCategory}</td>
                            <td>{x.line.observedWeight.toFixed(4)}</td>
                            <td>{x.xrf?.purityPct}%</td>
                            <td><span className="inline-flex px-2 py-0.5 rounded-full text-xs border border-red-500/40 bg-red-500/15 text-red-300">FAIL</span></td>
                            <td>Purity below claimed threshold</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          {requestModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-6xl card p-4 md:p-5 mt-8 mb-8">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold">{selectedId ? 'Edit HM Request' : 'New HM Request'}</h3>
                  <button className="btn" onClick={() => setRequestModalOpen(false)}>Close</button>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <Field label="BIS Request Number*">
                    <input id="hmrBis" className="input" value={bisRequestNumber} onChange={(e) => setBisRequestNumber(e.target.value)} placeholder="BIS-REQ-2026-001" />
                  </Field>
                  <Field label="Customer Name*">
                    <input id="hmrCustomer" className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Jewellers" />
                  </Field>
                  <Field label="Material*">
                    <select id="hmrMaterial" className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>
                      <option>GOLD</option>
                      <option>SILVER</option>
                      <option>PLATINUM</option>
                    </select>
                  </Field>
                  <Field label="AHC Center*">
                    <input id="hmrAhc" className="input" value={ahcCenter} onChange={(e) => setAhcCenter(e.target.value)} placeholder="AHC Mumbai" />
                  </Field>
                </div>

                <h4 className="text-xs font-semibold mt-4 mb-2 text-nexus-muted">Item Line</h4>
                <div className="grid md:grid-cols-5 gap-3">
                  <Field label="Item Category*">
                    <select id="hmrItemCategory" className="input" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                      <option>RING</option>
                      <option>CHAIN</option>
                      <option>BANGLE</option>
                      <option>NECKLACE</option>
                      <option>COIN</option>
                      <option>OTHER</option>
                    </select>
                  </Field>
                  <Field label="Declared Quantity*">
                    <input id="hmrItemQty" className="input" type="number" min={1} value={declaredQty} onChange={(e) => setDeclaredQty(Number(e.target.value || 1))} />
                  </Field>
                  <Field label="Declared Weight (g)*">
                    <input id="hmrItemDeclaredWeight" className="input" type="number" step="0.0001" value={declaredWeight} onChange={(e) => setDeclaredWeight(e.target.value)} />
                  </Field>
                  <Field label="Observed Weight (g)*">
                    <input id="hmrItemObservedWeight" className="input" type="number" step="0.0001" value={observedWeight} onChange={(e) => setObservedWeight(e.target.value)} />
                  </Field>
                  <Field label="Weight Status">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${currentLineStatus === 'WARNING' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}>
                      {currentLineStatus}
                    </span>
                  </Field>
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button className="btn-primary" onClick={addLine}>+ Add Item Line</button>
                  <button className="btn" onClick={saveDraft}>Save Draft</button>
                  <button className="btn" onClick={sendToQualityManager}>Save and Send to Quality Manager</button>
                  <button className="btn" onClick={clearForm}>Reset</button>
                </div>

                <div className="table-wrap mt-4">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item Category</th>
                        <th>Declared Qty</th>
                        <th>Declared Weight</th>
                        <th>Observed Weight</th>
                        <th>Weight Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-nexus-muted">No item lines yet</td></tr>
                      )}
                      {lines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.itemCategory}</td>
                          <td>{l.declaredQty}</td>
                          <td>{l.declaredWeight.toFixed(4)}</td>
                          <td>{l.observedWeight.toFixed(4)}</td>
                          <td>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${l.weightStatus === 'WARNING' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'}`}>
                              {l.weightStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="card p-4">
          <div className="flex gap-2 items-end mb-3">
            <Field label="Status filter">
              <select className="input" value={jobStatus} onChange={(e) => setJobStatus(e.target.value)}>
                <option value="">All</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="SAMPLED">SAMPLED</option>
                <option value="TESTED">TESTED</option>
                <option value="MARKED">MARKED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </Field>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Kind</th>
                  <th>Purity</th>
                  <th>Pieces</th>
                  <th>Gross g</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingJobs && <tr><td colSpan={6} className="text-center text-nexus-muted">Loading…</td></tr>}
                {!loadingJobs && jobs.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No jobs found</td></tr>}
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.jobNumber || '—'}</td>
                    <td>{j.kind || '—'}</td>
                    <td>{j.purityLabel || '—'}</td>
                    <td>{j.pieceCount ?? '—'}</td>
                    <td>{j.grossWeight ?? '—'}</td>
                    <td>{j.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'delivery' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-1">
            <button onClick={() => setDeliverySubtab('orders')} className={`px-3 py-1.5 rounded-lg border text-sm ${deliverySubtab === 'orders' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
              All Orders
            </button>
            <button onClick={() => setDeliverySubtab('pickups')} className={`px-3 py-1.5 rounded-lg border text-sm ${deliverySubtab === 'pickups' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
              My Pickups
            </button>
            <button onClick={() => setDeliverySubtab('returns')} className={`px-3 py-1.5 rounded-lg border text-sm ${deliverySubtab === 'returns' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`}>
              Returns
            </button>
          </div>

          {deliverySubtab === 'orders' && (
            <>
              <div className="card p-4">
                <h3 className="text-sm font-semibold mb-3">New Pickup Order</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <Field label="Customer Name*">
                    <input id="doNewCustName" className="input" value={doCustomerName} onChange={(e) => setDoCustomerName(e.target.value)} placeholder="Acme Jewellers" />
                  </Field>
                  <Field label="Delivery Type">
                    <select id="doDeliveryType" className="input" value={doDeliveryType} onChange={(e) => setDoDeliveryType(e.target.value as 'PICKUP' | 'DISPATCH')}>
                      <option value="PICKUP">PICKUP</option>
                      <option value="DISPATCH">DISPATCH</option>
                    </select>
                  </Field>
                  <Field label="Remarks">
                    <input id="doRemarks" className="input" value={doRemarks} onChange={(e) => setDoRemarks(e.target.value)} />
                  </Field>
                </div>
                <div className="mt-3">
                  <button className="btn-primary" onClick={createDeliveryOrder}>Send for Pickup</button>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex gap-2 items-end mb-3">
                  <Field label="Filter status">
                    <select id="doFilter" className="input" value={doFilter} onChange={(e) => setDoFilter(e.target.value)}>
                      <option value="">All</option>
                      <option value="AWAITING_PICKUP">AWAITING_PICKUP</option>
                      <option value="IN_TRANSIT">IN_TRANSIT</option>
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </Field>
                </div>

                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Order #</th><th>Customer</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No orders</td></tr>}
                      {filteredOrders.map((o) => (
                        <tr key={o.id}>
                          <td>{o.orderNumber}</td>
                          <td>{o.customerName}</td>
                          <td>{o.deliveryType}</td>
                          <td>{o.status}</td>
                          <td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                          <td className="flex gap-2">
                            <button className="btn" onClick={() => setDoCurrentId(o.id)}>Open</button>
                            {(o.status === 'AWAITING_PICKUP' || o.status === 'IN_TRANSIT') && (
                              <button className="btn" onClick={() => cancelDeliveryOrder(o.id)}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {currentOrder && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold mb-1">Order {currentOrder.orderNumber}</h3>
                  <div className="text-xs text-nexus-muted mb-3">Status: {currentOrder.status} · Customer: {currentOrder.customerName}</div>

                  {currentOrder.status === 'AWAITING_PICKUP' && (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <Field label="Customer Gross Weight (g)*">
                          <input id="doPickupGross" className="input" type="number" step="0.0001" value={doPickupGross} onChange={(e) => setDoPickupGross(e.target.value)} />
                        </Field>
                        <Field label="Customer Net Weight (g)*">
                          <input id="doPickupNet" className="input" type="number" step="0.0001" value={doPickupNet} onChange={(e) => setDoPickupNet(e.target.value)} />
                        </Field>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Field label="Image: Weighing Machine*">
                          <input id="doImgScale" className="input" type="file" accept="image/*" onChange={(e) => setDoScaleImage(e.target.files?.[0] || null)} />
                        </Field>
                        <Field label="Image: Jeweller Receipt*">
                          <input id="doImgReceipt" className="input" type="file" accept="image/*" onChange={(e) => setDoReceiptImage(e.target.files?.[0] || null)} />
                        </Field>
                      </div>
                      <button className="btn-primary" onClick={markAsPickedUp}>Mark as Picked Up</button>
                    </div>
                  )}

                  {currentOrder.status === 'IN_TRANSIT' && (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-3 gap-3">
                        <Field label="PHC Quantity*">
                          <input id="doPhcQty" className="input" type="number" min={1} value={doPhcQty} onChange={(e) => setDoPhcQty(e.target.value)} />
                        </Field>
                        <Field label="PHC Gross Weight (g)*">
                          <input id="doPhcGross" className="input" type="number" step="0.0001" value={doPhcGross} onChange={(e) => setDoPhcGross(e.target.value)} />
                        </Field>
                        <Field label="Declared Purity*">
                          <input id="doPhcPurity" className="input" value={doPhcPurity} onChange={(e) => setDoPhcPurity(e.target.value)} placeholder="22K / 916.667" />
                        </Field>
                      </div>
                      <button className="btn-primary" onClick={markAsReceived}>Mark as Received</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {deliverySubtab === 'pickups' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">My Pickups</h3>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Order #</th><th>Customer</th><th>Created</th><th>Action</th></tr></thead>
                  <tbody>
                    {myPickups.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No items awaiting pickup</td></tr>}
                    {myPickups.map((o) => (
                      <tr key={o.id}>
                        <td>{o.orderNumber}</td>
                        <td>{o.customerName}</td>
                        <td>{new Date(o.createdAt).toLocaleString()}</td>
                        <td>
                          <button className="btn" onClick={() => { setDeliverySubtab('orders'); setDoCurrentId(o.id); }}>
                            Pick Up
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {deliverySubtab === 'returns' && (
            <>
              <div className="card p-4">
                <h3 className="text-sm font-semibold mb-3">New Return Order</h3>
                <div className="grid md:grid-cols-4 gap-3">
                  <Field label="Source Order (optional)">
                    <select id="retOrder" className="input" value={retOrderId} onChange={(e) => setRetOrderId(e.target.value)}>
                      <option value="">— select —</option>
                      {deliveryOrders.filter((o) => o.status === 'RECEIVED').map((o) => (
                        <option key={o.id} value={o.id}>{o.orderNumber} - {o.customerName}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Customer Name*">
                    <input id="retCustomer" className="input" value={retCustomerName} onChange={(e) => setRetCustomerName(e.target.value)} placeholder="Acme Jewellers" />
                  </Field>
                  <Field label="Delivery Details">
                    <input id="retDetails" className="input" value={retDeliveryDetails} onChange={(e) => setRetDeliveryDetails(e.target.value)} placeholder="Courier / hand delivery" />
                  </Field>
                  <Field label="Remarks">
                    <input id="retRemarks" className="input" value={retRemarks} onChange={(e) => setRetRemarks(e.target.value)} />
                  </Field>
                </div>
                <div className="mt-3"><button className="btn-primary" onClick={createReturnOrder}>Mark as Delivery</button></div>
              </div>

              <div className="card p-4">
                <h3 className="text-sm font-semibold mb-3">Returns</h3>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Return #</th><th>Order #</th><th>Customer</th><th>Delivery Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {deliveryReturns.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No return orders</td></tr>}
                      {deliveryReturns.map((r) => (
                        <tr key={r.id}>
                          <td>{r.returnNumber}</td>
                          <td>{r.orderNumber || '—'}</td>
                          <td>{r.customerName}</td>
                          <td>{r.deliveryDate || '—'}</td>
                          <td>{r.status}</td>
                          <td>
                            {r.status !== 'DELIVERED' && <button className="btn" onClick={() => markReturnDelivered(r.id)}>Mark as Delivery</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs text-nexus-muted flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}
