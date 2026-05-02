import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import { PageHeader, Stat } from '@/components/Bits';
import { api } from '@/lib/api';

type WorkType = 'BRANCH' | 'CUSTOMER';
type RefineryStatus = 'INTAKE' | 'RECEIPT' | 'INTAKE_APPROVAL' | 'BATCHED';
type BatchStatus = 'AQUA_REGIA' | 'REFINING_ASSAY' | 'FINAL_PROCESSING' | 'COMPLETED';
type AlloyMetal = 'COPPER' | 'SILVER' | 'ZINC';

type RefineryOrder = {
  id: string;
  reference: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  workType: WorkType;
  customerId: string | null;
  customerNo: string | null;
  customerName: string | null;
  sentGoldWeight: number;
  declaredPurity: string;
  status: RefineryStatus;
  batchId?: string;
  receivedGoldWeight?: number;
  observedPurityPct?: number;
  meltingTotalWeight?: number;
  meltingSampleWeight?: number;
  createdAt: string;
};

type AquaRegiaData = {
  suggestedHclMl: number;
  suggestedHno3Ml: number;
  suggestedHhAcidMl: number;
  suggestedUreaG: number;
  usedHclMl: number;
  usedHno3Ml: number;
  usedHhAcidMl: number;
  usedUreaG: number;
  deviationWarnings: string[];
};

type AlloyLine = {
  id: string;
  metal: AlloyMetal;
  qtyG: number;
};

type RefineryBatch = {
  id: string;
  batchNo: string;
  branchId: string;
  branchCode: string;
  orderIds: string[];
  totalBatchWeight: number;
  status: BatchStatus;
  aquaRegia?: AquaRegiaData;
  expectedPureGold?: number;
  alloyLines: AlloyLine[];
  createdAt: string;
};

type Branch = { id: string; code: string; name: string };
type Customer = { id: string; no: string; name: string };
type InventoryItem = { metal: string; qtyG: number };
type BranchInventory = Record<string, InventoryItem[]>;

type BranchAcidTolerance = {
  hclPct: number;
  hno3Pct: number;
  hhAcidPct: number;
  ureaPct: number;
};

type AdminBranchRef = { id: string; code: string; name: string };
type AdminCustomerRef = { id: string; no: string; name: string };

const ORDER_KEY = 'nexus.react.refinery.orders.v1';
const BATCH_KEY = 'nexus.react.refinery.batches.v1';
const INV_KEY = 'nexus.react.refinery.branch.inventory.v1';
const RF_BASE = '/api/refinery/api/v1/refinery';
const ADMIN_BASE = '/api/admin/api/v1/admin';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// Load backend batches and map to frontend RefineryBatch
function mapBackendBatch(b: any): RefineryBatch {
  let r: any = {};
  try { r = JSON.parse(b.remarks || '{}'); } catch {}
  return {
    id: b.id,
    batchNo: b.batchNumber || b.id,
    branchId: r.branchId || '',
    branchCode: r.branchCode || 'BLR',
    orderIds: r.orderIds || [],
    totalBatchWeight: Number(b.inputGross) || 0,
    status: (r.stage as BatchStatus) || 'AQUA_REGIA',
    aquaRegia: r.aq,
    expectedPureGold: r.expectedPureGold != null ? Number(r.expectedPureGold) : (Number(b.inputPure) || 0),
    alloyLines: r.alloyLines || [],
    createdAt: b.createdAt || new Date().toISOString(),
  };
}

function mapBackendOrder(o: any): RefineryOrder {
  return {
    id: o.id,
    reference: o.orderNumber || o.id,
    branchId: o.branchId || '',
    branchCode: o.branchCode || '',
    branchName: o.branchCode || '',
    workType: (o.workType as WorkType) || 'CUSTOMER',
    customerId: o.customerId || null,
    customerNo: o.customerNo || null,
    customerName: o.customerName || null,
    sentGoldWeight: Number(o.sentGoldWeight) || 0,
    declaredPurity: o.declaredPurity || '',
    status: (o.status as RefineryStatus) || 'RECEIPT',
    batchId: o.batchId || undefined,
    receivedGoldWeight: o.receivedGoldWeight != null ? Number(o.receivedGoldWeight) : undefined,
    observedPurityPct: o.observedPurityPct != null ? Number(o.observedPurityPct) : undefined,
    meltingTotalWeight: o.meltingTotalWeight != null ? Number(o.meltingTotalWeight) : undefined,
    meltingSampleWeight: o.meltingSampleWeight != null ? Number(o.meltingSampleWeight) : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  };
}

const STATIC_BRANCHES: Branch[] = [
  { id: NIL_UUID, code: 'MUM', name: 'Mumbai' },
  { id: NIL_UUID, code: 'BLR', name: 'Bengaluru' },
  { id: NIL_UUID, code: 'DEL', name: 'Delhi' },
];

const STATIC_CUSTOMERS: Customer[] = [
  { id: NIL_UUID, no: '0001', name: 'Acme Jewels' },
  { id: NIL_UUID, no: '0002', name: 'Royal Gold' },
  { id: NIL_UUID, no: '0003', name: 'Silver Star' },
];

const BRANCH_ACID_MASTER: Record<string, BranchAcidTolerance> = {
  MUM: { hclPct: 10, hno3Pct: 10, hhAcidPct: 10, ureaPct: 10 },
  BLR: { hclPct: 10, hno3Pct: 10, hhAcidPct: 10, ureaPct: 10 },
  DEL: { hclPct: 10, hno3Pct: 10, hhAcidPct: 10, ureaPct: 10 },
};

