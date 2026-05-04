import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

// ── Customer & Rate types ─────────────────────────────────────────────────────
type Customer = {
  id: string;
  name: string;
  gstin: string;
  phone: string;
  email: string;
  customRatePerGram: number | null; // null → uses default rate
  createdAt: string;
  updatedAt: string;
};

type DefaultRate = {
  ratePerGram: number;
  updatedAt: string;
};

type RateRequest = {
  id: string;
  customerId: string;
  customerName: string;
  branchId: string;
  serviceTypeId: string;
  billingServiceCode: string;   // maps to billing ServiceCode
  defaultRate: number;           // default rate at time of submission
  requestedRatePerGram: number;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceType = {
  id: string;
  code: string;
  name: string;
};

type BackendRate = {
  id: string;
  branchCode: string;
  customerName: string | null;
  serviceTypeCode: string;
  rate: number;
};

// ── Product / Purity / Branch / Stock types ───────────────────────────────────
type Purity = {
  id: string;
  label: string;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  normalizedName: string;
  purityId: string;
  createdAt: string;
  updatedAt: string;
};

type Branch = {
  id: string;
  name: string;
  pan: string;
  createdAt: string;
  updatedAt: string;
};

type StockAlert = {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  currentStock: number;
  minimumStock: number;
  alertTriggered: boolean;
  updatedAt: string;
};

// localStorage-only keys (no dedicated backend endpoint)
const RATE_KEY    = 'nexus.react.admin.defaultrate.v1';
const RATEREQ_KEY = 'nexus.react.admin.raterequests.v1';
const STOCK_KEY   = 'nexus.react.admin.stockalerts.v1';
const BILLING_CUST_RATES_KEY = 'nexus.react.billing.customerRates.v1';

// Billing service catalogue (mirrors BillingDesk DEFAULT_RATES)
const BILLING_SERVICES = [
  { code: 'HM_STANDARD',       name: 'Hallmarking (Gold) Standard', defaultRate: 350 },
  { code: 'HM_EXPRESS',        name: 'Hallmarking Express',          defaultRate: 300 },
  { code: 'XRF',               name: 'XRF Testing',                  defaultRate: 250 },
  { code: 'FIRE_ASSAY',        name: 'Fire Assay Testing',           defaultRate: 400 },
  { code: 'HUID',              name: 'HUID Marking',                  defaultRate: 100 },
  { code: 'SILVER_TITRATION',  name: 'Silver Titration',             defaultRate: 350 },
];

const RATE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Submitted', APPROVED: 'Approved', REJECTED: 'Rejected',
};

// API base paths
const ADM = '/api/admin/api/v1/admin';

// Field mappers: backend → frontend
function mapCustomer(c: any): Customer {
  return { id: c.id, name: c.name ?? '', gstin: c.gstin ?? '', phone: c.phone ?? '', email: c.email ?? '', customRatePerGram: null, createdAt: c.createdAt ?? '', updatedAt: c.updatedAt ?? '' };
}
function mapBranch(b: any): Branch {
  return { id: b.id, name: b.name ?? '', pan: b.gstin ?? b.pan ?? '', createdAt: b.createdAt ?? '', updatedAt: b.updatedAt ?? '' };
}
function mapProduct(p: any): Product {
  return { id: p.id, name: p.name ?? '', normalizedName: normalizeProdName(p.name ?? ''), purityId: p.categoryId ?? '', createdAt: p.createdAt ?? '', updatedAt: p.updatedAt ?? '' };
}
function mapPurity(p: any): Purity {
  return { id: p.id, label: p.label ?? '', createdAt: p.createdAt ?? '' };
}

function isValidGSTIN(v: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.trim().toUpperCase());
}

function isValidPAN(v: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.trim().toUpperCase());
}

function normalizeProdName(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Employee types ────────────────────────────────────────────────────────────
type AccessRight =
  | 'ADMIN'
  | 'MANAGER'
  | 'RECEPTIONIST'
  | 'INVENTORY_CLERK'
  | 'BILLING_CLERK'
  | 'XRF_DESK_OPERATOR'
  | 'VIEWER';

type EmploymentType = 'Full-time' | 'Part-time' | 'Contract';

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
};

type Employee = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  designation: string;
  department: string;
  employmentType: EmploymentType;
  branchCode: string;
  accessRights: AccessRight[];
  systemUsername: string;
  systemPassword: string;
  bankAccounts: BankAccount[];
  createdAt: string;
  updatedAt: string;
};

const EMP_KEY = 'nexus.react.admin.employees.v1';
const ACCESS_RIGHTS: AccessRight[] = [
  'ADMIN',
  'MANAGER',
  'RECEPTIONIST',
  'INVENTORY_CLERK',
  'BILLING_CLERK',
  'XRF_DESK_OPERATOR',
  'VIEWER',
];
const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time', 'Contract'];

