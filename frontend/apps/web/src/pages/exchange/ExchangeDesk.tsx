import { useState, useMemo, useEffect } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { useAuth, hasAnyRole } from '@/auth/store';
import { api } from '@/lib/api';
import type { Role } from '@/modules/registry';

// ── Tester roles allowed to access XRF testing stage ────────────────────────
const TESTER_ROLES: Role[] = ['XRF_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'QUALITY_MANAGER'];

// ── Workflow stages ──────────────────────────────────────────────────────────
type ExStage =
  | 'ONBOARDING'
  | 'PRODUCT_DETAILS'
  | 'TESTING'
  | 'SETTLEMENT'
  | 'DONE'
  | 'CANCELLED';

// ── Types ────────────────────────────────────────────────────────────────────
type ExchangeCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  centre: string;
  backendId?: string;
};

type AdminBranchRef = { id: string; code: string; name: string };
type AdminCustomerRef = { id: string; name: string; phone?: string; address?: string; branchCode?: string; customerCode?: string };

type XrfResult = {
  observedPurity: number;
  observedWeight: number;
  pureGold: number;
  testedBy: string;
  testedAt: string;
  retestCount: number;
};

type Settlement = {
  extra: boolean;           // true = customer receives cash; false = customer pays
  exchangeRate: number;     // ₹ per gram of pure gold
  extraGrams: number;       // grams beyond or below the target
  cashAmount: number;       // auto-calculated: extraGrams * exchangeRate
};

type ExchangeOrder = {
  id: string;
  orderNo: string;
  branchCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCentre: string;
  stage: ExStage;
  // Product details
  itemName: string;
  claimedWeight: number;
  claimedPurity: number;
  observedWeight: number;
  // XRF
  xrf?: XrfResult;
  // Settlement
  settlement?: Settlement;
  billingId?: string;       // set when billing record is created
  createdAt: string;
  updatedAt: string;
};

