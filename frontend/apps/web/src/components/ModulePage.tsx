import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { ModuleDef } from '@/modules/registry';
import { PageHeader, Skeleton, EmptyState, Stat } from '@/components/Bits';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ResourceTab {
  label: string;
  /** Path under the module's apiPrefix, e.g. "/api/v1/admin/branches" */
  path: string;
  columns: { key: string; label: string }[];
}

/**
 * A pragmatic, generic CRUD-ish viewer used by every module page.
 * It hits a small list of well-known endpoints, renders the JSON in a
 * pretty animated table, and lets the user open Swagger for details.
 */
export default function ModulePage({ mod, tabs }: { mod: ModuleDef; tabs: ResourceTab[] }) {
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const tab = tabs[active];

  async function load() {
    setLoading(true);
    setRows(null);
    try {
      const url = `${mod.apiPrefix}${tab.path}`;
      const data = await api<any>(url);
      const list =
        Array.isArray(data) ? data
        : Array.isArray(data?.content) ? data.content
        : Array.isArray(data?.items)   ? data.items
        : Array.isArray(data?.data)    ? data.data
        : [];
      setRows(list);
    } catch (e: any) {
      toast.err(`${tab.label}: ${e.message ?? e}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active, mod.key]);

  return (
    <div>
      <PageHeader
        title={mod.label}
        subtitle={mod.blurb}
        actions={
          <button onClick={load} className="btn-primary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Resources"  value={tabs.length}    accent={`bg-gradient-to-br ${mod.accent}`} />
        <Stat label="Selected"   value={tab.label}      accent={`bg-gradient-to-br ${mod.accent}`} />
        <Stat label="Rows"       value={rows?.length ?? '—'} accent={`bg-gradient-to-br ${mod.accent}`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {tabs.map((t, i) => (
          <motion.button
            key={t.label}
            onClick={() => setActive(i)}
            whileTap={{ scale: 0.96 }}
            className={`relative px-3 py-1.5 rounded-lg text-sm border transition-all
              ${i === active
                ? 'border-nexus-accent text-white bg-nexus-accent/10'
                : 'border-nexus-line text-nexus-muted hover:text-white hover:border-nexus-panel2'}`}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {loading && <Skeleton rows={8} />}
      {!loading && (rows?.length ?? 0) === 0 && (
        <EmptyState title="No data yet" hint={`No ${tab.label.toLowerCase()} records to show.`} />
      )}
      {!loading && rows && rows.length > 0 && (
        <motion.div
          key={tab.path}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="table-wrap"
        >
          <table className="tbl">
            <thead>
              <tr>
                {tab.columns.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <motion.tr
                  key={r.id ?? r.uuid ?? idx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.25) }}
                >
                  {tab.columns.map((c) => (
                    <td key={c.key}>{formatCell(r[c.key])}</td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export type { ResourceTab };
