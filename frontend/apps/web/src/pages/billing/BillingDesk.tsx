import { useState, useMemo, useEffect } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────────
type BillStatus = 'DRAFT' | 'VALIDATED' | 'CONFIRMED' | 'CANCELLED';
type ServiceCode = 'HUID' | 'XRF' | 'FIRE_ASSAY' | 'SILVER_TITRATION' | 'HM_STANDARD' | 'HM_EXPRESS';

type ServiceLine = {
  id: string;
  serviceCode: ServiceCode;
  serviceName: string;
  qty: number;
  ratePerUnit: number;
  amount: number;
};

type Invoice = {
  id: string;
  invoiceNo: string;       // e.g. BLR-INV-20260501-001
  branchCode: string;
  customerId: string;
  customerName: string;
  linkedJobId: string;
  lines: ServiceLine[];
  status: BillStatus;
  totalAmount: number;
  advanceConsumed: number;
  createdAt: string;
  validatedAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
};

type CustomerRate = {
  id: string;
  customerId: string;
  serviceCode: ServiceCode;
  rate: number;
};

type Deposit = {
  id: string;
  customerId: string;
  branchCode: string;
  amount: number;
  remaining: number;
  createdAt: string;
};

type ExchangeRecord = {
  id: string;
  customerId: string;
  branchCode: string;
  goldGrams: number;
  purity: number;
  cashComponent: number;
  grand_total: number; // always 0 — exchange settles outside service billing
  createdAt: string;
};

type PaymentTender = 'cash' | 'bank_transfer' | 'cheque' | 'gold_physical';

type Payment = {
  id: string;
  customerId: string;
  branchCode: string;
  amount: number;
  tender: PaymentTender;
  goldGrams: number;
  purity: number;
  createdAt: string;
};

type GoldScrapLog = {
  id: string;
  linkedPaymentId: string;
  customerId: string;
  branchCode: string;
  goldGrams: number;
  purity: number;
  pureGold: number;
  createdAt: string;
};

type DiscountStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

type DiscountRecord = {
  id: string;
  customerId: string;
  branchCode: string;
  discountAmount: number;
  status: DiscountStatus;
  customerLedgerPosted: boolean;
  branchLedgerPosted: boolean;
  createdAt: string;
  approvedAt?: string;
};

type ScrapReport = {
  expectedPureGold: number;
  actualPureGold: number;
  variance: number;
  wtAvgPurityExpected: number;
  wtAvgPurityActual: number;
  generatedAt: string;
};

type AdminBranchRef = {
  id: string;
  code: string;
  name: string;
};

type AdminCustomerRef = {
  id: string;
  name: string;
};

// ── Storage keys ─────────────────────────────────────────────────────────────
const INVOICES_KEY    = 'nexus.react.billing.invoices.v1';
const CUST_RATES_KEY  = 'nexus.react.billing.customerRates.v1';
const DEPOSITS_KEY    = 'nexus.react.billing.deposits.v1';
const TESTING_KEY     = 'nexus.react.testing.jobs.v1';
const EXCHANGE_KEY    = 'nexus.react.billing.exchange.v1';
const PAYMENTS_KEY    = 'nexus.react.billing.payments.v1';
const SCRAP_LOG_KEY   = 'nexus.react.billing.scrapLog.v1';
const DISCOUNTS_KEY   = 'nexus.react.billing.discounts.v1';
const BILL_BASE = '/api/billing/api/v1/billing';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function mapBackendInvoice(b: any): Invoice {
  let r: any = {};
  try { r = JSON.parse(b.remarks || '{}'); } catch {}
  const statusMap: Record<string, BillStatus> = { DRAFT: 'DRAFT', ISSUED: 'VALIDATED', PARTIALLY_PAID: 'VALIDATED', PAID: 'CONFIRMED', CANCELLED: 'CANCELLED' };
  return {
    id: b.id, invoiceNo: b.invoiceNumber || b.id, branchCode: r.bc || 'BLR',
    customerId: r.cid || '', customerName: r.cnm || '', linkedJobId: r.ljid || '',
    lines: r.lines || [], status: statusMap[b.status] || 'DRAFT',
    totalAmount: Number(b.grandTotal) || 0, advanceConsumed: 0,
    createdAt: b.createdAt || new Date().toISOString(),
    validatedAt: b.issuedDate, confirmedAt: b.paidDate,
  };
}

// ── Service catalogue ─────────────────────────────────────────────────────────
const DEFAULT_RATES: Record<ServiceCode, number> = {
  HUID: 100, XRF: 250, FIRE_ASSAY: 400,
  SILVER_TITRATION: 350, HM_STANDARD: 150, HM_EXPRESS: 300,
};
const SERVICE_NAMES: Record<ServiceCode, string> = {
  HUID: 'HUID Marking', XRF: 'XRF Testing', FIRE_ASSAY: 'Fire Assay Testing',
  SILVER_TITRATION: 'Silver Titration', HM_STANDARD: 'HM Standard', HM_EXPRESS: 'HM Express',
};
const SERVICE_CODES: ServiceCode[] = ['HUID', 'XRF', 'FIRE_ASSAY', 'SILVER_TITRATION', 'HM_STANDARD', 'HM_EXPRESS'];

const BRANCHES = [
  { code: 'MUM', name: 'Mumbai' },
  { code: 'BLR', name: 'Bengaluru' },
  { code: 'DEL', name: 'Delhi' },
];

