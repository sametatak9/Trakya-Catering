import { useRows } from '@/lib/crud';
import type { Row } from '@/lib/crud';

export type Employee = Row<'employees'>;
export type AttendanceDay = Row<'attendance_days'>;
export type LedgerRow = Row<'employee_ledger'>;
export type EmployeeRequest = Row<'employee_requests'>;

export const DEPARTMENTS: Record<string, string> = {
  mutfak: 'Mutfak', servis: 'Servis', sevkiyat: 'Sevkiyat', depo: 'Depo', idari: 'İdari', satis: 'Satış & Pazarlama', temizlik: 'Temizlik',
};
export const PAY_TYPES: Record<string, string> = { aylik: 'Aylık maaş', yevmiye: 'Yevmiye (günlük)' };
export const DAY_STATUS: Record<string, { label: string; short: string; cls: string }> = {
  var: { label: 'Geldi', short: '✓', cls: 'bg-ok-soft text-ok' },
  yok: { label: 'Gelmedi', short: 'Y', cls: 'bg-stop-soft text-stop' },
  izinli: { label: 'İzinli (ücretli)', short: 'İ', cls: 'bg-accent-soft text-accent-strong' },
  raporlu: { label: 'Raporlu (ücretsiz)', short: 'R', cls: 'bg-info-soft text-info' },
  tatil: { label: 'Tatil', short: '–', cls: 'bg-surface-2 text-ink-3' },
};
export const LEDGER_KINDS: Record<string, { label: string; sign: 1 | -1; tone: 'ok' | 'wait' | 'stop' | 'info' | 'idle' }> = {
  hakedis: { label: 'Hakediş', sign: 1, tone: 'info' },
  prim: { label: 'Prim', sign: 1, tone: 'ok' },
  avans: { label: 'Avans', sign: -1, tone: 'wait' },
  kesinti: { label: 'Kesinti', sign: -1, tone: 'stop' },
  odeme: { label: 'Ödeme', sign: -1, tone: 'idle' },
};
export const REQUEST_KINDS: Record<string, string> = { izin: 'İzin', avans: 'Avans', mesai: 'Fazla mesai' };

export function useEmployees() {
  return useRows('employees', { order: 'full_name' });
}
export function useAttendance(from: string, to: string) {
  return useRows('attendance_days', { key: [from, to], filter: (q) => q.gte('work_date', from).lte('work_date', to) });
}
export function useLedger(employeeId?: string) {
  return useRows('employee_ledger', {
    key: [employeeId ?? 'all'], order: 'entry_date', ascending: false, refetchInterval: 20000,
    filter: employeeId ? (q) => q.eq('employee_id', employeeId) : undefined,
  });
}

/** "Ahmet Yıldız" → "ahmet-yildiz" */
export function slugify(name: string): string {
  const tr: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return name.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => tr[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
