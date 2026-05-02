import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Stat } from '@/components/Bits';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Recipient = {
  id: string;
  name: string;
  email: string;
  telegramChatId: string;
  createdAt: string;
};

type NotificationRule = {
  id: string;
  activity: string;
  triggerValue: string;
  recipientIds: string[];
  useCustomMessage: boolean;
  customMessage: string;
  createdAt: string;
};

// Backend channel enum: EMAIL | SMS | WEBHOOK | IN_APP
// Frontend display channel: EMAIL | TELEGRAM | NONE
type FrontendChannel = 'EMAIL' | 'TELEGRAM' | 'NONE';
type BackendChannel = 'EMAIL' | 'SMS' | 'WEBHOOK' | 'IN_APP';
type NotifStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

type NotificationLog = {
  id: string;
  ruleId: string;
  activity: string;
  triggerValue: string;
  recipientId: string;
  recipientName: string;
  channel: FrontendChannel;
  toAddress: string;
  message: string;
  firedAt: string;
  status?: NotifStatus;  // from backend
};

type NotifTemplate = {
  id?: string;
  code: string;
  name: string;
  channel: BackendChannel;
  subjectTpl: string;
  bodyTpl: string;
  active: boolean;
  description: string;
};

// ── Channel translation ───────────────────────────────────────────────────────
function toBackendChannel(ch: FrontendChannel): BackendChannel {
  if (ch === 'EMAIL') return 'EMAIL';
  if (ch === 'TELEGRAM') return 'SMS';
  return 'IN_APP';
}

