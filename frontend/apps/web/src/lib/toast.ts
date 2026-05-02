import { create } from 'zustand';

export type ToastKind = 'ok' | 'err' | 'info' | 'warn';
export interface Toast { id: number; kind: ToastKind; msg: string; }

interface ToastState {
  items: Toast[];
  push: (msg: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let _id = 1;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (msg, kind = 'info') => {
    const id = _id++;
    set({ items: [...get().items, { id, msg, kind }] });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = {
  ok:   (m: string) => useToasts.getState().push(m, 'ok'),
  err:  (m: string) => useToasts.getState().push(m, 'err'),
  info: (m: string) => useToasts.getState().push(m, 'info'),
  warn: (m: string) => useToasts.getState().push(m, 'warn'),
};
