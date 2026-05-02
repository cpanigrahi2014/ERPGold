import { useMemo, useState, useEffect } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

type BranchCode = 'MUM' | 'BLR' | 'DEL';

type BranchStock = {
  branch: BranchCode;
  pureGold: number;
  hclQty: number;
};

type Receipt = {
  id: string;
  branch: BranchCode;
  observedWeight: number;
  purity: number;
  pureWeight: number;
  createdAt: string;
};

type Delivery = {
  id: string;
  branch: BranchCode;
  pureWeight: number;
  status: 'DONE';
  createdAt: string;
  source: 'MANUAL' | 'REFINERY_AUTO';
};

type TransferStatus = 'REQUESTED' | 'ACCEPTED' | 'DISPATCHED' | 'RECEIVED';

type InternalTransfer = {
  id: string;
  fromBranch: BranchCode;
  toBranch: BranchCode;
  observedWeight: number;
  purity: number;
  purityTier: number;
  netPureWeight: number;
  status: TransferStatus;
  acceptedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
};

type RefineryTransfer = {
  id: string;
  branch: BranchCode;
  weightSent: number;
  avgPurity: number;
  expectedPureWeight: number;
  weightReceived?: number;
  pnlWeight?: number;
  pnlVerdict?: 'GAIN' | 'LOSS' | 'BREAK_EVEN';
  status: 'DISPATCHED' | 'RECEIVED';
  createdAt: string;
  receivedAt?: string;
};

type Centre = {
  id: string;
  name: string;
  shortCode: string;
  branch: BranchCode;
};

