import {
  LayoutDashboard, Building2, Boxes, FlaskConical, BadgeCheck,
  Zap, FlameKindling, ArrowLeftRight, ReceiptText, BookOpen, BellRing, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * Canonical role catalog. Mirrors `com.nexus.admin.domain.model.Roles` on the
 * backend. Keep these two lists in sync.
 */
export type Role =
  // Cross-cutting
  | 'ADMIN' | 'SUPER_ADMIN' | 'MANAGER' | 'VIEWER'
  // Hallmarking desks
  | 'RECEPTIONIST' | 'DELIVERY_PERSON' | 'QUALITY_MANAGER'
  | 'XRF_TECHNICIAN' | 'SAMPLING_TECHNICIAN'
  | 'FIRE_ASSAY_TECHNICIAN' | 'TITRATION_TECHNICIAN' | 'HUID_MARKER'
  // Other modules
  | 'LASER_OPERATOR' | 'REFINER' | 'INVENTORY_CLERK' | 'BILLING_CLERK'
  // Legacy
  | 'HM_OPERATOR';

export const ALL_ROLES: Role[] = [
  'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER',
  'RECEPTIONIST', 'DELIVERY_PERSON', 'QUALITY_MANAGER',
  'XRF_TECHNICIAN', 'SAMPLING_TECHNICIAN',
  'FIRE_ASSAY_TECHNICIAN', 'TITRATION_TECHNICIAN', 'HUID_MARKER',
  'LASER_OPERATOR', 'REFINER', 'INVENTORY_CLERK', 'BILLING_CLERK',
  'HM_OPERATOR',
];

/** Roles a user may pick at the public registration form. */
export const REQUESTABLE_ROLES: Role[] = [
  'MANAGER', 'VIEWER',
  'RECEPTIONIST', 'DELIVERY_PERSON', 'QUALITY_MANAGER',
  'XRF_TECHNICIAN', 'SAMPLING_TECHNICIAN',
  'FIRE_ASSAY_TECHNICIAN', 'TITRATION_TECHNICIAN', 'HUID_MARKER',
  'LASER_OPERATOR', 'REFINER', 'INVENTORY_CLERK', 'BILLING_CLERK',
];

export function prettyRole(r: string): string {
  return r.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ModuleKey =
  | 'dashboard' | 'admin' | 'inventory' | 'testing' | 'hm' | 'laser'
  | 'refinery' | 'exchange' | 'billing' | 'records' | 'notifications';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  short: string;
  blurb: string;
  /** API prefix used in vite proxy + nginx. Internal — not shown to users. */
  apiPrefix: string;
  icon: LucideIcon;
  accent: string; // tailwind color class fragment
  roles: Role[];
}

// Role bundles per module — every module is open to ADMIN/SUPER_ADMIN/MANAGER
// plus the desk-specific roles defined by the spec.
const CORE: Role[] = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

export const MODULES: ModuleDef[] = [
  {
    key: 'dashboard', label: 'Dashboard', short: 'Home',
    blurb: 'Live KPIs across every module',
    apiPrefix: '/api/admin', icon: LayoutDashboard,
    accent: 'from-violet-500 to-fuchsia-500',
    roles: ALL_ROLES,
  },
  {
    key: 'admin', label: 'Admin / Masters', short: 'Admin',
    blurb: 'Users · Branches · Customers · Products · Rates',
    apiPrefix: '/api/admin', icon: ShieldCheck,
    accent: 'from-indigo-500 to-violet-600',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    key: 'inventory', label: 'Inventory', short: 'Stock',
    blurb: 'Lots, locations, real-time stock ledger',
    apiPrefix: '/api/inventory', icon: Boxes,
    accent: 'from-emerald-500 to-teal-500',
    roles: [...CORE, 'INVENTORY_CLERK', 'RECEPTIONIST'],
  },
  {
    key: 'testing', label: 'Purity Testing', short: 'Testing',
    blurb: 'Reception · XRF · Fire Assay · Titration',
    apiPrefix: '/api/testing', icon: FlaskConical,
    accent: 'from-cyan-500 to-blue-500',
    roles: [...CORE, 'RECEPTIONIST', 'XRF_TECHNICIAN',
            'FIRE_ASSAY_TECHNICIAN', 'TITRATION_TECHNICIAN'],
  },
  {
    key: 'hm', label: 'Hallmarking', short: 'HM',
    blurb: 'BIS hallmarking · 10 desks · HUID',
    apiPrefix: '/api/hm', icon: BadgeCheck,
    accent: 'from-amber-500 to-orange-500',
    roles: [...CORE, 'HM_OPERATOR', 'DELIVERY_PERSON', 'RECEPTIONIST',
            'QUALITY_MANAGER', 'XRF_TECHNICIAN', 'SAMPLING_TECHNICIAN',
            'FIRE_ASSAY_TECHNICIAN', 'TITRATION_TECHNICIAN', 'HUID_MARKER'],
  },
  {
    key: 'laser', label: 'Laser Marking', short: 'Laser',
    blurb: 'Machines & engraving job queue',
    apiPrefix: '/api/laser', icon: Zap,
    accent: 'from-pink-500 to-rose-500',
    roles: [...CORE, 'LASER_OPERATOR', 'HM_OPERATOR'],
  },
  {
    key: 'refinery', label: 'Refinery', short: 'Refinery',
    blurb: 'Intake · Aqua-Regia · Final processing',
    apiPrefix: '/api/refinery', icon: FlameKindling,
    accent: 'from-red-500 to-orange-600',
    roles: [...CORE, 'REFINER'],
  },
  {
    key: 'exchange', label: 'Exchange', short: 'Exchange',
    blurb: 'Old-gold exchange & settlement',
    apiPrefix: '/api/exchange', icon: ArrowLeftRight,
    accent: 'from-yellow-500 to-amber-600',
    roles: [...CORE, 'BILLING_CLERK', 'RECEPTIONIST'],
  },
  {
    key: 'billing', label: 'Billing', short: 'Billing',
    blurb: 'GST invoices, payments, advances',
    apiPrefix: '/api/billing', icon: ReceiptText,
    accent: 'from-lime-500 to-emerald-500',
    roles: [...CORE, 'BILLING_CLERK'],
  },
  {
    key: 'records', label: 'Business Records', short: 'Records',
    blurb: 'Day book · Audit trail · Statutory registers',
    apiPrefix: '/api/records', icon: BookOpen,
    accent: 'from-sky-500 to-indigo-500',
    roles: [...CORE, 'BILLING_CLERK', 'VIEWER'],
  },
  {
    key: 'notifications', label: 'Notifications', short: 'Notif',
    blurb: 'Email · SMS · Webhook templates & dispatch',
    apiPrefix: '/api/notifications', icon: BellRing,
    accent: 'from-purple-500 to-pink-500',
    roles: [...CORE],
  },
];

export const moduleByKey = (k: ModuleKey) => MODULES.find((m) => m.key === k)!;

/** Modules visible given any of the user's granted roles. */
export function visibleModules(roles: readonly Role[] | undefined | null): ModuleDef[] {
  const set = new Set(roles ?? []);
  return MODULES.filter((m) => m.roles.some((r) => set.has(r)));
}

export const BRANCH_ICON = Building2;