function defaultInventory(): BranchInventory {
  return {
    MUM: [
      { metal: 'RAW_GOLD', qtyG: 150000 },
      { metal: 'COPPER', qtyG: 30000 },
      { metal: 'SILVER', qtyG: 20000 },
      { metal: 'ZINC', qtyG: 12000 },
    ],
    BLR: [
      { metal: 'RAW_GOLD', qtyG: 150000 },
      { metal: 'COPPER', qtyG: 30000 },
      { metal: 'SILVER', qtyG: 20000 },
      { metal: 'ZINC', qtyG: 12000 },
    ],
    DEL: [
      { metal: 'RAW_GOLD', qtyG: 150000 },
      { metal: 'COPPER', qtyG: 30000 },
      { metal: 'SILVER', qtyG: 20000 },
      { metal: 'ZINC', qtyG: 12000 },
    ],
  };
}

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function yyyymmdd() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function readOrders(): RefineryOrder[] {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') as RefineryOrder[];
  } catch {
    return [];
  }
}

function writeOrders(v: RefineryOrder[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(v));
}

function readBatches(): RefineryBatch[] {
  try {
    return JSON.parse(localStorage.getItem(BATCH_KEY) || '[]') as RefineryBatch[];
  } catch {
    return [];
  }
}

function writeBatches(v: RefineryBatch[]) {
  localStorage.setItem(BATCH_KEY, JSON.stringify(v));
}

function readInventory(): BranchInventory {
  try {
    const parsed = JSON.parse(localStorage.getItem(INV_KEY) || 'null') as BranchInventory | null;
    return parsed || defaultInventory();
  } catch {
    return defaultInventory();
  }
}

function writeInventory(v: BranchInventory) {
  localStorage.setItem(INV_KEY, JSON.stringify(v));
}

function adjustInventory(inv: BranchInventory, branchCode: string, metal: string, deltaG: number): BranchInventory {
  const branchInv = [...(inv[branchCode] || [])];
  const idx = branchInv.findIndex((x) => x.metal === metal);
  if (idx >= 0) {
    branchInv[idx] = { ...branchInv[idx], qtyG: Number((branchInv[idx].qtyG + deltaG).toFixed(4)) };
  } else {
    branchInv.push({ metal, qtyG: Number(deltaG.toFixed(4)) });
  }
  return { ...inv, [branchCode]: branchInv };
}