const STOCK_KEY = 'nexus.react.inventory.branch-stock.v1';
const RECEIPTS_KEY = 'nexus.react.inventory.receipts.v1'; // synced to backend lots
const DELIVERIES_KEY = 'nexus.react.inventory.deliveries.v1'; // synced to backend movements
const TRANSFERS_KEY = 'nexus.react.inventory.transfers.v1';
const REFINERY_KEY = 'nexus.react.inventory.refinery-transfers.v1';
const CENTRES_KEY = 'nexus.react.inventory.centres.v1';
const INV_BASE = '/api/inventory/api/v1/inventory';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function lotNumber(): string {
  return `LOT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}
function mapLotToReceipt(lot: any): Receipt {
  let r: any = {};
  try { r = JSON.parse(lot.remarks || '{}'); } catch {}
  // Backend stores declaredFineness in per-mille (0–1000); convert back to % for UI
  return { id: lot.id, branch: (r.br || 'BLR') as BranchCode, observedWeight: Number(lot.grossWeight) || 0, purity: (Number(lot.declaredFineness) || 0) / 10, pureWeight: Number(lot.fineWeight) || 0, createdAt: lot.createdAt || new Date().toISOString() };
}

const INITIAL_STOCK: BranchStock[] = [
  { branch: 'MUM', pureGold: 0, hclQty: 500 },
  { branch: 'BLR', pureGold: 0, hclQty: 500 },
  { branch: 'DEL', pureGold: 0, hclQty: 500 },
];

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function now() {
  return new Date().toISOString();
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

function purityTier(purity: number): number {
  if (purity >= 99.5) return 99.5;
  if (purity >= 91.6) return 91.6;
  if (purity >= 75) return 75;
  return purity;
}

function calcPure(observedWeight: number, purity: number): number {
  return Math.round((observedWeight * purity / 100) * 1000) / 1000;
}

export default function InventoryDesk() {
  const [activeTab, setActiveTab] = useState<'receipts' | 'deliveries' | 'transfers' | 'refinery' | 'centres'>('receipts');

  const [stocks, setStocks] = useState<BranchStock[]>(() => read<BranchStock[]>(STOCK_KEY, INITIAL_STOCK));
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transfers, setTransfers] = useState<InternalTransfer[]>(() => read<InternalTransfer[]>(TRANSFERS_KEY, []));
  const [refinery, setRefinery] = useState<RefineryTransfer[]>(() => read<RefineryTransfer[]>(REFINERY_KEY, []));
  const [centres, setCentres] = useState<Centre[]>(() => read<Centre[]>(CENTRES_KEY, []));

  // Load receipts (lots), deliveries (movements), and centres (locations) from backend on mount
  useEffect(() => {
    api<any[]>(`${INV_BASE}/lots`)
      .then(data => {
        const mapped = data.filter(l => l.status === 'RECEIVED').map(mapLotToReceipt);
        setReceipts(mapped);
        persist(RECEIPTS_KEY, mapped);
      })
      .catch(() => setReceipts(read<Receipt[]>(RECEIPTS_KEY, [])));
    api<any[]>(`${INV_BASE}/movements`)
      .then(data => {
        const mapped = data.filter((m: any) => m.type === 'OUT').map((m: any) => {
          let br: BranchCode = 'BLR';
          try { br = (JSON.parse(m.remarks || '{}').br || 'BLR') as BranchCode; } catch {}
          return { id: m.id, branch: br, pureWeight: Number(m.quantity) || 0, status: 'DONE' as const, createdAt: m.occurredAt || new Date().toISOString(), source: 'MANUAL' as const };
        });
        setDeliveries(mapped);
        persist(DELIVERIES_KEY, mapped);
      })
      .catch(() => setDeliveries(read<Delivery[]>(DELIVERIES_KEY, [])));
    api<any[]>(`${INV_BASE}/locations`)
      .then(data => {
        const mapped: Centre[] = data.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          shortCode: loc.code,
          branch: (loc.code.split('-')[0] || 'BLR') as BranchCode,
        }));
        setCentres(mapped);
        persist(CENTRES_KEY, mapped);
      })
      .catch(() => setCentres(read<Centre[]>(CENTRES_KEY, [])));
  }, []);

  // Receipts form
  const [rcptBranch, setRcptBranch] = useState<BranchCode>('BLR');
  const [rcptObservedWeight, setRcptObservedWeight] = useState('');
  const [rcptPurity, setRcptPurity] = useState('');

  // Deliveries form
  const [delBranch, setDelBranch] = useState<BranchCode>('BLR');
  const [delQty, setDelQty] = useState('');

  // Transfer form
  const [trFrom, setTrFrom] = useState<BranchCode>('BLR');
  const [trTo, setTrTo] = useState<BranchCode>('MUM');
  const [trObservedWeight, setTrObservedWeight] = useState('');
  const [trPurity, setTrPurity] = useState('');

  // Refinery form
  const [rfBranch, setRfBranch] = useState<BranchCode>('BLR');
  const [rfWeightSent, setRfWeightSent] = useState('');
  const [rfAvgPurity, setRfAvgPurity] = useState('');
  const [rfReceiveWeight, setRfReceiveWeight] = useState('');
  const [rfSelectedId, setRfSelectedId] = useState('');

  // Chemical usage
  const [chemBranch, setChemBranch] = useState<BranchCode>('BLR');
  const [chemHclUsage, setChemHclUsage] = useState('');

  // Centres
  const [centreName, setCentreName] = useState('');
  const [centreShortCode, setCentreShortCode] = useState('');
  const [centreBranch, setCentreBranch] = useState<BranchCode>('BLR');
  const [centreError, setCentreError] = useState('');

  const rcptPurePreview = useMemo(() => {
    const w = Number(rcptObservedWeight);
    const p = Number(rcptPurity);
    if (w <= 0 || p <= 0) return 0;
    return calcPure(w, p);
  }, [rcptObservedWeight, rcptPurity]);

  const trTier = useMemo(() => {
    const p = Number(trPurity);
    if (p <= 0) return 0;
    return purityTier(p);
  }, [trPurity]);

  const trNetPurePreview = useMemo(() => {
    const w = Number(trObservedWeight);
    if (w <= 0 || trTier <= 0) return 0;
    return calcPure(w, trTier);
  }, [trObservedWeight, trTier]);

  const stats = useMemo(() => ({
    totalPure: Math.round(stocks.reduce((s, b) => s + b.pureGold, 0) * 1000) / 1000,
    receipts: receipts.length,
    deliveries: deliveries.length,
    transfersInProgress: transfers.filter((t) => t.status !== 'RECEIVED').length,
  }), [stocks, receipts, deliveries, transfers]);

  function saveStocks(next: BranchStock[]) {
    setStocks(next);
    persist(STOCK_KEY, next);
  }

  function saveReceipts(next: Receipt[]) {
    setReceipts(next);
    persist(RECEIPTS_KEY, next);
  }

  function saveDeliveries(next: Delivery[]) {
    setDeliveries(next);
    persist(DELIVERIES_KEY, next);
  }

  function saveTransfers(next: InternalTransfer[]) {
    setTransfers(next);
    persist(TRANSFERS_KEY, next);
  }

  function saveRefinery(next: RefineryTransfer[]) {
    setRefinery(next);
    persist(REFINERY_KEY, next);
  }

  function saveCentres(next: Centre[]) {
    setCentres(next);
    persist(CENTRES_KEY, next);
  }

  function branchStock(branch: BranchCode): BranchStock {
    return stocks.find((s) => s.branch === branch) || { branch, pureGold: 0, hclQty: 0 };
  }

  function adjustStock(branch: BranchCode, deltaPure: number, deltaHcl = 0) {
    const next = stocks.map((s) => s.branch === branch
      ? { ...s, pureGold: Math.round((s.pureGold + deltaPure) * 1000) / 1000, hclQty: Math.round((s.hclQty + deltaHcl) * 1000) / 1000 }
      : s);
    saveStocks(next);
  }

  async function createReceipt() {
    const w = Number(rcptObservedWeight);
    const p = Number(rcptPurity);
    if (w <= 0 || p <= 0 || p > 100) {
      toast.err('Observed Weight and Purity must be valid');
      return;
    }
    const pure = calcPure(w, p);
    let lotId = uuid();
    try {
      // Backend declaredFineness is per-mille (0–1000); convert from % by multiplying by 10
      const created = await api<any>(`${INV_BASE}/lots`, {
        method: 'POST',
        body: JSON.stringify({ lotNumber: lotNumber(), branchId: NIL_UUID, metal: 'GOLD', purityLabel: 'Custom', declaredFineness: p * 10, grossWeight: w, netWeight: w, receivedDate: new Date().toISOString().slice(0,10), remarks: JSON.stringify({ br: rcptBranch }) }),
      });
      lotId = created.id;
    } catch (e: any) { toast.err(e.message || 'Failed to save receipt'); return; }
    const rec: Receipt = { id: lotId, branch: rcptBranch, observedWeight: w, purity: p, pureWeight: pure, createdAt: now() };
    saveReceipts([...receipts, rec]);
    adjustStock(rcptBranch, pure);
    toast.ok(`Receipt created. Pure Weight = ${pure}g`);
    setRcptObservedWeight(''); setRcptPurity('');
  }

  async function createDelivery() {
    const qty = Number(delQty);
    if (qty <= 0) { toast.err('Delivery quantity must be positive'); return; }
    const stock = branchStock(delBranch).pureGold;
    if (qty > stock) { toast.err('Insufficient stock for delivery'); return; }
    // Find a real lot from this branch to associate the movement with
    const branchLot = receipts.find((r) => r.branch === delBranch);
    if (!branchLot) { toast.err('No receipt (lot) found for this branch — create a receipt first'); return; }
    let movId = uuid();
    try {
      const created = await api<any>(`${INV_BASE}/movements`, {
        method: 'POST',
        body: JSON.stringify({ lotId: branchLot.id, type: 'OUT', quantity: qty, remarks: JSON.stringify({ br: delBranch, src: 'MANUAL' }) }),
      });
      movId = created.id;
    } catch (e: any) { toast.err(e?.message || 'Failed to save movement'); return; }
    const rec: Delivery = { id: movId, branch: delBranch, pureWeight: qty, status: 'DONE', createdAt: now(), source: 'MANUAL' };
    saveDeliveries([...deliveries, rec]);
    adjustStock(delBranch, -qty);
    toast.ok('Delivery saved');
    setDelQty('');
  }

  function createTransferRequest() {
    const w = Number(trObservedWeight);
    const p = Number(trPurity);
    if (trFrom === trTo) {
      toast.err('From and To branch must be different');
      return;
    }
    if (w <= 0 || p <= 0 || p > 100) {
      toast.err('Observed Weight and Purity must be valid');
      return;
    }
    const tier = purityTier(p);
    const net = calcPure(w, tier);
    const t: InternalTransfer = {
      id: uuid(),
      fromBranch: trFrom,
      toBranch: trTo,
      observedWeight: w,
      purity: p,
      purityTier: tier,
      netPureWeight: net,
      status: 'REQUESTED',
      createdAt: now(),
    };
    saveTransfers([...transfers, t]);
    toast.ok('Transfer request created');
    setTrObservedWeight('');
    setTrPurity('');
  }

  function acceptTransfer(id: string) {
    const tr = transfers.find((t) => t.id === id);
    if (!tr) return;
    const sourceStock = branchStock(tr.fromBranch).pureGold;
    if (sourceStock < tr.netPureWeight) {
      toast.err('Insufficient stock at source branch during acceptance');
      return;
    }
    const next = transfers.map((t) => t.id === id ? { ...t, status: 'ACCEPTED' as TransferStatus, acceptedAt: now() } : t);
    saveTransfers(next);
    toast.ok('Transfer accepted');
  }

  function dispatchTransfer(id: string) {
    const tr = transfers.find((t) => t.id === id);
    if (!tr || tr.status !== 'ACCEPTED') return;
    const sourceStock = branchStock(tr.fromBranch).pureGold;
    if (sourceStock < tr.netPureWeight) {
      toast.err('Insufficient stock at dispatch');
      return;
    }
    adjustStock(tr.fromBranch, -tr.netPureWeight);
    const next = transfers.map((t) => t.id === id ? { ...t, status: 'DISPATCHED' as TransferStatus, dispatchedAt: now() } : t);
    saveTransfers(next);
    // Persist as OUT movement on source branch's lot (fire-and-forget)
    const sourceLot = receipts.find((r) => r.branch === tr.fromBranch);
    if (sourceLot) {
      api<any>(`${INV_BASE}/movements`, {
        method: 'POST',
        body: JSON.stringify({ lotId: sourceLot.id, type: 'OUT', quantity: tr.netPureWeight, referenceType: 'TRANSFER', remarks: JSON.stringify({ from: tr.fromBranch, to: tr.toBranch }) }),
      }).catch(() => {});
    }
    toast.ok('Transfer dispatched and source stock deducted');
  }

  function receiveTransfer(id: string) {
    const tr = transfers.find((t) => t.id === id);
    if (!tr || tr.status !== 'DISPATCHED') return;
    adjustStock(tr.toBranch, tr.netPureWeight);
    const next = transfers.map((t) => t.id === id ? { ...t, status: 'RECEIVED' as TransferStatus, receivedAt: now() } : t);
    saveTransfers(next);
    // Persist as new IN lot at destination (fire-and-forget)
    api<any>(`${INV_BASE}/lots`, {
      method: 'POST',
      body: JSON.stringify({ lotNumber: lotNumber(), branchId: NIL_UUID, metal: 'GOLD', purityLabel: 'Custom', declaredFineness: tr.purityTier * 10, grossWeight: tr.netPureWeight, netWeight: tr.netPureWeight, receivedDate: new Date().toISOString().slice(0, 10), remarks: JSON.stringify({ br: tr.toBranch, src: 'INTERNAL_TRANSFER', from: tr.fromBranch }) }),
    }).catch(() => {});
    toast.ok('Transfer received and destination stock updated');
  }

  function dispatchToRefinery() {
    const sent = Number(rfWeightSent);
    const purity = Number(rfAvgPurity);
    if (sent <= 0 || purity <= 0 || purity > 100) {
      toast.err('Weight sent and avg purity must be valid');
      return;
    }
    const sourceStock = branchStock(rfBranch).pureGold;
    if (sourceStock < sent) {
      toast.err('Insufficient stock for refinery dispatch');
      return;
    }

    const expectedPure = calcPure(sent, purity);
    const rf: RefineryTransfer = {
      id: uuid(),
      branch: rfBranch,
      weightSent: sent,
      avgPurity: purity,
      expectedPureWeight: expectedPure,
      status: 'DISPATCHED',
      createdAt: now(),
    };

    adjustStock(rfBranch, -sent);
    saveRefinery([...refinery, rf]);

    // IN-005: auto-create delivery record on dispatch and persist as OUT movement
    const branchLot = receipts.find((r) => r.branch === rfBranch);
    let movId = uuid();
    if (branchLot) {
      api<any>(`${INV_BASE}/movements`, {
        method: 'POST',
        body: JSON.stringify({ lotId: branchLot.id, type: 'OUT', quantity: sent, referenceType: 'REFINERY', remarks: JSON.stringify({ br: rfBranch, src: 'REFINERY_DISPATCH' }) }),
      }).then(res => { movId = res.id; }).catch(() => {});
    }
    const d: Delivery = {
      id: movId,
      branch: rfBranch,
      pureWeight: sent,
      status: 'DONE',
      createdAt: now(),
      source: 'REFINERY_AUTO',
    };
    saveDeliveries([...deliveries, d]);

    toast.ok('Refinery transfer dispatched. Delivery record auto-created');
    setRfWeightSent('');
    setRfAvgPurity('');
  }

  function receiveFromRefinery() {
    const rec = Number(rfReceiveWeight);
    if (rec <= 0 || !rfSelectedId) {
      toast.err('Select transfer and enter received weight');
      return;
    }
    const tr = refinery.find((r) => r.id === rfSelectedId);
    if (!tr || tr.status !== 'DISPATCHED') {
      toast.err('Selected refinery transfer is not dispatch-pending');
      return;
    }

    const pnl = Math.round((rec - tr.expectedPureWeight) * 1000) / 1000;
    const verdict: RefineryTransfer['pnlVerdict'] = pnl > 0 ? 'GAIN' : pnl < 0 ? 'LOSS' : 'BREAK_EVEN';

    const next = refinery.map((r) => r.id === tr.id
      ? {
          ...r,
          weightReceived: rec,
          pnlWeight: pnl,
          pnlVerdict: verdict,
          status: 'RECEIVED' as const,
          receivedAt: now(),
        }
      : r);
    saveRefinery(next);

    adjustStock(tr.branch, rec);

    // IN-005: persist returned lot + auto-create receipt record on return
    let rcptLotId = uuid();
    api<any>(`${INV_BASE}/lots`, {
      method: 'POST',
      body: JSON.stringify({ lotNumber: lotNumber(), branchId: NIL_UUID, metal: 'GOLD', purityLabel: 'Custom', declaredFineness: 1000, grossWeight: rec, netWeight: rec, receivedDate: new Date().toISOString().slice(0, 10), remarks: JSON.stringify({ br: tr.branch, src: 'REFINERY_RETURN' }) }),
    }).then(res => { rcptLotId = res.id; }).catch(() => {});
    const receipt: Receipt = {
      id: rcptLotId,
      branch: tr.branch,
      observedWeight: rec,
      purity: 100,
      pureWeight: rec,
      createdAt: now(),
    };
    saveReceipts([...receipts, receipt]);

    toast.ok(`Refinery received. P&L ${verdict}: ${pnl}g`);
    setRfReceiveWeight('');
    setRfSelectedId('');
  }

  function logChemicalUsage() {
    const usage = Number(chemHclUsage);
    if (usage <= 0) {
      toast.err('HCl usage must be positive');
      return;
    }
    const stock = branchStock(chemBranch).hclQty;
    if (stock < usage) {
      toast.err('Insufficient HCl inventory');
      return;
    }
    adjustStock(chemBranch, 0, -usage);
    toast.ok('HCl usage logged and inventory deducted');
    setChemHclUsage('');
  }

  async function saveCentre() {
    const code = centreShortCode.trim().toUpperCase();
    const name = centreName.trim();
    if (!name || !code) {
      setCentreError('Name and short code are required');
      return;
    }
    if (!/^[A-Z]{2,5}$/.test(code)) {
      setCentreError('Validation error: short code must be 2–5 letters.');
      toast.err('Validation error: short code must be 2–5 letters.');
      return;
    }
    setCentreError('');
    let centreId = uuid();
    try {
      const created = await api<any>(`${INV_BASE}/locations`, {
        method: 'POST',
        // code prefixed with branch so mapLotToReceipt-style branch extraction works on reload
        body: JSON.stringify({ branchId: NIL_UUID, code: `${centreBranch}-${code}`, name, kind: 'OTHER' }),
      });
      centreId = created.id;
    } catch (e: any) { toast.err(e?.message || 'Failed to save centre'); return; }
    const c: Centre = { id: centreId, name, shortCode: code, branch: centreBranch };
    saveCentres([...centres, c]);
    toast.ok('Centre created');
    setCentreName('');
    setCentreShortCode('');
  }

  return (
    <div>
      <PageHeader title="Inventory Desk" subtitle="Receipts · Deliveries · Transfers · Refinery · Centres" />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Total Pure" value={stats.totalPure} accent="bg-gradient-to-br from-cyan-500 to-blue-600" />
        <Stat label="Receipts" value={stats.receipts} accent="bg-gradient-to-br from-cyan-500 to-blue-600" />
        <Stat label="Deliveries" value={stats.deliveries} accent="bg-gradient-to-br from-cyan-500 to-blue-600" />
        <Stat label="Transfers Open" value={stats.transfersInProgress} accent="bg-gradient-to-br from-cyan-500 to-blue-600" />
      </div>

      <div className="flex gap-2 mb-4">
        {(['receipts', 'deliveries', 'transfers', 'refinery', 'centres'] as const).map((t) => (
          <button
            key={t}
            id={`inTab-${t}`}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              activeTab === t
                ? 'border-nexus-accent bg-nexus-accent/10 text-white'
                : 'border-nexus-line text-nexus-muted hover:text-white'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Receipts</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Branch</label>
                <select id="inRcptBranch" className="input" value={rcptBranch} onChange={(e) => setRcptBranch(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">Observed Weight (g)</label>
                <input id="inRcptObservedWeight" className="input" type="number" value={rcptObservedWeight} onChange={(e) => setRcptObservedWeight(e.target.value)} />
              </div>
              <div>
                <label className="label">Purity (%)</label>
                <input id="inRcptPurity" className="input" type="number" value={rcptPurity} onChange={(e) => setRcptPurity(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button id="inRcptSave" className="btn-primary w-full" onClick={createReceipt}>Save Receipt</button>
              </div>
            </div>
            <div id="inRcptPurePreview" className="text-sm p-2 rounded border border-nexus-line">
              Pure Weight (auto) = <strong>{rcptPurePreview}g</strong>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Receipt Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Branch</th><th>Observed</th><th>Purity</th><th>Pure</th></tr></thead>
                <tbody>
                  {receipts.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No receipts</td></tr>}
                  {receipts.map((r) => (
                    <tr key={r.id} id={`inReceiptRow-${r.id}`}>
                      <td className="font-mono text-xs">{r.id.slice(0, 8)}...</td>
                      <td>{r.branch}</td>
                      <td>{r.observedWeight}</td>
                      <td>{r.purity}%</td>
                      <td id={`inReceiptPure-${r.id}`}>{r.pureWeight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Deliveries</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Branch</label>
                <select id="inDelBranch" className="input" value={delBranch} onChange={(e) => setDelBranch(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">Delivery Qty (pure g)</label>
                <input id="inDelQty" className="input" type="number" value={delQty} onChange={(e) => setDelQty(e.target.value)} />
              </div>
              <div className="p-2 rounded border border-nexus-line text-sm">
                Current Stock: <strong id="inDelCurrentStock">{branchStock(delBranch).pureGold}</strong> g
              </div>
              <div className="flex items-end">
                <button id="inDelSave" className="btn-primary w-full" onClick={createDelivery}>Save Delivery</button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Delivery Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Branch</th><th>Qty</th><th>Source</th><th>Date</th></tr></thead>
                <tbody>
                  {deliveries.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No deliveries</td></tr>}
                  {deliveries.map((d) => (
                    <tr key={d.id} id={`inDeliveryRow-${d.id}`}>
                      <td className="font-mono text-xs">{d.id.slice(0, 8)}...</td>
                      <td>{d.branch}</td>
                      <td>{d.pureWeight}</td>
                      <td id={`inDeliverySource-${d.id}`}>{d.source}</td>
                      <td className="text-xs text-nexus-muted">{new Date(d.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Internal Transfer</h3>
            <div className="grid md:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="label">From</label>
                <select id="inTrFrom" className="input" value={trFrom} onChange={(e) => setTrFrom(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">To</label>
                <select id="inTrTo" className="input" value={trTo} onChange={(e) => setTrTo(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">Observed Weight</label>
                <input id="inTrObservedWeight" className="input" type="number" value={trObservedWeight} onChange={(e) => setTrObservedWeight(e.target.value)} />
              </div>
              <div>
                <label className="label">Purity %</label>
                <input id="inTrPurity" className="input" type="number" value={trPurity} onChange={(e) => setTrPurity(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button id="inTrCreate" className="btn-primary w-full" onClick={createTransferRequest}>Create Transfer</button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div id="inTrTier">Purity Tier: <strong>{trTier}</strong></div>
              <div id="inTrNetPure">Net Pure (auto): <strong>{trNetPurePreview}</strong> g</div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Transfer Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>ID</th><th>From</th><th>To</th><th>Net Pure</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {transfers.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No transfers</td></tr>}
                  {transfers.map((t) => (
                    <tr key={t.id} id={`inTransferRow-${t.id}`}>
                      <td className="font-mono text-xs">{t.id.slice(0, 8)}...</td>
                      <td>{t.fromBranch}</td>
                      <td>{t.toBranch}</td>
                      <td id={`inTransferNetPure-${t.id}`}>{t.netPureWeight}</td>
                      <td id={`inTransferStatus-${t.id}`}>{t.status}</td>
                      <td className="space-x-1 whitespace-nowrap">
                        {t.status === 'REQUESTED' && <button id={`inTransferAccept-${t.id}`} className="btn text-xs" onClick={() => acceptTransfer(t.id)}>Accept</button>}
                        {t.status === 'ACCEPTED' && <button id={`inTransferDispatch-${t.id}`} className="btn text-xs" onClick={() => dispatchTransfer(t.id)}>Dispatch</button>}
                        {t.status === 'DISPATCHED' && <button id={`inTransferReceive-${t.id}`} className="btn text-xs" onClick={() => receiveTransfer(t.id)}>Receive</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'refinery' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Refinery Transfer</h3>
            <div className="grid md:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="label">Branch</label>
                <select id="inRfBranch" className="input" value={rfBranch} onChange={(e) => setRfBranch(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">Weight Sent (g)</label>
                <input id="inRfWeightSent" className="input" type="number" value={rfWeightSent} onChange={(e) => setRfWeightSent(e.target.value)} />
              </div>
              <div>
                <label className="label">Avg Purity %</label>
                <input id="inRfAvgPurity" className="input" type="number" value={rfAvgPurity} onChange={(e) => setRfAvgPurity(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button id="inRfDispatch" className="btn-primary w-full" onClick={dispatchToRefinery}>Dispatch to Refinery</button>
              </div>
              <div className="text-sm p-2 rounded border border-nexus-line">
                Stock: <strong id="inRfCurrentStock">{branchStock(rfBranch).pureGold}</strong> g
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Select Dispatched Transfer</label>
                <select id="inRfSelect" className="input" value={rfSelectedId} onChange={(e) => setRfSelectedId(e.target.value)}>
                  <option value="">- Select -</option>
                  {refinery.filter((r) => r.status === 'DISPATCHED').map((r) => (
                    <option key={r.id} value={r.id}>{r.id.slice(0, 8)}... ({r.branch})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Weight Received (g)</label>
                <input id="inRfWeightReceived" className="input" type="number" value={rfReceiveWeight} onChange={(e) => setRfReceiveWeight(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button id="inRfReceive" className="btn-primary w-full" onClick={receiveFromRefinery}>Receive from Refinery</button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Refinery Processing (Chemicals)</h3>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="label">Branch</label>
                <select id="inChemBranch" className="input" value={chemBranch} onChange={(e) => setChemBranch(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div>
                <label className="label">HCl Usage</label>
                <input id="inChemHclUsage" className="input" type="number" value={chemHclUsage} onChange={(e) => setChemHclUsage(e.target.value)} />
              </div>
              <div className="text-sm p-2 rounded border border-nexus-line">
                HCl Stock: <strong id="inChemHclStock">{branchStock(chemBranch).hclQty}</strong>
              </div>
              <div className="flex items-end">
                <button id="inChemLogUsage" className="btn-primary w-full" onClick={logChemicalUsage}>Log Aqua-Regia (HCl)</button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Refinery Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Branch</th><th>Sent</th><th>Avg Purity</th><th>Expected Pure</th><th>Received</th><th>P&L</th><th>Verdict</th><th>Status</th></tr></thead>
                <tbody>
                  {refinery.length === 0 && <tr><td colSpan={9} className="text-center text-nexus-muted">No refinery transfers</td></tr>}
                  {refinery.map((r) => (
                    <tr key={r.id} id={`inRefineryRow-${r.id}`}>
                      <td className="font-mono text-xs">{r.id.slice(0, 8)}...</td>
                      <td>{r.branch}</td>
                      <td>{r.weightSent}</td>
                      <td>{r.avgPurity}%</td>
                      <td id={`inRefineryExpected-${r.id}`}>{r.expectedPureWeight}</td>
                      <td id={`inRefineryReceived-${r.id}`}>{r.weightReceived ?? '-'}</td>
                      <td id={`inRefineryPnl-${r.id}`}>{r.pnlWeight ?? '-'}</td>
                      <td id={`inRefineryVerdict-${r.id}`}>{r.pnlVerdict ?? '-'}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'centres' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Centres (Branch Management)</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Centre Name</label>
                <input id="inCentreName" className="input" value={centreName} onChange={(e) => setCentreName(e.target.value)} />
              </div>
              <div>
                <label className="label">Short Code</label>
                <input id="inCentreShortCode" className="input" value={centreShortCode} onChange={(e) => setCentreShortCode(e.target.value)} />
              </div>
              <div>
                <label className="label">Branch</label>
                <select id="inCentreBranch" className="input" value={centreBranch} onChange={(e) => setCentreBranch(e.target.value as BranchCode)}>
                  <option value="BLR">BLR</option>
                  <option value="MUM">MUM</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>
              <div className="flex items-end">
                <button id="inCentreSave" className="btn-primary w-full" onClick={saveCentre}>Create Centre</button>
              </div>
            </div>
            {centreError && <div id="inCentreShortCodeError" className="text-sm text-red-400">{centreError}</div>}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Centres Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Short Code</th><th>Branch</th></tr></thead>
                <tbody>
                  {centres.length === 0 && <tr><td colSpan={3} className="text-center text-nexus-muted">No centres</td></tr>}
                  {centres.map((c) => (
                    <tr key={c.id} id={`inCentreRow-${c.id}`}>
                      <td>{c.name}</td>
                      <td id={`inCentreShortCode-${c.id}`}>{c.shortCode}</td>
                      <td>{c.branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Branch Inventory Snapshot</h3>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Branch</th><th>Pure Gold</th><th>HCl</th></tr></thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.branch} id={`inStockRow-${s.branch}`}>
                  <td>{s.branch}</td>
                  <td id={`inStockPure-${s.branch}`}>{s.pureGold}</td>
                  <td id={`inStockHcl-${s.branch}`}>{s.hclQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