function fromBackendChannel(ch: string): FrontendChannel {
  if (ch === 'EMAIL') return 'EMAIL';
  if (ch === 'SMS') return 'TELEGRAM';
  return 'NONE';
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const RECIP_KEY = 'nexus.react.notifications.recipients.v1';
const RULE_KEY  = 'nexus.react.notifications.rules.v1';
const LOG_KEY   = 'nexus.react.notifications.log.v1';
const NOTIF_BASE = '/api/notifications/api/v1/notifications';
const TMPL_KEY  = 'nexus.react.notifications.templates.v1';

// ── Activities → available trigger states ─────────────────────────────────────
const ACTIVITIES: Record<string, string[]> = {
  'Delivery Received':  ['Received', 'Pending', 'Failed'],
  'HM Request':         ['XRF Completed', 'Fire Assay Completed', 'Sampling', 'Approved', 'Rejected'],
  'Inventory Update':   ['Stock Added', 'Stock Removed', 'Alert Triggered'],
  'Exchange Order':     ['Created', 'Completed', 'Cancelled'],
  'Laser Marking':      ['Job Started', 'Job Completed'],
};
const ACTIVITY_NAMES = Object.keys(ACTIVITIES);

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}
function now() { return new Date().toISOString(); }
function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
function persist<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function buildMessage(
  useCustom: boolean,
  customMsg: string,
  activity: string,
  triggerValue: string,
  customer: string,
  orderId: string,
): string {
  if (useCustom && customMsg.trim()) {
    return customMsg
      .replace(/\{\{Customer\}\}/g, customer || 'N/A')
      .replace(/\{\{OrderID\}\}/g, orderId || 'N/A')
      .replace(/\{\{Status\}\}/g, triggerValue || 'N/A');
  }
  return `Activity: ${activity} | Order: ${orderId || 'N/A'} | Customer: ${customer || 'N/A'} | Status: ${triggerValue}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsDesk() {
  // ── Recipients ──────────────────────────────────────────────────────────────
  const [recipients, setRecipients] = useState<Recipient[]>(() => read<Recipient[]>(RECIP_KEY, []));
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rTelegram, setRTelegram] = useState('');
  const [rEmailErr, setREmailErr] = useState('');

  // ── Rules ───────────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<NotificationRule[]>(() => read<NotificationRule[]>(RULE_KEY, []));
  const [ruleActivity, setRuleActivity] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('');
  const [ruleRecipIds, setRuleRecipIds] = useState<string[]>([]);
  const [ruleUseCustom, setRuleUseCustom] = useState(false);
  const [ruleCustomMsg, setRuleCustomMsg] = useState('');

  // ── Log ─────────────────────────────────────────────────────────────────────
  const [log, setLog] = useState<NotificationLog[]>(() => read<NotificationLog[]>(LOG_KEY, []));
  const [logStatusFilter, setLogStatusFilter] = useState<NotifStatus | ''>('');

  // ── Templates ───────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<NotifTemplate[]>(() => read<NotifTemplate[]>(TMPL_KEY, []));
  const [tmplCode, setTmplCode] = useState('');
  const [tmplName, setTmplName] = useState('');
  const [tmplChannel, setTmplChannel] = useState<BackendChannel>('EMAIL');
  const [tmplSubject, setTmplSubject] = useState('');
  const [tmplBody, setTmplBody] = useState('');
  const [tmplDesc, setTmplDesc] = useState('');
  const [tmplActive, setTmplActive] = useState(true);

  // Load notification log from backend on mount
  useEffect(() => {
    api<any[]>(NOTIF_BASE)
      .then(data => {
        // Backend fields: id, channel, recipient, recipientName, body,
        //   sourceModule, sourceRef, status, createdAt
        const beLog: NotificationLog[] = data.map(n => ({
          id: n.id,
          ruleId: n.sourceRef || '',
          activity: n.sourceModule || '',
          triggerValue: n.sourceRef || '',
          recipientId: '',
          recipientName: n.recipientName || n.recipient || '',
          channel: fromBackendChannel(n.channel),
          toAddress: n.recipient || '',
          message: n.body || '',
          firedAt: n.createdAt || new Date().toISOString(),
          status: n.status as NotifStatus | undefined,
        }));
        setLog(prev => {
          const beIds = new Set(beLog.map(l => l.id));
          const localOnly = prev.filter(l => !beIds.has(l.id));
          const merged = [...beLog, ...localOnly];
          persist(LOG_KEY, merged);
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Load templates from backend on mount
  useEffect(() => {
    api<any[]>(`${NOTIF_BASE}/templates`)
      .then(data => {
        const beTemplates: NotifTemplate[] = data.map(t => ({
          id: t.id, code: t.code, name: t.name,
          channel: t.channel as BackendChannel,
          subjectTpl: t.subjectTpl || '', bodyTpl: t.bodyTpl || '',
          active: t.active !== false, description: t.description || '',
        }));
        setTemplates(beTemplates);
        persist(TMPL_KEY, beTemplates);
      })
      .catch(() => {});
  }, []);

  // ── Event simulator ─────────────────────────────────────────────────────────
  const [simActivity, setSimActivity] = useState('');
  const [simState, setSimState] = useState('');
  const [simCustomer, setSimCustomer] = useState('');
  const [simOrderId, setSimOrderId] = useState('');

  const availableTriggers = useMemo(() =>
    ruleActivity ? ACTIVITIES[ruleActivity] ?? [] : [],
  [ruleActivity]);

  const simAvailableStates = useMemo(() =>
    simActivity ? ACTIVITIES[simActivity] ?? [] : [],
  [simActivity]);

  const stats = useMemo(() => ({
    recipients: recipients.length,
    rules: rules.length,
    dispatched: log.length,
    sent: log.filter((l) => l.status === 'SENT').length,
  }), [recipients, rules, log]);

  const visibleLog = useMemo(() =>
    logStatusFilter
      ? log.filter(l => l.status === logStatusFilter)
      : log,
  [log, logStatusFilter]);

  // ── Recipient helpers ───────────────────────────────────────────────────────
  function saveRecips(next: Recipient[]) { setRecipients(next); persist(RECIP_KEY, next); }

  function addRecipient() {
    setREmailErr('');
    if (!rName.trim()) { toast.err('Recipient name is required'); return; }
    if (rEmail.trim() && !isValidEmail(rEmail.trim())) {
      const msg = 'Validation error: invalid email format.';
      setREmailErr(msg); toast.err(msg); return;
    }
    const recip: Recipient = {
      id: uuid(), name: rName.trim(),
      email: rEmail.trim(), telegramChatId: rTelegram.trim(),
      createdAt: now(),
    };
    saveRecips([recip, ...recipients]);
    toast.ok('Recipient added');
    setRName(''); setREmail(''); setRTelegram('');
  }

  function deleteRecipient(id: string) {
    if (rules.some((r) => r.recipientIds.includes(id))) {
      toast.err('Cannot delete: recipient is used by existing rules');
      return;
    }
    saveRecips(recipients.filter((r) => r.id !== id));
    toast.ok('Recipient removed');
  }

  // ── Rule helpers ────────────────────────────────────────────────────────────
  function saveRulesList(next: NotificationRule[]) { setRules(next); persist(RULE_KEY, next); }

  function toggleRuleRecip(id: string) {
    setRuleRecipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function saveRule() {
    if (!ruleActivity) { toast.err('Select an activity'); return; }
    if (!ruleTrigger) { toast.err('Select a trigger value'); return; }
    if (ruleRecipIds.length === 0) { toast.err('Add at least one recipient to the rule'); return; }
    const rule: NotificationRule = {
      id: uuid(),
      activity: ruleActivity,
      triggerValue: ruleTrigger,
      recipientIds: ruleRecipIds,
      useCustomMessage: ruleUseCustom,
      customMessage: ruleCustomMsg.trim(),
      createdAt: now(),
    };
    saveRulesList([rule, ...rules]);
    toast.ok('Notification rule saved');
    setRuleActivity(''); setRuleTrigger(''); setRuleRecipIds([]);
    setRuleUseCustom(false); setRuleCustomMsg('');
  }

  function deleteRule(id: string) {
    saveRulesList(rules.filter((r) => r.id !== id));
    toast.ok('Rule deleted');
  }

  // ── Template helpers ─────────────────────────────────────────────────────────
  async function saveTemplate() {
    if (!tmplCode.trim()) { toast.err('Template code is required'); return; }
    if (!tmplName.trim()) { toast.err('Template name is required'); return; }
    if (!tmplBody.trim()) { toast.err('Body template is required'); return; }
    try {
      const saved = await api<any>(`${NOTIF_BASE}/templates`, {
        method: 'POST',
        body: JSON.stringify({
          code: tmplCode.trim(), name: tmplName.trim(),
          channel: tmplChannel,
          subjectTpl: tmplSubject.trim() || null,
          bodyTpl: tmplBody.trim(),
          active: tmplActive,
          description: tmplDesc.trim() || null,
        }),
      });
      const mapped: NotifTemplate = {
        id: saved.id, code: saved.code, name: saved.name,
        channel: saved.channel, subjectTpl: saved.subjectTpl || '',
        bodyTpl: saved.bodyTpl, active: saved.active !== false,
        description: saved.description || '',
      };
      setTemplates(prev => {
        const withoutOld = prev.filter(t => t.code !== mapped.code);
        const next = [mapped, ...withoutOld];
        persist(TMPL_KEY, next);
        return next;
      });
      toast.ok(`Template "${mapped.code}" saved`);
      setTmplCode(''); setTmplName(''); setTmplSubject(''); setTmplBody(''); setTmplDesc(''); setTmplActive(true);
    } catch (e: any) {
      toast.err(e.message || 'Failed to save template');
    }
  }

  // ── Retry / Cancel log entries ────────────────────────────────────────────
  async function retryNotification(id: string) {
    try {
      const updated = await api<any>(`${NOTIF_BASE}/${id}/retry`, { method: 'POST' });
      setLog(prev => prev.map(l => l.id === id
        ? { ...l, status: updated.status as NotifStatus }
        : l));
      toast.ok('Retry queued');
    } catch (e: any) {
      toast.err(e.message || 'Retry failed');
    }
  }

  async function cancelNotification(id: string) {
    try {
      const updated = await api<any>(`${NOTIF_BASE}/${id}/cancel`, { method: 'POST' });
      setLog(prev => prev.map(l => l.id === id
        ? { ...l, status: updated.status as NotifStatus }
        : l));
      toast.ok('Notification cancelled');
    } catch (e: any) {
      toast.err(e.message || 'Cancel failed');
    }
  }

  // ── Fire event (simulator) ──────────────────────────────────────────────────
  function fireEvent() {
    if (!simActivity) { toast.err('Select an activity'); return; }
    if (!simState) { toast.err('Select a state'); return; }

    const matchingRules = rules.filter(
      (r) => r.activity === simActivity && r.triggerValue === simState,
    );

    if (matchingRules.length === 0) {
      toast.ok('No matching rules — no notifications sent');
      return;
    }

    const newEntries: NotificationLog[] = [];
    for (const rule of matchingRules) {
      for (const recipId of rule.recipientIds) {
        const recip = recipients.find((r) => r.id === recipId);
        if (!recip) continue;

        const channel: FrontendChannel =
          recip.email ? 'EMAIL' : recip.telegramChatId ? 'TELEGRAM' : 'NONE';
        const toAddress =
          channel === 'EMAIL' ? recip.email :
          channel === 'TELEGRAM' ? recip.telegramChatId : '';

        const message = buildMessage(
          rule.useCustomMessage, rule.customMessage,
          simActivity, simState, simCustomer, simOrderId,
        );

        newEntries.push({
          id: uuid(),
          ruleId: rule.id,
          activity: simActivity,
          triggerValue: simState,
          recipientId: recipId,
          recipientName: recip.name,
          channel,
          toAddress,
          message,
          firedAt: now(),
          status: 'PENDING',
        });
      }
    }

    const nextLog = [...newEntries, ...log];
    setLog(nextLog);
    persist(LOG_KEY, nextLog);

    // Fire to backend API (corrected payload)
    for (const entry of newEntries) {
      api<any>(`${NOTIF_BASE}/send`, {
        method: 'POST',
        body: JSON.stringify({
          channel: toBackendChannel(entry.channel),
          recipient: entry.toAddress || entry.recipientName,
          recipientName: entry.recipientName,
          body: entry.message,
          sourceModule: entry.activity,
          sourceRef: entry.triggerValue,
        }),
      })
        .then(saved => {
          // Update log entry id + status from backend response
          setLog(prev => prev.map(l =>
            l.id === entry.id
              ? { ...l, id: saved.id, status: saved.status as NotifStatus }
              : l,
          ));
        })
        .catch(() => {});
    }
    toast.ok(`${newEntries.length} notification(s) dispatched`);
  }

  return (
    <div>
      <PageHeader
        title="Notifications Desk"
        subtitle="Rules · Recipients · Templates · Dispatch Log"
      />

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Stat label="Recipients" value={stats.recipients} accent="bg-gradient-to-br from-violet-500 to-purple-600" />
        <Stat label="Rules" value={stats.rules} accent="bg-gradient-to-br from-sky-500 to-blue-600" />
        <Stat label="Total Dispatches" value={stats.dispatched} accent="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <Stat label="Sent" value={stats.sent} accent="bg-gradient-to-br from-amber-500 to-orange-600" />
      </div>

      <div className="space-y-4">

        {/* ── Recipients ────────────────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Recipients</h3>
          <div className="grid md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Name*</label>
              <input id="ntRecipName" className="input" value={rName}
                onChange={(e) => setRName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input id="ntRecipEmail" className="input" type="email" value={rEmail}
                onChange={(e) => setREmail(e.target.value)} />
              {rEmailErr && <div id="ntRecipEmailError" className="text-xs text-red-400 mt-1">{rEmailErr}</div>}
            </div>
            <div>
              <label className="label">Telegram Chat ID</label>
              <input id="ntRecipTelegram" className="input" value={rTelegram}
                onChange={(e) => setRTelegram(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button id="ntRecipSave" className="btn-primary w-full" onClick={addRecipient}>
                Add Recipient
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Telegram Chat ID</th><th>Actions</th></tr></thead>
              <tbody>
                {recipients.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-nexus-muted">No recipients</td></tr>
                )}
                {recipients.map((r) => (
                  <tr key={r.id} id={`ntRecipRow-${r.id}`}>
                    <td id={`ntRecipNameVal-${r.id}`}>{r.name}</td>
                    <td id={`ntRecipEmailVal-${r.id}`}>{r.email || '—'}</td>
                    <td id={`ntRecipTelegramVal-${r.id}`}>{r.telegramChatId || '—'}</td>
                    <td>
                      <button id={`ntRecipDelete-${r.id}`} className="btn text-xs text-red-400"
                        onClick={() => deleteRecipient(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Notification Rules ─────────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Notification Rules</h3>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Activity*</label>
              <select id="ntRuleActivity" className="input" value={ruleActivity}
                onChange={(e) => { setRuleActivity(e.target.value); setRuleTrigger(''); }}>
                <option value="">— select activity —</option>
                {ACTIVITY_NAMES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Trigger Value (State)*</label>
              <select id="ntRuleTrigger" className="input" value={ruleTrigger}
                onChange={(e) => setRuleTrigger(e.target.value)}
                disabled={!ruleActivity}>
                <option value="">— select trigger —</option>
                {availableTriggers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="label">Recipients* (select one or more)</label>
            <div className="grid md:grid-cols-4 gap-2">
              {recipients.length === 0 && (
                <p className="text-xs text-nexus-muted col-span-4">No recipients available — add recipients above first</p>
              )}
              {recipients.map((r) => (
                <label key={r.id} className="text-xs p-2 border border-nexus-line rounded-lg flex items-center gap-2">
                  <input
                    id={`ntRuleRecip-${r.id}`}
                    type="checkbox"
                    checked={ruleRecipIds.includes(r.id)}
                    onChange={() => toggleRuleRecip(r.id)}
                  />
                  {r.name}
                  {r.email && <span className="text-nexus-muted">(email)</span>}
                  {r.telegramChatId && <span className="text-nexus-muted">(tg)</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input id="ntRuleUseCustomMsg" type="checkbox" checked={ruleUseCustom}
                onChange={(e) => setRuleUseCustom(e.target.checked)} />
              Use Custom Message (variables: {'{{'+'Customer'+'}}'},  {'{{'+'OrderID'+'}}'},  {'{{'+'Status'+'}}'}  )
            </label>
            {ruleUseCustom && (
              <textarea
                id="ntRuleCustomMsg"
                className="input mt-2 w-full h-20 resize-none"
                placeholder="e.g. Hello {{Customer}}, your order {{OrderID}} is now {{Status}}."
                value={ruleCustomMsg}
                onChange={(e) => setRuleCustomMsg(e.target.value)}
              />
            )}
          </div>

          <button id="ntRuleSave" className="btn-primary" onClick={saveRule}>Save Rule</button>

          <div className="table-wrap mt-4">
            <table className="tbl">
              <thead>
                <tr><th>Activity</th><th>Trigger</th><th>Recipients</th><th>Custom Msg</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-nexus-muted">No rules configured</td></tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} id={`ntRuleRow-${r.id}`}>
                    <td id={`ntRuleActivityVal-${r.id}`}>{r.activity}</td>
                    <td id={`ntRuleTriggerVal-${r.id}`}>{r.triggerValue}</td>
                    <td className="text-xs">
                      {r.recipientIds
                        .map((rid) => recipients.find((rc) => rc.id === rid)?.name ?? rid)
                        .join(', ')}
                    </td>
                    <td>{r.useCustomMessage ? 'Yes' : 'No'}</td>
                    <td>
                      <button id={`ntRuleDelete-${r.id}`} className="btn text-xs text-red-400"
                        onClick={() => deleteRule(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Notification Templates ─────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Notification Templates</h3>
          <p className="text-xs text-nexus-muted mb-3">
            Templates let you define reusable message formats. A template is identified by its unique code.
            Saving with the same code will upsert (update) the existing template.
          </p>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="label">Code* (unique key)</label>
              <input id="ntTmplCode" className="input" value={tmplCode}
                onChange={(e) => setTmplCode(e.target.value)} placeholder="e.g. DELIVERY_RECEIVED" />
            </div>
            <div>
              <label className="label">Name*</label>
              <input id="ntTmplName" className="input" value={tmplName}
                onChange={(e) => setTmplName(e.target.value)} />
            </div>
            <div>
              <label className="label">Channel*</label>
              <select id="ntTmplChannel" className="input" value={tmplChannel}
                onChange={(e) => setTmplChannel(e.target.value as BackendChannel)}>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
                <option value="IN_APP">IN_APP</option>
                <option value="WEBHOOK">WEBHOOK</option>
              </select>
            </div>
            <div>
              <label className="label">Subject Template</label>
              <input id="ntTmplSubject" className="input" value={tmplSubject}
                onChange={(e) => setTmplSubject(e.target.value)} placeholder="e.g. Order {{OrderID}} update" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Body Template* (use {'{{Customer}}'}, {'{{OrderID}}'}, {'{{Status}}'})</label>
              <textarea id="ntTmplBody" className="input w-full h-20 resize-none" value={tmplBody}
                onChange={(e) => setTmplBody(e.target.value)}
                placeholder="e.g. Hello {{Customer}}, your order {{OrderID}} status: {{Status}}" />
            </div>
            <div>
              <label className="label">Description</label>
              <input id="ntTmplDesc" className="input" value={tmplDesc}
                onChange={(e) => setTmplDesc(e.target.value)} />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input id="ntTmplActive" type="checkbox" checked={tmplActive}
                  onChange={(e) => setTmplActive(e.target.checked)} />
                Active
              </label>
              <button id="ntTmplSave" className="btn-primary" onClick={saveTemplate}>
                Save Template
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Channel</th><th>Subject</th><th>Active</th><th>Description</th></tr>
              </thead>
              <tbody>
                {templates.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-nexus-muted">No templates — create one above</td></tr>
                )}
                {templates.map((t) => (
                  <tr key={t.code} id={`ntTmplRow-${t.code}`}>
                    <td id={`ntTmplCodeVal-${t.code}`} className="font-mono text-xs">{t.code}</td>
                    <td>{t.name}</td>
                    <td id={`ntTmplChannelVal-${t.code}`}>{t.channel}</td>
                    <td className="text-xs text-nexus-muted truncate max-w-xs">{t.subjectTpl || '—'}</td>
                    <td>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${t.active ? 'text-emerald-300 bg-emerald-500/10' : 'text-nexus-muted bg-nexus-line/40'}`}>
                        {t.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-xs text-nexus-muted">{t.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Event Simulator ────────────────────────────────────────────────── */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Event Simulator (Fire Notification)</h3>
          <p className="text-xs text-nexus-muted mb-3">
            Simulate a system event to trigger matching notification rules.
          </p>
          <div className="grid md:grid-cols-5 gap-3 mb-3">
            <div>
              <label className="label">Activity*</label>
              <select id="ntSimActivity" className="input" value={simActivity}
                onChange={(e) => { setSimActivity(e.target.value); setSimState(''); }}>
                <option value="">— select —</option>
                {ACTIVITY_NAMES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">State*</label>
              <select id="ntSimState" className="input" value={simState}
                onChange={(e) => setSimState(e.target.value)}
                disabled={!simActivity}>
                <option value="">— select —</option>
                {simAvailableStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Customer</label>
              <input id="ntSimCustomer" className="input" value={simCustomer}
                onChange={(e) => setSimCustomer(e.target.value)} />
            </div>
            <div>
              <label className="label">Order ID</label>
              <input id="ntSimOrderId" className="input" value={simOrderId}
                onChange={(e) => setSimOrderId(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button id="ntSimFire" className="btn-primary w-full" onClick={fireEvent}>
                Fire Event
              </button>
            </div>
          </div>
        </div>

        {/* ── Notification Log ───────────────────────────────────────────────── */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Notification Dispatch Log</h3>
            <select
              id="ntLogFilter"
              className="input text-xs w-40"
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value as NotifStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Activity</th><th>Trigger</th><th>Recipient</th>
                  <th>Channel</th><th>To</th><th>Message</th><th>Status</th><th>Fired At</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLog.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-nexus-muted">No notifications dispatched yet</td></tr>
                )}
                {visibleLog.map((entry) => (
                  <tr key={entry.id} id={`ntLogRow-${entry.id}`}>
                    <td id={`ntLogActivity-${entry.id}`}>{entry.activity}</td>
                    <td>{entry.triggerValue}</td>
                    <td id={`ntLogRecipient-${entry.id}`}>{entry.recipientName}</td>
                    <td id={`ntLogChannel-${entry.id}`}>{entry.channel}</td>
                    <td className="text-xs">{entry.toAddress || '—'}</td>
                    <td id={`ntLogMessage-${entry.id}`} className="text-xs max-w-xs truncate">{entry.message}</td>
                    <td>
                      {entry.status === 'SENT' && (
                        <span id={`ntLogStatus-${entry.id}`} className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">SENT</span>
                      )}
                      {entry.status === 'PENDING' && (
                        <span id={`ntLogStatus-${entry.id}`} className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">PENDING</span>
                      )}
                      {entry.status === 'FAILED' && (
                        <span id={`ntLogStatus-${entry.id}`} className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">FAILED</span>
                      )}
                      {entry.status === 'CANCELLED' && (
                        <span id={`ntLogStatus-${entry.id}`} className="text-xs px-1.5 py-0.5 rounded bg-nexus-line text-nexus-muted">CANCELLED</span>
                      )}
                      {!entry.status && <span className="text-xs text-nexus-muted">—</span>}
                    </td>
                    <td className="text-xs text-nexus-muted">{entry.firedAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="flex gap-1">
                      {(entry.status === 'PENDING' || entry.status === 'FAILED') && (
                        <button id={`ntLogRetry-${entry.id}`} className="btn text-xs"
                          onClick={() => retryNotification(entry.id)}>Retry</button>
                      )}
                      {(entry.status === 'PENDING') && (
                        <button id={`ntLogCancel-${entry.id}`} className="btn text-xs text-red-400"
                          onClick={() => cancelNotification(entry.id)}>Cancel</button>
                      )}
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
