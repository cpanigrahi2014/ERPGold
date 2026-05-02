import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, UserPlus, ArrowLeft } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { REQUESTABLE_ROLES, prettyRole, type Role } from '@/modules/registry';

interface RegisterResponse {
  userId: string;
  email: string;
  status: string;
  message: string;
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [requestedRole, setRequestedRole] = useState<Role>('RECEPTIONIST');
  const [serverRoles, setServerRoles] = useState<Role[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RegisterResponse | null>(null);

  // Pull live list of self-service roles from the backend; fall back to local list.
  useEffect(() => {
    api<string[]>('/api/admin/api/v1/admin/auth/roles', { noAuth: true })
      .then((rs) => setServerRoles(rs as Role[]))
      .catch(() => setServerRoles(null));
  }, []);

  const roles = (serverRoles && serverRoles.length > 0 ? serverRoles : REQUESTABLE_ROLES);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.err('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { toast.err('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const r = await api<RegisterResponse>('/api/admin/api/v1/admin/auth/register', {
        method: 'POST', noAuth: true,
        body: JSON.stringify({ email, fullName, password, requestedRole }),
      });
      setDone(r);
      toast.ok('Registration submitted');
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : String(err);
      toast.err(`Registration failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen aurora flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="card w-full max-w-md p-8 text-center"
        >
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-nexus-accent to-nexus-accent2 grid place-items-center mb-4 shadow-glow">
            <UserPlus className="text-white" size={26} />
          </div>
          <h1 className="text-xl font-semibold">Registration received</h1>
          <p className="text-sm text-nexus-muted mt-2">{done.message}</p>
          <div className="text-xs text-nexus-muted mt-4">
            Account: <span className="text-white font-mono">{done.email}</span>
            <br />
            Status: <span className="text-amber-300">{done.status}</span>
          </div>
          <button onClick={() => nav('/login', { replace: true })} className="btn-primary mt-6 w-full">
            Back to sign in <ChevronRight size={16} />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[920px] grid md:grid-cols-2 rounded-2xl overflow-hidden border border-nexus-line shadow-glow bg-nexus-panel/70 backdrop-blur-xl"
      >
        {/* Hero */}
        <div className="relative p-10 hidden md:flex flex-col justify-between bg-gradient-to-br from-nexus-panel2 via-nexus-panel to-[#10153a] overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-nexus-accent/30 blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-nexus-accent2/25 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="text-nexus-accent2" />
              <div className="text-lg font-semibold tracking-wider">NEXUS</div>
            </div>
            <div className="mt-10 text-3xl font-semibold leading-snug">
              Request access to the
              <br /><span className="text-nexus-accent2">Jewellery ERP</span>
            </div>
            <div className="mt-3 text-sm text-nexus-muted max-w-[320px]">
              Pick the desk you'll be working at. An administrator will review
              and grant the right roles before you can sign in.
            </div>
          </div>
          <Link to="/login" className="relative text-xs text-nexus-muted inline-flex items-center gap-1 hover:text-white">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-8 md:p-10 flex flex-col">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-sm text-nexus-muted mt-1">
            New accounts start in <span className="text-amber-300">Pending</span> until an admin approves them.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div>
                <label className="label">Confirm</label>
                <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
            </div>
            <div>
              <label className="label">Requested role / desk</label>
              <select
                className="input"
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{prettyRole(r)}</option>
                ))}
              </select>
              <div className="text-[11px] text-nexus-muted mt-1">
                Final roles are decided by your administrator on approval.
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            className="btn-primary mt-7 group"
            type="submit"
          >
            {busy ? 'Submitting…' : 'Request access'}
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </motion.button>

          <div className="text-xs text-nexus-muted mt-4 text-center md:hidden">
            <Link to="/login" className="hover:text-white">Already have an account? Sign in</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
