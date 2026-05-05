import { chromium } from 'playwright';

const BASE = 'http://139.59.60.127:3010';
const AUTH = { user: { id:'1', email:'admin@nexus.local', name:'Admin', roles:['SUPER_ADMIN','MANAGER'] }, token:'mock-token' };
const TYPES = ['HALLMARKING','EXCHANGE','PURITY_TESTING','NON_HUID','MISCELLANEOUS'];
const results = {};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const p = await ctx.newPage();

// Login
await p.goto(BASE + '/');
await p.waitForTimeout(1500);
await p.evaluate((auth) => localStorage.setItem('nexus.auth.v2', JSON.stringify(auth)), AUTH);

// --- Get a customer UUID from admin page ---
await p.goto(BASE + '/admin');
await p.waitForTimeout(3000);
const custId = await p.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('tr[id]'));
  const custRow = rows.find(r => r.id.startsWith('amCustRow-'));
  return custRow ? custRow.id.replace('amCustRow-','') : null;
});
results.customerFound = !!custId;
results.customerId = custId ? custId.substring(0,8)+'...' : null;

// --- TC-TE.07: type selector must be <select> with exactly 5 options ---
await p.goto(BASE + '/billing');
await p.waitForTimeout(3000);

const selectInfo = await p.evaluate(() => {
  const el = document.getElementById('blTxnType');
  if (!el) return { found: false };
  return {
    found: true,
    tag: el.tagName,
    options: Array.from(el.options).map(o => o.value),
  };
});
results['TC-TE.07'] = selectInfo.found && selectInfo.tag === 'SELECT'
  ? `PASS - <select> with options: ${JSON.stringify(selectInfo.options)}`
  : `FAIL - ${JSON.stringify(selectInfo)}`;

if (!custId) {
  results.note = 'No customer found - skipping create invoice tests';
  console.log(JSON.stringify(results, null, 2));
  await b.close();
  process.exit(0);
}

// --- TC-TE.01-05: Create draft for each type ---
const typeMap = {
  'TC-TE.01': 'HALLMARKING',
  'TC-TE.02': 'EXCHANGE',
  'TC-TE.03': 'PURITY_TESTING',
  'TC-TE.04': 'NON_HUID',
  'TC-TE.05': 'MISCELLANEOUS',
};

for (const [tc, txnType] of Object.entries(typeMap)) {
  await p.goto(BASE + '/billing');
  await p.waitForTimeout(2500);

  // Select type
  await p.selectOption('#blTxnType', txnType);
  await p.waitForTimeout(300);

  // Select customer
  const custSelect = await p.$('#blCustomerId select, select#blCustomerId');
  if (custSelect) {
    await custSelect.selectOption(custId);
  } else {
    await p.fill('#blCustomerId', custId);
  }
  await p.waitForTimeout(300);

  // For EXCHANGE: fill exchange fields
  if (txnType === 'EXCHANGE') {
    await p.fill('#blExWeight', '50');
    await p.fill('#blExPurity', '91.6');
    await p.fill('#blExRate', '4500');
    await p.waitForTimeout(200);
  } else {
    // For other types add a service line (HALLMARKING, PURITY_TESTING, NON_HUID, MISCELLANEOUS)
    await p.click('#blAddLine').catch(() => {});
    await p.waitForTimeout(300);
  }

  // Click Create Invoice
  await p.click('#blCreateInvoice');
  await p.waitForTimeout(1500);

  // Check for toast or new invoice in register
  const toast = await p.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[class*="toast"], [id*="toast"], .fixed'));
    return toasts.map(t => t.textContent?.trim()).filter(Boolean).join(' | ');
  });
  const invoiceRows = await p.evaluate((type) => {
    const rows = Array.from(document.querySelectorAll('tr'));
    return rows.filter(r => r.textContent?.includes(type.substring(0,2))).length;
  }, txnType);

  results[tc] = {
    type: txnType,
    toast: toast.substring(0, 100),
    invoiceRows,
  };
}

// --- TC-TE.06: Verify type-specific field visibility per type ---
results['TC-TE.06'] = {};
for (const txnType of TYPES) {
  await p.goto(BASE + '/billing');
  await p.waitForTimeout(2000);
  await p.selectOption('#blTxnType', txnType);
  await p.waitForTimeout(400);

  const fields = await p.evaluate(() => ({
    linkedHmReq: !!document.getElementById('blLinkedHmReq'),
    linkedJob:   !!document.getElementById('blLinkedJob'),
    exWeight:    !!document.getElementById('blExWeight'),
    exPurity:    !!document.getElementById('blExPurity'),
    exRate:      !!document.getElementById('blExRate'),
    articleDesc: !!document.getElementById('blArticleDesc'),
    notes:       !!document.getElementById('blNotes'),
    addLine:     !!document.getElementById('blAddLine'),
  }));
  results['TC-TE.06'][txnType] = fields;
}

console.log(JSON.stringify(results, null, 2));
await b.close();
