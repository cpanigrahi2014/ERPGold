import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Ban, Power, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader, Skeleton, EmptyState, Stat } from '@/components/Bits';
import { ApiError, api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { prettyRole, type Role } from '@/modules/registry';

type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';

interface UserView {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  requestedRole: string | null;
  roles: string[];
  branchId: string | null;
  branchName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  active: boolean;
  createdAt: string;
}

interface Branch { id: string; name: string; code: string }

const STATUS_CLASS: Record<UserStatus, string> = {
  PENDING:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  DISABLED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const TABS: { key: UserStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING',  label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'DISABLED', label: 'Disabled' },
  { key: 'ALL',      label: 'All' },
];

export default function UserApprovals() {
  const [tab, setTab] = useState<UserStatus | 'ALL'>('PENDING');
  const [users, setUsers] = useState<UserView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<UserView | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = tab === 'ALL' ? '' : `?status=${tab}`;
      const list = await api<UserView[]>(`/api/admin/api/v1/admin/users${q}`);
      setUsers(list);
    } catch (err) {
      toast.err(`Failed to load users: ${err instanceof ApiError ? err.message : err}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api<string[]>('/api/admin/api/v1/admin/users/roles')
      .then((rs) => setAllRoles(rs as Role[]))
      .catch(() => setAllRoles([]));
    api<Branch[]>('/api/admin/api/v1/admin/branches')
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const counts = useMemo(() => {
    const c: Record<UserStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, DISABLED: 0 };
    (users ?? []).forEach((u) => { c[u.status]++; });
    return c;
  }, [users]);

  return (
    <div>
      <PageHeader
        title="User Approvals"
        subtitle="Approve new registrations, assign roles, manage account status."
        actions={
          <button onClick={load} className="btn-primary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Pending"  value={tab === 'PENDING'  ? users?.length ?? '—' : counts.PENDING}  accent="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat label="Approved" value={tab === 'APPROVED' ? users?.length ?? '—' : counts.APPROVED} accent="bg-gradient-to-br from-emerald-500 to-teal-500" />
        <Stat label="Rejected" value={tab === 'REJECTED' ? users?.length ?? '—' : counts.REJECTED} accent="bg-gradient-to-br from-rose-500 to-red-500" />
        <Stat label="Disabled" value={tab === 'DISABLED' ? users?.length ?? '—' : counts.DISABLED} accent="bg-gradient-to-br from-slate-500 to-slate-700" />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {TABS.map((t) => (
          <motion.button
            key={t.key}
            onClick={() => setTab(t.key)}
            whileTap={{ scale: 0.96 }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all
              ${t.key === tab
                ? 'border-nexus-accent text-white bg-nexus-accent/10'
                : 'border-nexus-line text-nexus-muted hover:text-white hover:border-nexus-panel2'}`}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {loading && <Skeleton rows={6} />}
      {!loading && (users?.length ?? 0) === 0 && (
        <EmptyState title="Nothing here" hint={tab === 'PENDING' ? 'No pending registrations 🎉' : 'No users to show.'} />
      )}

      {!loading && users && users.length > 0 && (
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="table-wrap"
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Granted Roles</th>
                <th>Branch</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.25) }}
                >
                  <td>
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-[11px] text-nexus-muted">{u.email}</div>
                  </td>
                  <td>
                    <span className={`badge border ${STATUS_CLASS[u.status]}`}>{u.status}</span>
                  </td>
                  <td>{u.requestedRole ? prettyRole(u.requestedRole) : '—'}</td>
                  <td className="max-w-[260px]">
                    {u.roles.length === 0
                      ? <span className="text-nexus-muted">—</span>
                      : <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span key={r} className="badge bg-nexus-panel2 border border-nexus-line text-[10px]">
                              {prettyRole(r)}
                            </span>
                          ))}
                        </div>}
                  </td>
                  <td>{u.branchName ?? '—'}</td>
                  <td className="text-xs text-nexus-muted">{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      {u.status === 'PENDING' && (
                        <button
                          className="btn-primary !py-1 !px-2 text-xs"
                          onClick={() => setEditing(u)}
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                      )}
                      {u.status !== 'APPROVED' && u.roles.length > 0 && (
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => act(u.id, 'enable', null, load)}
                        >
                          <Power size={14} /> Enable
                        </button>
                      )}
                      {u.status === 'PENDING' && (
                        <button
                          className="btn-danger !py-1 !px-2 text-xs"
                          onClick={() => promptReject(u.id, load)}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      )}
                      {u.status === 'APPROVED' && (
                        <button
                          className="btn-danger !py-1 !px-2 text-xs"
                          onClick={() => promptDisable(u.id, load)}
                        >
                          <Ban size={14} /> Disable
                        </button>
                      )}
                      {u.status === 'APPROVED' && (
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => setEditing(u)}
                        >
                          <ShieldCheck size={14} /> Roles
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <AnimatePresence>
        {editing && (
          <ApproveDialog
            user={editing}
            allRoles={allRoles}
            branches={branches}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ApproveDialog({ user, allRoles, branches, onClose, onSaved }: {
  user: UserView;
  allRoles: Role[];
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<Set<string>>(() => {
    const init = new Set<string>(user.roles);
    if (init.size === 0 && user.requestedRole) init.add(user.requestedRole);
    return init;
  });
  const [branchId, setBranchId] = useState<string>(user.branchId ?? '');
  const [busy, setBusy] = useState(false);

  function toggle(r: string) {
    setRoles((s) => {
      const n = new Set(s);
      if (n.has(r)) n.delete(r); else n.add(r);
      return n;
    });
  }

  async function save() {
    if (roles.size === 0) { toast.err('Select at least one role.'); return; }
    setBusy(true);
    try {
      await api(`/api/admin/api/v1/admin/users/${user.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ roles: [...roles], branchId: branchId || null }),
      });
      toast.ok(`Approved ${user.email}`);
      onSaved();
    } catch (err) {
      toast.err(`Approve failed: ${err instanceof ApiError ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-6 bg-black/50 backdrop-blur"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        className="card w-full max-w-lg p-6"
      >
        <h2 className="text-lg font-semibold">Approve {user.fullName}</h2>
        <p className="text-xs text-nexus-muted mt-1">{user.email} · requested {user.requestedRole ? prettyRole(user.requestedRole) : '—'}</p>

        <div className="mt-5">
          <label className="label">Branch</label>
          <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">— No branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="label">Roles to grant</label>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {allRoles.map((r) => (
              <button
                type="button" key={r}
                onClick={() => toggle(r)}
                className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all
                  ${roles.has(r)
                    ? 'border-nexus-accent bg-nexus-accent/10 text-white shadow-glow'
                    : 'border-nexus-line text-nexus-muted hover:text-white hover:border-nexus-panel2'}`}
              >
                {prettyRole(r)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            <CheckCircle2 size={14} /> {busy ? 'Saving…' : 'Approve & Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function promptReject(id: string, reload: () => void) {
  const reason = window.prompt('Optional reason for rejection (visible to the user later):') ?? '';
  act(id, 'reject', reason, reload);
}

function promptDisable(id: string, reload: () => void) {
  const reason = window.prompt('Optional reason for disabling:') ?? '';
  act(id, 'disable', reason, reload);
}

async function act(id: string, action: 'reject' | 'disable' | 'enable', reason: string | null, reload: () => void) {
  try {
    await api(`/api/admin/api/v1/admin/users/${id}/${action}`, {
      method: 'POST',
      body: action === 'enable' ? undefined : JSON.stringify({ reason }),
    });
    toast.ok(`${action[0].toUpperCase() + action.slice(1)}d.`);
    reload();
  } catch (err) {
    toast.err(`${action} failed: ${err instanceof ApiError ? err.message : err}`);
  }
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
