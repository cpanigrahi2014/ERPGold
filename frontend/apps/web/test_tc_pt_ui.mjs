import { chromium } from 'playwright';

const ADMIN_BASE = 'http://localhost:8084/api/v1/admin';
const BILL_BASE = 'http://localhost:8091/api/v1/billing';
const WEB_BASE = 'http://localhost:3010';
const BRANCH_ID = '7c3b2c11-b0a4-4a7d-a83d-bfda1812fd80';
const TODAY = new Date().toISOString().slice(0, 10);

function uuid() {
  return crypto.randomUUID();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function contains(haystack, needle) {
  return haystack.indexOf(needle) >= 0;
}

async function createCustomer(name, gstin, bisNumber) {
  const customerNumber = `CUST-${uuid().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const res = await fetch(`${ADMIN_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerNumber,
      name,
      company: `${name} Pvt Ltd`,
      gstin,
      bisNumber,
      type: 'JEWELLER',
    }),
  });
  if (!res.ok) {
    throw new Error(`createCustomer failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function patch(url) {
  const res = await fetch(url, { method: 'PATCH' });
  if (!res.ok) {
    throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function createInvoiceFixture({ customerId, interstate, remarks, lineDesc, qty, rate, invoiceNo }) {
  const created = await postJson(`${BILL_BASE}/invoices`, {
    invoiceNumber: '',
    branchId: BRANCH_ID,
    customerId,
    invoiceDate: TODAY,
    dueDate: TODAY,
    type: 'SALE',
    interstate,
    placeOfSupply: interstate ? 'KA-OUT' : 'KA',
    remarks: JSON.stringify(remarks),
  });

  await postJson(`${BILL_BASE}/lines`, {
    invoiceId: created.id,
    lineNo: 1,
    itemDesc: lineDesc,
    grossWeight: qty,
    ratePerGram: rate,
    makingCharges: 0,
    discount: 0,
    taxRatePct: 3,
  });

  await patch(`${BILL_BASE}/invoices/${created.id}/status?status=ISSUED`);
  await patch(`${BILL_BASE}/invoices/${created.id}/status?status=PAID&invoiceNumber=${encodeURIComponent(invoiceNo)}`);

  return getJson(`${BILL_BASE}/invoices/${created.id}`);
}

async function capturePrintHtml(page, invoiceId) {
  await page.evaluate(() => {
    window.__capturedPrintHtml = '';
    window.open = () => {
      return {
        document: {
          write: (html) => {
            window.__capturedPrintHtml = String(html || '');
          },
          close: () => {},
        },
      };
    };
  });

  await page.waitForFunction((id) => {
    return !!document.getElementById(`blPrintPdf-${id}`) || !!document.getElementById(`blPrintPdfDetail-${id}`);
  }, invoiceId, { timeout: 30000 });

  let clickedByLocator = false;
  const primarySel = `#blPrintPdf-${invoiceId}`;
  const detailSel = `#blPrintPdfDetail-${invoiceId}`;

  const primaryVisible = await page.locator(primarySel).first().isVisible().catch(() => false);
  if (primaryVisible) {
    await page.locator(primarySel).first().click();
    clickedByLocator = true;
  } else {
    const detailVisible = await page.locator(detailSel).first().isVisible().catch(() => false);
    if (detailVisible) {
      await page.locator(detailSel).first().click();
      clickedByLocator = true;
    }
  }

  const clicked = clickedByLocator || await page.evaluate((id) => {
    const el = document.getElementById(`blPrintPdf-${id}`) || document.getElementById(`blPrintPdfDetail-${id}`);
    if (!el) return false;
    el.click();
    return true;
  }, invoiceId);

  if (!clicked) {
    throw new Error(`Unable to click print button for invoice ${invoiceId}`);
  }

  await page.waitForFunction(() => {
    return typeof window.__capturedPrintHtml === 'string' && window.__capturedPrintHtml.length > 0;
  }, { timeout: 7000 }).catch(() => {});

  return page.evaluate(() => window.__capturedPrintHtml || '');
}

(async () => {
  const results = [];
  const runTag = uuid().replace(/-/g, '').slice(0, 6).toUpperCase();

  const liveCustomer = await createCustomer('TCPT UI Live Customer', '29ABCDE1234F1Z5', 'BIS-TCPT-UI-001');
  const nullCustomer = await createCustomer('TCPT UI Null Customer', '', '');

  const intra = await createInvoiceFixture({
    customerId: liveCustomer.id,
    interstate: false,
    remarks: {
      bc: 'BLR1',
      tt: 'HALLMARKING',
      cid: liveCustomer.id,
      cnm: 'STALE UI NAME SHOULD NOT PRINT',
      cgp: 1.5,
      sgp: 1.5,
      igp: 0,
      cga: 15,
      sga: 15,
      iga: 0,
      sub: 1000,
    },
    lineDesc: 'HUID Marking',
    qty: 10,
    rate: 100,
    invoiceNo: `BLR1-HM-UIPT1-${runTag}`,
  });

  const inter = await createInvoiceFixture({
    customerId: liveCustomer.id,
    interstate: true,
    remarks: {
      bc: 'DEL',
      tt: 'HALLMARKING',
      cid: liveCustomer.id,
      cnm: 'STALE INTER UI NAME',
      cgp: 0,
      sgp: 0,
      igp: 3,
      cga: 0,
      sga: 0,
      iga: 24,
      sub: 800,
    },
    lineDesc: 'XRF Testing',
    qty: 4,
    rate: 200,
    invoiceNo: `DEL-HM-UIPT2-${runTag}`,
  });

  const exchange = await createInvoiceFixture({
    customerId: liveCustomer.id,
    interstate: false,
    remarks: {
      bc: 'BLR1',
      tt: 'EXCHANGE',
      cid: liveCustomer.id,
      cnm: 'EXCHANGE UI STALE',
      cgp: 0,
      sgp: 0,
      igp: 0,
      cga: 0,
      sga: 0,
      iga: 0,
      sub: 500,
      exw: 12.5,
      exp: 91.6,
      exr: 5500,
    },
    lineDesc: 'Exchange Service',
    qty: 1,
    rate: 500,
    invoiceNo: `BLR1-EX-UIPT3-${runTag}`,
  });

  const nullInv = await createInvoiceFixture({
    customerId: nullCustomer.id,
    interstate: false,
    remarks: {
      bc: 'BLR1',
      tt: 'MISCELLANEOUS',
      cid: nullCustomer.id,
      cnm: '',
      cgp: 0,
      sgp: 0,
      igp: 0,
      cga: 0,
      sga: 0,
      iga: 0,
      sub: 100,
    },
    lineDesc: 'Misc Service',
    qty: 1,
    rate: 100,
    invoiceNo: `BLR1-MS-UIPT4-${runTag}`,
  });

  await createInvoiceFixture({
    customerId: liveCustomer.id,
    interstate: false,
    remarks: {
      bc: 'BLR1',
      tt: 'HALLMARKING',
      cid: liveCustomer.id,
      cnm: 'LATER RATE UI',
      cgp: 1.5,
      sgp: 1.5,
      igp: 0,
      cga: 75,
      sga: 75,
      iga: 0,
      sub: 5000,
    },
    lineDesc: 'HUID Marking',
    qty: 1,
    rate: 5000,
    invoiceNo: `BLR1-HM-UIPT5-${runTag}`,
  });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${WEB_BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem('nexus.auth.v2', JSON.stringify({
      state: {
        user: {
          email: 'admin@nexus.local',
          name: 'Admin',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN', 'MANAGER'],
          standalone: true,
        },
        hydrated: true,
      },
      version: 0,
    }));
  });

  await page.goto(`${WEB_BASE}/billing`);
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(2500);

  const intraHtml = await capturePrintHtml(page, intra.id);
  const interHtml = await capturePrintHtml(page, inter.id);
  const exchangeHtml = await capturePrintHtml(page, exchange.id);
  const nullHtml = await capturePrintHtml(page, nullInv.id);

  const tc01 = contains(intraHtml, 'Grand Total') && contains(intraHtml, '₹1030.00');
  results.push({
    id: 'TC-PT.UI.01',
    expected: 'Print grand total equals live confirmed model',
    actual: `containsGrandTotal=${tc01}`,
    status: tc01 ? 'Pass' : 'Fail',
  });

  const tc02 = contains(intraHtml, 'CGST (1.5%)') && contains(intraHtml, 'SGST (1.5%)') && !contains(intraHtml, 'IGST (3%)');
  results.push({
    id: 'TC-PT.UI.02',
    expected: 'Intra-state print shows CGST+SGST and suppresses IGST',
    actual: `cgst=${contains(intraHtml, 'CGST (1.5%)')}, sgst=${contains(intraHtml, 'SGST (1.5%)')}, igst=${contains(intraHtml, 'IGST (3%)')}`,
    status: tc02 ? 'Pass' : 'Fail',
  });

  const tc03 = contains(interHtml, 'IGST (3%)') && !contains(interHtml, 'CGST (') && !contains(interHtml, 'SGST (');
  results.push({
    id: 'TC-PT.UI.03',
    expected: 'Inter-state print shows IGST and suppresses CGST+SGST',
    actual: `igst=${contains(interHtml, 'IGST (3%)')}, cgst=${contains(interHtml, 'CGST (')}, sgst=${contains(interHtml, 'SGST (')}`,
    status: tc03 ? 'Pass' : 'Fail',
  });

  const tc04 = contains(intraHtml, '₹1030.00') && !contains(intraHtml, '₹5150.00');
  results.push({
    id: 'TC-PT.UI.04',
    expected: 'Locked historical invoice print is unchanged after later rate changes',
    actual: `oldTotal=${contains(intraHtml, '₹1030.00')}, leakedNew=${contains(intraHtml, '₹5150.00')}`,
    status: tc04 ? 'Pass' : 'Fail',
  });

  const tc05 = contains(exchangeHtml, 'Grand Total') && contains(exchangeHtml, '₹0.00') && contains(exchangeHtml, 'Old Gold: 12.5 g') && contains(exchangeHtml, 'Purity/Fineness: 91.6%');
  results.push({
    id: 'TC-PT.UI.05',
    expected: 'Exchange print shows grand total 0 and gold/fineness details',
    actual: `grand0=${contains(exchangeHtml, '₹0.00')}, exw=${contains(exchangeHtml, 'Old Gold: 12.5 g')}, exp=${contains(exchangeHtml, 'Purity/Fineness: 91.6%')}`,
    status: tc05 ? 'Pass' : 'Fail',
  });

  const tc06 = contains(nullHtml, 'GSTIN: N/A') && contains(nullHtml, 'BIS: N/A') && contains(nullHtml, 'TCPT UI Null Customer');
  results.push({
    id: 'TC-PT.UI.06',
    expected: 'Null fields render safely as N/A while customer name remains available',
    actual: `gstinNA=${contains(nullHtml, 'GSTIN: N/A')}, bisNA=${contains(nullHtml, 'BIS: N/A')}, hasName=${contains(nullHtml, 'TCPT UI Null Customer')}`,
    status: tc06 ? 'Pass' : 'Fail',
  });

  const tc07 = !contains(intraHtml, 'STALE UI NAME SHOULD NOT PRINT') && contains(intraHtml, 'TCPT UI Live Customer') && contains(intraHtml, 'GSTIN: 29ABCDE1234F1Z5') && contains(intraHtml, 'BIS: BIS-TCPT-UI-001');
  results.push({
    id: 'TC-PT.UI.07',
    expected: 'Print customer identity is sourced from live customer model, not stale remarks',
    actual: `staleAbsent=${!contains(intraHtml, 'STALE UI NAME SHOULD NOT PRINT')}, liveName=${contains(intraHtml, 'TCPT UI Live Customer')}, gst=${contains(intraHtml, 'GSTIN: 29ABCDE1234F1Z5')}, bis=${contains(intraHtml, 'BIS: BIS-TCPT-UI-001')}`,
    status: tc07 ? 'Pass' : 'Fail',
  });

  await browser.close();

  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
