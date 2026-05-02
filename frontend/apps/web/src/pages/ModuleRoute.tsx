import { Suspense, lazy, type ReactNode } from 'react';
import ModulePage, { type ResourceTab } from '@/components/ModulePage';
import { moduleByKey, type ModuleKey } from '@/modules/registry';

const AdminDesk = lazy(() => import('@/pages/admin/AdminDesk'));
const HallmarkingDesk = lazy(() => import('@/pages/hm/HallmarkingDesk'));
const TestingDesk = lazy(() => import('@/pages/testing/TestingDesk'));
const RefineryDesk = lazy(() => import('@/pages/refinery/RefineryDesk'));
const BusinessRecordsDesk = lazy(() => import('@/pages/records/BusinessRecordsDesk'));
const BillingDesk = lazy(() => import('@/pages/billing/BillingDesk'));
const ExchangeDesk = lazy(() => import('@/pages/exchange/ExchangeDesk'));
const LaserMarkingDesk = lazy(() => import('@/pages/laser/LaserMarkingDesk'));
const InventoryDesk = lazy(() => import('@/pages/inventory/InventoryDesk'));
const NotificationsDesk = lazy(() => import('@/pages/notifications/NotificationsDesk'));

/**
 * Pragmatic resource map per module. These endpoint paths intentionally
 * mirror the existing static console (admin-standalone/index.html) so they
 * work against the deployed backends with zero changes. Adjust freely if
 * a backend exposes different routes.
 */
