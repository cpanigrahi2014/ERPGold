import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, ChevronRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth/store';
import { ALL_ROLES, type Role } from '@/modules/registry';
import { ApiError, api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface LoginResponse {
  accessToken: string;
  email: string;
  fullName: string;
  roles: Role[];
}

export default function Login() {
  const setUser = useAuth((s) => s.setUser);
  const nav = useNavigate();

  const [email, setEmail] = useState('admin@nexus.local');
  const [password, setPassword] = useState('admin123');
  const [demoRole, setDemoRole] = useState<Role>('ADMIN');
  const [backendUp, setBackendUp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  // Probe whether the admin backend is reachable so we can offer a demo
  // fallback when running the UI without the Java services.
  useEffect(() => {
    fetch('/api/admin/actuator/health')
      .then((r) => setBackendUp(r.ok))
      .catch(() => setBackendUp(false));
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setPendingMsg(null);
    try {
      if (!backendUp) {
        // Pure demo / preview mode — no backend at all.
        setUser({
          email: email || 'demo@nexus.local',
          name: (email || 'admin').split('@')[0],
          role: demoRole,
          roles: [demoRole],
          standalone: true,
        });
        toast.warn(`Backend offline — entered demo mode as ${demoRole}`);
        nav('/dashboard', { replace: true });
        return;
      }
      const r = await api<LoginResponse>('/api/admin/api/v1/admin/auth/login', {
        method: 'POST', noAuth: true,
        body: JSON.stringify({ email, password }),
      });
      const roles = (r.roles && r.roles.length > 0) ? r.roles : ['VIEWER' as Role];
      setUser({
        email: r.email,
        name: r.fullName || r.email.split('@')[0],
        role: roles[0],
        roles,
        token: r.accessToken,
        standalone: false,
      });
      toast.ok(`Signed in — ${r.fullName || r.email}`);
      nav('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.code) {
          // PENDING_APPROVAL / REJECTED / DISABLED — show inline, don't toast as scary error.
          setPendingMsg(err.message);
          return;
        }
        toast.err(`Login failed: ${err.message}`);
      } else {
        const msg = String((err as Error)?.message ?? err);
        if (/failed to fetch|networkerror|load failed|ECONN|TypeError/i.test(msg)) {
          setUser({
            email: email || 'demo@nexus.local',
            name: (email || 'admin').split('@')[0],
            role: demoRole,
            roles: [demoRole],
            standalone: true,
          });
          toast.warn(`Backend unreachable — entered demo mode as ${demoRole}`);
          nav('/dashboard', { replace: true });
        } else {
          toast.err(`Login failed: ${msg}`);
        }
      }
    } finally {
      setBusy(false);
    }
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
              The unified <span className="text-nexus-accent2">Jewellery ERP</span>
              <br />for modern operations.
            </div>
            <div className="mt-3 text-sm text-nexus-muted max-w-[320px]">
              Hallmarking · Testing · Refinery · Exchange · Inventory · Billing —
              one beautifully animated console for every desk.
            </div>
          </div>
          <div className="relative text-xs text-nexus-muted">
            © {new Date().getFullYear()} NEXUS · Single-customer deployment
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-8 md:p-10 flex flex-col">
          <div className="flex items-center gap-2 text-xs text-nexus-muted">
            <ShieldCheck size={14} className={!backendUp ? 'text-red-400' : 'text-emerald-400'} />
            {!backendUp
              ? 'Backend offline — pick a role to enter demo mode.'
              : 'Sign in with your NEXUS account'}
          </div>
          <h1 className="text-2xl font-semibold mt-2">Sign in</h1>
          <p className="text-sm text-nexus-muted mt-1">Welcome back. Pick up where you left off.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            {backendUp && (
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password}
                       onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {!backendUp && (
              <div>
                <label className="label">Demo role</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ALL_ROLES.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setDemoRole(r)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all
                        ${demoRole === r
                          ? 'border-nexus-accent bg-nexus-accent/10 text-white shadow-glow'
                          : 'border-nexus-line text-nexus-muted hover:text-white hover:border-nexus-panel2'}`}
                    >
                      {r.replaceAll('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pendingMsg && (
            <div className="mt-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-100 flex gap-2">
              <ShieldAlert size={16} className="text-amber-300 flex-none mt-0.5" />
              <div>{pendingMsg}</div>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            className="btn-primary mt-7 group"
            type="submit"
          >
            {busy ? 'Signing in…' : 'Continue'}
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </motion.button>

          <div className="text-xs text-nexus-muted mt-5 text-center">
            New here?{' '}
            <Link to="/register" className="text-nexus-accent2 hover:text-white">Request access</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
