import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout, { RequireAuth, RequireModule } from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import ModuleRoute from '@/pages/ModuleRoute';
import UserApprovals from '@/pages/admin/UserApprovals';
import Toaster from '@/components/Toaster';
import { MODULES } from '@/modules/registry';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/admin/users"
            element={
              <RequireModule moduleKey="admin">
                <UserApprovals />
              </RequireModule>
            }
          />

          {MODULES.filter((m) => m.key !== 'dashboard').map((m) => (
            <Route
              key={m.key}
              path={`/${m.key}`}
              element={
                <RequireModule moduleKey={m.key}>
                  <ModuleRoute moduleKey={m.key as any} />
                </RequireModule>
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
