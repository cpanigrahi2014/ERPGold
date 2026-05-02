import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useToasts, type ToastKind } from '@/lib/toast';

const palette: Record<ToastKind, { ring: string; icon: JSX.Element }> = {
  ok:   { ring: 'border-emerald-500/40 bg-emerald-500/10', icon: <CheckCircle2 className="text-emerald-400" size={18} /> },
  err:  { ring: 'border-red-500/40     bg-red-500/10',     icon: <XCircle      className="text-red-400"     size={18} /> },
  warn: { ring: 'border-amber-500/40   bg-amber-500/10',   icon: <AlertTriangle className="text-amber-400"  size={18} /> },
  info: { ring: 'border-violet-500/40  bg-violet-500/10',  icon: <Info         className="text-violet-300"  size={18} /> },
};

export default function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 w-[320px] max-w-[90vw]">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{    opacity: 0, x: 80, scale: 0.9  }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`flex items-start gap-2 p-3 rounded-xl border backdrop-blur shadow-soft ${palette[t.kind].ring}`}
          >
            <div className="mt-0.5">{palette[t.kind].icon}</div>
            <div className="flex-1 text-sm text-slate-100">{t.msg}</div>
            <button onClick={() => dismiss(t.id)} className="text-nexus-muted hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