type ExchangeReturn = {
  id: string;
  orderId: string;
  orderNo: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

function mapReturn(r: any): ExchangeReturn {
  return {
    id: r.id,
    orderId: r.txnId,
    orderNo: r.txnNumber || '',
    reason: r.reason || '',
    status: (r.status as 'PENDING' | 'APPROVED' | 'REJECTED') || 'PENDING',
    createdAt: r.createdAt || new Date().toISOString(),
  };
}

// ── Storage keys ─────────────────────────────────────────────────────────────
const ORDERS_KEY    = 'nexus.react.exchange.orders.v1'; // hybrid: local for active, backend for finalized
const CUSTOMERS_KEY = 'nexus.react.exchange.customers.v1';
const RETURNS_KEY   = 'nexus.react.exchange.returns.v1';
const BILLING_EX_KEY = 'nexus.react.billing.exchange.v1';

const EX_BASE = '/api/exchange/api/v1/exchange';
const BILL_BASE = '/api/billing/api/v1/billing';
const ADMIN_BASE = '/api/admin/api/v1/admin';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// Map a backend ExchangeTxn response to frontend ExchangeOrder
function mapTxnToOrder(txn: any): ExchangeOrder {
  let r: any = {};
  try { r = JSON.parse(txn.remarks || '{}'); } catch {}
  const stage: ExStage = r.stg ?? (txn.status === 'POSTED' ? 'DONE' : txn.status === 'CANCELLED' ? 'CANCELLED' : 'PRODUCT_DETAILS');
  return {
    id: txn.id,
    orderNo: txn.txnNumber ?? '',
    branchCode: r.bc ?? 'BLR',
    customerId: r.cid ?? '',
    customerName: r.cnm ?? '',
    customerPhone: r.cph ?? '',
    customerAddress: r.cad ?? '',
    customerCentre: r.cct ?? '',
    stage,
    itemName: r.itn ?? '',
    claimedWeight: Number(txn.oldGross) || 0,
    claimedPurity: Number(r.cp) || 0,
    observedWeight: Number(txn.oldPure) || 0,
    xrf: r.xp != null ? {
      observedPurity: r.xp, observedWeight: Number(txn.oldPure) || 0,
      pureGold: Math.round((Number(txn.oldPure) || 0) * r.xp / 100 * 1000) / 1000,
      testedBy: r.xby ?? '', testedAt: r.xat ?? '', retestCount: r.xrc ?? 0,
    } : undefined,
    settlement: r.sg != null ? {
      extra: r.sext ?? true, exchangeRate: Number(txn.valuationRate) || 0,
      extraGrams: r.sg ?? 0,
      cashAmount: Math.round((r.sg ?? 0) * (Number(txn.valuationRate) || 0) * 100) / 100,
    } : undefined,
    createdAt: txn.createdAt ?? new Date().toISOString(),
    updatedAt: txn.updatedAt ?? new Date().toISOString(),
  };
}

// Encode ExchangeOrder extra data for remarks (max ~400 chars)
function encodeRemarks(order: ExchangeOrder, stage: ExStage): string {
  const r: Record<string, any> = { stg: stage, bc: order.branchCode, cid: order.customerId, cnm: order.customerName, cph: order.customerPhone, cad: order.customerAddress, cct: order.customerCentre, itn: order.itemName, cp: order.claimedPurity };
  if (order.xrf) { r.xp = order.xrf.observedPurity; r.xby = order.xrf.testedBy; r.xat = order.xrf.testedAt; r.xrc = order.xrf.retestCount; }
  if (order.settlement) { r.sext = order.settlement.extra; r.sg = order.settlement.extraGrams; }
  return JSON.stringify(r).slice(0, 490);
}

// ── Seed customer data (mimics Masters) ──────────────────────────────────────
const SEED_CUSTOMERS: ExchangeCustomer[] = [
  { id: 'CUST-001', name: 'Arjun Mehta',   phone: '9876543210', address: '12 MG Road, Bengaluru', centre: 'BLR' },
  { id: 'CUST-002', name: 'Priya Sharma',  phone: '9988776655', address: '45 Park St, Mumbai',    centre: 'MUM' },
  { id: 'CUST-003', name: 'Raju Nair',     phone: '9123456789', address: '7 CP Lane, Delhi',      centre: 'DEL' },
];

const BRANCHES = [
  { code: 'MUM', name: 'Mumbai' },
  { code: 'BLR', name: 'Bengaluru' },
  { code: 'DEL', name: 'Delhi' },
];

const STAGE_LABELS: Record<ExStage, string> = {
  ONBOARDING: 'Onboarding', PRODUCT_DETAILS: 'Product Details',
  TESTING: 'Testing', SETTLEMENT: 'Settlement',
  DONE: 'Done', CANCELLED: 'Cancelled',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}
function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function persist<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
function now() { return new Date().toISOString(); }

function nextOrderNo(orders: ExchangeOrder[], branchCode: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${branchCode}-EX-${ymd}-`;
  const max = orders
    .filter((o) => o.orderNo.startsWith(prefix))
    .reduce((m, o) => Math.max(m, Number(o.orderNo.split('-').pop() ?? '0')), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExchangeDesk() {
  const { user } = useAuth();
  const isTester = hasAnyRole(user, TESTER_ROLES);

  const [orders, setOrders]       = useState<ExchangeOrder[]>(() => read<ExchangeOrder[]>(ORDERS_KEY, []));
  const [branchRefs, setBranchRefs] = useState<AdminBranchRef[]>([]);
  const [customerRefs, setCustomerRefs] = useState<AdminCustomerRef[]>([]);

  // Load finalized orders from backend on mount, merge with localStorage active orders
  useEffect(() => {
    api<any[]>(`${EX_BASE}/txns`)
      .then(data => {
        const backendOrders = data.map(mapTxnToOrder);
        setOrders(prev => {
          const active = prev.filter(o => !['DONE','CANCELLED'].includes(o.stage));
          const backendIds = new Set(backendOrders.map(o => o.id));
          const deduped = [...backendOrders, ...active.filter(o => !backendIds.has(o.id))];
          persist(ORDERS_KEY, deduped);
          return deduped;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<any[]>(`${ADMIN_BASE}/branches`)
      .then((rows) => setBranchRefs(rows.map((b: any) => ({ id: b.id, code: String(b.code || b.name || 'BR').toUpperCase(), name: b.name || b.code || 'Branch' }))))
      .catch(() => {});
    api<any[]>(`${ADMIN_BASE}/customers`)
      .then((rows) => {
        const refs = rows.map((c: any) => ({
          id: c.id,
          name: c.name || '',
          phone: c.phone || '',
          address: c.address || '',
          branchCode: c.branchCode || c.centre || 'BLR',
          customerCode: c.code || c.customerCode || '',
        }));
        setCustomerRefs(refs);
      })
      .catch(() => {});
  }, []);

  const branches = useMemo(() => branchRefs.length > 0 ? branchRefs.map((b) => ({ code: b.code, name: b.name, id: b.id })) : BRANCHES.map((b) => ({ ...b, id: NIL_UUID })), [branchRefs]);
  const [customers, setCustomers] = useState<ExchangeCustomer[]>(() => {
    const stored = read<ExchangeCustomer[]>(CUSTOMERS_KEY, []);
    if (stored.length === 0) {
      persist(CUSTOMERS_KEY, SEED_CUSTOMERS);
      return SEED_CUSTOMERS;
    }
    return stored;
  });

  useEffect(() => {
    if (customerRefs.length === 0) return;
    setCustomers((prev) => {
      const fromAdmin: ExchangeCustomer[] = customerRefs.map((c) => ({
        id: c.customerCode || c.id,
        name: c.name,
        phone: c.phone || '',
        address: c.address || '',
        centre: c.branchCode || 'BLR',
        backendId: c.id,
      }));
      const seen = new Set<string>();
      const merged = [...fromAdmin, ...prev].filter((c) => {
        const key = (c.backendId || c.id).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      persist(CUSTOMERS_KEY, merged);
      return merged;
    });
  }, [customerRefs]);
  const [returns, setReturns]     = useState<ExchangeReturn[]>(() => read<ExchangeReturn[]>(RETURNS_KEY, []));

  useEffect(() => {
    api<any[]>(`${EX_BASE}/returns`)
      .then((rows) => {
        const mapped = rows.map(mapReturn);
        setReturns(mapped);
        persist(RETURNS_KEY, mapped);
      })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'returns' | 'reports'>('orders');

  // ── Active order for step-through workflow ───────────────────────────────
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  // ── New order form state ─────────────────────────────────────────────────
  const [formBranch, setFormBranch]           = useState('BLR');
  const [formCustMode, setFormCustMode]       = useState<'existing' | 'new'>('existing');
  const [formExistingCustId, setFormExistingCustId] = useState('');
  // auto-filled / new customer fields
  const [formCustName, setFormCustName]       = useState('');
  const [formCustPhone, setFormCustPhone]     = useState('');
  const [formCustAddress, setFormCustAddress] = useState('');
  const [formCustCentre, setFormCustCentre]   = useState('BLR');

  // ── Product details form ─────────────────────────────────────────────────
  const [pdItemName, setPdItemName]           = useState('');
  const [pdClaimedWeight, setPdClaimedWeight] = useState('');
  const [pdClaimedPurity, setPdClaimedPurity] = useState('');
  const [pdObservedWeight, setPdObservedWeight] = useState('');

  // ── XRF form ─────────────────────────────────────────────────────────────
  const [xrfPurity, setXrfPurity]   = useState('');
  const [xrfWeight, setXrfWeight]   = useState('');

  // ── Settlement form ───────────────────────────────────────────────────────
  const [stlExtra, setStlExtra]         = useState(true);
  const [stlRate, setStlRate]           = useState('');
  const [stlExtraGrams, setStlExtraGrams] = useState('');

  // ── Return form ───────────────────────────────────────────────────────────
  const [retOrderId, setRetOrderId]   = useState('');
  const [retReason, setRetReason]     = useState('');

  // ── Reports filters/result (EX-013 / EX-014 / EX-015) ───────────────────
  const [dailyStartDate, setDailyStartDate] = useState('');
  const [dailyEndDate, setDailyEndDate] = useState('');
  const [reportCustomerId, setReportCustomerId] = useState('');
  const [reportBranchCode, setReportBranchCode] = useState('');
  const [reportRows, setReportRows] = useState<ExchangeOrder[]>([]);
  const [reportTitle, setReportTitle] = useState('No report generated');

  // ── New customer form (create mode) ──────────────────────────────────────
  const [newCustId, setNewCustId]       = useState('');
  const [newCustName, setNewCustName]   = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr]   = useState('');
  const [newCustCentre, setNewCustCentre] = useState('BLR');

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     orders.length,
    active:    orders.filter((o) => !['DONE', 'CANCELLED'].includes(o.stage)).length,
    done:      orders.filter((o) => o.stage === 'DONE').length,
    cancelled: orders.filter((o) => o.stage === 'CANCELLED').length,
  }), [orders]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function saveOrders(next: ExchangeOrder[]) {
    setOrders(next);
    persist(ORDERS_KEY, next);
  }
  function updateOrder(id: string, patch: Partial<ExchangeOrder>) {
    const next = orders.map((o) => o.id === id ? { ...o, ...patch, updatedAt: now() } : o);
    saveOrders(next);
  }

  async function patchTxn(order: ExchangeOrder, patch: { stage: ExStage; status?: 'POSTED' | 'CANCELLED'; valuationRate?: number; settlementType?: 'CASH' | 'REFUND' }) {
    if (!isUuid(order.id)) return;
    try {
      await api(`${EX_BASE}/txns/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          remarks: encodeRemarks(order, patch.stage),
          valuationRate: patch.valuationRate,
          settlementType: patch.settlementType,
        }),
      });
      if (patch.status) {
        await api(`${EX_BASE}/txns/${order.id}/status?status=${patch.status}`, { method: 'PATCH' });
      }
    } catch (_) {
      // Keep UX resilient; local state is already updated.
    }
  }

  // ── Customer auto-fill ────────────────────────────────────────────────────
  function handleExistingCustChange(custId: string) {
    setFormExistingCustId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setFormCustName(cust.name);
      setFormCustPhone(cust.phone);
      setFormCustAddress(cust.address);
      setFormCustCentre(cust.centre);
    } else {
      setFormCustName(''); setFormCustPhone(''); setFormCustAddress(''); setFormCustCentre('BLR');
    }
  }

  // ── Create new customer (EX-002) ──────────────────────────────────────────
  function saveNewCustomer() {
    if (!newCustId.trim() || !newCustName.trim()) { toast.err('Customer ID and Name are required'); return; }
    if (customers.find((c) => c.id === newCustId.trim())) { toast.err('Customer ID already exists'); return; }
    const cust: ExchangeCustomer = {
      id: newCustId.trim(), name: newCustName.trim(),
      phone: newCustPhone.trim(), address: newCustAddr.trim(), centre: newCustCentre,
    };
    const updated = [...customers, cust];
    setCustomers(updated);
    persist(CUSTOMERS_KEY, updated);
    toast.ok(`Customer ${cust.name} created`);
    setNewCustId(''); setNewCustName(''); setNewCustPhone(''); setNewCustAddr('');
  }

  // ── Onboarding: start exchange order (EX-001 / EX-002) ───────────────────
  async function startOnboarding() {
    let custId: string;
    let cust: ExchangeCustomer | undefined;
    let backendCustomerId: string | null = null;
    if (formCustMode === 'existing') {
      if (!formExistingCustId) { toast.err('Select an existing customer'); return; }
      cust = customers.find((c) => c.id === formExistingCustId);
      if (!cust) { toast.err('Customer not found'); return; }
      custId = cust.id;
      backendCustomerId = cust.backendId && isUuid(cust.backendId) ? cust.backendId : null;
    } else {
      if (!formCustName.trim() || !formCustPhone.trim()) { toast.err('Customer Name and Phone required'); return; }
      custId = uuid();
      cust = {
        id: custId, name: formCustName.trim(),
        phone: formCustPhone.trim(), address: formCustAddress.trim(), centre: formCustCentre,
      };
      const updated = [...customers, cust];
      setCustomers(updated);
      persist(CUSTOMERS_KEY, updated);
    }
    const branch = branches.find((b) => b.code === formBranch);
    const branchId = branch && isUuid(branch.id) ? branch.id : NIL_UUID;
    const localOrderNo = nextOrderNo(orders, formBranch);

    try {
      const created = await api<any>(`${EX_BASE}/txns`, {
        method: 'POST',
        body: JSON.stringify({
          txnNumber: localOrderNo,
          branchId,
          customerId: backendCustomerId || NIL_UUID,
          exchangeDate: new Date().toISOString().slice(0, 10),
          metal: 'GOLD',
          valuationRate: 0,
          settlementType: 'CASH',
          remarks: JSON.stringify({ stg: 'PRODUCT_DETAILS', bc: formBranch, cid: custId, cnm: cust.name, cph: cust.phone, cad: cust.address, cct: cust.centre }).slice(0, 490),
        }),
      });
      const order: ExchangeOrder = {
        id: created.id,
        orderNo: created.txnNumber || localOrderNo,
        branchCode: formBranch,
        customerId: custId,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerAddress: cust.address,
        customerCentre: cust.centre,
        stage: 'PRODUCT_DETAILS',
        itemName: '', claimedWeight: 0, claimedPurity: 0, observedWeight: 0,
        createdAt: now(), updatedAt: now(),
      };
      saveOrders([...orders, order]);
      setSelectedOrderId(order.id);
      toast.ok(`Exchange ${order.orderNo} created — enter product details`);
    } catch {
      const order: ExchangeOrder = {
        id: uuid(),
        orderNo: localOrderNo,
        branchCode: formBranch,
        customerId: custId,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerAddress: cust.address,
        customerCentre: cust.centre,
        stage: 'PRODUCT_DETAILS',
        itemName: '', claimedWeight: 0, claimedPurity: 0, observedWeight: 0,
        createdAt: now(), updatedAt: now(),
      };
      saveOrders([...orders, order]);
      setSelectedOrderId(order.id);
      toast.ok(`Exchange ${order.orderNo} created locally — enter product details`);
    }
    // reset form
    setFormExistingCustId(''); setFormCustName(''); setFormCustPhone(''); setFormCustAddress('');
  }

  // ── Product details (EX-003) ──────────────────────────────────────────────
  function saveProductDetails(orderId: string) {
    const cw = Number(pdClaimedWeight), cp = Number(pdClaimedPurity), ow = Number(pdObservedWeight);
    if (!pdItemName.trim()) { toast.err('Item name required'); return; }
    if (cw <= 0 || cp <= 0 || ow <= 0) { toast.err('All weights and purity must be positive'); return; }
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const nextOrder: ExchangeOrder = {
      ...order,
      itemName: pdItemName.trim(),
      claimedWeight: cw, claimedPurity: cp, observedWeight: ow,
      stage: 'TESTING' as ExStage,
    };
    updateOrder(orderId, {
      itemName: nextOrder.itemName,
      claimedWeight: cw, claimedPurity: cp, observedWeight: ow,
      stage: 'TESTING',
    });

    if (isUuid(orderId)) {
      api(`${EX_BASE}/items`, {
        method: 'POST',
        body: JSON.stringify({
          txnId: orderId,
          side: 'OLD',
          itemDesc: pdItemName.trim(),
          grossWeight: ow,
          fineness: cp * 10,
          remarks: `claimed=${cw}`,
        }),
      }).catch(() => {});
      patchTxn(nextOrder, { stage: 'TESTING' });
    }
    toast.ok('Product details saved — advancing to Testing');
    setPdItemName(''); setPdClaimedWeight(''); setPdClaimedPurity(''); setPdObservedWeight('');
  }

  // ── XRF Testing (EX-005 / EX-006) ────────────────────────────────────────
  function saveXrf(orderId: string) {
    const p = Number(xrfPurity), w = Number(xrfWeight);
    if (p <= 0 || p > 100 || w <= 0) { toast.err('Enter valid XRF purity (0-100) and weight'); return; }
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const retestCount = (order.xrf?.retestCount ?? 0);
    const xrf: XrfResult = {
      observedPurity: p, observedWeight: w,
      pureGold: Math.round(w * p / 100 * 1000) / 1000,
      testedBy: user?.email ?? 'unknown',
      testedAt: now(),
      retestCount,
    };
    const nextOrder = { ...order, xrf, stage: 'SETTLEMENT' as ExStage };
    updateOrder(orderId, { xrf, stage: 'SETTLEMENT' });
    patchTxn(nextOrder, { stage: 'SETTLEMENT' });
    toast.ok(`XRF complete — Pure gold: ${xrf.pureGold}g @ ${p}%`);
    setXrfPurity(''); setXrfWeight('');
  }

  function requestRetest(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.xrf) return;
    updateOrder(orderId, {
      xrf: { ...order.xrf, retestCount: order.xrf.retestCount + 1 },
      stage: 'TESTING',
    });
    toast.warn('Retest requested — order returned to Testing stage');
  }

  // ── Final Settlement (EX-007 / EX-008) ───────────────────────────────────
  async function confirmSettlement(orderId: string) {
    const rate = Number(stlRate), grams = Number(stlExtraGrams);
    if (rate <= 0 || grams < 0) { toast.err('Enter valid exchange rate and extra grams'); return; }
    const cash = Math.round(grams * rate * 100) / 100;
    const settlement: Settlement = { extra: stlExtra, exchangeRate: rate, extraGrams: grams, cashAmount: cash };
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    let billingId = uuid();
    try {
      const rec = await api<any>(`${BILL_BASE}/exchange-records`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: isUuid(order.customerId) ? order.customerId : NIL_UUID,
          branchCode: order.branchCode,
          goldGrams: order.xrf?.observedWeight ?? 0,
          purity: order.xrf?.observedPurity ?? 0,
          cashComponent: cash,
          remarks: JSON.stringify({ linkedExchangeOrderId: orderId, orderNo: order.orderNo }).slice(0, 490),
        }),
      });
      billingId = rec.id || billingId;
    } catch {
      const billingRec = {
        id: billingId, linkedExchangeOrderId: orderId, orderNo: order.orderNo,
        customerId: order.customerId, branchCode: order.branchCode,
        goldGrams: order.xrf?.observedWeight ?? 0, purity: order.xrf?.observedPurity ?? 0,
        cashComponent: cash, grand_total: 0, createdAt: now(),
      };
      const billingList = read<any[]>(BILLING_EX_KEY, []);
      persist(BILLING_EX_KEY, [...billingList, billingRec]);
    }

    const nextOrder = { ...order, settlement, stage: 'DONE' as ExStage, billingId };
    updateOrder(orderId, { settlement, stage: 'DONE', billingId });

    await patchTxn(nextOrder, {
      stage: 'DONE',
      status: 'POSTED',
      valuationRate: rate,
      settlementType: stlExtra ? 'REFUND' : 'CASH',
    });

    const direction = stlExtra ? `Cash payable to customer` : `Cash received from customer`;
    toast.ok(`Settlement confirmed. ${direction}: ₹${cash}`);
    setStlRate(''); setStlExtraGrams('');
  }

  // ── Cancel (EX-010 / EX-011) ──────────────────────────────────────────────
  function cancelOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.stage === 'DONE') {
      toast.err('Cannot directly cancel a completed exchange — use Exchange Return process');
      return;
    }
    updateOrder(orderId, { stage: 'CANCELLED' });
    patchTxn({ ...order, stage: 'CANCELLED' }, { stage: 'CANCELLED', status: 'CANCELLED' });
    toast.warn(`Exchange ${order.orderNo} cancelled`);
    if (selectedOrderId === orderId) setSelectedOrderId(null);
  }

  // ── Exchange Return (EX-012) ──────────────────────────────────────────────
  async function createReturn() {
    if (!retOrderId) { toast.err('Select an exchange order to return'); return; }
    if (!retReason.trim()) { toast.err('Reason is required'); return; }
    const order = orders.find((o) => o.id === retOrderId);
    if (!order) { toast.err('Order not found'); return; }
    if (order.stage !== 'DONE') { toast.err('Only completed (Done) exchanges can be returned'); return; }

    if (isUuid(retOrderId)) {
      try {
        const created = await api<any>(`${EX_BASE}/returns`, {
          method: 'POST',
          body: JSON.stringify({ txnId: retOrderId, reason: retReason.trim() }),
        });
        const ret = mapReturn(created);
        const updated = [ret, ...returns];
        setReturns(updated);
        persist(RETURNS_KEY, updated);
        toast.ok(`Return request raised for ${ret.orderNo || order.orderNo} — pending admin approval`);
        setRetOrderId(''); setRetReason('');
        return;
      } catch {
        // fallback local below
      }
    }

    const ret: ExchangeReturn = {
      id: uuid(),
      orderId: retOrderId,
      orderNo: order.orderNo,
      reason: retReason.trim(),
      status: 'PENDING',
      createdAt: now(),
    };
    const updated = [...returns, ret];
    setReturns(updated);
    persist(RETURNS_KEY, updated);
    toast.ok(`Return request saved locally for ${order.orderNo}`);
    setRetOrderId(''); setRetReason('');
  }

  function generateDailyReport() {
    if (!dailyStartDate || !dailyEndDate) {
      toast.err('Start and End date are required');
      return;
    }
    const start = new Date(`${dailyStartDate}T00:00:00`).getTime();
    const end = new Date(`${dailyEndDate}T23:59:59.999`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      toast.err('Provide a valid date range');
      return;
    }
    const filtered = orders.filter((o) => {
      const ts = new Date(o.createdAt).getTime();
      return ts >= start && ts <= end;
    });
    setReportRows(filtered);
    setReportTitle(`Daily Report (${dailyStartDate} to ${dailyEndDate})`);
    toast.ok(`Daily report generated: ${filtered.length} transactions`);
  }

  function generateCustomerReport() {
    if (!reportCustomerId) {
      toast.err('Select a customer');
      return;
    }
    const filtered = orders.filter((o) => o.customerId === reportCustomerId);
    const customerName = customers.find((c) => c.id === reportCustomerId)?.name ?? reportCustomerId;
    setReportRows(filtered);
    setReportTitle(`Customer Report (${customerName})`);
    toast.ok(`Customer report generated: ${filtered.length} transactions`);
  }

  function generateBranchReport() {
    if (!reportBranchCode) {
      toast.err('Select a branch/centre');
      return;
    }
    const filtered = orders.filter((o) => o.branchCode === reportBranchCode);
    setReportRows(filtered);
    setReportTitle(`Branch Report (${reportBranchCode})`);
    toast.ok(`Branch report generated: ${filtered.length} transactions`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Exchange Desk" subtitle="Gold exchange · Customer onboarding · Testing · Settlement" />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Total"     value={stats.total}     accent="bg-gradient-to-br from-yellow-500 to-amber-600" />
        <Stat label="Active"    value={stats.active}    accent="bg-gradient-to-br from-yellow-500 to-amber-600" />
        <Stat label="Done"      value={stats.done}      accent="bg-gradient-to-br from-yellow-500 to-amber-600" />
        <Stat label="Cancelled" value={stats.cancelled} accent="bg-gradient-to-br from-yellow-500 to-amber-600" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        {(['orders', 'customers', 'returns', 'reports'] as const).map((t) => (
          <button
            key={t}
            id={`exTab-${t}`}
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

      {/* ── ORDERS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* New Exchange — Onboarding */}
          {!selectedOrder && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Start Exchange — Customer Onboarding</h3>
              <div className="flex gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="exCustModeExisting"
                    type="radio"
                    name="custMode"
                    value="existing"
                    checked={formCustMode === 'existing'}
                    onChange={() => setFormCustMode('existing')}
                  />
                  Existing Customer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="exCustModeNew"
                    type="radio"
                    name="custMode"
                    value="new"
                    checked={formCustMode === 'new'}
                    onChange={() => setFormCustMode('new')}
                  />
                  New Customer
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Branch</label>
                  <select id="exBranch" className="input" value={formBranch} onChange={(e) => setFormBranch(e.target.value)}>
                    {branches.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                  </select>
                </div>
                {formCustMode === 'existing' && (
                  <div>
                    <label className="label">Select Customer</label>
                    <select id="exExistingCust" className="input" value={formExistingCustId} onChange={(e) => handleExistingCustChange(e.target.value)}>
                      <option value="">— Select —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Auto-filled or new customer fields */}
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Customer Name*</label>
                  <input
                    id="exCustName"
                    className="input"
                    value={formCustName}
                    onChange={(e) => setFormCustName(e.target.value)}
                    readOnly={formCustMode === 'existing'}
                    placeholder="Auto-filled from customer record"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    id="exCustPhone"
                    className="input"
                    value={formCustPhone}
                    onChange={(e) => setFormCustPhone(e.target.value)}
                    readOnly={formCustMode === 'existing'}
                    placeholder="Auto-filled"
                  />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input
                    id="exCustAddress"
                    className="input"
                    value={formCustAddress}
                    onChange={(e) => setFormCustAddress(e.target.value)}
                    readOnly={formCustMode === 'existing'}
                    placeholder="Auto-filled"
                  />
                </div>
                <div>
                  <label className="label">Centre</label>
                  <input
                    id="exCustCentre"
                    className="input"
                    value={formCustCentre}
                    onChange={(e) => setFormCustCentre(e.target.value)}
                    readOnly={formCustMode === 'existing'}
                    placeholder="Auto-filled"
                  />
                </div>
              </div>
              <button id="exStartOnboarding" className="btn-primary" onClick={startOnboarding}>
                Start Exchange
              </button>
            </div>
          )}

          {/* Active Order — workflow steps */}
          {selectedOrder && selectedOrder.stage === 'PRODUCT_DETAILS' && (
            <div className="card p-4" id={`exOrderCard-${selectedOrder.id}`}>
              <h3 className="text-sm font-semibold mb-1">
                {selectedOrder.orderNo} — <span className="text-amber-400">Product Details</span>
              </h3>
              <p className="text-xs text-nexus-muted mb-3">Customer: {selectedOrder.customerName} · Branch: {selectedOrder.branchCode}</p>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Item Name*</label>
                  <input id="exPdItemName" className="input" value={pdItemName} onChange={(e) => setPdItemName(e.target.value)} placeholder="Gold Necklace" />
                </div>
                <div>
                  <label className="label">Claimed Weight (g)*</label>
                  <input id="exPdClaimedWeight" className="input" type="number" value={pdClaimedWeight} onChange={(e) => setPdClaimedWeight(e.target.value)} />
                </div>
                <div>
                  <label className="label">Claimed Purity (%)*</label>
                  <input id="exPdClaimedPurity" className="input" type="number" value={pdClaimedPurity} onChange={(e) => setPdClaimedPurity(e.target.value)} />
                </div>
                <div>
                  <label className="label">Observed Weight (g)*</label>
                  <input id="exPdObservedWeight" className="input" type="number" value={pdObservedWeight} onChange={(e) => setPdObservedWeight(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <button id={`exSaveProduct-${selectedOrder.id}`} className="btn-primary" onClick={() => saveProductDetails(selectedOrder.id)}>
                  Save & Advance to Testing
                </button>
                <button className="btn text-xs" onClick={() => setSelectedOrderId(null)}>← Back to List</button>
              </div>
            </div>
          )}

          {selectedOrder && selectedOrder.stage === 'TESTING' && (
            <div className="card p-4" id={`exOrderCard-${selectedOrder.id}`}>
              <h3 className="text-sm font-semibold mb-1">
                {selectedOrder.orderNo} — <span className="text-blue-400">XRF Testing</span>
                {selectedOrder.xrf && selectedOrder.xrf.retestCount > 0 && (
                  <span className="ml-2 text-xs text-amber-400">Retest #{selectedOrder.xrf.retestCount}</span>
                )}
              </h3>
              <p className="text-xs text-nexus-muted mb-3">Customer: {selectedOrder.customerName} · Item: {selectedOrder.itemName}</p>

              {/* Role guard (EX-004) */}
              {!isTester ? (
                <div id="exTestingAccessDenied" className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg text-sm text-red-400">
                  🔒 Access Denied — Only users with the XRF Tester role can access this stage.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Observed Purity (%)</label>
                      <input id="exXrfPurity" className="input" type="number" value={xrfPurity} onChange={(e) => setXrfPurity(e.target.value)} placeholder="91.6" />
                    </div>
                    <div>
                      <label className="label">Observed Weight (g)</label>
                      <input id="exXrfWeight" className="input" type="number" value={xrfWeight} onChange={(e) => setXrfWeight(e.target.value)} placeholder="10.00" />
                    </div>
                  </div>
                  {xrfPurity && xrfWeight && (
                    <div id="exXrfPureGoldCalc" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm">
                      Pure Gold = <span className="font-mono font-bold text-emerald-400">
                        {Math.round(Number(xrfWeight) * Number(xrfPurity) / 100 * 1000) / 1000} g
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button id={`exSaveXrf-${selectedOrder.id}`} className="btn-primary" onClick={() => saveXrf(selectedOrder.id)}>
                      Confirm XRF Results
                    </button>
                    <button id={`exCancel-${selectedOrder.id}`} className="btn text-xs text-red-400" onClick={() => cancelOrder(selectedOrder.id)}>
                      Cancel Exchange
                    </button>
                    <button className="btn text-xs" onClick={() => setSelectedOrderId(null)}>← Back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedOrder && selectedOrder.stage === 'SETTLEMENT' && (
            <div className="card p-4" id={`exOrderCard-${selectedOrder.id}`}>
              <h3 className="text-sm font-semibold mb-1">
                {selectedOrder.orderNo} — <span className="text-purple-400">Final Settlement</span>
              </h3>
              <p className="text-xs text-nexus-muted mb-3">Customer: {selectedOrder.customerName}</p>

              {selectedOrder.xrf && (
                <div id={`exPureGold-${selectedOrder.id}`} className="grid grid-cols-3 gap-3 mb-4 p-3 bg-nexus-panel2 rounded-lg text-sm">
                  <div><span className="label">Observed Weight</span><br /><strong>{selectedOrder.xrf.observedWeight} g</strong></div>
                  <div><span className="label">Purity</span><br /><strong>{selectedOrder.xrf.observedPurity}%</strong></div>
                  <div><span className="label">Pure Gold</span><br /><strong className="text-emerald-400">{selectedOrder.xrf.pureGold} g</strong></div>
                </div>
              )}

              <div className="mb-3">
                <label className="label">Settlement Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      id="exStlExtraOn"
                      type="radio"
                      name="stlExtra"
                      checked={stlExtra}
                      onChange={() => setStlExtra(true)}
                    />
                    Extra ON (customer receives cash for extra gold)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      id="exStlExtraOff"
                      type="radio"
                      name="stlExtra"
                      checked={!stlExtra}
                      onChange={() => setStlExtra(false)}
                    />
                    Extra OFF (customer pays for deficit gold)
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Exchange Rate (₹/g)</label>
                  <input id="exStlRate" className="input" type="number" value={stlRate} onChange={(e) => setStlRate(e.target.value)} placeholder="6000" />
                </div>
                <div>
                  <label className="label">{stlExtra ? 'Extra' : 'Deficit'} Grams</label>
                  <input id="exStlExtraGrams" className="input" type="number" value={stlExtraGrams} onChange={(e) => setStlExtraGrams(e.target.value)} placeholder="2.5" />
                </div>
              </div>

              {stlRate && stlExtraGrams && (
                <div id="exStlCashCalc" className={`p-3 rounded-lg text-sm mb-3 border ${stlExtra ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  {stlExtra ? 'Cash payable to customer' : 'Cash received from customer'}:{' '}
                  <span id="exStlCashAmount" className={`font-mono font-bold ${stlExtra ? 'text-emerald-400' : 'text-red-400'}`}>
                    ₹{Math.round(Number(stlExtraGrams) * Number(stlRate) * 100) / 100}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button id={`exConfirmSettlement-${selectedOrder.id}`} className="btn-primary" onClick={() => confirmSettlement(selectedOrder.id)}>
                  Confirm Settlement & Mark Done
                </button>
                <button id={`exRetest-${selectedOrder.id}`} className="btn text-xs" onClick={() => requestRetest(selectedOrder.id)}>
                  Request Retest
                </button>
                <button className="btn text-xs" onClick={() => setSelectedOrderId(null)}>← Back</button>
              </div>
            </div>
          )}

          {selectedOrder && selectedOrder.stage === 'DONE' && (
            <div className="card p-4" id={`exOrderCard-${selectedOrder.id}`}>
              <h3 className="text-sm font-semibold mb-1">
                {selectedOrder.orderNo} — <span className="text-emerald-400">Done ✓</span>
              </h3>
              <p className="text-xs text-nexus-muted mb-3">Customer: {selectedOrder.customerName} · Billing ID: {selectedOrder.billingId ?? '—'}</p>
              <div className="flex gap-2 mb-3">
                <button id={`exPrintReceipt-${selectedOrder.id}`} className="btn-primary text-xs" onClick={() => toast.ok(`Receipt for ${selectedOrder.orderNo} sent to print`)}>
                  🖨 Print Receipt
                </button>
                <button
                  id={`exCancel-${selectedOrder.id}`}
                  className="btn text-xs text-nexus-muted"
                  onClick={() => cancelOrder(selectedOrder.id)}
                  title="Cancel not allowed in Done state"
                >
                  Cancel (blocked)
                </button>
                <button className="btn text-xs" onClick={() => setSelectedOrderId(null)}>← Back</button>
              </div>
              <div id={`exBillingCreated-${selectedOrder.id}`} className="p-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                ✅ Billing record created — ID: {selectedOrder.billingId}
              </div>
            </div>
          )}

          {selectedOrder && selectedOrder.stage === 'CANCELLED' && (
            <div className="card p-4" id={`exOrderCard-${selectedOrder.id}`}>
              <h3 className="text-sm font-semibold mb-1">
                {selectedOrder.orderNo} — <span className="text-red-400">Cancelled</span>
              </h3>
              <p className="text-xs text-nexus-muted mb-3">Inventory not affected.</p>
              <button className="btn text-xs" onClick={() => setSelectedOrderId(null)}>← Back to List</button>
            </div>
          )}

          {/* Order register */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Exchange Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order #</th><th>Branch</th><th>Customer</th><th>Item</th>
                    <th>Stage</th><th>Pure Gold (g)</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-nexus-muted">No exchange orders yet</td></tr>
                  )}
                  {orders.map((o) => (
                    <tr key={o.id} id={`exRow-${o.id}`}>
                      <td id={`exOrderNo-${o.id}`} className="font-mono text-xs">{o.orderNo}</td>
                      <td>{o.branchCode}</td>
                      <td>{o.customerName}</td>
                      <td>{o.itemName || '—'}</td>
                      <td>
                        <span
                          id={`exStage-${o.id}`}
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                            o.stage === 'DONE'       ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : o.stage === 'CANCELLED' ? 'border-red-500/40 bg-red-500/15 text-red-300'
                            : o.stage === 'TESTING'   ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                            : o.stage === 'SETTLEMENT'? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                            : 'border-nexus-line text-nexus-muted'
                          }`}
                        >
                          {STAGE_LABELS[o.stage]}
                        </span>
                      </td>
                      <td id={`exPureGoldCell-${o.id}`}>{o.xrf ? `${o.xrf.pureGold} g` : '—'}</td>
                      <td className="space-x-1 whitespace-nowrap">
                        {!['DONE', 'CANCELLED'].includes(o.stage) && (
                          <button className="btn text-xs" onClick={() => setSelectedOrderId(o.id)}>Open</button>
                        )}
                        {o.stage === 'DONE' && (
                          <button className="btn text-xs" onClick={() => setSelectedOrderId(o.id)}>View</button>
                        )}
                        {!['DONE', 'CANCELLED'].includes(o.stage) && (
                          <button
                            id={`exCancelBtn-${o.id}`}
                            className="btn text-xs text-red-400"
                            onClick={() => cancelOrder(o.id)}
                          >
                            Cancel
                          </button>
                        )}
                        {o.stage === 'DONE' && (
                          <button
                            id={`exCancelDoneBtn-${o.id}`}
                            className="btn text-xs text-nexus-muted cursor-not-allowed opacity-50"
                            onClick={() => cancelOrder(o.id)}
                          >
                            Cancel
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

      {/* ── CUSTOMERS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create New Customer</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Customer ID*</label>
                <input id="exNewCustId" className="input" value={newCustId} onChange={(e) => setNewCustId(e.target.value)} placeholder="CUST-004" />
              </div>
              <div>
                <label className="label">Name*</label>
                <input id="exNewCustName" className="input" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Sunita Rao" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input id="exNewCustPhone" className="input" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="9000000000" />
              </div>
              <div>
                <label className="label">Address</label>
                <input id="exNewCustAddr" className="input" value={newCustAddr} onChange={(e) => setNewCustAddr(e.target.value)} placeholder="10 Gold St" />
              </div>
              <div>
                <label className="label">Centre</label>
                <select id="exNewCustCentre" className="input" value={newCustCentre} onChange={(e) => setNewCustCentre(e.target.value)}>
                  {branches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button id="exSaveNewCustomer" className="btn-primary w-full" onClick={saveNewCustomer}>Create Customer</button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Customer Registry</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Address</th><th>Centre</th></tr></thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} id={`exCust-${c.id}`}>
                      <td>{c.id}</td>
                      <td id={`exCustName-${c.id}`}>{c.name}</td>
                      <td id={`exCustPhone-${c.id}`}>{c.phone}</td>
                      <td id={`exCustAddress-${c.id}`}>{c.address}</td>
                      <td id={`exCustCentre-${c.id}`}>{c.centre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RETURNS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Raise Exchange Return</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Completed Exchange</label>
                <select id="exReturnOrderId" className="input" value={retOrderId} onChange={(e) => setRetOrderId(e.target.value)}>
                  <option value="">— Select Done exchange —</option>
                  {orders.filter((o) => o.stage === 'DONE').map((o) => (
                    <option key={o.id} value={o.id}>{o.orderNo} — {o.customerName}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Reason*</label>
                <input id="exReturnReason" className="input" value={retReason} onChange={(e) => setRetReason(e.target.value)} placeholder="Customer not satisfied with settlement" />
              </div>
            </div>
            <button id="exSubmitReturn" className="btn-primary" onClick={createReturn}>Submit Return Request</button>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Exchange Returns Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Return ID</th><th>Order #</th><th>Reason</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {returns.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-nexus-muted">No return requests</td></tr>
                  )}
                  {returns.map((r) => (
                    <tr key={r.id} id={`exReturn-${r.id}`}>
                      <td className="font-mono text-xs">{r.id.slice(0, 8)}…</td>
                      <td>{r.orderNo}</td>
                      <td>{r.reason}</td>
                      <td>
                        <span
                          id={`exReturnStatus-${r.id}`}
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                            r.status === 'APPROVED'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : r.status === 'REJECTED'
                                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                                : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="text-xs text-nexus-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Daily Report</h3>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Start Date</label>
                <input
                  id="exDailyReportStartDate"
                  type="date"
                  className="input"
                  value={dailyStartDate}
                  onChange={(e) => setDailyStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  id="exDailyReportEndDate"
                  type="date"
                  className="input"
                  value={dailyEndDate}
                  onChange={(e) => setDailyEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button id="exGenerateDailyReport" className="btn-primary w-full" onClick={generateDailyReport}>
                  Generate Daily Report
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Customer Report</h3>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Customer</label>
                <select
                  id="exCustomerReportCustomer"
                  className="input"
                  value={reportCustomerId}
                  onChange={(e) => setReportCustomerId(e.target.value)}
                >
                  <option value="">— Select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button id="exGenerateCustomerReport" className="btn-primary w-full" onClick={generateCustomerReport}>
                  Generate Customer Report
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Branch Report</h3>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Branch / Centre</label>
                <select
                  id="exBranchReportBranch"
                  className="input"
                  value={reportBranchCode}
                  onChange={(e) => setReportBranchCode(e.target.value)}
                >
                  <option value="">— Select branch —</option>
                  {branches.map((b) => (
                    <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button id="exGenerateBranchReport" className="btn-primary w-full" onClick={generateBranchReport}>
                  Generate Branch Report
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 id="exReportTitle" className="text-sm font-semibold mb-3">{reportTitle}</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Branch</th>
                    <th>Stage</th>
                    <th>Pure Gold (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 && (
                    <tr><td id="exReportEmpty" colSpan={6} className="text-center text-nexus-muted">No transactions found</td></tr>
                  )}
                  {reportRows.map((o) => (
                    <tr key={o.id} id={`exReportRow-${o.id}`}>
                      <td id={`exReportOrderNo-${o.id}`}>{o.orderNo}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td id={`exReportCustomer-${o.id}`}>{o.customerName}</td>
                      <td id={`exReportBranch-${o.id}`}>{o.branchCode}</td>
                      <td>{STAGE_LABELS[o.stage]}</td>
                      <td>{o.xrf ? `${o.xrf.pureGold} g` : '—'}</td>
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
