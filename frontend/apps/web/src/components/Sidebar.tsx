import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Sparkles, UserPlus } from 'lucide-react';
import { useAuth, hasAnyRole } from '@/auth/store';
import { visibleModules } from '@/modules/registry';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const modules = user ? visibleModules(user.roles) : [];
  const isAdmin = hasAnyRole(user, ['ADMIN', 'SUPER_ADMIN']);

  return (
    <aside className="w-[248px] shrink-0 hidden md:flex flex-col border-r border-nexus-line bg-nexus-panel/60 backdrop-blur">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-nexus-line">
        <div className="relative">
          <Sparkles className="text-nexus-accent2" size={22} />
          <span className="absolute inset-0 rounded-full animate-pulse-ring border border-nexus-accent2/60" />
        </div>
        <div>
          <div className="font-semibold tracking-wide">NEXUS</div>
          <div className="text-[11px] text-nexus-muted -mt-0.5">Jewellery ERP</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {modules.map((m, idx) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * idx, duration: 0.25 }}
          >
            <NavLink
              to={`/${m.key}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg
                 text-sm transition-all
                 ${isActive
                   ? 'bg-nexus-panel2 text-white shadow-soft'
                   : 'text-slate-300 hover:bg-nexus-panel2/60 hover:text-white'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="active-pill"
                      className={`absolute inset-y-1 left-0 w-1 rounded-r bg-gradient-to-b ${m.accent}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <m.icon
                    size={18}
                    className={isActive ? 'text-nexus-accent2' : 'text-nexus-muted group-hover:text-white'}
                  />
                  <span className="truncate">{m.label}</span>
                </>
              )}
            </NavLink>
            {m.key === 'admin' && isAdmin && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `flex items-center gap-3 pl-12 pr-4 py-1.5 mx-2 rounded-lg text-xs transition-all
                   ${isActive
                     ? 'text-white bg-nexus-panel2/70'
                     : 'text-nexus-muted hover:text-white hover:bg-nexus-panel2/40'}`
                }
              >
                <UserPlus size={14} /> User Approvals
              </NavLink>
            )}
          </motion.div>
        ))}
      </nav>

      <div className="border-t border-nexus-line p-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-nexus-accent to-nexus-accent2 grid place-items-center font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user.name}</div>
              <div className="text-[11px] text-nexus-muted truncate" title={user.roles.join(', ')}>
                {user.roles.length > 1
                  ? `${user.role.replaceAll('_', ' ')} +${user.roles.length - 1}`
                  : user.role.replaceAll('_', ' ')}
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className="text-nexus-muted hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
