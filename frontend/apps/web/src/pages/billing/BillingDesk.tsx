import { useState, useMemo, useEffect } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────────
type BillStatus = 'DRAFT' | 'VALIDATED' | 'CONFIRMED' | 'CANCELLED';
type ServiceCode = 'HUID' | 'XRF' | 'FIRE_ASSAY' | 'SILVER_TITRATION' | 'HM_STANDARD' | 'HM_EXPRESS';
type TxnType = 'HALLMARKING' | 'EXCHANGE' | 'PURITY_TESTING' | 'NON_HUID' | 'MISCELLANEOUS';

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
  invoiceNo: string;       // e.g. BLR1-HM-0001
  txnType: TxnType;
  branchCode: string;
  customerId: string;
  customerName: string;
  linkedJobId: string;
  linkedHmRequestNo: string;
  lines: ServiceLine[];
  status: BillStatus;
  subtotalAmount: number;
  cgstPct: number;
  sgstPct: number;
  cgstAmt: number;
  sgstAmt: number;
  totalAmount: number;     // grand total = subtotal + cgst + sgst
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
const HM_REQS_KEY     = 'nexus.react.hm.requests.v1';
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
  const subtotal = Number(r.sub) || Number(b.grandTotal) || 0;
  return {
    id: b.id, invoiceNo: b.invoiceNumber || b.id,
    txnType: TXN_TYPE_COMPAT[r.tt as string] ?? 'MISCELLANEOUS',
    branchCode: r.bc || 'BLR1',
    customerId: r.cid || '', customerName: r.cnm || '',
    linkedJobId: r.ljid || '', linkedHmRequestNo: r.lhmr || '',
    lines: r.lines || [], status: statusMap[b.status] || 'DRAFT',
    subtotalAmount: subtotal,
    cgstPct: Number(r.cgp) || 0, sgstPct: Number(r.sgp) || 0,
    cgstAmt: Number(r.cga) || 0, sgstAmt: Number(r.sga) || 0,
    totalAmount: Number(b.grandTotal) || 0, advanceConsumed: 0,
    createdAt: b.createdAt || new Date().toISOString(),
    validatedAt: b.issuedDate, confirmedAt: b.paidDate,
  };
}

// ── Service catalogue ─────────────────────────────────────────────────────────
const DEFAULT_RATES: Record<ServiceCode, number> = {
  HUID: 100, XRF: 250, FIRE_ASSAY: 400,
  SILVER_TITRATION: 350, HM_STANDARD: 350, HM_EXPRESS: 300,
};
const SERVICE_NAMES: Record<ServiceCode, string> = {
  HUID: 'HUID Marking', XRF: 'XRF Testing', FIRE_ASSAY: 'Fire Assay Testing',
  SILVER_TITRATION: 'Silver Titration', HM_STANDARD: 'HM Standard', HM_EXPRESS: 'HM Express',
};
const SERVICE_CODES: ServiceCode[] = ['HUID', 'XRF', 'FIRE_ASSAY', 'SILVER_TITRATION', 'HM_STANDARD', 'HM_EXPRESS'];

const BRANCHES = [
  { code: 'MUM', name: 'Mumbai' },
  { code: 'BLR1', name: 'Bengaluru' },
  { code: 'DEL', name: 'Delhi' },
];

const TXN_TYPE_ABBR: Record<TxnType, string> = {
  HALLMARKING: 'HM', EXCHANGE: 'EX', PURITY_TESTING: 'PT', NON_HUID: 'NH', MISCELLANEOUS: 'MISC',
};
const TXN_TYPE_LABELS: Record<TxnType, string> = {
  HALLMARKING: 'Hallmarking', EXCHANGE: 'Exchange', PURITY_TESTING: 'Purity Testing',
  NON_HUID: 'Non-HUID', MISCELLANEOUS: 'Miscellaneous',
};
const TXN_TYPES: TxnType[] = ['HALLMARKING', 'EXCHANGE', 'PURITY_TESTING', 'NON_HUID', 'MISCELLANEOUS'];
// backward-compat mapping from old stored values
const TXN_TYPE_COMPAT: Record<string, TxnType> = {
  HALLMARKING: 'HALLMARKING', XRF_TXN: 'PURITY_TESTING', FIRE_ASSAY_TXN: 'PURITY_TESTING',
  TESTING: 'PURITY_TESTING', GENERAL: 'MISCELLANEOUS',
  EXCHANGE: 'EXCHANGE', PURITY_TESTING: 'PURITY_TESTING', NON_HUID: 'NON_HUID', MISCELLANEOUS: 'MISCELLANEOUS',
};

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