function toTitleCase(v: string): string {
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function makeUsername(fullName: string, existing: Employee[]): string {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'employee';
  const seq = existing.length + 1;
  return `${base}.${String(seq).padStart(3, '0')}`;
}

function makePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function AdminDesk() {
  // ── Employee state ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>(() => read<Employee[]>(EMP_KEY, []));

  const [selectedId, setSelectedId] = useState('');
  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) || null,
    [employees, selectedId],
  );

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('Full-time');
  const [empBranchCode, setEmpBranchCode] = useState('');
  const [rights, setRights] = useState<AccessRight[]>([]);

  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [draftBanks, setDraftBanks] = useState<BankAccount[]>([]);

  // ── Customer state ──────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custGSTIN, setCustGSTIN] = useState('');
  const [custGSTINErr, setCustGSTINErr] = useState('');

  // ── Rate state ──────────────────────────────────────────────────────────────
  const [defaultRate, setDefaultRate] = useState<DefaultRate>(() =>
    read<DefaultRate>(RATE_KEY, { ratePerGram: 6000, updatedAt: new Date().toISOString() }),
  );
  const [defaultRateInput, setDefaultRateInput] = useState(() =>
    String(read<DefaultRate>(RATE_KEY, { ratePerGram: 6000, updatedAt: '' }).ratePerGram),
  );

  // ── Rate-request state ──────────────────────────────────────────────────────
  const [rateRequests, setRateRequests] = useState<RateRequest[]>(() =>
    read<RateRequest[]>(RATEREQ_KEY, []),
  );
  const [rrCustomerId, setRrCustomerId] = useState('');
  const [rrRate, setRrRate] = useState('');
  const [rrBranch, setRrBranch] = useState('');
  const [rrServiceTypeId, setRrServiceTypeId] = useState('');
  const [rrBillingServiceCode, setRrBillingServiceCode] = useState('HM_STANDARD');

  // ── Service types + backend rates state ────────────────────────
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [backendRates, setBackendRates] = useState<BackendRate[]>([]);

  // ── Default rate form selectors ────────────────────────────────
  const [drBranchId, setDrBranchId] = useState('');
  const [drServiceTypeId, setDrServiceTypeId] = useState('');

  // ── Product state ─────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [prodName, setProdName] = useState('');
  const [prodPurityId, setProdPurityId] = useState('');
  const [prodDupErr, setProdDupErr] = useState('');

  // ── Purity state ─────────────────────────────────────────────
  const [purities, setPurities] = useState<Purity[]>([]);
  const [purityLabel, setPurityLabel] = useState('');
  const [purityDeleteErr, setPurityDeleteErr] = useState('');

  // ── Branch state ─────────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchName, setBranchName] = useState('');
  const [branchPAN, setBranchPAN] = useState('');
  const [branchPANErr, setBranchPANErr] = useState('');

  // ── Stock alert state ────────────────────────────────────────
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>(() => read<StockAlert[]>(STOCK_KEY, []));
  const [saProductId, setSaProductId] = useState('');
  const [saBranchId, setSaBranchId] = useState('');
  const [saCurrentStock, setSaCurrentStock] = useState('');
  const [saMinStock, setSaMinStock] = useState('');

  const [phoneErr, setPhoneErr] = useState('');
  const [emailErr, setEmailErr] = useState('');

  // ── Load data from API on mount ───────────────────────────────────────────
  useEffect(() => {
    api<any[]>(`${ADM}/customers`).then(d => setCustomers(d.map(mapCustomer))).catch(() => {});
    api<any[]>(`${ADM}/branches`).then(d => setBranches(d.map(mapBranch))).catch(() => {});
    api<any[]>(`${ADM}/products`).then(d => setProducts(d.map(mapProduct))).catch(() => {});
    api<any[]>(`${ADM}/purity`).then(d => setPurities(d.map(mapPurity))).catch(() => {});
    api<any[]>(`${ADM}/service-types`).then(d => setServiceTypes(d.map((s: any) => ({ id: s.id, code: s.code, name: s.name })))).catch(() => {});
    api<any[]>(`${ADM}/rates`).then(d => setBackendRates(d.map((r: any) => ({ id: r.id, branchCode: r.branchCode ?? '', customerName: r.customerName ?? null, serviceTypeCode: r.serviceTypeCode ?? '', rate: Number(r.rate) })))).catch(() => {});
  }, []);

  const stats = useMemo(() => ({
    employees: employees.length,
    accounts: employees.filter((e) => !!e.systemUsername).length,
    bankLinks: employees.reduce((sum, e) => sum + e.bankAccounts.length, 0),
    customers: customers.length,
    pendingRateReqs: rateRequests.filter((r) => r.status === 'PENDING').length,
    products: products.length,
    branches: branches.length,
  }), [employees, customers, rateRequests, products, branches]);

  // ── Employee helpers ────────────────────────────────────────────────────────
  function saveEmployees(next: Employee[]) {
    setEmployees(next);
    persist(EMP_KEY, next);
  }

  function resetForm() {
    setSelectedId('');
    setFullName('');
    setPhone('');
    setEmail('');
    setDesignation('');
    setDepartment('');
    setEmploymentType('Full-time');
    setEmpBranchCode('');
    setRights([]);
    setDraftBanks([]);
    setPhoneErr('');
    setEmailErr('');
    setBankName('');
    setBankAccountNo('');
    setBankIfsc('');
  }

  // ── Customer helpers ────────────────────────────────────────────────────────
  async function saveCustomer() {
    setCustGSTINErr('');
    if (!custName.trim()) { toast.err('Customer name is required'); return; }
    if (!isValidGSTIN(custGSTIN)) {
      const msg = 'Validation error: GSTIN format invalid.';
      setCustGSTINErr(msg);
      toast.err(msg);
      return;
    }
    try {
      const created = await api<any>(`${ADM}/customers`, {
        method: 'POST',
        body: JSON.stringify({ name: custName.trim(), gstin: custGSTIN.trim().toUpperCase(), phone: custPhone.trim(), email: custEmail.trim(), customerNumber: custGSTIN.trim().toUpperCase() }),
      });
      setCustomers(prev => [mapCustomer(created), ...prev]);
      toast.ok('Customer saved');
      setCustName(''); setCustPhone(''); setCustEmail(''); setCustGSTIN('');
    } catch (e: any) { toast.err(e.message || 'Failed to save customer'); }
  }

  // ── Rate helpers ────────────────────────────────────────────────────────────
  async function saveDefaultRate() {
    const n = parseFloat(defaultRateInput);
    if (isNaN(n) || n <= 0) { toast.err('Enter a valid rate per gram'); return; }
    if (!drBranchId) { toast.err('Select a branch for the rate'); return; }
    if (!drServiceTypeId) { toast.err('Select a service type for the rate'); return; }
    try {
      const created = await api<any>(`${ADM}/rates`, {
        method: 'POST',
        body: JSON.stringify({ branchId: drBranchId, serviceTypeId: drServiceTypeId, rate: n, rateBasis: 'PER_GRAM' }),
      });
      setBackendRates(prev => [{ id: created.id, branchCode: created.branchCode ?? '', customerName: null, serviceTypeCode: created.serviceTypeCode ?? '', rate: n }, ...prev]);
      const next: DefaultRate = { ratePerGram: n, updatedAt: now() };
      setDefaultRate(next);
      persist(RATE_KEY, next);
      toast.ok('Default rate saved');
    } catch (e: any) { toast.err(e.message || 'Failed to save rate'); }
  }

  function bulkApplyDefaultRate() {
    if (customers.length === 0) { toast.err('No customers to apply rate to'); return; }
    setCustomers(prev => prev.map(c => c.customRatePerGram === null ? { ...c, updatedAt: now() } : c));
    toast.ok(`Default rate applied to all customers without custom pricing`);
  }

  // ── Rate-request helpers ────────────────────────────────────────────────────
  function saveRateRequests(next: RateRequest[]) {
    setRateRequests(next);
    persist(RATEREQ_KEY, next);
  }

  function submitRateRequest() {
    const rate = parseFloat(rrRate);
    if (!rrCustomerId) { toast.err('Select a customer'); return; }
    if (isNaN(rate) || rate <= 0) { toast.err('Enter a valid requested rate'); return; }
    if (!rrBranch) { toast.err('Select a branch'); return; }
    if (!rrBillingServiceCode) { toast.err('Select a service'); return; }
    const cust = customers.find((c) => c.id === rrCustomerId);
    const br = branches.find((b) => b.id === rrBranch);
    if (!cust) return;
    const svc = BILLING_SERVICES.find((s) => s.code === rrBillingServiceCode);
    const req: RateRequest = {
      id: uuid(),
      customerId: rrCustomerId,
      customerName: cust.name,
      branchId: rrBranch,
      serviceTypeId: rrServiceTypeId,
      billingServiceCode: rrBillingServiceCode,
      defaultRate: svc?.defaultRate ?? 0,
      requestedRatePerGram: rate,
      requestedBy: br?.name ?? rrBranch,
      status: 'PENDING',
      reviewNote: '',
      createdAt: now(),
      updatedAt: now(),
    };
    saveRateRequests([req, ...rateRequests]);
    toast.ok(`Rate request submitted: ${cust.name} — ${svc?.name ?? rrBillingServiceCode} @ ₹${rate}/piece`);
    setRrCustomerId(''); setRrRate(''); setRrBranch(''); setRrServiceTypeId('');
  }

  async function approveRateRequest(id: string) {
    const req = rateRequests.find((r) => r.id === id);
    if (!req) return;
    // Try to persist to backend rates API (best-effort)
    try {
      if (req.serviceTypeId) {
        const created = await api<any>(`${ADM}/rates`, {
          method: 'POST',
          body: JSON.stringify({ branchId: req.branchId, customerId: req.customerId, serviceTypeId: req.serviceTypeId, rate: req.requestedRatePerGram, rateBasis: 'PER_PIECE' }),
        });
        setBackendRates(prev => [{ id: created.id, branchCode: created.branchCode ?? '', customerName: req.customerName, serviceTypeCode: created.serviceTypeCode ?? '', rate: req.requestedRatePerGram }, ...prev]);
      }
    } catch { /* non-fatal — local sync always proceeds */ }
    // Sync approved rate into billing's customer-rates localStorage
    try {
      const existing: any[] = JSON.parse(localStorage.getItem(BILLING_CUST_RATES_KEY) || '[]');
      const idx = existing.findIndex((r) => r.customerId === req.customerId && r.serviceCode === req.billingServiceCode);
      const entry = { id: idx >= 0 ? existing[idx].id : uuid(), customerId: req.customerId, serviceCode: req.billingServiceCode, rate: req.requestedRatePerGram };
      if (idx >= 0) existing[idx] = entry; else existing.push(entry);
      localStorage.setItem(BILLING_CUST_RATES_KEY, JSON.stringify(existing));
    } catch { /* ignore storage errors */ }
    const nextReqs = rateRequests.map((r) =>
      r.id === id ? { ...r, status: 'APPROVED' as const, updatedAt: now() } : r,
    );
    saveRateRequests(nextReqs);
    setCustomers(prev => prev.map(c =>
      c.id === req.customerId ? { ...c, customRatePerGram: req.requestedRatePerGram, updatedAt: now() } : c,
    ));
    const svc = BILLING_SERVICES.find((s) => s.code === req.billingServiceCode);
    toast.ok(`Approved: ${req.customerName} — ${svc?.name ?? req.billingServiceCode} @ ₹${req.requestedRatePerGram}/piece. Rate active for next billing cycle.`);
  }

  function rejectRateRequest(id: string) {
    const nextReqs = rateRequests.map((r) =>
      r.id === id ? { ...r, status: 'REJECTED' as const, updatedAt: now() } : r,
    );
    saveRateRequests(nextReqs);
    toast.ok('Rate request rejected. Customer rate unchanged.');
  }

  // ── Product helpers ────────────────────────────────────────────
  async function addProduct() {
    setProdDupErr('');
    if (!prodName.trim()) { toast.err('Product name is required'); return; }
    const normalized = normalizeProdName(prodName);
    if (products.some((p) => p.normalizedName === normalized)) {
      const msg = 'Duplicate product: name already exists.';
      setProdDupErr(msg);
      toast.err(msg);
      return;
    }
    try {
      const created = await api<any>(`${ADM}/products`, {
        method: 'POST',
        body: JSON.stringify({ name: prodName.trim(), code: normalized.replace(/\s/g, '-').slice(0, 20).toUpperCase(), categoryId: prodPurityId || null }),
      });
      setProducts(prev => [mapProduct(created), ...prev]);
      toast.ok('Product saved');
      setProdName(''); setProdPurityId('');
    } catch (e: any) { toast.err(e.message || 'Failed to save product'); }
  }

  // ── Purity helpers ────────────────────────────────────────────
  async function addPurity() {
    if (!purityLabel.trim()) { toast.err('Purity label is required'); return; }
    try {
      const created = await api<any>(`${ADM}/purity`, {
        method: 'POST',
        body: JSON.stringify({ label: purityLabel.trim(), finenessThreshold: 0, metal: 'GOLD' }),
      });
      setPurities(prev => [mapPurity(created), ...prev]);
      toast.ok('Purity added');
      setPurityLabel('');
    } catch (e: any) { toast.err(e.message || 'Failed to add purity'); }
  }

  async function deletePurity(id: string) {
    setPurityDeleteErr('');
    if (products.some((p) => p.purityId === id)) {
      const msg = 'Cannot delete: purity is referenced by existing products.';
      setPurityDeleteErr(msg);
      toast.err(msg);
      return;
    }
    try {
      await api(`${ADM}/purity/${id}`, { method: 'DELETE' });
      setPurities(prev => prev.filter(p => p.id !== id));
      toast.ok('Purity deleted');
    } catch (e: any) { toast.err(e.message || 'Failed to delete purity'); }
  }

  // ── Branch helpers ────────────────────────────────────────────
  async function saveBranch() {
    setBranchPANErr('');
    if (!branchName.trim()) { toast.err('Branch name is required'); return; }
    if (!isValidPAN(branchPAN)) {
      const msg = 'Validation error: invalid PAN format.';
      setBranchPANErr(msg);
      toast.err(msg);
      return;
    }
    try {
      const created = await api<any>(`${ADM}/branches`, {
        method: 'POST',
        body: JSON.stringify({ name: branchName.trim(), code: branchName.trim().slice(0, 5).toUpperCase().replace(/\s/g, ''), invoiceCode: branchPAN.trim().toUpperCase(), gstin: branchPAN.trim().toUpperCase() }),
      });
      setBranches(prev => [mapBranch(created), ...prev]);
      toast.ok('Branch saved');
      setBranchName(''); setBranchPAN('');
    } catch (e: any) { toast.err(e.message || 'Failed to save branch'); }
  }

  // ── Stock alert helpers ───────────────────────────────────────
  function saveSAs(next: StockAlert[]) { setStockAlerts(next); persist(STOCK_KEY, next); }

  function saveStockAlert() {
    if (!saProductId) { toast.err('Select a product'); return; }
    if (!saBranchId) { toast.err('Select a branch'); return; }
    const cur = parseFloat(saCurrentStock);
    const min = parseFloat(saMinStock);
    if (isNaN(cur) || cur < 0) { toast.err('Enter valid current stock'); return; }
    if (isNaN(min) || min <= 0) { toast.err('Enter valid minimum stock threshold'); return; }
    const prod = products.find((p) => p.id === saProductId);
    const branch = branches.find((b) => b.id === saBranchId);
    if (!prod || !branch) return;
    const sa: StockAlert = {
      id: uuid(),
      productId: saProductId, productName: prod.name,
      branchId: saBranchId, branchName: branch.name,
      currentStock: cur, minimumStock: min,
      alertTriggered: cur < min,
      updatedAt: now(),
    };
    saveSAs([sa, ...stockAlerts]);
    toast.ok(cur < min ? 'Stock alert saved. ALERT: stock below minimum!' : 'Stock alert saved');
    setSaProductId(''); setSaBranchId(''); setSaCurrentStock(''); setSaMinStock('');
  }

  function loadEmployee(id: string) {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    setSelectedId(emp.id);
    setFullName(emp.fullName);
    setPhone(emp.phone);
    setEmail(emp.email);
    setDesignation(emp.designation);
    setDepartment(emp.department ?? '');
    setEmploymentType(emp.employmentType ?? 'Full-time');
    setEmpBranchCode(emp.branchCode ?? '');
    setRights(emp.accessRights);
    setDraftBanks(emp.bankAccounts);
    setPhoneErr('');
    setEmailErr('');
    toast.ok(`Loaded ${emp.fullName} for editing`);
  }

  function toggleRight(r: AccessRight) {
    setRights((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function addBankAccount() {
    if (!bankName.trim() || !bankAccountNo.trim() || !bankIfsc.trim()) {
      toast.err('Bank Name, Account Number, and IFSC are required');
      return;
    }
    const row: BankAccount = {
      id: uuid(),
      bankName: bankName.trim(),
      accountNumber: bankAccountNo.trim(),
      ifscCode: bankIfsc.trim().toUpperCase(),
    };
    setDraftBanks((prev) => [...prev, row]);
    setBankName('');
    setBankAccountNo('');
    setBankIfsc('');
  }

  function removeBankAccount(id: string) {
    setDraftBanks((prev) => prev.filter((b) => b.id !== id));
  }

  function validate(): boolean {
    setPhoneErr('');
    setEmailErr('');

    if (!/^\d{10}$/.test(phone.trim())) {
      const msg = 'Validation error: phone number must be exactly 10 digits.';
      setPhoneErr(msg);
      toast.err(msg);
      return false;
    }

    if (!isValidEmail(email.trim())) {
      const msg = 'Validation error: invalid email format.';
      setEmailErr(msg);
      toast.err(msg);
      return false;
    }

    if (!fullName.trim() || !designation.trim()) {
      toast.err('Employee Name and Designation are required');
      return false;
    }

    if (!department.trim()) {
      toast.err('Department is required');
      return false;
    }

    if (rights.length === 0) {
      toast.err('Select at least one access right');
      return false;
    }

    return true;
  }

  function saveEmployee() {
    if (!validate()) return;

    if (selected) {
      const next = employees.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              fullName: toTitleCase(fullName.trim()),
              phone: phone.trim(),
              email: email.trim(),
              designation: designation.trim(),
              department: department.trim(),
              employmentType,
              branchCode: empBranchCode,
              accessRights: rights,
              bankAccounts: draftBanks,
              updatedAt: now(),
            }
          : e,
      );
      saveEmployees(next);
      toast.ok('Employee updated successfully');
      return;
    }

    const formatted = toTitleCase(fullName.trim());
    const systemUsername = makeUsername(formatted, employees);
    const systemPassword = makePassword();

    const emp: Employee = {
      id: uuid(),
      fullName: formatted,
      phone: phone.trim(),
      email: email.trim(),
      designation: designation.trim(),
      department: department.trim(),
      employmentType,
      branchCode: empBranchCode,
      accessRights: rights,
      systemUsername,
      systemPassword,
      bankAccounts: draftBanks,
      createdAt: now(),
      updatedAt: now(),
    };

    saveEmployees([emp, ...employees]);
    toast.ok('Employee created. System account auto-provisioned');
    resetForm();
  }

  return (
    <div>
      <PageHeader title="Admin / Masters Desk" subtitle="Employee Profiles · Access Rights · Bank Accounts · Customer & Rate Management · Products & Branches" />

      <div className="grid grid-cols-7 gap-2 mb-5">
        <Stat label="Employees" value={stats.employees} accent="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <Stat label="System Accounts" value={stats.accounts} accent="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <Stat label="Bank Links" value={stats.bankLinks} accent="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <Stat label="Customers" value={stats.customers} accent="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <Stat label="Pending Rate Reqs" value={stats.pendingRateReqs} accent="bg-gradient-to-br from-amber-500 to-orange-600" />
        <Stat label="Products" value={stats.products} accent="bg-gradient-to-br from-sky-500 to-blue-600" />
        <Stat label="Branches" value={stats.branches} accent="bg-gradient-to-br from-pink-500 to-rose-600" />
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Employee Profiles</h3>

          <div className="grid md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Employee Name*</label>
              <input id="amEmpName" className="input" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={(e) => setFullName(toTitleCase(e.target.value))} />
            </div>
            <div>
              <label className="label">Phone (10 digits)*</label>
              <input id="amEmpPhone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phoneErr && <div id="amEmpPhoneError" className="text-xs text-red-400 mt-1">{phoneErr}</div>}
            </div>
            <div>
              <label className="label">Email*</label>
              <input id="amEmpEmail" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailErr && <div id="amEmpEmailError" className="text-xs text-red-400 mt-1">{emailErr}</div>}
            </div>
            <div>
              <label className="label">Title / Designation*</label>
              <input id="amEmpDesignation" className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Department*</label>
              <input id="amEmpDept" className="input" placeholder="e.g. Testing Lab" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <label className="label">Employment Type*</label>
              <select id="amEmpEmploymentType" className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Branch</label>
              <select id="amEmpBranch" className="input" value={empBranchCode} onChange={(e) => setEmpBranchCode(e.target.value)}>
                <option value="">— none —</option>
                <option value="BLR1">BLR1</option>
                <option value="HQ">HQ</option>
                <option value="ACHD">ACHD</option>
                {branches.filter(b => !['BLR1','HQ','ACHD'].includes(b.name)).map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="label">Access Rights*</label>
            <div className="grid md:grid-cols-6 gap-2">
              {ACCESS_RIGHTS.map((r) => (
                <label key={r} className="text-xs p-2 border border-nexus-line rounded-lg flex items-center gap-2">
                  <input
                    id={`amRight-${r}`}
                    type="checkbox"
                    checked={rights.includes(r)}
                    onChange={() => toggleRight(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div className="card p-3 mb-3">
            <h4 className="text-xs font-semibold mb-2">Bank Accounts</h4>
            <div className="grid md:grid-cols-4 gap-2 mb-2">
              <input id="amBankName" className="input" placeholder="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <input id="amBankAccountNo" className="input" placeholder="Account Number" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
              <input id="amBankIfsc" className="input" placeholder="IFSC" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
              <button id="amBankAdd" className="btn" onClick={addBankAccount}>Add Bank Account</button>
            </div>

            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Bank</th><th>Account</th><th>IFSC</th><th>Actions</th></tr></thead>
                <tbody>
                  {draftBanks.length === 0 && <tr><td colSpan={4} className="text-center text-nexus-muted">No bank accounts linked</td></tr>}
                  {draftBanks.map((b) => (
                    <tr key={b.id} id={`amEmpBankRow-${b.id}`}>
                      <td>{b.bankName}</td>
                      <td>{b.accountNumber}</td>
                      <td>{b.ifscCode}</td>
                      <td><button id={`amBankRemove-${b.id}`} className="btn text-xs" onClick={() => removeBankAccount(b.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button id="amEmpSave" className="btn-primary" onClick={saveEmployee}>{selected ? 'Update Employee' : 'Save Employee'}</button>
            <button id="amEmpReset" className="btn" onClick={resetForm}>Reset</button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Employee Register</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Title</th>
                  <th>Dept</th>
                  <th>Type</th>
                  <th>Branch</th>
                  <th>Access Rights</th>
                  <th>System User</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && <tr><td colSpan={11} className="text-center text-nexus-muted">No employees found</td></tr>}
                {employees.map((e) => (
                  <tr key={e.id} id={`amEmpRow-${e.id}`}>
                    <td id={`amEmpNameVal-${e.id}`}>{e.fullName}</td>
                    <td>{e.phone}</td>
                    <td>{e.email}</td>
                    <td id={`amEmpTitle-${e.id}`}>{e.designation}</td>
                    <td id={`amEmpDeptVal-${e.id}`}>{e.department ?? '—'}</td>
                    <td id={`amEmpTypeVal-${e.id}`}>{e.employmentType ?? '—'}</td>
                    <td id={`amEmpBranchVal-${e.id}`}>{e.branchCode ?? '—'}</td>
                    <td id={`amEmpRights-${e.id}`} className="text-xs">{e.accessRights.join(', ')}</td>
                    <td id={`amEmpSystemUser-${e.id}`} className="font-mono text-xs">{e.systemUsername}</td>
                    <td id={`amEmpSystemPass-${e.id}`} className="font-mono text-xs">{e.systemPassword}</td>
                    <td>
                      <button id={`amEmpOpen-${e.id}`} className="btn text-xs" onClick={() => loadEmployee(e.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Customer Management ─────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Customer Management</h3>
          <div className="grid md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Customer Name*</label>
              <input id="amCustName" className="input" value={custName} onChange={(e) => setCustName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input id="amCustPhone" className="input" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input id="amCustEmail" className="input" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">GSTIN*</label>
              <input id="amCustGSTIN" className="input font-mono" placeholder="e.g. 27AAAAA0000A1Z5" value={custGSTIN} onChange={(e) => setCustGSTIN(e.target.value)} />
              {custGSTINErr && <div id="amCustGSTINError" className="text-xs text-red-400 mt-1">{custGSTINErr}</div>}
            </div>
          </div>
          <button id="amCustSave" className="btn-primary" onClick={saveCustomer}>Save Customer</button>

          <div className="table-wrap mt-4">
            <table className="tbl">
              <thead><tr><th>Name</th><th>ID (UUID)</th><th>GSTIN</th><th>Phone</th><th>Email</th><th>Rate (₹/g)</th></tr></thead>
              <tbody>
                {customers.length === 0 && <tr><td colSpan={6} className="text-center text-nexus-muted">No customers</td></tr>}
                {customers.map((c) => (
                  <tr key={c.id} id={`amCustRow-${c.id}`}>
                    <td id={`amCustNameVal-${c.id}`}>{c.name}</td>
                    <td className="font-mono text-xs select-all" id={`amCustId-${c.id}`}>{c.id}</td>
                    <td className="font-mono text-xs">{c.gstin}</td>
                    <td>{c.phone}</td>
                    <td>{c.email}</td>
                    <td id={`amCustRateVal-${c.id}`}>
                      {c.customRatePerGram !== null
                        ? `${c.customRatePerGram} (custom)`
                        : `${defaultRate.ratePerGram} (default)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Rate Management ─────────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Rate Management</h3>

          {/* Default Rate */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">Branch*</label>
              <select id="amDefaultRateBranch" className="input" value={drBranchId} onChange={(e) => setDrBranchId(e.target.value)}>
                <option value="">— select —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type*</label>
              <select id="amDefaultRateServiceType" className="input" value={drServiceTypeId} onChange={(e) => setDrServiceTypeId(e.target.value)}>
                <option value="">— select —</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Default Rate (₹ per gram)</label>
              <input id="amDefaultRate" className="input w-40" type="number" min="1" step="0.01"
                value={defaultRateInput} onChange={(e) => setDefaultRateInput(e.target.value)} />
            </div>
            <button id="amDefaultRateSave" className="btn-primary" onClick={saveDefaultRate}>Save Default Rate</button>
            <button id="amBulkApply" className="btn" onClick={bulkApplyDefaultRate}>
              Bulk-Apply to Customers Without Custom Rate
            </button>
          </div>

          {/* Backend rates register */}
          {backendRates.length > 0 && (
            <div className="table-wrap mb-4">
              <table className="tbl">
                <thead><tr><th>Branch</th><th>Service Type</th><th>Customer</th><th>Rate (₹/g)</th></tr></thead>
                <tbody>
                  {backendRates.map((r) => (
                    <tr key={r.id}>
                      <td>{r.branchCode}</td>
                      <td>{r.serviceTypeCode}</td>
                      <td>{r.customerName ?? <span className="text-nexus-muted">Default</span>}</td>
                      <td>₹{r.rate}/g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rate Request form */}
          <div className="card p-3 mb-3">
            <h4 className="text-xs font-semibold mb-2">Submit Custom Rate Request</h4>
            <div className="grid md:grid-cols-5 gap-2">
              <div>
                <label className="label">Customer</label>
                <select id="amRateReqCustomer" className="input" value={rrCustomerId}
                  onChange={(e) => setRrCustomerId(e.target.value)}>
                  <option value="">— select —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Service</label>
                <select id="amRateReqBillingService" className="input" value={rrBillingServiceCode}
                  onChange={(e) => setRrBillingServiceCode(e.target.value)}>
                  {BILLING_SERVICES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Requested Rate (₹/piece)</label>
                <input id="amRateReqRate" className="input" type="number" min="1" step="0.01"
                  value={rrRate} onChange={(e) => setRrRate(e.target.value)} />
              </div>
              <div>
                <label className="label">Requesting Branch</label>
                <select id="amRateReqBranch" className="input" value={rrBranch} onChange={(e) => setRrBranch(e.target.value)}>
                  <option value="">— select —</option>
                  <option value="BLR1">BLR1 — Bengaluru</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button id="amRateReqSubmit" className="btn-primary w-full" onClick={submitRateRequest}>Submit Request</button>
              </div>
            </div>
          </div>

          {/* Rate Requests table — Rate Approval Desk */}
          <h4 className="text-xs font-semibold mt-4 mb-2">Rate Approval Desk</h4>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Default ₹</th>
                  <th>Requested ₹</th>
                  <th>vs Default</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rateRequests.length === 0 && <tr><td colSpan={8} className="text-center text-nexus-muted">No rate requests</td></tr>}
                {rateRequests.map((r) => {
                  const svc = BILLING_SERVICES.find((s) => s.code === (r.billingServiceCode || ''));
                  const defRate = r.defaultRate || svc?.defaultRate || 0;
                  const diff = r.requestedRatePerGram - defRate;
                  const diffLabel = diff === 0 ? '=' : diff < 0 ? `↓ ₹${Math.abs(diff)} lower` : `↑ ₹${diff} higher`;
                  const diffClass = diff < 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-nexus-muted';
                  return (
                    <tr key={r.id} id={`amRateReqRow-${r.id}`}>
                      <td id={`amRateReqCust-${r.id}`}>{r.customerName}</td>
                      <td id={`amRateReqSvc-${r.id}`}>{svc?.name ?? r.billingServiceCode ?? '—'}</td>
                      <td id={`amRateReqDefault-${r.id}`}>₹{defRate}/piece</td>
                      <td id={`amRateReqRequested-${r.id}`}>₹{r.requestedRatePerGram}/piece</td>
                      <td id={`amRateReqDiff-${r.id}`} className={`text-xs ${diffClass}`}>{diffLabel}</td>
                      <td>{r.requestedBy}</td>
                      <td id={`amRateReqStatus-${r.id}`}>
                        <span className={r.status === 'APPROVED' ? 'text-green-400' : r.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}>
                          {RATE_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="flex gap-1">
                        {r.status === 'PENDING' && (
                          <>
                            <button id={`amRateApprove-${r.id}`} className="btn text-xs text-green-400"
                              onClick={() => approveRateRequest(r.id)}>Approve</button>
                            <button id={`amRateReject-${r.id}`} className="btn text-xs text-red-400"
                              onClick={() => rejectRateRequest(r.id)}>Reject</button>
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

        {/* ── Product Management ──────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Product Management</h3>

          {/* Purity Values sub-section */}
          <div className="card p-3 mb-4">
            <h4 className="text-xs font-semibold mb-2">Purity Values</h4>
            <div className="flex gap-2 mb-2">
              <input id="amPurityLabel" className="input flex-1" placeholder="e.g. 24K, 22K, 18K, Silver 925"
                value={purityLabel} onChange={(e) => setPurityLabel(e.target.value)} />
              <button id="amPurityAdd" className="btn-primary" onClick={addPurity}>Add Purity</button>
            </div>
            {purityDeleteErr && <div id="amPurityDeleteError" className="text-xs text-red-400 mb-2">{purityDeleteErr}</div>}
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Purity Label</th><th>Actions</th></tr></thead>
                <tbody>
                  {purities.length === 0 && <tr><td colSpan={2} className="text-center text-nexus-muted">No purity values</td></tr>}
                  {purities.map((p) => (
                    <tr key={p.id} id={`amPurityRow-${p.id}`}>
                      <td id={`amPurityLabel-${p.id}`}>{p.label}</td>
                      <td><button id={`amPurityDelete-${p.id}`} className="btn text-xs text-red-400"
                        onClick={() => deletePurity(p.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product form */}
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="label">Product Name*</label>
              <input id="amProdName" className="input" value={prodName} onChange={(e) => setProdName(e.target.value)} />
              {prodDupErr && <div id="amProdDupError" className="text-xs text-red-400 mt-1">{prodDupErr}</div>}
            </div>
            <div>
              <label className="label">Purity</label>
              <select id="amProdPurity" className="input" value={prodPurityId}
                onChange={(e) => setProdPurityId(e.target.value)}>
                <option value="">— none —</option>
                {purities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button id="amProdSave" className="btn-primary" onClick={addProduct}>Save Product</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Product Name</th><th>Purity</th><th>Created</th></tr></thead>
              <tbody>
                {products.length === 0 && <tr><td colSpan={3} className="text-center text-nexus-muted">No products</td></tr>}
                {products.map((p) => (
                  <tr key={p.id} id={`amProdRow-${p.id}`}>
                    <td id={`amProdNameVal-${p.id}`}>{p.name}</td>
                    <td>{purities.find((pu) => pu.id === p.purityId)?.label || '—'}</td>
                    <td className="text-xs text-nexus-muted">{p.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Branch / Centre Management ──────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Branch / Centre Management</h3>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="label">Branch Name*</label>
              <input id="amBranchName" className="input" value={branchName}
                onChange={(e) => setBranchName(e.target.value)} />
            </div>
            <div>
              <label className="label">PAN*</label>
              <input id="amBranchPAN" className="input font-mono" placeholder="e.g. AAAAA9999A"
                value={branchPAN} onChange={(e) => setBranchPAN(e.target.value)} />
              {branchPANErr && <div id="amBranchPANError" className="text-xs text-red-400 mt-1">{branchPANErr}</div>}
            </div>
            <div className="flex items-end">
              <button id="amBranchSave" className="btn-primary" onClick={saveBranch}>Save Branch</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Branch Name</th><th>PAN</th><th>Created</th></tr></thead>
              <tbody>
                {branches.length === 0 && <tr><td colSpan={3} className="text-center text-nexus-muted">No branches</td></tr>}
                {branches.map((b) => (
                  <tr key={b.id} id={`amBranchRow-${b.id}`}>
                    <td id={`amBranchNameVal-${b.id}`}>{b.name}</td>
                    <td className="font-mono text-xs">{b.pan}</td>
                    <td className="text-xs text-nexus-muted">{b.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Branch Stock Alerts ──────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Branch Stock Alerts</h3>
          <div className="grid md:grid-cols-5 gap-2 mb-3">
            <div>
              <label className="label">Product*</label>
              <select id="amStockProduct" className="input" value={saProductId}
                onChange={(e) => setSaProductId(e.target.value)}>
                <option value="">— select —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Branch*</label>
              <select id="amStockBranch" className="input" value={saBranchId}
                onChange={(e) => setSaBranchId(e.target.value)}>
                <option value="">— select —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Current Stock</label>
              <input id="amStockCurrent" className="input" type="number" min="0" step="1"
                value={saCurrentStock} onChange={(e) => setSaCurrentStock(e.target.value)} />
            </div>
            <div>
              <label className="label">Min Stock Threshold*</label>
              <input id="amStockMin" className="input" type="number" min="1" step="1"
                value={saMinStock} onChange={(e) => setSaMinStock(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button id="amStockSave" className="btn-primary w-full" onClick={saveStockAlert}>Set Alert</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Product</th><th>Branch</th><th>Current Stock</th><th>Min Threshold</th><th>Alert Status</th></tr></thead>
              <tbody>
                {stockAlerts.length === 0 && <tr><td colSpan={5} className="text-center text-nexus-muted">No stock alerts configured</td></tr>}
                {stockAlerts.map((sa) => (
                  <tr key={sa.id} id={`amStockRow-${sa.id}`}>
                    <td>{sa.productName}</td>
                    <td>{sa.branchName}</td>
                    <td>{sa.currentStock}</td>
                    <td>{sa.minimumStock}</td>
                    <td id={`amStockAlert-${sa.id}`}
                      className={sa.alertTriggered ? 'text-red-400 font-semibold' : 'text-green-400'}>
                      {sa.alertTriggered ? 'ALERT' : 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
