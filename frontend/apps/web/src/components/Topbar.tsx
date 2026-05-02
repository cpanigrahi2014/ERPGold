import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Search } from 'lucide-react';
import { MODULES } from '@/modules/registry';
import { useAuth } from '@/auth/store';

export default function Topbar() {
  const loc = useLocation();
  const { user } = useAuth();
  const key = loc.pathname.replace('/', '').split('/')[0] || 'dashboard';
  const mod = MODULES.find((m) => m.key === key);

  return (
    <header className="h-14 border-b border-nexus-line bg-nexus-panel/40 backdrop-blur flex items-center px-4 md:px-6 gap-4">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-2 min-w-0"
      >
        {mod && <mod.icon className="text-nexus-accent2 shrink-0" size={18} />}
        <div className="font-semibold truncate">{mod?.label ?? 'NEXUS'}</div>
        {mod && (
          <span className="hidden lg:inline text-xs text-nexus-muted truncate">
            · {mod.blurb}
          </span>
        )}
      </motion.div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-bg/60 border border-nexus-line text-sm text-nexus-muted w-[260px]">
        <Search size={15} />
        <input
          placeholder="Search anything…"
          className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-nexus-muted"
        />
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-panel2 border border-nexus-line">⌘K</kbd>
      </div>

      <button className="relative text-nexus-muted hover:text-white transition-colors">
        <Bell size={18} />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-nexus-accent2 animate-pulse" />
      </button>

      {user?.standalone && (
        <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Standalone
        </span>
      )}
    </header>
  );
}