function printInvoicePdf(inv: Invoice) {
  const fmt = (n: number) => `₹${n.toFixed(2)}`;
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const rows = inv.lines.map((l) => `
    <tr>
      <td>${l.serviceName}</td>
      <td style="text-align:center">${l.qty}</td>
      <td style="text-align:right">${fmt(l.ratePerUnit)}</td>
      <td style="text-align:right">${fmt(l.amount)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${inv.invoiceNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e0aa3e; padding-bottom: 16px; margin-bottom: 20px; }
    .company { font-size: 22px; font-weight: 700; color: #e0aa3e; letter-spacing: 1px; }
    .company-sub { font-size: 11px; color: #666; margin-top: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-meta .inv-no { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .invoice-meta .status { display: inline-block; background: #d4edda; color: #155724; border-radius: 4px; padding: 2px 10px; font-size: 11px; margin-top: 4px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
    .party-block h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .party-block p { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #1a1a2e; color: #e0aa3e; }
    thead th { padding: 8px 10px; font-size: 11px; text-align: left; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tbody td { padding: 7px 10px; }
    .totals { margin-left: auto; width: 260px; }
    .totals table { margin-bottom: 0; }
    .totals tbody td { padding: 4px 10px; font-size: 12px; }
    .totals .grand-total td { font-size: 14px; font-weight: 700; border-top: 2px solid #1a1a2e; background: #f8f4e8; }
    .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
    .watermark { text-align: center; margin-top: 12px; font-size: 11px; color: #bbb; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">NEXUS ERP</div>
      <div class="company-sub">Jewellery Processing &amp; Hallmarking Services</div>
      <div class="company-sub">Branch: ${inv.branchCode}</div>
    </div>
    <div class="invoice-meta">
      <div class="inv-no">${inv.invoiceNo}</div>
      <div style="font-size:11px; color:#666; margin-top:4px;">Date: ${fmtDate(inv.confirmedAt || inv.createdAt)}</div>
      <div class="status">${STATUS_LABELS[inv.status]}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-block">
      <h4>Bill To</h4>
      <p><strong>${inv.customerName}</strong></p>
      <p style="color:#666; font-size:11px;">Customer ID: ${inv.customerId}</p>
    </div>
    <div class="party-block">
      <h4>Invoice Details</h4>
      <p>Type: ${TXN_TYPE_LABELS[inv.txnType] ?? inv.txnType}</p>
      ${inv.linkedHmRequestNo ? `<p style="font-size:11px; color:#666;">HM Request: ${inv.linkedHmRequestNo}</p>` : ''}
      ${inv.linkedJobId ? `<p style="font-size:11px; color:#666;">Testing Job: ${inv.linkedJobId}</p>` : ''}
      <p style="font-size:11px; color:#666;">Created: ${fmtDate(inv.createdAt)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Service Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate (₹)</th>
        <th style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tbody>
        <tr><td>Subtotal</td><td style="text-align:right">${fmt(inv.subtotalAmount)}</td></tr>
        ${inv.cgstAmt > 0 ? `<tr><td>CGST (${inv.cgstPct}%)</td><td style="text-align:right">${fmt(inv.cgstAmt)}</td></tr>` : ''}
        ${inv.sgstAmt > 0 ? `<tr><td>SGST (${inv.sgstPct}%)</td><td style="text-align:right">${fmt(inv.sgstAmt)}</td></tr>` : ''}
        ${inv.advanceConsumed > 0 ? `<tr><td>Advance Adjusted</td><td style="text-align:right">-${fmt(inv.advanceConsumed)}</td></tr>` : ''}
        <tr class="grand-total"><td><strong>Grand Total</strong></td><td style="text-align:right"><strong>${fmt(inv.totalAmount)}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>This is a computer-generated invoice. No signature required.</div>
    <div>Printed: ${new Date().toLocaleString('en-IN')}</div>
  </div>
  <div class="watermark">NEXUS ERP — Confidential</div>

  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function nextInvoiceNo(invoices: Invoice[], branchCode: string, txnType: TxnType): string {
  const abbr = TXN_TYPE_ABBR[txnType];
  const prefix = `${branchCode}-${abbr}-`;
  const max = invoices
    .filter((i) => i.invoiceNo.startsWith(prefix))
    .reduce((m, i) => Math.max(m, Number(i.invoiceNo.split('-').pop() ?? '0')), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
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
  const [formBranch, setFormBranch]           = useState('BLR1');
  const [formTxnType, setFormTxnType]         = useState<TxnType>('HALLMARKING');
  const [formCustomerId, setFormCustomerId]   = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formLinkedJob, setFormLinkedJob]     = useState('');
  const [formLinkedHmReq, setFormLinkedHmReq] = useState('');
  const [formSvcCode, setFormSvcCode]         = useState<ServiceCode>('HM_STANDARD');
  const [formSvcQty, setFormSvcQty]           = useState('1');
  const [formLines, setFormLines]             = useState<ServiceLine[]>([]);
  const [formCgstPct, setFormCgstPct]         = useState('0');
  const [formSgstPct, setFormSgstPct]         = useState('0');
  // exchange-specific form fields (visible when type = EXCHANGE)
  const [formExWeight, setFormExWeight]       = useState('');
  const [formExPurity, setFormExPurity]       = useState('91.6');
  const [formExRate, setFormExRate]           = useState('');
  // description / notes (visible for NON_HUID and MISCELLANEOUS)
  const [formNotes, setFormNotes]             = useState('');

  const [activeTab, setActiveTab] = useState<'invoices' | 'rates' | 'deposits' | 'exchange' | 'payments' | 'discounts' | 'scrap' | 'ledger'>('invoices');
  const [ledgerCustId, setLedgerCustId]       = useState('');

  // ── Rate form ───────────────────────────────────────────────────────────────
  const [rCustId, setRCustId]     = useState('');
  const [rSvcCode, setRSvcCode]   = useState<ServiceCode>('HUID');
  const [rValue, setRValue]       = useState('');

  // ── Deposit form ────────────────────────────────────────────────────────────
  const [dCustId, setDCustId]     = useState('');
  const [dBranch, setDBranch]     = useState('BLR1');
  const [dAmount, setDAmount]     = useState('');

  // Exchange form state
  const [exCustId, setExCustId]         = useState('');
  const [exBranch, setExBranch]         = useState('BLR1');
  const [exGoldGrams, setExGoldGrams]   = useState('');
  const [exPurity, setExPurity]         = useState('91.6');
  const [exCash, setExCash]             = useState('0');

  // Payment form state
  const [pyCustomer, setPyCustomer]     = useState('');
  const [pyBranch, setPyBranch]         = useState('BLR1');
  const [pyAmount, setPyAmount]         = useState('');
  const [pyTender, setPyTender]         = useState<PaymentTender>('cash');
  const [pyGoldGrams, setPyGoldGrams]   = useState('');
  const [pyPurity, setPyPurity]         = useState('91.6');

  // Discount form state
  const [dcCustomer, setDcCustomer]     = useState('');
  const [dcBranch, setDcBranch]         = useState('BLR1');
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

  // ── HM Requests (for Hallmarking billing link) ──────────────────────────────
  const hmRequests = useMemo(() => {
    const all = read<any[]>(HM_REQS_KEY, []);
    return all.filter((r) => r.status !== 'CANCELLED');
  }, []);

  // ── Computed form totals ────────────────────────────────────────────────────
  const formSubtotal = formLines.reduce((s, l) => s + l.amount, 0);
  const formCgstAmt  = Math.round(formSubtotal * (Number(formCgstPct) || 0) / 100 * 100) / 100;
  const formSgstAmt  = Math.round(formSubtotal * (Number(formSgstPct) || 0) / 100 * 100) / 100;
  const formGrandTotal = formSubtotal + formCgstAmt + formSgstAmt;

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
    // For EXCHANGE type, exchange-specific fields are required instead of service lines
    if (formTxnType === 'EXCHANGE') {
      if (!formExWeight.trim() || !formExRate.trim()) {
        toast.err('Old Gold Weight and Exchange Rate are required for Exchange transactions');
        return;
      }
    }
    // Service lines required for non-exchange types only on validate; allow draft without lines
    const cgstPct = Number(formCgstPct) || 0;
    const sgstPct = Number(formSgstPct) || 0;
    const exSubtotal = formTxnType === 'EXCHANGE'
      ? Math.round(Number(formExWeight) * (Number(formExPurity) / 100) * Number(formExRate) * 100) / 100
      : 0;
    const subtotal = formLines.reduce((s, l) => s + l.amount, 0) + exSubtotal;
    const cgstAmt  = Math.round(subtotal * cgstPct / 100 * 100) / 100;
    const sgstAmt  = Math.round(subtotal * sgstPct / 100 * 100) / 100;
    const grandTotal = subtotal + cgstAmt + sgstAmt;
    const branchId = branchOptions.find((b) => b.code === formBranch)?.id ?? NIL_UUID;
    try {
      const remarks = JSON.stringify({
        bc: formBranch,
        tt: formTxnType,
        cid: formCustomerId.trim(),
        cnm: formCustomerName.trim(),
        ljid: formLinkedJob,
        lhmr: formLinkedHmReq.trim(),
        lines: formLines,
        sub: subtotal,
        cgp: cgstPct,
        sgp: sgstPct,
        cga: cgstAmt,
        sga: sgstAmt,
        exw: formExWeight,
        exp: formExPurity,
        exr: formExRate,
        notes: formNotes,
      });
      const created = await api<any>(`${BILL_BASE}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: '',
          branchId,
          customerId: formCustomerId.trim(),
          remarks,
          grandTotal,
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
              taxRatePct: cgstPct + sgstPct,
            }),
          }),
        ),
      );
      const fresh = await api<any>(`${BILL_BASE}/invoices/${created.id}`);
      const inv = { ...mapBackendInvoice({ ...fresh, remarks, grandTotal }), invoiceNo: 'DRAFT' };
      setInvoices((prev) => [...prev, inv]);
      setFormLines([]);
      setFormLinkedJob('');
      setFormLinkedHmReq('');
      setFormExWeight('');
      setFormExRate('');
      setFormNotes('');
      toast.ok(`Draft invoice created (number assigned on Confirm)`);
    } catch (e: any) {
      toast.err(e?.message || 'Failed to create invoice in backend');
    }
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  async function validateInvoice(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    if (inv.status !== 'DRAFT') { toast.err('Only Draft invoices can be Validated'); return; }
    if (inv.lines.length === 0 && inv.txnType !== 'EXCHANGE') { toast.err('No billable service quantity — validation blocked'); return; }
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

    // Assign the real sequential invoice number at confirmation time
    const realInvoiceNo = nextInvoiceNo(invoices, inv.branchCode, inv.txnType as TxnType);

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
      ? { ...i, status: 'CONFIRMED' as BillStatus, invoiceNo: realInvoiceNo, confirmedAt: new Date().toISOString(), advanceConsumed: consumed }
      : i);
    setInvoices(updated);
    persist(INVOICES_KEY, updated);
    // Always mark PAID on backend so status persists as CONFIRMED after reload
    const backendStatus = 'PAID';
    try {
      await api(`${BILL_BASE}/invoices/${id}/status?status=${backendStatus}&invoiceNumber=${encodeURIComponent(realInvoiceNo)}`, { method: 'PATCH' });
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
    toast.ok(`Invoice ${realInvoiceNo} Confirmed. Advance consumed: ₹${consumed}`);
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
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['invoices', 'rates', 'deposits', 'exchange', 'payments', 'discounts', 'scrap', 'ledger'] as const).map((t) => (
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
            {t === 'ledger' ? 'Customer Ledger' : t.charAt(0).toUpperCase() + t.slice(1)}
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
                <label className="label">Transaction Type</label>
                <select id="blTxnType" className="input" value={formTxnType} onChange={(e) => setFormTxnType(e.target.value as TxnType)}>
                  {TXN_TYPES.map((t) => <option key={t} value={t}>{TXN_TYPE_LABELS[t]}</option>)}
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
            </div>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              {/* Linked HM Request — HALLMARKING only */}
              {formTxnType === 'HALLMARKING' && (
                <div>
                  <label className="label">Linked HM Request</label>
                  {hmRequests.length > 0 ? (
                    <select id="blLinkedHmReq" className="input" value={formLinkedHmReq} onChange={(e) => setFormLinkedHmReq(e.target.value)}>
                      <option value="">— None —</option>
                      {hmRequests.map((r: any) => (
                        <option key={r.id} value={r.requestNumber}>{r.requestNumber}{r.customerName ? ` — ${r.customerName}` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <input id="blLinkedHmReq" className="input" value={formLinkedHmReq} onChange={(e) => setFormLinkedHmReq(e.target.value)} placeholder="HM-001/002" />
                  )}
                </div>
              )}
              {/* Linked Testing Job — PURITY_TESTING only */}
              {formTxnType === 'PURITY_TESTING' && (
                <div>
                  <label className="label">Linked Testing Job</label>
                  <select id="blLinkedJob" className="input" value={formLinkedJob} onChange={(e) => setFormLinkedJob(e.target.value)}>
                    <option value="">— None —</option>
                    {billingJobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.orderId || j.id} — {j.customerName}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Article Description — NON_HUID */}
              {formTxnType === 'NON_HUID' && (
                <div>
                  <label className="label">Article Description</label>
                  <input id="blArticleDesc" className="input" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="e.g. Bangles, chains (non-HUID items)" />
                </div>
              )}
              {/* Notes — MISCELLANEOUS */}
              {formTxnType === 'MISCELLANEOUS' && (
                <div>
                  <label className="label">Notes / Description</label>
                  <input id="blNotes" className="input" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Describe the miscellaneous service" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">CGST %</label>
                  <input id="blCgstPct" className="input" type="number" min={0} max={30} value={formCgstPct} onChange={(e) => setFormCgstPct(e.target.value)} placeholder="9" />
                </div>
                <div>
                  <label className="label">SGST %</label>
                  <input id="blSgstPct" className="input" type="number" min={0} max={30} value={formSgstPct} onChange={(e) => setFormSgstPct(e.target.value)} placeholder="9" />
                </div>
              </div>
            </div>

            {/* Exchange-specific fields — EXCHANGE only */}
            {formTxnType === 'EXCHANGE' && (
              <div className="card p-3 mb-3 border border-amber-500/30 bg-amber-900/10">
                <h4 className="text-xs font-semibold text-amber-400 mb-2">Exchange Details</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Old Gold Weight (g)*</label>
                    <input id="blExWeight" className="input" type="number" min={0} step="0.001" value={formExWeight} onChange={(e) => setFormExWeight(e.target.value)} placeholder="50" />
                  </div>
                  <div>
                    <label className="label">Purity (%)*</label>
                    <input id="blExPurity" className="input" type="number" min={0} max={100} step="0.1" value={formExPurity} onChange={(e) => setFormExPurity(e.target.value)} placeholder="91.6 (22K)" />
                  </div>
                  <div>
                    <label className="label">Exchange Rate (₹/g pure)*</label>
                    <input id="blExRate" className="input" type="number" min={0} value={formExRate} onChange={(e) => setFormExRate(e.target.value)} placeholder="4500" />
                  </div>
                </div>
                {formExWeight && formExPurity && formExRate && (
                  <div className="mt-2 text-xs text-amber-300">
                    Pure gold: {(Number(formExWeight) * Number(formExPurity) / 100).toFixed(3)}g ×
                    ₹{formExRate}/g = ₹{(Number(formExWeight) * Number(formExPurity) / 100 * Number(formExRate)).toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Service lines section — hidden for EXCHANGE type which uses exchange-specific fields */}
            {formTxnType !== 'EXCHANGE' && (<>
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
                    <tr className="border-t border-nexus-line">
                      <td colSpan={3} className="text-right text-xs text-nexus-muted">Subtotal</td>
                      <td id="blFormSubtotal" className="font-semibold">₹{formSubtotal}</td><td />
                    </tr>
                    {formCgstAmt > 0 && (
                      <tr>
                        <td colSpan={3} className="text-right text-xs text-nexus-muted">CGST ({formCgstPct}%)</td>
                        <td id="blFormCgst" className="text-amber-300">₹{formCgstAmt}</td><td />
                      </tr>
                    )}
                    {formSgstAmt > 0 && (
                      <tr>
                        <td colSpan={3} className="text-right text-xs text-nexus-muted">SGST ({formSgstPct}%)</td>
                        <td id="blFormSgst" className="text-amber-300">₹{formSgstAmt}</td><td />
                      </tr>
                    )}
                    <tr className="border-t border-nexus-line">
                      <td colSpan={3} className="text-right font-semibold text-xs">Grand Total</td>
                      <td id="blFormTotal" className="font-bold text-emerald-400">₹{formGrandTotal}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            </>)}

            <button id="blCreateInvoice" className="btn-primary" onClick={createInvoice}>Create Invoice</button>
          </div>

          {/* Invoice register */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Invoice Register</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Type</th><th>Branch</th><th>Customer</th>
                    <th>Subtotal ₹</th><th>CGST ₹</th><th>SGST ₹</th><th>Grand Total ₹</th><th>Advance ₹</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr><td colSpan={11} className="text-center text-nexus-muted">No invoices yet</td></tr>
                  )}
                  {invoices.map((inv) => {
                    const locked = inv.status === 'CONFIRMED' || inv.status === 'CANCELLED';
                    return (
                      <tr key={inv.id}>
                        <td id={`blInvoiceNo-${inv.id}`} className="font-mono text-xs whitespace-nowrap">{inv.invoiceNo}</td>
                        <td className="text-xs text-nexus-muted">{TXN_TYPE_LABELS[inv.txnType] ?? inv.txnType}</td>
                        <td>{inv.branchCode}</td>
                        <td>{inv.customerName}</td>
                        <td id={`blSubtotal-${inv.id}`}>₹{inv.subtotalAmount}</td>
                        <td id={`blCgst-${inv.id}`} className="text-amber-300">{inv.cgstAmt > 0 ? `₹${inv.cgstAmt}` : '—'}</td>
                        <td id={`blSgst-${inv.id}`} className="text-amber-300">{inv.sgstAmt > 0 ? `₹${inv.sgstAmt}` : '—'}</td>
                        <td id={`blGrandTotal-${inv.id}`} className="font-semibold">₹{inv.totalAmount}</td>
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
                            <>
                              <span id={`blLocked-${inv.id}`} className="text-amber-400 text-xs">🔒 Locked</span>
                              <button id={`blPrintPdf-${inv.id}`} className="btn text-xs" onClick={() => printInvoicePdf(inv)}>🖨 PDF</button>
                            </>
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
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold">
                  Invoice Detail — {inv.invoiceNo}
                  <span id={`blAmountLocked-${inv.id}`} className="ml-2 text-amber-400 text-xs">
                    🔒 All amounts locked after confirmation
                  </span>
                </h4>
                <button id={`blPrintPdfDetail-${inv.id}`} className="btn text-xs" onClick={() => printInvoicePdf(inv)}>🖨 Print / Save PDF</button>
              </div>
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

      {/* ── CUSTOMER LEDGER TAB ──────────────────────────────────────────────── */}
      {activeTab === 'ledger' && (() => {
        const custId = ledgerCustId.trim();
        // Deposits for this customer (all branches)
        const custDeposits = deposits.filter((d) => !custId || d.customerId === custId);
        // Confirmed invoices for this customer
        const custInvoices = invoices.filter((i) => i.status === 'CONFIRMED' && (!custId || i.customerId === custId));

        // Build chronological ledger entries
        type LedgerEntry = { date: string; narration: string; ref: string; dr: number; cr: number; };
        const entries: LedgerEntry[] = [];
        for (const d of custDeposits) {
          entries.push({ date: d.createdAt, narration: 'Advance Received', ref: `DEP-${d.id.slice(0, 6).toUpperCase()}`, dr: 0, cr: d.amount });
        }
        for (const inv of custInvoices) {
          entries.push({ date: inv.confirmedAt || inv.createdAt, narration: 'Invoice Raised', ref: inv.invoiceNo, dr: inv.totalAmount, cr: 0 });
          if (inv.advanceConsumed > 0) {
            entries.push({ date: inv.confirmedAt || inv.createdAt, narration: 'Advance Consumed', ref: inv.invoiceNo, dr: 0, cr: inv.advanceConsumed });
          }
        }
        entries.sort((a, b) => a.date.localeCompare(b.date));

        let running = 0;
        const rows = entries.map((e) => {
          running += e.cr - e.dr;
          return { ...e, balance: running };
        });

        const totalDr = entries.reduce((s, e) => s + e.dr, 0);
        const totalCr = entries.reduce((s, e) => s + e.cr, 0);
        const finalBalance = totalCr - totalDr;

        return (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Customer Ledger</h3>
              <div className="flex gap-3 mb-4 items-end">
                <div className="flex-1">
                  <label className="label">Filter by Customer ID (leave blank for all)</label>
                  {customerRefs.length > 0 ? (
                    <select id="blLedgerCust" className="input" value={ledgerCustId} onChange={(e) => setLedgerCustId(e.target.value)}>
                      <option value="">— All Customers —</option>
                      {customerRefs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input id="blLedgerCust" className="input" value={ledgerCustId} onChange={(e) => setLedgerCustId(e.target.value)} placeholder="Customer ID or leave blank" />
                  )}
                </div>
              </div>
              {rows.length === 0 ? (
                <p className="text-center text-nexus-muted text-sm py-4">No ledger entries for this customer.</p>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead>
                        <tr><th>Date</th><th>Narration</th><th>Reference</th><th>Dr ₹</th><th>Cr ₹</th><th>Balance ₹</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} id={`blLedger-${i}`}>
                            <td className="text-xs text-nexus-muted">{new Date(r.date).toLocaleDateString()}</td>
                            <td>{r.narration}</td>
                            <td className="font-mono text-xs">{r.ref}</td>
                            <td className="text-red-400">{r.dr > 0 ? `₹${r.dr}` : '—'}</td>
                            <td className="text-emerald-400">{r.cr > 0 ? `₹${r.cr}` : '—'}</td>
                            <td
                              id={`blLedgerBal-${i}`}
                              className={`font-semibold ${r.balance > 0 ? 'text-emerald-400' : r.balance < 0 ? 'text-red-400' : 'text-nexus-muted'}`}
                            >
                              {r.balance === 0 ? '₹0 (settled)' : `₹${Math.abs(r.balance)} ${r.balance > 0 ? 'CR' : 'DR'}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-nexus-line">
                          <td colSpan={3} className="text-right text-xs font-semibold text-nexus-muted">Totals</td>
                          <td className="font-bold text-red-400">₹{totalDr}</td>
                          <td className="font-bold text-emerald-400">₹{totalCr}</td>
                          <td
                            id="blLedgerFinalBalance"
                            className={`font-bold ${finalBalance > 0 ? 'text-emerald-400' : finalBalance < 0 ? 'text-red-400' : 'text-nexus-muted'}`}
                          >
                            {finalBalance === 0 ? '₹0 (settled)' : `₹${Math.abs(finalBalance)} ${finalBalance > 0 ? 'CR' : 'DR'}`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-xs text-nexus-muted mt-2">
                    CR = customer has credit balance (advance remaining) · DR = customer owes (outstanding)
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
