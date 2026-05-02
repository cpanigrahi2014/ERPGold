import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/auth/store';
import { visibleModules, type ModuleKey } from '@/modules/registry';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <>{children}</>;
}

export function RequireModule({ moduleKey, children }: { moduleKey: ModuleKey; children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const allowed = visibleModules(user.roles).some((m) => m.key === moduleKey);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function AppLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen aurora flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 px-4 md:px-8 py-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
