import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/modules/registry';

export interface SessionUser {
  email: string;
  name: string;
  /** Primary role — first entry of {@link roles} or a default. */
  role: Role;
  /** All roles granted to the user by the backend. */
  roles: Role[];
  token?: string;
  standalone: boolean;
}

interface AuthState {
  user: SessionUser | null;
  hydrated: boolean;
  setUser: (u: SessionUser | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      setUser: (u) => set({ user: u }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'nexus.auth.v2',
      onRehydrateStorage: () => (state) => { if (state) state.hydrated = true; },
    },
  ),
);

/** True if any of {@link allowed} is held by the user. */
export function hasAnyRole(user: SessionUser | null, allowed: readonly Role[]): boolean {
  if (!user) return false;
  const set = new Set(user.roles ?? []);
  return allowed.some((r) => set.has(r));
}

/** Backward-compat alias used by older call sites. */
export const hasRole = hasAnyRole;
