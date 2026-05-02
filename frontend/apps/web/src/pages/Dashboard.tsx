import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/auth/store';
import { visibleModules, prettyRole } from '@/modules/registry';
import { PageHeader, Stat } from '@/components/Bits';

export default function Dashboard() {
  const { user } = useAuth();
  const mods = user ? visibleModules(user.roles).filter((m) => m.key !== 'dashboard') : [];

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.name ?? 'there'} 👋`}
        subtitle={`Signed in as ${user ? prettyRole(user.role) : '—'}. You have access to ${mods.length} module${mods.length === 1 ? '' : 's'}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Active Modules" value={mods.length}                accent="from-violet-500 to-fuchsia-500" />
        <Stat label="Backends Online" value={`${mods.length}/10`}        accent="from-emerald-500 to-teal-500" />
        <Stat label="Today’s Invoices" value="—" hint="live from billing" accent="from-amber-500 to-orange-500" />
        <Stat label="Pending HM Jobs"  value="—" hint="live from HM"      accent="from-cyan-500 to-blue-500" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mods.map((m, idx) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
          >
            <Link
              to={`/${m.key}`}
              className="block card p-5 group relative overflow-hidden hover:border-nexus-accent/50 transition-colors"
            >
              <div className={`absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${m.accent}`} />
              <div className="flex items-start justify-between relative">
                <div className={`w-11 h-11 rounded-xl grid place-items-center bg-gradient-to-br ${m.accent} shadow-glow`}>
                  <m.icon className="text-white" size={22} />
                </div>
                <ArrowRight className="text-nexus-muted group-hover:text-nexus-accent2 group-hover:translate-x-1 transition-all" size={18} />
              </div>
              <div className="mt-4 font-semibold">{m.label}</div>
              <div className="text-xs text-nexus-muted mt-1 line-clamp-2">{m.blurb}</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
