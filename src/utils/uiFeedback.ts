import { useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => toasts;

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 3200) {
  const id = nextId++;
  // Batasi maksimal 3 toast sekaligus agar layar tidak penuh
  toasts = [...toasts.slice(-2), { id, message, type }];
  emit();

  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs);
  }
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Scroll halus ke elemen yang bermasalah, fokuskan kursor, lalu beri efek getar singkat.
 */
export function focusAndShake(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('ui-shake-error');
  // Paksa reflow agar animasi tetap jalan jika tombol ditekan berulang
  void el.offsetWidth;
  el.classList.add('ui-shake-error');

  setTimeout(() => {
    el.focus({ preventScroll: true });
  }, 220);

  setTimeout(() => {
    el.classList.remove('ui-shake-error');
  }, 800);
}