import { chromium } from 'playwright';

const BASE = 'http://139.59.60.127:3010';
const AUTH = { state: { user: { email:'admin@nexus.local', name:'Admin', role:'SUPER_ADMIN', roles:['SUPER_ADMIN','MANAGER'], token:'mock-token', standalone:false }, hydrated: true }, version: 0 };

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const p = await ctx.newPage();

// Set auth first, then navigate
await p.goto(BASE + '/');
await p.waitForTimeout(2000);
await p.evaluate((auth) => localStorage.setItem('nexus.auth.v2', JSON.stringify(auth)), AUTH);
await p.waitForTimeout(500);

// Check admin page
await p.goto(BASE + '/admin');
await p.waitForTimeout(4000);

const adminHtml = await p.evaluate(() => {
  return { 
    url: location.href, 
    title: document.title,
    bodyText: document.body.innerText.substring(0, 300),
    allIds: Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(id => id.includes('Cust') || id.includes('amCust')).slice(0, 20),
  };
});
console.log('Admin page:', JSON.stringify(adminHtml, null, 2));

// Check billing page
await p.goto(BASE + '/billing');
await p.waitForTimeout(4000);

const billingHtml = await p.evaluate(() => {
  return {
    url: location.href,
    title: document.title,
    bodyText: document.body.innerText.substring(0, 300),
    allIds: Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(id => id.includes('bl') || id.includes('Billing')).slice(0, 30),
  };
});
console.log('Billing page:', JSON.stringify(billingHtml, null, 2));

await b.close();