const STATUS_LABELS: Record<BillStatus, string> = {
  DRAFT: 'Draft', VALIDATED: 'Validated', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function nextInvoiceNo(invoices: Invoice[], branchCode: string): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${branchCode}-INV-${ymd}-`;
  const max = invoices
    .filter((i) => i.invoiceNo.startsWith(prefix))
    .reduce((m, i) => Math.max(m, Number(i.invoiceNo.split('-').pop() ?? '0')), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function resolveRate(
  code: ServiceCode,
  customerId: string,
  customerRates: CustomerRate[],
): { rate: number; isCustomer: boolean } {
  const cr = customerRates.find((r) => r.customerId === customerId && r.serviceCode === code);
  return cr ? { rate: cr.rate, isCustomer: true } : { rate: DEFAULT_RATES[code], isCustomer: false };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BillingDesk() {
  const [invoices, setInvoices]         = useState<Invoice[]>(() => read<Invoice[]>(INVOICES_KEY, []));
  const [branchRefs, setBranchRefs]     = useState<AdminBranchRef[]>([]);
  const [customerRefs, setCustomerRefs] = useState<AdminCustomerRef[]>([]);

  // Load invoices from backend on mount, merge with localStorage
  useEffect(() => {
    api<any[]>(`${BILL_BASE}/invoices`)
      .then(data => {
        const beInvoices = data.map(mapBackendInvoice);
        setInvoices(prev => {
          const beIds = new Set(beInvoices.map(i => i.id));
          const localOnly = prev.filter(i => !beIds.has(i.id));
          const merged = [...beInvoices, ...localOnly];
          persist(INVOICES_KEY, merged);
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<Deposit[]>(`${BILL_BASE}/deposits`).then(setDeposits).catch(() => {});
    api<ExchangeRecord[]>(`${BILL_BASE}/exchange-records`).then(setExchanges).catch(() => {});
    api<Payment[]>(`${BILL_BASE}/payments-register`).then(setPayments).catch(() => {});
    api<GoldScrapLog[]>(`${BILL_BASE}/scrap-log`).then(setScrapLog).catch(() => {});
    api<DiscountRecord[]>(`${BILL_BASE}/discounts`).then(setDiscounts).catch(() => {});
  }, []);

  useEffect(() => {
    api<any[]>('/api/admin/api/v1/admin/branches')
      .then((rows) => {
        const refs = rows.map((b: any) => ({
          id: b.id,
          code: String(b.code || b.name || 'BR').toUpperCase(),
          name: b.name || b.code || 'Branch',
        }));
        setBranchRefs(refs);
      })
      .catch(() => {});
    api<any[]>('/api/admin/api/v1/admin/customers')
      .then((rows) => setCustomerRefs(rows.map((c: any) => ({ id: c.id, name: c.name || '' }))))
      .catch(() => {});
  }, []);
  const [customerRates, setCustomerRates] = useState<CustomerRate[]>(() => read<CustomerRate[]>(CUST_RATES_KEY, []));
  const [deposits, setDeposits]         = useState<Deposit[]>(() => read<Deposit[]>(DEPOSITS_KEY, []));
  const [exchanges, setExchanges]       = useState<ExchangeRecord[]>(() => read<ExchangeRecord[]>(EXCHANGE_KEY, []));
  const [payments, setPayments]         = useState<Payment[]>(() => read<Payment[]>(PAYMENTS_KEY, []));
  const [scrapLog, setScrapLog]         = useState<GoldScrapLog[]>(() => read<GoldScrapLog[]>(SCRAP_LOG_KEY, []));
  const [discounts, setDiscounts]       = useState<DiscountRecord[]>(() => read<DiscountRecord[]>(DISCOUNTS_KEY, []));
  const [scrapReport, setScrapReport]   = useState<ScrapReport | null>(null);

  useEffect(() => { persist(INVOICES_KEY, invoices); },    [invoices]);
  useEffect(() => { persist(CUST_RATES_KEY, customerRates); }, [customerRates]);
  useEffect(() => { persist(DEPOSITS_KEY, deposits); },   [deposits]);
  useEffect(() => { persist(EXCHANGE_KEY, exchanges); },  [exchanges]);
  useEffect(() => { persist(PAYMENTS_KEY, payments); },   [payments]);
  useEffect(() => { persist(SCRAP_LOG_KEY, scrapLog); },  [scrapLog]);
  useEffect(() => { persist(DISCOUNTS_KEY, discounts); }, [discounts]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formBranch, setFormBranch]           = useState('BLR');
  const [formCustomerId, setFormCustomerId]   = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formLinkedJob, setFormLinkedJob]     = useState('');
  const [formSvcCode, setFormSvcCode]         = useState<ServiceCode>('HUID');
  const [formSvcQty, setFormSvcQty]           = useState('1');
  const [formLines, setFormLines]             = useState<ServiceLine[]>([]);

  const [activeTab, setActiveTab] = useState<'invoices' | 'rates' | 'deposits' | 'exchange' | 'payments' | 'discounts' | 'scrap'>('invoices');

  // ── Rate form ───────────────────────────────────────────────────────────────
  const [rCustId, setRCustId]     = useState('');
  const [rSvcCode, setRSvcCode]   = useState<ServiceCode>('HUID');
  const [rValue, setRValue]       = useState('');

  // ── Deposit form ────────────────────────────────────────────────────────────
  const [dCustId, setDCustId]     = useState('');
  const [dBranch, setDBranch]     = useState('BLR');
  const [dAmount, setDAmount]     = useState('');

  // Exchange form state
  const [exCustId, setExCustId]         = useState('');
  const [exBranch, setExBranch]         = useState('BLR');
  const [exGoldGrams, setExGoldGrams]   = useState('');
  const [exPurity, setExPurity]         = useState('91.6');
  const [exCash, setExCash]             = useState('0');

  // Payment form state
  const [pyCustomer, setPyCustomer]     = useState('');
  const [pyBranch, setPyBranch]         = useState('BLR');
  const [pyAmount, setPyAmount]         = useState('');
  const [pyTender, setPyTender]         = useState<PaymentTender>('cash');
  const [pyGoldGrams, setPyGoldGrams]   = useState('');
  const [pyPurity, setPyPurity]         = useState('91.6');

  // Discount form state
  const [dcCustomer, setDcCustomer]     = useState('');
  const [dcBranch, setDcBranch]         = useState('BLR');
  const [dcAmount, setDcAmount]         = useState('');

  const branchOptions = useMemo(
    () => (branchRefs.length > 0
      ? branchRefs.map((b) => ({ code: b.code, name: b.name, id: b.id }))
      : BRANCHES.map((b) => ({ ...b, id: NIL_UUID }))),
    [branchRefs],
  );

  // ── Testing jobs in BILLING_STAGE ──────────────────────────────────────────
  const billingJobs = useMemo(() => {
    const all = read<any[]>(TESTING_KEY, []);
    return all.filter((j) => j.status === 'BILLING_STAGE');
  }, []); // intentionally static read; refresh on page reload

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     invoices.length,
    draft:     invoices.filter((i) => i.status === 'DRAFT').length,
    validated: invoices.filter((i) => i.status === 'VALIDATED').length,
    confirmed: invoices.filter((i) => i.status === 'CONFIRMED').length,
    cancelled: invoices.filter((i) => i.status === 'CANCELLED').length,
    revenue:   invoices.filter((i) => i.status === 'CONFIRMED').reduce((s, i) => s + i.totalAmount, 0),
  }), [invoices]);

  // ── Rate preview ────────────────────────────────────────────────────────────
  const previewRate = useMemo(
    () => resolveRate(formSvcCode, formCustomerId.trim(), customerRates),
    [formSvcCode, formCustomerId, customerRates],
  );

  // ── Add service line to form ─────────────────────────────────────────────────
  function addFormLine() {
    const qty = Number(formSvcQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.err('Quantity must be a positive number'); return; }
    const { rate, isCustomer } = resolveRate(formSvcCode, formCustomerId.trim(), customerRates);
    const line: ServiceLine = {
      id: uuid(),
      serviceCode: formSvcCode,
      serviceName: SERVICE_NAMES[formSvcCode],
      qty,
      ratePerUnit: rate,
      amount: qty * rate,
    };
    setFormLines((prev) => [...prev, line]);
    toast.ok(`${SERVICE_NAMES[formSvcCode]} added (${isCustomer ? 'customer' : 'default'} rate ₹${rate})`);
  }

  // ── Create invoice ───────────────────────────────────────────────────────────
  async function createInvoice() {
    if (!formCustomerId.trim() || !formCustomerName.trim()) {
      toast.err('Customer ID and Customer Name are required');
      return;
    }
    if (!isUuid(formCustomerId)) {
      toast.err('Select a valid customer from Admin master list');
      return;
    }
    if (formLines.length === 0) {
      toast.err('At least one billable service line is required');
      return;
    }
    const branchId = branchOptions.find((b) => b.code === formBranch)?.id ?? NIL_UUID;
    try {
      const invoiceNo = nextInvoiceNo(invoices, formBranch);
      const remarks = JSON.stringify({
        bc: formBranch,
        cid: formCustomerId.trim(),
        cnm: formCustomerName.trim(),
        ljid: formLinkedJob,
        lines: formLines,
      });
      const created = await api<any>(`${BILL_BASE}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invoiceNo,
          branchId,
          customerId: formCustomerId.trim(),
          remarks,
          type: 'SALE',
        }),
      });
      await Promise.all(
        formLines.map((l, idx) =>
          api(`${BILL_BASE}/lines`, {
            method: 'POST',
            body: JSON.stringify({
              invoiceId: created.id,
              lineNo: idx + 1,
              itemDesc: l.serviceName,
              grossWeight: l.qty,
              ratePerGram: l.ratePerUnit,
              makingCharges: 0,
              discount: 0,
              taxRatePct: 0,
            }),
          }),
        ),
      );
      const fresh = await api<any>(`${BILL_BASE}/invoices/${created.id}`);
      const inv = mapBackendInvoice({ ...fresh, remarks });
      setInvoices((prev) => [...prev, inv]);
      setFormLines([]);
      setFormLinkedJob('');
      toast.ok(`Invoice ${inv.invoiceNo} created (Draft)`);
    } catch (e: any) {
      toast.err(e?.message || 'Failed to create invoice in backend');
    }
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  async function validateInvoice(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    if (inv.status !== 'DRAFT') { toast.err('Only Draft invoices can be Validated'); return; }
    if (inv.lines.length === 0) { toast.err('No billable service quantity — validation blocked'); return; }
    if (!isUuid(id)) { toast.err('Invoice is not synced to backend yet'); return; }
    try {
      await api(`${BILL_BASE}/invoices/${id}/status?status=ISSUED`, { method: 'PATCH' });
    } catch (e: any) {
      toast.err(e?.message || 'Failed to validate invoice');
      return;
    }
    setInvoices((prev) => prev.map((i) => i.id === id
      ? { ...i, status: 'VALIDATED', validatedAt: new Date().toISOString() }
      : i));
    toast.ok(`Invoice ${inv.invoiceNo} → Validated`);
  }

  // ── Confirm with FIFO deposit consumption + testing job linkage ──────────────
  async function confirmInvoice(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    if (inv.status !== 'VALIDATED') { toast.err('Only Validated invoices can be Confirmed'); return; }
    if (!isUuid(id)) { toast.err('Invoice is not synced to backend yet'); return; }

    // FIFO deposit consumption (sorted by createdAt ascending)
    let toConsume = inv.totalAmount;
    let consumed = 0;
    const sorted = [...deposits].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const updatedDeposits = deposits.map((dep) => {
      const inSorted = sorted.find((s) => s.id === dep.id);
      if (!inSorted) return dep;
      if (dep.customerId === inv.customerId && dep.branchCode === inv.branchCode && toConsume > 0 && dep.remaining > 0) {
        const use = Math.min(dep.remaining, toConsume);
        toConsume -= use;
        consumed += use;
        return { ...dep, remaining: dep.remaining - use };
      }
      return dep;
    });
    setDeposits(updatedDeposits);
    persist(DEPOSITS_KEY, updatedDeposits);

    const updated = invoices.map((i) => i.id === id
      ? { ...i, status: 'CONFIRMED' as BillStatus, confirmedAt: new Date().toISOString(), advanceConsumed: consumed }
      : i);
    setInvoices(updated);
    persist(INVOICES_KEY, updated);
    // Backend sync: mark final stage + capture consumed advance as adjustment payment.
    const backendStatus = consumed >= inv.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
    try {
      await api(`${BILL_BASE}/invoices/${id}/status?status=${backendStatus}`, { method: 'PATCH' });
      if (consumed > 0) {
        await api(`${BILL_BASE}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: id,
            paymentDate: new Date().toISOString().slice(0, 10),
            amount: consumed,
            method: 'ADJUSTMENT',
            referenceNo: 'ADVANCE',
            remarks: 'Advance deposit consumed',
          }),
        });
      }
    } catch (e: any) {
      toast.err(e?.message || 'Failed to sync confirmed invoice');
    }

    // Linked testing job → DONE
    if (inv.linkedJobId) {
      const jobs = read<any[]>(TESTING_KEY, []);
      const updJobs = jobs.map((j) =>
        j.id === inv.linkedJobId && j.status === 'BILLING_STAGE'
          ? { ...j, status: 'DONE', closedAt: new Date().toISOString() }
          : j,
      );
      persist(TESTING_KEY, updJobs);
      toast.ok(`Testing job ${inv.linkedJobId} moved to Done`);
    }
    toast.ok(`Invoice ${inv.invoiceNo} Confirmed. Advance consumed: ₹${consumed}`);
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────
  async function cancelInvoice(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    if (inv.status === 'CONFIRMED') { toast.err('Confirmed invoices cannot be cancelled'); return; }
    if (!isUuid(id)) { toast.err('Invoice is not synced to backend yet'); return; }
    try {
      await api(`${BILL_BASE}/invoices/${id}/status?status=CANCELLED`, { method: 'PATCH' });
    } catch (e: any) {
      toast.err(e?.message || 'Failed to cancel invoice');
      return;
    }
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : i));
    toast.warn(`Invoice ${inv.invoiceNo} Cancelled`);
  }

  // ── Save customer rate ───────────────────────────────────────────────────────
  function saveCustomerRate() {
    if (!rCustId.trim()) { toast.err('Customer ID required'); return; }
    const v = Number(rValue);
    if (!Number.isFinite(v) || v <= 0) { toast.err('Rate must be a positive number'); return; }
    setCustomerRates((prev) => {
      const idx = prev.findIndex((r) => r.customerId === rCustId.trim() && r.serviceCode === rSvcCode);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], rate: v };
        return copy;
      }
      return [...prev, { id: uuid(), customerId: rCustId.trim(), serviceCode: rSvcCode, rate: v }];
    });
    toast.ok(`Customer rate set: ${rCustId} / ${rSvcCode} = ₹${v}`);
    setRValue('');
  }

  // ── Exchange record ──────────────────────────────────────────────────────────
  async function createExchange() {
    if (!exCustId.trim()) { toast.err('Customer ID required'); return; }
    const grams = Number(exGoldGrams);
    if (!Number.isFinite(grams) || grams <= 0) { toast.err('Gold grams must be positive'); return; }
    const purity = Number(exPurity);
    if (!Number.isFinite(purity) || purity <= 0 || purity > 100) { toast.err('Purity must be 0–100'); return; }
    const cash = Number(exCash) || 0;
    try {
      const rec = await api<ExchangeRecord>(`${BILL_BASE}/exchange-records`, {
        method: 'POST',
        body: JSON.stringify({ customerId: exCustId.trim(), branchCode: exBranch, goldGrams: grams, purity, cashComponent: cash }),
      });
      setExchanges((prev) => [rec, ...prev]);
      toast.ok('Exchange record created — grand_total always ₹0');
      setExGoldGrams(''); setExCash('0');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to create exchange record');
    }
  }

  // ── Submit payment (gold_physical → auto scrap log) ──────────────────────────
  async function submitPayment() {
    if (!pyCustomer.trim()) { toast.err('Customer ID required'); return; }
    const amt = Number(pyAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.err('Amount must be positive'); return; }
    const grams = Number(pyGoldGrams) || 0;
    const pur = Number(pyPurity) || 0;
    try {
      const pay = await api<Payment>(`${BILL_BASE}/payments-register`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: pyCustomer.trim(),
          branchCode: pyBranch,
          amount: amt,
          tender: pyTender,
          goldGrams: grams,
          purity: pur,
        }),
      });
      setPayments((prev) => [pay, ...prev]);
      if (pyTender === 'gold_physical' && grams > 0 && pur > 0) {
        api<GoldScrapLog[]>(`${BILL_BASE}/scrap-log`).then(setScrapLog).catch(() => {});
        toast.ok(`Payment recorded. Gold scrap log entry created (${grams}g @ ${pur}%)`);
      } else {
        toast.ok(`Payment ₹${amt} recorded (${pyTender})`);
      }
      setPyAmount(''); setPyGoldGrams('');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to submit payment');
    }
  }

  // ── Discount workflow ─────────────────────────────────────────────────────────
  async function createDiscount() {
    if (!dcCustomer.trim()) { toast.err('Customer ID required'); return; }
    const amt = Number(dcAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.err('Discount amount must be positive'); return; }
    try {
      const rec = await api<DiscountRecord>(`${BILL_BASE}/discounts`, {
        method: 'POST',
        body: JSON.stringify({ customerId: dcCustomer.trim(), branchCode: dcBranch, discountAmount: amt }),
      });
      setDiscounts((prev) => [rec, ...prev]);
      toast.ok('Discount record created (Draft)');
      setDcAmount('');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to create discount');
    }
  }
  async function submitDiscount(id: string) {
    try {
      const rec = await api<DiscountRecord>(`${BILL_BASE}/discounts/${id}/submit`, { method: 'PATCH' });
      setDiscounts((prev) => prev.map((d) => (d.id === id ? rec : d)));
      toast.ok('Discount submitted for approval');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to submit discount');
    }
  }
  async function approveDiscount(id: string) {
    try {
      const rec = await api<DiscountRecord>(`${BILL_BASE}/discounts/${id}/approve`, { method: 'PATCH' });
      setDiscounts((prev) => prev.map((d) => (d.id === id ? rec : d)));
      toast.ok('Discount approved — posted to customer and branch ledgers');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to approve discount');
    }
  }

  // ── Scrap reconciliation report ───────────────────────────────────────────────
  async function generateScrapReport() {
    try {
      const report = await api<ScrapReport>(`${BILL_BASE}/scrap-report`);
      setScrapReport(report);
      toast.ok('Scrap reconciliation report generated');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to generate scrap report');
    }
  }

  // ── Add deposit ──────────────────────────────────────────────────────────────
  async function addDeposit() {
    if (!dCustId.trim()) { toast.err('Customer ID required'); return; }
    const amt = Number(dAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.err('Amount must be positive'); return; }
    try {
      const dep = await api<Deposit>(`${BILL_BASE}/deposits`, {
        method: 'POST',
        body: JSON.stringify({ customerId: dCustId.trim(), branchCode: dBranch, amount: amt }),
      });
      setDeposits((prev) => [dep, ...prev]);
      toast.ok(`Deposit ₹${amt} added for ${dep.customerId}`);
      setDAmount('');
    } catch (e: any) {
      toast.err(e?.message || 'Failed to add deposit');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Billing Desk" subtitle="Invoices · Service rates · Advance deposits · Workflow" />

      <div className="grid grid-cols-6 gap-2 mb-5">
        <Stat label="Total"       value={stats.total}     accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Draft"       value={stats.draft}     accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Validated"   value={stats.validated} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Confirmed"   value={stats.confirmed} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Cancelled"   value={stats.cancelled} accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Revenue ₹"  value={stats.revenue}   accent="bg-gradient-to-br from-amber-500 to-orange-500" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        {(['invoices', 'rates', 'deposits', 'exchange', 'payments', 'discounts', 'scrap'] as const).map((t) => (
          <button
            key={t}
            id={`blTab-${t}`}
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

      {/* ── INVOICES TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Create Invoice card */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create Invoice</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Branch</label>
                <select id="blBranch" className="input" value={formBranch} onChange={(e) => setFormBranch(e.target.value)}>
                  {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Customer*</label>
                {customerRefs.length > 0 ? (
                  <select
                    id="blCustomerId"
                    className="input"
                    value={formCustomerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const c = customerRefs.find((x) => x.id === id);
                      setFormCustomerId(id);
                      setFormCustomerName(c?.name || '');
                    }}
                  >
                    <option value="">— select —</option>
                    {customerRefs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <input id="blCustomerId" className="input" value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} placeholder="Customer UUID" />
                )}
              </div>
              <div>
                <label className="label">Customer Name</label>
                <input id="blCustomerName" className="input" value={formCustomerName} onChange={(e) => setFormCustomerName(e.target.value)} placeholder="Acme Jewellers" readOnly={customerRefs.length > 0} />
              </div>
              <div>
                <label className="label">Linked Testing Job</label>
                <select id="blLinkedJob" className="input" value={formLinkedJob} onChange={(e) => setFormLinkedJob(e.target.value)}>
                  <option value="">— None —</option>
                  {billingJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.orderId || j.id} — {j.customerName}</option>
                  ))}
                </select>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-nexus-muted mb-2">Add Service Line</h4>
            <div className="grid md:grid-cols-4 gap-3 mb-2">
              <div>
                <label className="label">Service</label>
                <select id="blServiceCode" className="input" value={formSvcCode} onChange={(e) => setFormSvcCode(e.target.value as ServiceCode)}>
                  {SERVICE_CODES.map((c) => <option key={c} value={c}>{SERVICE_NAMES[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Qty</label>
                <input id="blServiceQty" className="input" type="number" min={1} value={formSvcQty} onChange={(e) => setFormSvcQty(e.target.value)} />
              </div>
              <div>
                <label className="label">Rate (auto-resolved)</label>
                <div id="blRatePreview" className="input bg-nexus-panel2 cursor-default flex items-center gap-1 text-sm">
                  ₹{previewRate.rate}
                  {previewRate.isCustomer
                    ? <span className="text-emerald-400 text-xs ml-1">customer rate</span>
                    : <span className="text-nexus-muted text-xs ml-1">default rate</span>}
                </div>
              </div>
              <div className="flex items-end">
                <button id="blAddLine" className="btn-primary w-full" onClick={addFormLine}>+ Add Line</button>
              </div>
            </div>

            {formLines.length > 0 && (
              <div className="table-wrap mb-3">
                <table className="tbl">
                  <thead>
                    <tr><th>Service</th><th>Qty</th><th>Rate ₹</th><th>Amount ₹</th><th></th></tr>
                  </thead>
                  <tbody>
                    {formLines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.serviceName}</td>
                        <td>{l.qty}</td>
                        <td>{l.ratePerUnit}</td>
                        <td>{l.amount}</td>
                        <td><button className="btn text-xs" onClick={() => setFormLines((p) => p.filter((x) => x.id !== l.id))}>Remove</button></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="text-right font-semibold text-xs">Total</td>
                      <td id="blFormTotal" className="font-semibold">₹{formLines.reduce((s, l) => s + l.amount, 0)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <button id="blCreateInvoice" className="btn-primary" onClick={createInvoice}>Create Invoice</button>
          </div>

          {/* Invoice register */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Invoice Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Branch</th><th>Customer</th>
                    <th>Lines</th><th>Total ₹</th><th>Advance ₹</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-nexus-muted">No invoices yet</td></tr>
                  )}
                  {invoices.map((inv) => {
                    const locked = inv.status === 'CONFIRMED' || inv.status === 'CANCELLED';
                    return (
                      <tr key={inv.id}>
                        <td id={`blInvoiceNo-${inv.id}`} className="font-mono text-xs whitespace-nowrap">{inv.invoiceNo}</td>
                        <td>{inv.branchCode}</td>
                        <td>{inv.customerName}</td>
                        <td>{inv.lines.length}</td>
                        <td>₹{inv.totalAmount}</td>
                        <td id={`blAdvance-${inv.id}`}>{inv.advanceConsumed > 0 ? `₹${inv.advanceConsumed}` : '—'}</td>
                        <td>
                          <span
                            id={`blStatus-${inv.id}`}
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                              inv.status === 'CONFIRMED'  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : inv.status === 'VALIDATED' ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                              : inv.status === 'CANCELLED' ? 'border-red-500/40 bg-red-500/15 text-red-300'
                              : 'border-nexus-line text-nexus-muted'
                            }`}
                          >
                            {STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td className="space-x-1 whitespace-nowrap">
                          {inv.status === 'DRAFT' && (
                            <button id={`blValidate-${inv.id}`} className="btn text-xs" onClick={() => validateInvoice(inv.id)}>Validate</button>
                          )}
                          {inv.status === 'VALIDATED' && (
                            <button id={`blConfirm-${inv.id}`} className="btn-primary text-xs" onClick={() => confirmInvoice(inv.id)}>Confirm</button>
                          )}
                          {!locked && (
                            <button id={`blCancel-${inv.id}`} className="btn text-xs" onClick={() => cancelInvoice(inv.id)}>Cancel</button>
                          )}
                          {inv.status === 'CONFIRMED' && (
                            <span id={`blLocked-${inv.id}`} className="text-amber-400 text-xs">🔒 Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmed invoice detail — locked fields */}
          {invoices.filter((i) => i.status === 'CONFIRMED').map((inv) => (
            <div key={inv.id} id={`blInvoiceDetail-${inv.id}`} className="card p-4">
              <h4 className="text-sm font-semibold mb-1">
                Invoice Detail — {inv.invoiceNo}
                <span id={`blAmountLocked-${inv.id}`} className="ml-2 text-amber-400 text-xs">
                  🔒 All amounts locked after confirmation
                </span>
              </h4>
              <p className="text-xs text-nexus-muted mb-3">Customer: {inv.customerName} · Branch: {inv.branchCode}</p>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Service</th><th>Qty (locked)</th><th>Rate ₹ (locked)</th><th>Amount ₹</th></tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.serviceName}</td>
                        <td>
                          <input
                            id={`blLineQty-${l.id}`}
                            className="input text-xs w-20 opacity-60 cursor-not-allowed"
                            type="number"
                            value={l.qty}
                            readOnly
                            disabled
                          />
                        </td>
                        <td>
                          <input
                            id={`blLineRate-${l.id}`}
                            className="input text-xs w-24 opacity-60 cursor-not-allowed"
                            type="number"
                            value={l.ratePerUnit}
                            readOnly
                            disabled
                          />
                        </td>
                        <td id={`blLineAmount-${l.id}`}>₹{l.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RATES TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Default Service Rates</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Service</th><th>Default Rate ₹</th></tr></thead>
                <tbody>
                  {SERVICE_CODES.map((c) => (
                    <tr key={c}>
                      <td>{SERVICE_NAMES[c]}</td>
                      <td id={`blDefaultRate-${c}`}>₹{DEFAULT_RATES[c]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Customer-Specific Rate Override</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Customer ID</label>
                <input id="blSetCustRateCustomer" className="input" value={rCustId} onChange={(e) => setRCustId(e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label className="label">Service</label>
                <select id="blSetCustRateService" className="input" value={rSvcCode} onChange={(e) => setRSvcCode(e.target.value as ServiceCode)}>
                  {SERVICE_CODES.map((c) => <option key={c} value={c}>{SERVICE_NAMES[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Rate ₹</label>
                <input id="blSetCustRateValue" className="input" type="number" value={rValue} onChange={(e) => setRValue(e.target.value)} placeholder="200" />
              </div>
              <div className="flex items-end">
                <button id="blSaveCustRate" className="btn-primary w-full" onClick={saveCustomerRate}>Save Rate</button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Customer ID</th><th>Service</th><th>Rate ₹</th></tr></thead>
                <tbody>
                  {customerRates.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-nexus-muted">No custom rates set</td></tr>
                  )}
                  {customerRates.map((r) => (
                    <tr key={r.id} id={`blCustRate-${r.customerId}-${r.serviceCode}`}>
                      <td>{r.customerId}</td>
                      <td>{SERVICE_NAMES[r.serviceCode]}</td>
                      <td id={`blCustRateValue-${r.customerId}-${r.serviceCode}`}>₹{r.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPOSITS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Add Advance Deposit</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Customer ID</label>
                <input id="blDepositCustomer" className="input" value={dCustId} onChange={(e) => setDCustId(e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label className="label">Branch</label>
                <select id="blDepositBranch" className="input" value={dBranch} onChange={(e) => setDBranch(e.target.value)}>
                  {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount ₹</label>
                <input id="blDepositAmount" className="input" type="number" value={dAmount} onChange={(e) => setDAmount(e.target.value)} placeholder="5000" />
              </div>
              <div className="flex items-end">
                <button id="blAddDeposit" className="btn-primary w-full" onClick={addDeposit}>Add Deposit</button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Customer ID</th><th>Branch</th><th>Deposited ₹</th><th>Remaining ₹</th><th>Date</th></tr></thead>
                <tbody>
                  {deposits.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-nexus-muted">No deposits yet</td></tr>
                  )}
                  {deposits.map((d) => (
                    <tr key={d.id} id={`blDeposit-${d.id}`}>
                      <td>{d.customerId}</td>
                      <td>{d.branchCode}</td>
                      <td>₹{d.amount}</td>
                      <td id={`blDepRemaining-${d.id}`}>₹{d.remaining}</td>
                      <td className="text-xs text-nexus-muted">{new Date(d.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EXCHANGE TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'exchange' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-1">Create Exchange Record</h3>
            <p className="text-xs text-nexus-muted mb-3">Gold/cash exchange settles outside service billing — grand_total is always ₹0.</p>
            <div className="grid md:grid-cols-5 gap-3 mb-3">
              <div>
                <label className="label">Customer ID</label>
                <input id="blExchCustomer" className="input" value={exCustId} onChange={(e) => setExCustId(e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label className="label">Branch</label>
                <select id="blExchBranch" className="input" value={exBranch} onChange={(e) => setExBranch(e.target.value)}>
                  {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Gold (g)</label>
                <input id="blExchGoldGrams" className="input" type="number" value={exGoldGrams} onChange={(e) => setExGoldGrams(e.target.value)} placeholder="10.00" />
              </div>
              <div>
                <label className="label">Purity (%)</label>
                <input id="blExchPurity" className="input" type="number" value={exPurity} onChange={(e) => setExPurity(e.target.value)} placeholder="91.6" />
              </div>
              <div>
                <label className="label">Cash Component ₹</label>
                <input id="blExchCash" className="input" type="number" value={exCash} onChange={(e) => setExCash(e.target.value)} placeholder="0" />
              </div>
            </div>
            <button id="blCreateExchange" className="btn-primary" onClick={createExchange}>Create Exchange Record</button>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Exchange Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Customer</th><th>Branch</th><th>Gold (g)</th><th>Purity %</th><th>Cash ₹</th><th>Grand Total ₹</th><th>Date</th></tr></thead>
                <tbody>
                  {exchanges.length === 0 && <tr><td colSpan={7} className="text-center text-nexus-muted">No exchange records</td></tr>}
                  {exchanges.map((ex) => (
                    <tr key={ex.id} id={`blExchange-${ex.id}`}>
                      <td>{ex.customerId}</td>
                      <td>{ex.branchCode}</td>
                      <td>{ex.goldGrams}</td>
                      <td>{ex.purity}</td>
                      <td>₹{ex.cashComponent}</td>
                      <td id={`blExchGrandTotal-${ex.id}`} className="font-semibold text-emerald-400">₹{ex.grand_total}</td>
                      <td className="text-xs text-nexus-muted">{new Date(ex.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Register Payment</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Customer ID</label>
                <input id="blPayCustomer" className="input" value={pyCustomer} onChange={(e) => setPyCustomer(e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label className="label">Branch</label>
                <select id="blPayBranch" className="input" value={pyBranch} onChange={(e) => setPyBranch(e.target.value)}>
                  {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount ₹</label>
                <input id="blPayAmount" className="input" type="number" value={pyAmount} onChange={(e) => setPyAmount(e.target.value)} placeholder="5000" />
              </div>
              <div>
                <label className="label">Tender</label>
                <select id="blPayTender" className="input" value={pyTender} onChange={(e) => setPyTender(e.target.value as PaymentTender)}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="gold_physical">Gold (Physical)</option>
                </select>
              </div>
            </div>
            {pyTender === 'gold_physical' && (
              <div className="grid md:grid-cols-2 gap-3 mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div>
                  <label className="label">Gold Weight (g)</label>
                  <input id="blPayGoldGrams" className="input" type="number" value={pyGoldGrams} onChange={(e) => setPyGoldGrams(e.target.value)} placeholder="10.00" />
                </div>
                <div>
                  <label className="label">Purity (%)</label>
                  <input id="blPayPurity" className="input" type="number" value={pyPurity} onChange={(e) => setPyPurity(e.target.value)} placeholder="91.6" />
                </div>
              </div>
            )}
            <button id="blSubmitPayment" className="btn-primary" onClick={submitPayment}>Submit Payment</button>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Payment Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Customer</th><th>Branch</th><th>Amount ₹</th><th>Tender</th><th>Gold (g)</th><th>Purity %</th><th>Date</th></tr></thead>
                <tbody>
                  {payments.length === 0 && <tr><td colSpan={7} className="text-center text-nexus-muted">No payments</td></tr>}
                  {payments.map((p) => (
                    <tr key={p.id} id={`blPayment-${p.id}`}>
                      <td>{p.customerId}</td>
                      <td>{p.branchCode}</td>
                      <td>₹{p.amount}</td>
                      <td id={`blPayTenderVal-${p.id}`}>{p.tender}</td>
                      <td>{p.goldGrams > 0 ? p.goldGrams : '—'}</td>
                      <td>{p.purity > 0 ? p.purity + '%' : '—'}</td>
                      <td className="text-xs text-nexus-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {scrapLog.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Gold Scrap Log</h3>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Customer</th><th>Branch</th><th>Gold (g)</th><th>Purity %</th><th>Pure Gold (g)</th><th>Linked Payment</th><th>Date</th></tr></thead>
                  <tbody>
                    {scrapLog.map((s) => (
                      <tr key={s.id} id={`blScrapLog-${s.id}`}>
                        <td>{s.customerId}</td>
                        <td>{s.branchCode}</td>
                        <td>{s.goldGrams}</td>
                        <td>{s.purity}%</td>
                        <td id={`blScrapPureGold-${s.id}`}>{s.pureGold.toFixed(3)}</td>
                        <td className="font-mono text-xs">{s.linkedPaymentId.slice(0, 8)}…</td>
                        <td className="text-xs text-nexus-muted">{new Date(s.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DISCOUNTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create Discount</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Customer ID</label>
                <input id="blDiscCustomer" className="input" value={dcCustomer} onChange={(e) => setDcCustomer(e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label className="label">Branch</label>
                <select id="blDiscBranch" className="input" value={dcBranch} onChange={(e) => setDcBranch(e.target.value)}>
                  {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Discount Amount ₹</label>
                <input id="blDiscAmount" className="input" type="number" value={dcAmount} onChange={(e) => setDcAmount(e.target.value)} placeholder="500" />
              </div>
              <div className="flex items-end">
                <button id="blCreateDiscount" className="btn-primary w-full" onClick={createDiscount}>Create Discount</button>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Discount Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Customer</th><th>Branch</th><th>Amount ₹</th><th>Status</th><th>Cust Ledger</th><th>Branch Ledger</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {discounts.length === 0 && <tr><td colSpan={7} className="text-center text-nexus-muted">No discounts</td></tr>}
                  {discounts.map((d) => (
                    <tr key={d.id} id={`blDiscount-${d.id}`}>
                      <td>{d.customerId}</td>
                      <td>{d.branchCode}</td>
                      <td>₹{d.discountAmount}</td>
                      <td>
                        <span
                          id={`blDiscStatus-${d.id}`}
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                            d.status === 'APPROVED'         ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : d.status === 'PENDING_APPROVAL' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : d.status === 'REJECTED'       ? 'border-red-500/40 bg-red-500/15 text-red-300'
                            : 'border-nexus-line text-nexus-muted'
                          }`}
                        >{d.status}</span>
                      </td>
                      <td id={`blDiscCustLedger-${d.id}`}>{d.customerLedgerPosted ? '✅ Posted' : '—'}</td>
                      <td id={`blDiscBranchLedger-${d.id}`}>{d.branchLedgerPosted ? '✅ Posted' : '—'}</td>
                      <td className="space-x-1 whitespace-nowrap">
                        {d.status === 'DRAFT' && (
                          <button id={`blDiscSubmit-${d.id}`} className="btn text-xs" onClick={() => submitDiscount(d.id)}>Submit</button>
                        )}
                        {d.status === 'PENDING_APPROVAL' && (
                          <button id={`blDiscApprove-${d.id}`} className="btn-primary text-xs" onClick={() => approveDiscount(d.id)}>Approve</button>
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

      {/* ── SCRAP RECONCILIATION TAB ─────────────────────────────────────────── */}
      {activeTab === 'scrap' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-1">Scrap Reconciliation</h3>
            <p className="text-xs text-nexus-muted mb-3">
              Compares expected scrap (from exchange records) vs reported scrap (gold_physical payment log) for the current period.
            </p>
            <button id="blGenScrapReport" className="btn-primary" onClick={generateScrapReport}>Generate Monthly Scrap Validation</button>
          </div>
          {scrapReport && (
            <div className="card p-4" id="blScrapReportTable">
              <h3 className="text-sm font-semibold mb-3">Scrap Validation Report — {new Date(scrapReport.generatedAt).toLocaleDateString()}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-nexus-muted mb-2">Expected Scrap (Exchange Records)</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Expected Pure Gold</span>
                      <span id="blScrapExpected" className="font-mono">{scrapReport.expectedPureGold} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wt. Avg. Purity</span>
                      <span id="blScrapWtAvgPurityExp" className="font-mono">{scrapReport.wtAvgPurityExpected}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-nexus-muted mb-2">Actual Scrap (Gold Physical Payments)</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Actual Pure Gold</span>
                      <span id="blScrapActual" className="font-mono">{scrapReport.actualPureGold} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wt. Avg. Purity</span>
                      <span id="blScrapWtAvgPurityAct" className="font-mono">{scrapReport.wtAvgPurityActual}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 border border-nexus-line rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Pure Gold Variance</span>
                  <span
                    id="blScrapVariance"
                    className={`font-mono text-sm font-bold ${scrapReport.variance >= 0 ? 'text-amber-400' : 'text-red-400'}`}
                  >
                    {scrapReport.variance >= 0 ? '+' : ''}{scrapReport.variance} g
                  </span>
                </div>
                <p className="text-xs text-nexus-muted mt-1">
                  {scrapReport.variance === 0 ? 'No variance — records reconcile perfectly.'
                    : scrapReport.variance > 0 ? 'Positive variance: more expected than reported.'
                    : 'Negative variance: reported exceeds expected.'}
                </p>
              </div>
            </div>
          )}
          {!scrapReport && (
            <div className="card p-4 text-center text-nexus-muted text-sm">
              Click "Generate Monthly Scrap Validation" to view the reconciliation report.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