const RESOURCES: Record<Exclude<ModuleKey, 'dashboard'>, ResourceTab[]> = {
  admin: [
    { label: 'Branches',  path: '/api/v1/admin/branches',  columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' }, { key: 'city', label: 'City' },
        { key: 'gstin', label: 'GSTIN' },
    ]},
    { label: 'Customers', path: '/api/v1/admin/customers', columns: [
        { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
        { key: 'gstin', label: 'GSTIN' },
    ]},
    { label: 'Products',  path: '/api/v1/admin/products',  columns: [
        { key: 'id', label: 'ID' }, { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Name' }, { key: 'purity', label: 'Purity' },
        { key: 'category', label: 'Category' },
    ]},
    { label: 'Purity',    path: '/api/v1/admin/purity',    columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'caratage', label: 'Carat' }, { key: 'fineness', label: 'Fineness' },
    ]},
    { label: 'Rates',     path: '/api/v1/admin/rates',     columns: [
        { key: 'id', label: 'ID' }, { key: 'metal', label: 'Metal' },
        { key: 'purity', label: 'Purity' }, { key: 'rate', label: 'Rate' },
        { key: 'effectiveAt', label: 'Effective' },
    ]},
    { label: 'Service Types', path: '/api/v1/admin/service-types', columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' }, { key: 'module', label: 'Module' },
        { key: 'active', label: 'Active' },
    ]},
  ],
  inventory: [
    { label: 'Locations', path: '/api/v1/inventory/locations', columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' }, { key: 'branchId', label: 'Branch' },
    ]},
    { label: 'Lots',      path: '/api/v1/inventory/lots',      columns: [
        { key: 'id', label: 'ID' }, { key: 'lotCode', label: 'Lot' },
        { key: 'productId', label: 'Product' },
        { key: 'grossWeight', label: 'Gross g' },
        { key: 'netWeight', label: 'Net g' },
        { key: 'status', label: 'Status' },
    ]},
    // Stock movements require a lotId param; surfaced via Lots row drill-down later.
  ],
  testing: [
    { label: 'Test Jobs',    path: '/api/v1/testing/jobs',          columns: [
        { key: 'id', label: 'ID' }, { key: 'jobNo', label: 'Job#' },
        { key: 'lotId', label: 'Lot' }, { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'When' },
    ]},
    { label: 'Certificates', path: '/api/v1/testing/certificates',  columns: [
        { key: 'id', label: 'ID' }, { key: 'certNo', label: 'Cert#' },
        { key: 'fineness', label: 'Fineness' }, { key: 'issuedAt', label: 'Issued' },
    ]},
  ],
  hm: [
    { label: 'HM Jobs',  path: '/api/v1/hm/jobs',       columns: [
        { key: 'id', label: 'ID' }, { key: 'jobNumber', label: 'Job#' },
        { key: 'kind', label: 'Kind' }, { key: 'pieceCount', label: 'Pcs' },
        { key: 'grossWeight', label: 'Gross g' }, { key: 'status', label: 'Status' },
    ]},
    // Marks & dispatches are sub-resources of a job (drilldown TBD).
  ],
  laser: [
    { label: 'Machines',   path: '/api/v1/laser/machines', columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'model', label: 'Model' }, { key: 'status', label: 'Status' },
    ]},
    { label: 'Laser Jobs', path: '/api/v1/laser/jobs',     columns: [
        { key: 'id', label: 'ID' }, { key: 'jobNo', label: 'Job#' },
        { key: 'machineId', label: 'Machine' }, { key: 'status', label: 'Status' },
    ]},
  ],
  refinery: [
    { label: 'Batches', path: '/api/v1/refinery/batches', columns: [
        { key: 'id', label: 'ID' }, { key: 'batchNo', label: 'Batch#' },
        { key: 'inputWeight', label: 'In g' }, { key: 'recoveredWeight', label: 'Out g' },
        { key: 'fineness', label: 'Fineness' }, { key: 'status', label: 'Status' },
    ]},
  ],
  exchange: [
    { label: 'Transactions', path: '/api/v1/exchange/txns', columns: [
        { key: 'id', label: 'ID' }, { key: 'txnNumber', label: 'Txn#' },
        { key: 'customerId', label: 'Customer' }, { key: 'grossWeight', label: 'Gross g' },
        { key: 'netValue', label: 'Net ₹' }, { key: 'status', label: 'Status' },
    ]},
  ],
  billing: [
    { label: 'Invoices', path: '/api/v1/billing/invoices', columns: [
        { key: 'id', label: 'ID' }, { key: 'invoiceNo', label: 'Invoice#' },
        { key: 'customerName', label: 'Customer' }, { key: 'totalAmount', label: 'Total ₹' },
        { key: 'paymentStatus', label: 'Status' }, { key: 'invoiceDate', label: 'Date' },
    ]},
  ],
  records: [
    { label: 'Day Book',       path: '/api/v1/records/daybook?page=0&size=50',  columns: [
        { key: 'id', label: 'ID' }, { key: 'txnType', label: 'Type' },
        { key: 'reference', label: 'Ref' }, { key: 'amount', label: 'Amount' },
        { key: 'createdAt', label: 'When' },
    ]},
    { label: 'Audit Trail',    path: '/api/v1/records/audit?page=0&size=50',    columns: [
        { key: 'id', label: 'ID' }, { key: 'actor', label: 'Actor' },
        { key: 'action', label: 'Action' }, { key: 'entity', label: 'Entity' },
        { key: 'createdAt', label: 'When' },
    ]},
  ],
  notifications: [
    { label: 'Templates', path: '/api/v1/notifications/templates', columns: [
        { key: 'id', label: 'ID' }, { key: 'code', label: 'Code' },
        { key: 'channel', label: 'Channel' }, { key: 'subject', label: 'Subject' },
    ]},
    { label: 'Dispatches', path: '/api/v1/notifications', columns: [
        { key: 'id', label: 'ID' }, { key: 'channel', label: 'Channel' },
        { key: 'toAddress', label: 'To' }, { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'When' },
    ]},
  ],
};

export default function ModuleRoute({ moduleKey }: { moduleKey: Exclude<ModuleKey, 'dashboard'> }) {
  const withFallback = (node: ReactNode) => (
    <Suspense fallback={<div className="card p-4 text-sm text-nexus-muted">Loading module…</div>}>
      {node}
    </Suspense>
  );

  if (moduleKey === 'admin') {
    return withFallback(<AdminDesk />);
  }
  if (moduleKey === 'hm') {
    return withFallback(<HallmarkingDesk />);
  }
  if (moduleKey === 'testing') {
    return withFallback(<TestingDesk />);
  }
  if (moduleKey === 'refinery') {
    return withFallback(<RefineryDesk />);
  }
  if (moduleKey === 'records') {
    return withFallback(<BusinessRecordsDesk />);
  }
  if (moduleKey === 'billing') {
    return withFallback(<BillingDesk />);
  }
  if (moduleKey === 'exchange') {
    return withFallback(<ExchangeDesk />);
  }
  if (moduleKey === 'laser') {
    return withFallback(<LaserMarkingDesk />);
  }
  if (moduleKey === 'inventory') {
    return withFallback(<InventoryDesk />);
  }
  if (moduleKey === 'notifications') {
    return withFallback(<NotificationsDesk />);
  }
  const mod = moduleByKey(moduleKey);
  const tabs = RESOURCES[moduleKey];
  return <ModulePage mod={mod} tabs={tabs} />;
}
