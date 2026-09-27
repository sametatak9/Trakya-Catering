import { useCallback, useRef, useState } from 'react';

/** Geri al / yinele yığını (saf çekirdek — vitest ile test edilir). Varsayılan 100 adım (EK-1 en az 50 ister). */
export interface History<T> { past: T[]; present: T; future: T[] }

export const historyInit = <T,>(present: T): History<T> => ({ past: [], present, future: [] });

export function historyPush<T>(h: History<T>, next: T, limit = 100): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] };
}
export function historyUndo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}
export function historyRedo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** React kancası: `set` yeni adım ekler; `reset` yığını sıfırlar (sunucudan yükleme, kayıt sonrası). */
export function useCalendarHistory<T>(initial: T, limit = 100) {
  const [h, setH] = useState<History<T>>(() => historyInit(initial));
  const ref = useRef(h); ref.current = h;
  const set = useCallback((next: T | ((cur: T) => T)) => setH((cur) => historyPush(cur, typeof next === 'function' ? (next as (c: T) => T)(cur.present) : next, limit)), [limit]);
  const undo = useCallback(() => setH((cur) => historyUndo(cur)), []);
  const redo = useCallback(() => setH((cur) => historyRedo(cur)), []);
  const reset = useCallback((value: T) => setH(historyInit(value)), []);
  return { value: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0, steps: h.past.length };
}
