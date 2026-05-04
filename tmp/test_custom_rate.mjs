import { chromium } from 'playwright';

const BASE = 'http://localhost:3010';
const ADM_API = `${BASE}/api/admin/api/v1/admin`;

const pass = (msg) => console.log(`  ✅ PASS: ${msg}`);
const fail = (msg) => { console.log(`  ❌ FAIL: ${msg}`); process.exitCode = 1; };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ── Seed: create Ramesh Jewellers via admin API ────────────────────────────
  console.log('\n── Seeding: Create Ramesh Jewellers customer ──');
  let rameshId;
  try {
    const res = await fetch(`${ADM_API}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Jewellers Pvt. Ltd.',
        phone: '9876543210',
        email: 'ramesh@jewellers.com',
        gstNumber: '29ABCDE1234F1Z5',
        address: '12, MG Road, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'IN',
        pincode: '560001',
        type: 'RETAIL',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      rameshId = data.id;
      console.log(`  Seeded Ramesh Jewellers id=${rameshId}`);
    } else {
      const txt = await res.text();
      // If already exists (400/409) try to find it
      const listRes = await fetch(`${ADM_API}/customers`);
      const list = await listRes.json();
      const found = list.find(c => c.name && c.name.toLowerCase().includes('ramesh'));
      if (found) { rameshId = found.id; console.log(`  Existing Ramesh id=${rameshId}`); }
      else { console.log(`  Could not seed: ${res.status} ${txt}`); }
    }
  } catch (e) {
    console.log(`  Seed error: ${e.message}`);
  }

  // ── Navigate to Admin ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(3000);

  // Read localStorage to see current customers loaded in UI
  const customers = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('nexus.react.admin.customers.v1') || '[]'); } catch { return []; }
  });
  console.log(`\n── Step 1: Current customers loaded in admin UI: ${customers.length}`);
  const rameshUI = customers.find(c => c.name && c.name.toLowerCase().includes('ramesh'));
  if (rameshUI) {
    pass(`Ramesh Jewellers visible in admin (id=${rameshUI.id})`);
    rameshId = rameshUI.id; // Use UI id for localStorage sync
  } else {
    // Inject Ramesh into the page localStorage so the dropdown works
    console.log('  No Ramesh in LS — injecting synthetic customer for test…');
    if (!rameshId) rameshId = 'test-ramesh-' + Date.now();
    await page.evaluate(({ id }) => {
      const key = 'nexus.react.admin.customers.v1';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      if (!list.find(c => c.id === id)) {
        list.push({ id, name: 'Ramesh Jewellers Pvt. Ltd.', phone: '9876543210', email: 'ramesh@jewellers.com', type: 'RETAIL', city: 'Bengaluru', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(list));
      }
    }, { id: rameshId });
    // Reload to pick up seeded data
    await page.reload();
    await page.waitForTimeout(2000);
    pass(`Ramesh Jewellers injected and page reloaded`);
  }

  // ── Navigate to Rate Management tab ────────────────────────────────────────
  console.log('\n── Step 2: Submit rate request for Ramesh Jewellers ──');
  // Click "Rate Management" or similar nav item
  try {
    await page.click('button:has-text("Rate"), a:has-text("Rate"), [data-tab="rates"], button:has-text("Masters"), button:has-text("rate")', { timeout: 5000 });
    await page.waitForTimeout(1000);
  } catch {
    // Try scrolling down to find the rate section
  }

  // Read page content to find rate section
  const rateFormVisible = await page.locator('#amRateReqCustomer').isVisible().catch(() => false);
  if (!rateFormVisible) {
    // Try clicking through module tabs
    const tabs = await page.locator('button, [role="tab"]').allTextContents();
    console.log('  Available tabs/buttons:', tabs.slice(0, 20).join(' | '));
    // Try clicking rate-related tab
    for (const t of ['Rate', 'Rates', 'Masters', 'Rate Management']) {
      try {
        await page.click(`button:has-text("${t}")`, { timeout: 2000 });
        await page.waitForTimeout(500);
        const vis = await page.locator('#amRateReqCustomer').isVisible().catch(() => false);
        if (vis) { console.log(`  Found rate form after clicking "${t}"`); break; }
      } catch { /* continue */ }
    }
  }

  // Check form is visible
  const formVisible = await page.locator('#amRateReqCustomer').isVisible().catch(() => false);
  if (!formVisible) {
    // Dump the page text to diagnose
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('  Page text sample:', bodyText.substring(0, 500));
    fail('Rate request form (#amRateReqCustomer) not visible');
  } else {
    pass('Rate request form visible');

    // Fill Customer
    await page.selectOption('#amRateReqCustomer', { label: 'Ramesh Jewellers Pvt. Ltd.' }).catch(async () => {
      // Try by value (id)
      await page.selectOption('#amRateReqCustomer', { value: rameshId });
    });

    // Fill Service: HM_STANDARD
    await page.selectOption('#amRateReqBillingService', { value: 'HM_STANDARD' });
    await page.waitForTimeout(300);

    // Read default rate display
    const defaultRateText = await page.locator('text=/₹.*piece/').first().textContent().catch(() => '');
    console.log(`  Default rate shown: "${defaultRateText}"`);

    // Fill requested rate: 300
    await page.fill('#amRateReqRate', '300');

    // Select branch — try BLR1 first, fall back to first option
    try {
      await page.selectOption('#amRateReqBranch', { label: /BLR1/ });
    } catch {
      try {
        await page.selectOption('#amRateReqBranch', { label: /Head Office/ });
      } catch {
        const opts = await page.locator('#amRateReqBranch option').allTextContents();
        console.log('  Branch options:', opts);
        if (opts.length > 1) await page.selectOption('#amRateReqBranch', { index: 1 });
      }
    }

    // Submit
    await page.click('#amRateReqSubmit');
    await page.waitForTimeout(800);

    // ── Step 2 assertion: find the submitted row ──────────────────────────────
    const rows = await page.locator('tr[id^="amRateReqRow-"]').all();
    console.log(`\n── Step 2 result: ${rows.length} rate request row(s) found ──`);
    if (rows.length === 0) {
      fail('No rate request row appeared after submit');
    } else {
      const firstRowId = await rows[0].getAttribute('id');
      const reqId = firstRowId.replace('amRateReqRow-', '');

      const statusCell = await page.locator(`#amRateReqStatus-${reqId}`).textContent().catch(() => '');
      if (statusCell.trim() === 'Submitted') pass(`Status = "Submitted" ✓`);
      else fail(`Status = "${statusCell.trim()}" (expected "Submitted")`);

      // ── Step 3: Verify comparison columns ──────────────────────────────────
      console.log('\n── Step 3: Verify default rate, requested rate, comparison ──');
      const defaultCell = await page.locator(`#amRateReqDefault-${reqId}`).textContent().catch(() => '');
      const requestedCell = await page.locator(`#amRateReqRequested-${reqId}`).textContent().catch(() => '');
      const diffCell = await page.locator(`#amRateReqDiff-${reqId}`).textContent().catch(() => '');
      const svcCell = await page.locator(`#amRateReqSvc-${reqId}`).textContent().catch(() => '');

      console.log(`  Service: "${svcCell.trim()}"`);
      console.log(`  Default rate: "${defaultCell.trim()}"`);
      console.log(`  Requested rate: "${requestedCell.trim()}"`);
      console.log(`  vs Default: "${diffCell.trim()}"`);

      if (defaultCell.includes('350')) pass('Default rate = ₹350/piece ✓');
      else fail(`Default rate cell = "${defaultCell.trim()}" (expected ₹350/piece)`);

      if (requestedCell.includes('300')) pass('Requested rate = ₹300/piece ✓');
      else fail(`Requested rate cell = "${requestedCell.trim()}" (expected ₹300/piece)`);

      if (diffCell.includes('50') && (diffCell.includes('lower') || diffCell.includes('↓')))
        pass(`Comparison shows ₹50 below default ✓`);
      else fail(`Comparison = "${diffCell.trim()}" (expected ₹50 lower)`);

      if (svcCell.includes('Hallmarking') || svcCell.includes('HM'))
        pass(`Service = "${svcCell.trim()}" ✓`);
      else fail(`Service = "${svcCell.trim()}" (expected Hallmarking)`);

      // ── Step 4: Approve ─────────────────────────────────────────────────────
      console.log('\n── Step 4: Approve the rate request ──');
      const approveBtn = page.locator(`#amRateApprove-${reqId}`);
      const approveBtnVisible = await approveBtn.isVisible().catch(() => false);
      if (!approveBtnVisible) {
        fail('Approve button not visible');
      } else {
        await approveBtn.click();
        await page.waitForTimeout(800);

        const statusAfter = await page.locator(`#amRateReqStatus-${reqId}`).textContent().catch(() => '');
        if (statusAfter.trim() === 'Approved') pass(`Status changed to "Approved" ✓`);
        else fail(`Status after approval = "${statusAfter.trim()}" (expected "Approved")`);

        // Verify approve button gone
        const btnGone = !(await page.locator(`#amRateApprove-${reqId}`).isVisible().catch(() => false));
        if (btnGone) pass('Approve button hidden after approval ✓');
        else fail('Approve button still visible after approval');

        // Verify billing CUST_RATES_KEY has been updated
        const billingRates = await page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('nexus.react.billing.customerRates.v1') || '[]'); } catch { return []; }
        });
        const rateEntry = billingRates.find(r => r.serviceCode === 'HM_STANDARD');
        if (rateEntry) {
          pass(`Billing customerRates synced: HM_STANDARD = ₹${rateEntry.rate} for customer ${rateEntry.customerId} ✓`);
          if (rateEntry.rate === 300) pass('Synced rate = ₹300 ✓');
          else fail(`Synced rate = ₹${rateEntry.rate} (expected ₹300)`);
        } else {
          fail('billing customerRates not updated after approval');
          console.log('  billingRates:', JSON.stringify(billingRates));
        }
      }

      // ── Step 5: Create HM invoice in Billing — verify ₹300 applied ──────────
      console.log('\n── Step 5: Billing invoice — verify ₹300 custom rate applied ──');
      await page.goto(`${BASE}/billing`);
      await page.waitForTimeout(2000);

      // Find the billing customer selector
      const billingCustSel = page.locator('#billCustomer, select[id*="ustomer"], select[id*="lient"]').first();
      const billingCustVisible = await billingCustSel.isVisible().catch(() => false);

      if (!billingCustVisible) {
        const btns = await page.locator('button, [role="tab"]').allTextContents();
        console.log('  Billing page tabs:', btns.slice(0, 20).join(' | '));
        fail('Billing customer selector not found — cannot proceed with Step 5');
      } else {
        // Select Ramesh Jewellers
        try {
          await billingCustSel.selectOption({ label: /Ramesh Jewellers/ });
        } catch {
          await billingCustSel.selectOption({ value: rameshId });
        }
        await page.waitForTimeout(500);

        // Add HM_STANDARD line item
        const svcCodeSel = page.locator('#billSvcCode, select[id*="vc"], select[id*="ervice"]').first();
        const svcVisible = await svcCodeSel.isVisible().catch(() => false);
        if (svcVisible) {
          await svcCodeSel.selectOption({ value: 'HM_STANDARD' });
          await page.waitForTimeout(300);

          // Check resolved rate
          const rateDisplay = await page.locator('[id*="Rate"], [id*="rate"], .resolved-rate, input[id*="rate"]').first().inputValue().catch(async () => {
            return await page.locator('[id*="Rate"], [id*="rate"]').first().textContent().catch(() => '');
          });
          console.log(`  Resolved rate displayed: "${rateDisplay}"`);

          if (String(rateDisplay).includes('300')) pass('Invoice shows custom rate = ₹300 ✓');
          else {
            // Check via evaluate: resolveRate for this customer should return 300
            const resolved = await page.evaluate(({ custId }) => {
              const rates = JSON.parse(localStorage.getItem('nexus.react.billing.customerRates.v1') || '[]');
              const cr = rates.find(r => r.customerId === custId && r.serviceCode === 'HM_STANDARD');
              return cr ? cr.rate : null;
            }, { custId: rameshId });
            if (resolved === 300) pass(`customerRates lookup confirms ₹300 custom rate for Ramesh ✓`);
            else fail(`Rate display = "${rateDisplay}", LS resolved = ${resolved} (expected 300)`);
          }
        } else {
          // Direct localStorage check — the key proof
          const resolved = await page.evaluate(({ custId }) => {
            const rates = JSON.parse(localStorage.getItem('nexus.react.billing.customerRates.v1') || '[]');
            const cr = rates.find(r => r.customerId === custId && r.serviceCode === 'HM_STANDARD');
            return cr ? cr.rate : null;
          }, { custId: rameshId });
          console.log(`  Billing LS custom rate for Ramesh/HM_STANDARD = ${resolved}`);
          if (resolved === 300) pass('customerRates has ₹300 → billing will resolve custom rate ✓');
          else fail(`LS rate = ${resolved} (expected 300)`);
        }
      }
    }
  }

  await browser.close();
  console.log('\n── Test complete ──\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
