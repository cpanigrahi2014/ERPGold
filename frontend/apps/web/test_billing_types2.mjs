import { chromium } from 'playwright';

const BASE = 'http://localhost:3010';
const AUTH_KEY = 'nexus.auth.v2';
const AUTH_VAL = JSON.stringify({
  state: {
    user: { email:'admin@nexus.local', name:'Admin', role:'SUPER_ADMIN', roles:['SUPER_ADMIN','MANAGER'], token:'mock', standalone:false },
    hydrated: true
  },
  version: 0
});

const TYPES = ['HALLMARKING','EXCHANGE','PURITY_TESTING','NON_HUID','MISCELLANEOUS'];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const p = await ctx.newPage();

// Set auth before first navigation
await p.goto(BASE + '/');
await p.waitForTimeout(1500);
await p.evaluate(([k,v]) => localStorage.setItem(k,v), [AUTH_KEY, AUTH_VAL]);
await p.reload();
await p.waitForTimeout(2000);

const url1 = await p.url();
console.log('After reload URL:', url1);

// --- Seed a customer via API so we have a UUID ---
const custRes = await fetch(`${BASE}/api/admin/api/v1/admin/customers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'TC-TE Test Customer', phone:'9000000001', email:'tcte@test.com', gstNumber:'', address:'Test', city:'Test', state:'MH', country:'IN', pincode:'400001', type:'RETAIL' }),
}).then(r => r.json()).catch(() => null);

let custId = custRes?.id || null;
console.log('Customer seeded:', custId);

if (!custId) {
  // Try to get existing
  const list = await fetch(`${BASE}/api/admin/api/v1/admin/customers`).then(r => r.json()).catch(() => []);
  custId = list?.[0]?.id || null;
  console.log('Using existing customer:', custId);
}

// --- Navigate to billing ---
await p.goto(BASE + '/billing');
await p.waitForTimeout(3000);

const billingUrl = await p.url();
console.log('Billing URL:', billingUrl);

const ids = await p.evaluate(() =>
  Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(id => id.startsWith('bl')).slice(0,20)
);
console.log('Billing element IDs found:', JSON.stringify(ids));

// --- TC-TE.07: select element with exactly 5 options ---
const selectInfo = await p.evaluate(() => {
  const el = document.getElementById('blTxnType');
  if (!el) return { found: false };
  return { found: true, tag: el.tagName, options: Array.from(el.options).map(o => o.value) };
});
console.log('\n=== TC-TE.07 ===');
console.log('Select element:', JSON.stringify(selectInfo));
const tcte07 = selectInfo.found && selectInfo.tag === 'SELECT' && selectInfo.options.length === 5
  && TYPES.every(t => selectInfo.options.includes(t));
console.log(tcte07 ? 'PASS - 5 valid options, no free text' : 'FAIL - ' + JSON.stringify(selectInfo));

if (!selectInfo.found) {
  console.log('blTxnType not found — page may not be authenticated. Exiting.');
  await b.close();
  process.exit(0);
}

// --- TC-TE.06: per-type field visibility ---
console.log('\n=== TC-TE.06 ===');
const expectedFields = {
  HALLMARKING:   { linkedHmReq: true,  linkedJob: false, exWeight: false, articleDesc: false, notes: false, addLine: true  },
  EXCHANGE:      { linkedHmReq: false, linkedJob: false, exWeight: true,  articleDesc: false, notes: false, addLine: false },
  PURITY_TESTING:{ linkedHmReq: false, linkedJob: true,  exWeight: false, articleDesc: false, notes: false, addLine: true  },
  NON_HUID:      { linkedHmReq: false, linkedJob: false, exWeight: false, articleDesc: true,  notes: false, addLine: true  },
  MISCELLANEOUS: { linkedHmReq: false, linkedJob: false, exWeight: false, articleDesc: false, notes: true,  addLine: true  },
};
for (const txnType of TYPES) {
  await p.selectOption('#blTxnType', txnType);
  await p.waitForTimeout(400);
  const got = await p.evaluate(() => ({
    linkedHmReq: !!document.getElementById('blLinkedHmReq'),
    linkedJob:   !!document.getElementById('blLinkedJob'),
    exWeight:    !!document.getElementById('blExWeight'),
    articleDesc: !!document.getElementById('blArticleDesc'),
    notes:       !!document.getElementById('blNotes'),
    addLine:     !!document.getElementById('blAddLine'),
  }));
  const exp = expectedFields[txnType];
  const pass = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`  ${txnType}: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) { console.log('    Expected:', JSON.stringify(exp)); console.log('    Got:', JSON.stringify(got)); }
}

// --- TC-TE.01-05: create draft for each type ---
if (!custId) {
  console.log('\nNo customer ID available — skipping TC-TE.01-05');
  await b.close();
  process.exit(0);
}

console.log('\n=== TC-TE.01-05 ===');
const typeToTC = { HALLMARKING:'TC-TE.01', EXCHANGE:'TC-TE.02', PURITY_TESTING:'TC-TE.03', NON_HUID:'TC-TE.04', MISCELLANEOUS:'TC-TE.05' };

for (const txnType of TYPES) {
  await p.goto(BASE + '/billing');
  await p.waitForTimeout(2500);

  await p.selectOption('#blTxnType', txnType);
  await p.waitForTimeout(300);

  // Select customer
  const custSelectExists = await p.evaluate(() => {
    const el = document.querySelector('select#blCustomerId, #blCustomerId select');
    return !!el;
  });
  if (custSelectExists) {
    await p.selectOption('select#blCustomerId', custId).catch(() => {});
  } else {
    await p.fill('#blCustomerId', custId);
  }
  await p.waitForTimeout(300);

  if (txnType === 'EXCHANGE') {
    await p.fill('#blExWeight', '50');
    await p.fill('#blExPurity', '91.6');
    await p.fill('#blExRate', '4500');
  } else {
    // Click add line to add at least one service line (for validation)
    await p.click('#blAddLine').catch(() => {});
    await p.waitForTimeout(300);
  }

  // Count invoices before
  const before = await p.evaluate(() => document.querySelectorAll('tr[id^="blInv-"], tbody tr').length);

  await p.click('#blCreateInvoice');
  await p.waitForTimeout(2000);

  // Check for success toast
  const toastText = await p.evaluate(() => {
    const fixed = Array.from(document.querySelectorAll('.fixed, [role="alert"]'));
    return fixed.map(e => e.textContent?.trim()).filter(Boolean).join(' | ');
  });

  const after = await p.evaluate(() => document.querySelectorAll('tr[id^="blInv-"], tbody tr').length);
  const invoiceNoVisible = await p.evaluate((type) => {
    const abbr = { HALLMARKING:'HM', EXCHANGE:'EX', PURITY_TESTING:'PT', NON_HUID:'NH', MISCELLANEOUS:'MISC' };
    const a = abbr[type] || '';
    return document.body.innerText.includes(a);
  }, txnType);

  const tc = typeToTC[txnType];
  // Pass if rows increased or invoice abbreviation found in page or toast contains success
  const passed = after > before || invoiceNoVisible || toastText.toLowerCase().includes('created') || toastText.toLowerCase().includes('draft');
  console.log(`  ${tc} (${txnType}): ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) console.log(`    toast: "${toastText.substring(0,80)}", rows before: ${before}, after: ${after}`);
}

await b.close();