function nextReference(list: RefineryOrder[], branchCode: string, customerNo: string) {
  const day = yyyymmdd();
  const prefix = `${branchCode}-${day}-${customerNo}-`;
  const seq = list
    .filter((o) => o.reference.startsWith(prefix))
    .reduce((max, o) => {
      const v = Number(o.reference.split('-').pop());
      return Number.isFinite(v) ? Math.max(max, v) : max;
    }, 0);
  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

function nextBatchNo(list: RefineryBatch[], branchCode: string) {
  const day = yyyymmdd();
  const prefix = `${branchCode}_${day}_`;
  const seq = list
    .filter((b) => b.batchNo.startsWith(prefix))
    .reduce((max, b) => {
      const v = Number(b.batchNo.split('_').pop());
      return Number.isFinite(v) ? Math.max(max, v) : max;
    }, 0);
  return `${prefix}${seq + 1}`;
}

function round(v: number) {
  return Number(v.toFixed(3));
}

function suggestAqua(totalBatchWeightG: number) {
  const kg = totalBatchWeightG / 1000;
  return {
    hclMl: round(1690 * kg),
    hno3Ml: round(320 * kg),
    hhAcidMl: round(300 * kg),
    ureaG: round(2000 * kg),
  };
}

export default function RefineryDesk() {
  const [orders, setOrders] = useState<RefineryOrder[]>(() => readOrders());
  const [batches, setBatches] = useState<RefineryBatch[]>(() => readBatches());
  const [inventory, setInventory] = useState<BranchInventory>(() => readInventory());
  const [branchRefs, setBranchRefs] = useState<AdminBranchRef[]>([]);
  const [customerRefs, setCustomerRefs] = useState<AdminCustomerRef[]>([]);

  const branchOptions: Branch[] = branchRefs.length > 0
    ? branchRefs.map(b => ({ id: b.id, code: b.code, name: b.name }))
    : STATIC_BRANCHES;
  const customerOptions: Customer[] = customerRefs.length > 0
    ? customerRefs.map(c => ({ id: c.id, no: c.no || c.id.slice(0, 6), name: c.name }))
    : STATIC_CUSTOMERS;

  // Load master data and orders/batches from backend on mount
  useEffect(() => {
    api<any[]>(`${ADMIN_BASE}/branches`)
      .then(rows => setBranchRefs(rows.map((b: any) => ({ id: b.id, code: String(b.code || b.name || 'BR').toUpperCase(), name: b.name || b.code || 'Branch' }))))
      .catch(() => {});
    api<any[]>(`${ADMIN_BASE}/customers`)
      .then(rows => setCustomerRefs(rows.map((c: any) => ({ id: c.id, no: c.code || c.customerCode || c.id.slice(0,6), name: c.name || '' }))))
      .catch(() => {});
  }, []);

  // Load orders from backend on mount
  useEffect(() => {
    api<any[]>(`${RF_BASE}/orders`)
      .then(data => {
        const beOrders = data.map(mapBackendOrder);
        setOrders(prev => {
          const beIds = new Set(beOrders.map(o => o.id));
          const localOnly = prev.filter(o => !beIds.has(o.id));
          const merged = [...beOrders, ...localOnly];
          writeOrders(merged);
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Load batches from backend on mount, merge with localStorage
  useEffect(() => {
    api<any[]>(`${RF_BASE}/batches`)
      .then(data => {
        const beBatches = data.map(mapBackendBatch);
        setBatches(prev => {
          const beIds = new Set(beBatches.map(b => b.id));
          const localOnly = prev.filter(b => !beIds.has(b.id));
          const merged = [...beBatches, ...localOnly];
          writeBatches(merged);
          return merged;
        });
      })
      .catch(() => {});
  }, []);
  const [activeTab, setActiveTab] = useState<'intake' | 'receipt' | 'approval' | 'batch' | 'aqua' | 'refining' | 'final'>('intake');

  const [branchId, setBranchId] = useState('');
  const [workType, setWorkType] = useState<WorkType>('CUSTOMER');
  const [customerId, setCustomerId] = useState('');
  const [sentGoldWeight, setSentGoldWeight] = useState('');
  const [declaredPurity, setDeclaredPurity] = useState('');

  const [receiptOrderId, setReceiptOrderId] = useState('');
  const [receivedGoldWeight, setReceivedGoldWeight] = useState('');
  const [observedPurityPct, setObservedPurityPct] = useState('');
  const [meltingTotalWeight, setMeltingTotalWeight] = useState('');
  const [meltingSampleWeight, setMeltingSampleWeight] = useState('');

  const [pickedOrderIds, setPickedOrderIds] = useState<Record<string, boolean>>({});

  const [aquaBatchId, setAquaBatchId] = useState('');
  const [aquaUsedHcl, setAquaUsedHcl] = useState('');
  const [aquaUsedHno3, setAquaUsedHno3] = useState('');
  const [aquaUsedHhAcid, setAquaUsedHhAcid] = useState('');
  const [aquaUsedUrea, setAquaUsedUrea] = useState('');
  const [aquaWarning, setAquaWarning] = useState('');

  const [refineBatchId, setRefineBatchId] = useState('');

  const [finalBatchId, setFinalBatchId] = useState('');
  const [alloyMetal, setAlloyMetal] = useState<AlloyMetal>('COPPER');
  const [alloyQty, setAlloyQty] = useState('');

  useEffect(() => {
    writeOrders(orders);
  }, [orders]);

  useEffect(() => {
    writeBatches(batches);
  }, [batches]);

  useEffect(() => {
    writeInventory(inventory);
  }, [inventory]);

  const intakeOrders = useMemo(() => orders.filter((o) => o.status === 'INTAKE'), [orders]);
  const receiptOrders = useMemo(() => orders.filter((o) => o.status === 'RECEIPT'), [orders]);
  const approvalOrders = useMemo(() => orders.filter((o) => o.status === 'INTAKE_APPROVAL'), [orders]);
  const batchEligibleOrders = useMemo(() => orders.filter((o) => o.status === 'INTAKE_APPROVAL'), [orders]);

  const selectedReceipt = useMemo(() => orders.find((o) => o.id === receiptOrderId) || null, [orders, receiptOrderId]);
  const selectedAquaBatch = useMemo(() => batches.find((b) => b.id === aquaBatchId) || null, [batches, aquaBatchId]);
  const selectedRefineBatch = useMemo(() => batches.find((b) => b.id === refineBatchId) || null, [batches, refineBatchId]);
  const selectedFinalBatch = useMemo(() => batches.find((b) => b.id === finalBatchId) || null, [batches, finalBatchId]);

  const refiningExpectedPure = useMemo(() => {
    if (!selectedRefineBatch) return 0;
    const linkedOrders = orders.filter((o) => selectedRefineBatch.orderIds.includes(o.id));
    const sum = linkedOrders.reduce((acc, o) => {
      const recv = Number(o.receivedGoldWeight || 0);
      const purity = Number(o.observedPurityPct || 0);
      return acc + (recv * purity) / 100;
    }, 0);
    return round(sum);
  }, [selectedRefineBatch, orders]);

  const selectedBatchBranchInventory = useMemo(() => {
    if (!selectedFinalBatch) return [] as InventoryItem[];
    return inventory[selectedFinalBatch.branchCode] || [];
  }, [selectedFinalBatch, inventory]);

  function resetIntakeForm() {
    setBranchId('');
    setWorkType('CUSTOMER');
    setCustomerId('');
    setSentGoldWeight('');
    setDeclaredPurity('');
  }

  async function createOrder() {
    const branch = branchOptions.find((b) => b.id === branchId);
    if (!branch) {
      toast.err('Branch is required.');
      return;
    }
    if (!Number.isFinite(Number(sentGoldWeight)) || Number(sentGoldWeight) <= 0) {
      toast.err('Sent Gold Weight must be positive.');
      return;
    }
    if (!declaredPurity.trim()) {
      toast.err('Declared Purity is required.');
      return;
    }

    let customerNo = '0000';
    let customerName: string | null = null;
    let cid: string | null = null;
    let cidUUID: string | null = null;

    if (workType === 'CUSTOMER') {
      const c = customerOptions.find((x) => x.id === customerId);
      if (!c) {
        toast.err('Validation error: Customer is mandatory for Customer work type.');
        return;
      }
      customerNo = c.no;
      customerName = c.name;
      cid = c.id;
      cidUUID = /^[0-9a-f-]{36}$/i.test(c.id) ? c.id : null;
    }

    const reference = nextReference(orders, branch.code, customerNo);

    try {
      const created = await api<any>(`${RF_BASE}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          orderNumber: reference,
          branchId: /^[0-9a-f-]{36}$/i.test(branch.id) ? branch.id : NIL_UUID,
          branchCode: branch.code,
          customerId: cidUUID,
          customerNo,
          customerName,
          workType,
          sentGoldWeight: Number(sentGoldWeight),
          declaredPurity: declaredPurity.trim(),
        }),
      });
      const newOrder = mapBackendOrder(created);
      setOrders((prev) => [newOrder, ...prev]);
      toast.ok(`Order saved with reference ${reference}`);
    } catch {
      // Fallback to local-only
      const fallback: RefineryOrder = {
        id: uuid(),
        reference,
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        workType,
        customerId: cid,
        customerNo: workType === 'CUSTOMER' ? customerNo : null,
        customerName,
        sentGoldWeight: Number(sentGoldWeight),
        declaredPurity: declaredPurity.trim(),
        status: 'RECEIPT',
        createdAt: new Date().toISOString(),
      };
      setOrders((prev) => [fallback, ...prev]);
      toast.ok(`Order saved locally with reference ${reference}`);
    }
    resetIntakeForm();
  }

  function openReceipt(id: string) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    setReceiptOrderId(id);
    setReceivedGoldWeight(o.receivedGoldWeight?.toString() || '');
    setObservedPurityPct(o.observedPurityPct?.toString() || '');
    setMeltingTotalWeight(o.meltingTotalWeight?.toString() || '');
    setMeltingSampleWeight(o.meltingSampleWeight?.toString() || '');
  }

  function saveReceiptAndAdvance() {
    if (!selectedReceipt) return;

    const recv = Number(receivedGoldWeight);
    const observed = Number(observedPurityPct || '0');
    const meltTotal = Number(meltingTotalWeight);
    const meltSample = Number(meltingSampleWeight);

    if (!Number.isFinite(recv) || recv <= 0) {
      toast.err('Received Gold Weight must be positive.');
      return;
    }
    if (recv > selectedReceipt.sentGoldWeight) {
      toast.err('Validation error: received weight cannot exceed sent weight.');
      return;
    }
    if (!Number.isFinite(meltTotal) || meltTotal <= 0) {
      toast.err('Validation error: melting total weight must be positive.');
      return;
    }
    if (!Number.isFinite(meltSample) || meltSample <= 0) {
      toast.err('Melting sample weight must be positive.');
      return;
    }
    if (observedPurityPct && (!Number.isFinite(observed) || observed <= 0)) {
      toast.err('Observed Purity must be positive when provided.');
      return;
    }

    const patch = {
      receivedGoldWeight: recv,
      observedPurityPct: observedPurityPct ? observed : null,
      meltingTotalWeight: meltTotal,
      meltingSampleWeight: meltSample,
      status: 'INTAKE_APPROVAL',
    };

    setOrders((prev) => prev.map((o) => (
      o.id === selectedReceipt.id
        ? { ...o, receivedGoldWeight: recv, observedPurityPct: observedPurityPct ? observed : undefined, meltingTotalWeight: meltTotal, meltingSampleWeight: meltSample, status: 'INTAKE_APPROVAL' }
        : o
    )));

    // Sync to backend (fire and forget with silent fallback)
    api(`${RF_BASE}/orders/${selectedReceipt.id}`, { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => {});

    toast.ok('Order advanced to Intake Approval Desk.');
    setReceiptOrderId('');
    setReceivedGoldWeight('');
    setObservedPurityPct('');
    setMeltingTotalWeight('');
    setMeltingSampleWeight('');
  }

  function createBatchFromApprovedOrders() {
    const picked = batchEligibleOrders.filter((o) => pickedOrderIds[o.id]);
    if (picked.length === 0) { toast.err('Select at least one centre-approved order.'); return; }
    const branchSet = new Set(picked.map((o) => o.branchCode));
    if (branchSet.size !== 1) { toast.err('All selected orders must belong to the same centre.'); return; }
    const branchCode = picked[0].branchCode;
    const branchId2 = picked[0].branchId;
    const totalBatchWeight = round(picked.reduce((s, o) => s + Number(o.receivedGoldWeight || 0), 0));
    if (totalBatchWeight <= 0) { toast.err('Selected orders must have received weight > 0.'); return; }
    const batchNo = nextBatchNo(batches, branchCode);
    const localBatchId = uuid();
    const batch: RefineryBatch = { id: localBatchId, batchNo, branchId: branchId2, branchCode, orderIds: picked.map((o) => o.id), totalBatchWeight, status: 'AQUA_REGIA', alloyLines: [], createdAt: new Date().toISOString() };

    setBatches((prev) => [batch, ...prev]);
    setOrders((prev) => prev.map((o) => (pickedOrderIds[o.id] ? { ...o, status: 'BATCHED', batchId: localBatchId } : o)));
    setInventory((prev) => adjustInventory(prev, branchCode, 'RAW_GOLD', -totalBatchWeight));
    setPickedOrderIds({});

    const avgPurity = picked.reduce((s, o) => s + (Number(o.observedPurityPct || 0)), 0) / Math.max(picked.length, 1);
    const realBranchId = /^[0-9a-f-]{36}$/i.test(branchId2) ? branchId2 : NIL_UUID;
    const remarksPayload = JSON.stringify({ stage: 'AQUA_REGIA', branchId: branchId2, branchCode, orderIds: picked.map(o => o.id) });

    // POST batch to backend, then record inputs + link orders
    api<any>(`${RF_BASE}/batches`, {
      method: 'POST',
      body: JSON.stringify({
        batchNumber: batchNo, branchId: realBranchId, customerId: null,
        metal: 'GOLD', method: 'AQUA_REGIA',
        startDate: new Date().toISOString().slice(0, 10),
        expectedFineness: avgPurity,
        remarks: remarksPayload,
      }),
    }).then(created => {
      const beId = (created as any).id as string;
      // Update local batch id to backend id and update linked order batchIds
      setBatches(prev => prev.map(b => b.id === localBatchId ? { ...b, id: beId } : b));
      setOrders(prev => prev.map(o => o.batchId === localBatchId ? { ...o, batchId: beId } : o));
      // POST inputs for each order
      picked.forEach(o => {
        api(`${RF_BASE}/inputs`, {
          method: 'POST',
          body: JSON.stringify({
            batchId: beId,
            sourceLabel: o.reference,
            grossWeight: o.receivedGoldWeight || 0,
            fineness: o.observedPurityPct ? o.observedPurityPct * 10 : null,
            remarks: o.reference,
          }),
        }).catch(() => {});
        // PATCH each order to BATCHED status linked to backend batch
        api(`${RF_BASE}/orders/${o.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'BATCHED', batchId: beId }),
        }).catch(() => {});
      });
    }).catch(() => {});

    toast.ok(`Batch ${batchNo} created. RAW_GOLD deducted by ${totalBatchWeight} g.`);
  }

  function loadAquaBatch(id: string) {
    setAquaBatchId(id);
    const b = batches.find((x) => x.id === id);
    if (!b) return;
    setAquaUsedHcl(b.aquaRegia?.usedHclMl?.toString() || '');
    setAquaUsedHno3(b.aquaRegia?.usedHno3Ml?.toString() || '');
    setAquaUsedHhAcid(b.aquaRegia?.usedHhAcidMl?.toString() || '');
    setAquaUsedUrea(b.aquaRegia?.usedUreaG?.toString() || '');
    setAquaWarning('');
  }

  function saveAquaRegia() {
    if (!selectedAquaBatch) return;

    const suggested = suggestAqua(selectedAquaBatch.totalBatchWeight);
    const usedHcl = Number(aquaUsedHcl);
    const usedHno3 = Number(aquaUsedHno3);
    const usedHh = Number(aquaUsedHhAcid);
    const usedUrea = Number(aquaUsedUrea);

    if (![usedHcl, usedHno3, usedHh, usedUrea].every((n) => Number.isFinite(n) && n > 0)) {
      toast.err('All Aqua-Regia usage fields must be positive numbers.');
      return;
    }

    const tol = BRANCH_ACID_MASTER[selectedAquaBatch.branchCode] || BRANCH_ACID_MASTER.BLR;
    const warnings: string[] = [];

    if (usedHcl > suggested.hclMl * (1 + tol.hclPct / 100)) warnings.push('HCL');
    if (usedHno3 > suggested.hno3Ml * (1 + tol.hno3Pct / 100)) warnings.push('HNO3');
    if (usedHh > suggested.hhAcidMl * (1 + tol.hhAcidPct / 100)) warnings.push('HH-Acid');
    if (usedUrea > suggested.ureaG * (1 + tol.ureaPct / 100)) warnings.push('Urea');

    const warningMsg = warnings.length > 0
      ? `Warning: acid usage deviation exceeding tolerance for ${warnings.join(', ')}.`
      : '';

    setAquaWarning(warningMsg);

    const aquaData: AquaRegiaData = {
      suggestedHclMl: suggested.hclMl, suggestedHno3Ml: suggested.hno3Ml,
      suggestedHhAcidMl: suggested.hhAcidMl, suggestedUreaG: suggested.ureaG,
      usedHclMl: usedHcl, usedHno3Ml: usedHno3, usedHhAcidMl: usedHh, usedUreaG: usedUrea,
      deviationWarnings: warnings,
    };

    setBatches((prev) => prev.map((b) => (
      b.id === selectedAquaBatch.id
        ? { ...b, aquaRegia: aquaData, status: 'REFINING_ASSAY' }
        : b
    )));

    // Sync to backend: update remarks with aq data + stage, and PATCH status IN_PROCESS
    if (/^[0-9a-f-]{36}$/i.test(selectedAquaBatch.id)) {
      const updatedRemarks = JSON.stringify({
        stage: 'REFINING_ASSAY',
        branchId: selectedAquaBatch.branchId,
        branchCode: selectedAquaBatch.branchCode,
        orderIds: selectedAquaBatch.orderIds,
        alloyLines: selectedAquaBatch.alloyLines,
        aq: aquaData,
      });
      api(`${RF_BASE}/batches/${selectedAquaBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: updatedRemarks }),
      }).catch(() => {});
      api(`${RF_BASE}/batches/${selectedAquaBatch.id}/status?status=IN_PROCESS`, { method: 'PATCH' }).catch(() => {});
      api(`${RF_BASE}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedAquaBatch.id, stepName: 'AQUA_REGIA',
          notes: `HCL:${usedHcl}ml HNO3:${usedHno3}ml HH:${usedHh}ml Urea:${usedUrea}g${warnings.length ? ' WARN:'+warnings.join(',') : ''}`,
          startedAt: new Date().toISOString().replace('Z', ''), completedAt: new Date().toISOString().replace('Z', ''),
        }),
      }).catch(() => {});
    }

    if (warningMsg) toast.warn(warningMsg);
    else toast.ok('Aqua-Regia saved and moved to Refining & Assay.');
  }

  function computeAndMoveToFinal() {
    if (!selectedRefineBatch) return;
    const expected = refiningExpectedPure;

    setBatches((prev) => prev.map((b) => (
      b.id === selectedRefineBatch.id
        ? { ...b, expectedPureGold: expected, status: 'FINAL_PROCESSING' }
        : b
    )));

    // Sync to backend
    if (/^[0-9a-f-]{36}$/i.test(selectedRefineBatch.id)) {
      const updatedRemarks = JSON.stringify({
        stage: 'FINAL_PROCESSING',
        branchId: selectedRefineBatch.branchId,
        branchCode: selectedRefineBatch.branchCode,
        orderIds: selectedRefineBatch.orderIds,
        alloyLines: selectedRefineBatch.alloyLines,
        aq: selectedRefineBatch.aquaRegia,
        expectedPureGold: expected,
      });
      api(`${RF_BASE}/batches/${selectedRefineBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: updatedRemarks, expectedFineness: expected }),
      }).catch(() => {});
      api(`${RF_BASE}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedRefineBatch.id, stepName: 'REFINING_ASSAY',
          notes: `Expected pure gold: ${expected}g`,
          startedAt: new Date().toISOString().replace('Z', ''), completedAt: new Date().toISOString().replace('Z', ''),
        }),
      }).catch(() => {});
    }

    toast.ok(`Expected Pure Gold computed as ${expected} g. Batch moved to Final Processing.`);
  }

  function completeBatch() {
    if (!selectedFinalBatch) return;

    setBatches((prev) => prev.map((b) => (
      b.id === selectedFinalBatch.id ? { ...b, status: 'COMPLETED' } : b
    )));

    // Sync to backend
    if (/^[0-9a-f-]{36}$/i.test(selectedFinalBatch.id)) {
      const updatedRemarks = JSON.stringify({
        stage: 'COMPLETED',
        branchId: selectedFinalBatch.branchId,
        branchCode: selectedFinalBatch.branchCode,
        orderIds: selectedFinalBatch.orderIds,
        alloyLines: selectedFinalBatch.alloyLines,
        aq: selectedFinalBatch.aquaRegia,
        expectedPureGold: selectedFinalBatch.expectedPureGold,
      });
      api(`${RF_BASE}/batches/${selectedFinalBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: updatedRemarks }),
      }).catch(() => {});
      api(`${RF_BASE}/batches/${selectedFinalBatch.id}/status?status=COMPLETED`, { method: 'PATCH' }).catch(() => {});
      // Record total output
      const totalAlloyWeight = selectedFinalBatch.alloyLines.reduce((s, l) => s + l.qtyG, 0);
      const outputGross = round((selectedFinalBatch.expectedPureGold || 0) + totalAlloyWeight);
      if (outputGross > 0) {
        api(`${RF_BASE}/outputs`, {
          method: 'POST',
          body: JSON.stringify({
            batchId: selectedFinalBatch.id,
            form: 'BAR',
            grossWeight: outputGross,
            fineness: outputGross > 0 && selectedFinalBatch.expectedPureGold
              ? round((selectedFinalBatch.expectedPureGold / outputGross) * 1000)
              : null,
            remarks: `Final output: pure=${selectedFinalBatch.expectedPureGold}g alloy=${totalAlloyWeight}g`,
          }),
        }).catch(() => {});
      }
    }
    toast.ok('Batch marked as Completed.');
    setFinalBatchId('');
  }

  function addAlloyLine() {
    if (!selectedFinalBatch) return;
    const qty = Number(alloyQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.err('Alloy quantity must be positive.');
      return;
    }

    const line: AlloyLine = { id: uuid(), metal: alloyMetal, qtyG: qty };
    const updatedLines = [line, ...selectedFinalBatch.alloyLines];

    setBatches((prev) => prev.map((b) => (
      b.id === selectedFinalBatch.id
        ? { ...b, alloyLines: updatedLines }
        : b
    )));

    setInventory((prev) => adjustInventory(prev, selectedFinalBatch.branchCode, alloyMetal, -qty));
    setAlloyQty('');

    if (/^[0-9a-f-]{36}$/i.test(selectedFinalBatch.id)) {
      const updatedRemarks = JSON.stringify({
        stage: 'FINAL_PROCESSING',
        branchId: selectedFinalBatch.branchId,
        branchCode: selectedFinalBatch.branchCode,
        orderIds: selectedFinalBatch.orderIds,
        alloyLines: updatedLines,
        aq: selectedFinalBatch.aquaRegia,
        expectedPureGold: selectedFinalBatch.expectedPureGold,
      });
      api(`${RF_BASE}/batches/${selectedFinalBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: updatedRemarks }),
      }).catch(() => {});
    }
    toast.ok(`${alloyMetal} deducted immediately by ${qty} g.`);
  }

  function deleteAlloyLine(lineId: string) {
    if (!selectedFinalBatch) return;
    const line = selectedFinalBatch.alloyLines.find((l) => l.id === lineId);
    if (!line) return;

    const updatedLines = selectedFinalBatch.alloyLines.filter((l) => l.id !== lineId);
    setBatches((prev) => prev.map((b) => (
      b.id === selectedFinalBatch.id
        ? { ...b, alloyLines: updatedLines }
        : b
    )));

    setInventory((prev) => adjustInventory(prev, selectedFinalBatch.branchCode, line.metal, line.qtyG));

    if (/^[0-9a-f-]{36}$/i.test(selectedFinalBatch.id)) {
      const updatedRemarks = JSON.stringify({
        stage: 'FINAL_PROCESSING',
        branchId: selectedFinalBatch.branchId,
        branchCode: selectedFinalBatch.branchCode,
        orderIds: selectedFinalBatch.orderIds,
        alloyLines: updatedLines,
        aq: selectedFinalBatch.aquaRegia,
        expectedPureGold: selectedFinalBatch.expectedPureGold,
      });
      api(`${RF_BASE}/batches/${selectedFinalBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: updatedRemarks }),
      }).catch(() => {});
    }
    toast.ok(`${line.metal} inventory restored by ${line.qtyG} g.`);
  }

  return (
    <div>
      <PageHeader title="Refinery Desk" subtitle="Intake · Receipt · Intake Approval · Batch · Aqua-Regia · Refining/Assay · Final Processing" />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Intake" value={intakeOrders.length} accent="bg-gradient-to-br from-red-500 to-orange-600" />
        <Stat label="Receipt" value={receiptOrders.length} accent="bg-gradient-to-br from-red-500 to-orange-600" />
        <Stat label="Intake Approval" value={approvalOrders.length} accent="bg-gradient-to-br from-red-500 to-orange-600" />
        <Stat label="Batches" value={batches.length} accent="bg-gradient-to-br from-red-500 to-orange-600" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button id="rfTabIntake" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'intake' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('intake')}>Intake Desk</button>
        <button id="rfTabReceipt" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'receipt' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('receipt')}>Receipt Desk</button>
        <button id="rfTabApproval" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'approval' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('approval')}>Intake Approval Desk</button>
        <button id="rfTabBatch" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'batch' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('batch')}>Batching Desk</button>
        <button id="rfTabAqua" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'aqua' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('aqua')}>Aqua-Regia</button>
        <button id="rfTabRefining" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'refining' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('refining')}>Refining & Assay</button>
        <button id="rfTabFinal" className={`px-3 py-1.5 rounded-lg border text-sm ${activeTab === 'final' ? 'border-nexus-accent bg-nexus-accent/10 text-white' : 'border-nexus-line text-nexus-muted hover:text-white'}`} onClick={() => setActiveTab('final')}>Final Processing</button>
      </div>

      {activeTab === 'intake' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create Intake Order</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-xs text-nexus-muted flex flex-col gap-1">Branch*
                <select id="rfBranch" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Select branch</option>
                  {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                </select>
              </label>

              <label className="text-xs text-nexus-muted flex flex-col gap-1">Work Type*
                <select id="rfWorkType" className="input" value={workType} onChange={(e) => setWorkType(e.target.value as WorkType)}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="BRANCH">Branch</option>
                </select>
              </label>

              <label className="text-xs text-nexus-muted flex flex-col gap-1">Customer
                <select id="rfCustomer" className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={workType === 'BRANCH'}>
                  <option value="">Select customer</option>
                  {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.no} - {c.name}</option>)}
                </select>
              </label>

              <label className="text-xs text-nexus-muted flex flex-col gap-1">Sent Gold Weight (g)*
                <input id="rfSentWeight" className="input" type="number" step="0.0001" value={sentGoldWeight} onChange={(e) => setSentGoldWeight(e.target.value)} />
              </label>

              <label className="text-xs text-nexus-muted flex flex-col gap-1">Declared Purity*
                <input id="rfDeclaredPurity" className="input" value={declaredPurity} onChange={(e) => setDeclaredPurity(e.target.value)} placeholder="e.g. 916" />
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button id="rfCreateOrder" className="btn-primary" onClick={createOrder}>Create Order</button>
              <button className="btn" onClick={resetIntakeForm}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receipt' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Receipt Queue</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Reference</th><th>Branch</th><th>Sent Weight</th><th>Purity</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {receiptOrders.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No orders in Receipt Desk</td></tr>}
                  {receiptOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.reference}</td>
                      <td>{o.branchCode}</td>
                      <td>{o.sentGoldWeight}</td>
                      <td>{o.declaredPurity}</td>
                      <td>{o.status}</td>
                      <td><button id={`rfOpenReceipt-${o.id}`} className="btn" onClick={() => openReceipt(o.id)}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedReceipt && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-1">Receipt Entry</h3>
              <p className="text-xs text-nexus-muted mb-3">{selectedReceipt.reference} · Sent Weight: {selectedReceipt.sentGoldWeight}</p>

              <div className="grid md:grid-cols-4 gap-3">
                <label className="text-xs text-nexus-muted flex flex-col gap-1">Received Gold Weight (g)*
                  <input id="rfReceivedWeight" className="input" type="number" step="0.0001" value={receivedGoldWeight} onChange={(e) => setReceivedGoldWeight(e.target.value)} />
                </label>
                <label className="text-xs text-nexus-muted flex flex-col gap-1">Observed Purity %
                  <input id="rfObservedPurity" className="input" type="number" step="0.001" value={observedPurityPct} onChange={(e) => setObservedPurityPct(e.target.value)} placeholder="e.g. 91.6" />
                </label>
                <label className="text-xs text-nexus-muted flex flex-col gap-1">Melting Total Weight (g)*
                  <input id="rfMeltingTotal" className="input" type="number" step="0.0001" value={meltingTotalWeight} onChange={(e) => setMeltingTotalWeight(e.target.value)} />
                </label>
                <label className="text-xs text-nexus-muted flex flex-col gap-1">Melting Sample Weight (g)*
                  <input id="rfMeltingSample" className="input" type="number" step="0.0001" value={meltingSampleWeight} onChange={(e) => setMeltingSampleWeight(e.target.value)} />
                </label>
              </div>

              <div className="mt-3">
                <button id="rfAdvanceApproval" className="btn-primary" onClick={saveReceiptAndAdvance}>Advance to Intake Approval</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Intake Approval Desk</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Reference</th><th>Branch</th><th>Sent Weight</th><th>Received Weight</th><th>Observed Purity %</th><th>Status</th></tr></thead>
              <tbody>
                {approvalOrders.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No orders in Intake Approval Desk</td></tr>}
                {approvalOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.reference}</td>
                    <td>{o.branchCode}</td>
                    <td>{o.sentGoldWeight}</td>
                    <td>{o.receivedGoldWeight}</td>
                    <td>{o.observedPurityPct ?? '—'}</td>
                    <td>{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'batch' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create Refinery Batch (RF-007)</h3>
            <div className="table-wrap mb-3">
              <table className="tbl">
                <thead><tr><th>Pick</th><th>Reference</th><th>Centre</th><th>Received Weight</th><th>Status</th></tr></thead>
                <tbody>
                  {batchEligibleOrders.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No centre-approved orders available</td></tr>}
                  {batchEligibleOrders.map((o) => (
                    <tr key={o.id}>
                      <td><input id={`rfPickOrder-${o.id}`} type="checkbox" checked={!!pickedOrderIds[o.id]} onChange={(e) => setPickedOrderIds((prev) => ({ ...prev, [o.id]: e.target.checked }))} /></td>
                      <td>{o.reference}</td>
                      <td>{o.branchCode}</td>
                      <td>{o.receivedGoldWeight ?? '—'}</td>
                      <td>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button id="rfCreateBatch" className="btn-primary" onClick={createBatchFromApprovedOrders}>Create Refinery Batch</button>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Refinery Batches</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Batch No</th><th>Centre</th><th>Total Weight</th><th>Status</th></tr></thead>
                <tbody>
                  {batches.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No batches created yet</td></tr>}
                  {batches.map((b) => (
                    <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td id={`rfBatchNo-${b.id}`}>{b.batchNo}</td>
                      <td id={`rfBatchCentre-${b.id}`}>{b.branchCode}</td>
                      <td>{b.totalBatchWeight}</td>
                      <td>{b.status}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'aqua' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Aqua-Regia Stage (RF-008, RF-009)</h3>
            <label className="text-xs text-nexus-muted flex flex-col gap-1 mb-3">Batch
              <select id="rfAquaBatch" className="input" value={aquaBatchId} onChange={(e) => loadAquaBatch(e.target.value)}>
                <option value="">Select batch</option>
                {batches.filter((b) => b.status === 'AQUA_REGIA' || !!b.aquaRegia).map((b) => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
              </select>
            </label>

            {selectedAquaBatch && (
              <>
                {(() => {
                  const s = suggestAqua(selectedAquaBatch.totalBatchWeight);
                  return (
                    <div className="grid md:grid-cols-4 gap-3 mb-3 text-xs text-nexus-muted">
                      <div>Suggested HCL: <span id="rfAquaSuggestedHcl" className="text-white">{s.hclMl}</span> ml</div>
                      <div>Suggested HNO3: <span id="rfAquaSuggestedHno3" className="text-white">{s.hno3Ml}</span> ml</div>
                      <div>Suggested HH-Acid: <span id="rfAquaSuggestedHh" className="text-white">{s.hhAcidMl}</span> ml</div>
                      <div>Suggested Urea: <span id="rfAquaSuggestedUrea" className="text-white">{s.ureaG}</span> g</div>
                    </div>
                  );
                })()}

                <div className="grid md:grid-cols-4 gap-3">
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Used HCL (ml)
                    <input id="rfAquaUsedHcl" className="input" type="number" value={aquaUsedHcl} onChange={(e) => setAquaUsedHcl(e.target.value)} />
                  </label>
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Used HNO3 (ml)
                    <input id="rfAquaUsedHno3" className="input" type="number" value={aquaUsedHno3} onChange={(e) => setAquaUsedHno3(e.target.value)} />
                  </label>
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Used HH-Acid (ml)
                    <input id="rfAquaUsedHh" className="input" type="number" value={aquaUsedHhAcid} onChange={(e) => setAquaUsedHhAcid(e.target.value)} />
                  </label>
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Used Urea (g)
                    <input id="rfAquaUsedUrea" className="input" type="number" value={aquaUsedUrea} onChange={(e) => setAquaUsedUrea(e.target.value)} />
                  </label>
                </div>

                <div className="mt-3 flex gap-2">
                  <button id="rfAquaSave" className="btn-primary" onClick={saveAquaRegia}>Save Aqua-Regia</button>
                </div>

                {aquaWarning && <p id="rfAquaWarning" className="text-xs text-amber-300 mt-2">{aquaWarning}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'refining' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Refining & Assay (RF-010)</h3>
          <label className="text-xs text-nexus-muted flex flex-col gap-1 mb-3">Batch
            <select id="rfRefineBatch" className="input" value={refineBatchId} onChange={(e) => setRefineBatchId(e.target.value)}>
              <option value="">Select batch</option>
              {batches.filter((b) => b.status === 'REFINING_ASSAY' || typeof b.expectedPureGold === 'number').map((b) => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
            </select>
          </label>

          {selectedRefineBatch && (
            <>
              <div className="table-wrap mb-3">
                <table className="tbl">
                  <thead><tr><th>Order Ref</th><th>Received Weight</th><th>Observed Purity %</th><th>Weight x Purity /100</th></tr></thead>
                  <tbody>
                    {orders.filter((o) => selectedRefineBatch.orderIds.includes(o.id)).map((o) => {
                      const part = round((Number(o.receivedGoldWeight || 0) * Number(o.observedPurityPct || 0)) / 100);
                      return (
                        <tr key={o.id}>
                          <td>{o.reference}</td>
                          <td>{o.receivedGoldWeight ?? 0}</td>
                          <td>{o.observedPurityPct ?? 0}</td>
                          <td>{part}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-nexus-muted">Expected Pure Gold: <span id="rfExpectedPureGold" className="text-white font-semibold">{refiningExpectedPure}</span> g</p>
              <div className="mt-3">
                <button id="rfMoveFinal" className="btn-primary" onClick={computeAndMoveToFinal}>Move to Final Processing</button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'final' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Final Processing (RF-011, RF-012)</h3>
            <label className="text-xs text-nexus-muted flex flex-col gap-1 mb-3">Batch
              <select id="rfFinalBatch" className="input" value={finalBatchId} onChange={(e) => setFinalBatchId(e.target.value)}>
                <option value="">Select batch</option>
                {batches.filter((b) => b.status === 'FINAL_PROCESSING' || b.alloyLines.length > 0).map((b) => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
              </select>
            </label>

            {selectedFinalBatch && (
              <>
                <p className="text-xs text-nexus-muted mb-3">Centre: <span id="rfFinalCentre" className="text-white">{selectedFinalBatch.branchCode}</span></p>

                <div className="grid md:grid-cols-3 gap-3 mb-3">
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Metal
                    <select id="rfAlloyMetal" className="input" value={alloyMetal} onChange={(e) => setAlloyMetal(e.target.value as AlloyMetal)}>
                      <option value="COPPER">COPPER</option>
                      <option value="SILVER">SILVER</option>
                      <option value="ZINC">ZINC</option>
                    </select>
                  </label>
                  <label className="text-xs text-nexus-muted flex flex-col gap-1">Quantity (g)
                    <input id="rfAlloyQty" className="input" type="number" step="0.0001" value={alloyQty} onChange={(e) => setAlloyQty(e.target.value)} />
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button id="rfAddAlloy" className="btn-primary" onClick={addAlloyLine}>Add Alloy Line</button>
                  {selectedFinalBatch.status === 'FINAL_PROCESSING' && (
                    <button id="rfCompleteBatch" className="btn-primary bg-green-600 hover:bg-green-500" onClick={completeBatch}>Complete Batch</button>
                  )}
                </div>

                <div className="mt-4 table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Metal</th><th>Qty (g)</th><th>Actions</th></tr></thead>
                    <tbody>
                      {selectedFinalBatch.alloyLines.length === 0 && <tr><td colSpan={3} className="text-center text-nexus-muted">No alloy lines</td></tr>}
                      {selectedFinalBatch.alloyLines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.metal}</td>
                          <td>{l.qtyG}</td>
                          <td><button id={`rfDeleteAlloy-${l.id}`} className="btn" onClick={() => deleteAlloyLine(l.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Branch Inventory</h4>
                  <div className="grid md:grid-cols-4 gap-2 text-xs text-nexus-muted">
                    {selectedBatchBranchInventory.map((item) => (
                      <div key={item.metal}>{item.metal}: <span id={`rfInv-${item.metal}`} className="text-white">{item.qtyG}</span> g</div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
