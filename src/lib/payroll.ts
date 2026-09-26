// Puantaj ve ücret kuralı — tek yerde, testli.
// Günlük çalışma 10 saat (personel kartında değiştirilebilir). Eksik saat kesilir, fazla saat ×1,5 yazılır.
// Raporlu gün ücretsizdir. Kaydı olmayan iş günü "yok" sayılır. Yevmiyeli: gün ücreti; aylıkçı: maaş/30.

export type PayType = 'aylik' | 'yevmiye';
export type DayStatus = 'var' | 'yok' | 'izinli' | 'raporlu' | 'tatil';

export interface PayEmployee {
  pay_type: string;
  monthly_salary: number | null;
  daily_wage: number | null;
  daily_hours: number;
  overtime_rate: number;
}
export interface PayDay { work_date: string; status: string; worked_minutes: number | null }

export interface DayPay {
  status: DayStatus;
  hours: number;
  normalHours: number;
  overtimeHours: number;
  missingHours: number;
  /** Günün hakedişi (yevmiyeli için doğrudan ücret; aylıkçı için maaşa göre artı/eksi fark) */
  amount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function dailyRate(e: PayEmployee): number {
  return e.pay_type === 'yevmiye' ? Number(e.daily_wage ?? 0) : Number(e.monthly_salary ?? 0) / 30;
}
export function hourlyRate(e: PayEmployee): number {
  return dailyRate(e) / Number(e.daily_hours || 10);
}

/**
 * Bir günün ücreti.
 * Yevmiyeli: var → çalışılan saat × saatlik (normal saate kadar) + fazla saat × saatlik × 1,5; izinli → tam gün; yok/raporlu/tatil → 0.
 * Aylıkçı: maaş zaten 30 günü kapsar; bu fonksiyon yalnızca FARKI döndürür:
 *   var → +fazla mesai − eksik saat; yok/raporlu → −1 gün; izinli/tatil → 0.
 */
export function dayPay(e: PayEmployee, d: PayDay): DayPay {
  const status = (d.status as DayStatus) ?? 'var';
  const std = Number(e.daily_hours || 10);
  const hours = status === 'var' ? Math.max(0, Number(d.worked_minutes ?? 0)) / 60 : 0;
  const normalHours = Math.min(hours, std);
  const overtimeHours = status === 'var' ? Math.max(0, hours - std) : 0;
  const missingHours = status === 'var' ? Math.max(0, std - hours) : 0;
  const h = hourlyRate(e);
  const ot = overtimeHours * h * Number(e.overtime_rate || 1.5);
  let amount: number;
  if (e.pay_type === 'yevmiye') {
    amount = status === 'var' ? normalHours * h + ot : status === 'izinli' ? dailyRate(e) : 0;
  } else {
    amount = status === 'var' ? ot - missingHours * h : status === 'yok' || status === 'raporlu' ? -dailyRate(e) : 0;
  }
  return { status, hours, normalHours, overtimeHours, missingHours, amount: r2(amount) };
}

export interface MonthPay {
  base: number;           // aylıkçı: maaş; yevmiyeli: 0
  earned: number;         // günlerden gelen (yevmiye) veya fark (aylıkçı)
  overtimePay: number;
  deduction: number;      // eksik saat + yok + raporlu kesintisi (pozitif sayı)
  total: number;          // dönem hakedişi
  daysWorked: number;
  daysAbsent: number;
  daysReport: number;
  daysLeave: number;
  overtimeHours: number;
  missingHours: number;
}

/** Ayın hakedişi. `days` o ayın kayıtlarıdır (eksik gün için "yok" kaydı ekleyin — bkz. fillMissingDays). */
export function monthPay(e: PayEmployee, days: PayDay[]): MonthPay {
  const h = hourlyRate(e);
  const per = days.map((d) => dayPay(e, d));
  const overtimeHours = per.reduce((s, p) => s + p.overtimeHours, 0);
  const missingHours = per.reduce((s, p) => s + p.missingHours, 0);
  const overtimePay = r2(overtimeHours * h * Number(e.overtime_rate || 1.5));
  const daysAbsent = per.filter((p) => p.status === 'yok').length;
  const daysReport = per.filter((p) => p.status === 'raporlu').length;
  const base = e.pay_type === 'yevmiye' ? 0 : Number(e.monthly_salary ?? 0);
  const earned = r2(per.reduce((s, p) => s + p.amount, 0));
  const deduction = e.pay_type === 'yevmiye'
    ? r2(missingHours * h)
    : r2(missingHours * h + (daysAbsent + daysReport) * dailyRate(e));
  return {
    base, earned, overtimePay, deduction, total: r2(base + earned),
    daysWorked: per.filter((p) => p.status === 'var').length, daysAbsent, daysReport,
    daysLeave: per.filter((p) => p.status === 'izinli').length,
    overtimeHours: r2(overtimeHours), missingHours: r2(missingHours),
  };
}

/** İş günü olup kaydı olmayan günleri "yok" olarak tamamlar (pazar = tatil). `until` bugünse ileri günler eklenmez. */
export function fillMissingDays(days: PayDay[], from: string, until: string, sundayOff = true): PayDay[] {
  const have = new Map(days.map((d) => [d.work_date, d]));
  const out: PayDay[] = [];
  for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= until; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const rec = have.get(iso);
    if (rec) out.push(rec);
    else out.push({ work_date: iso, status: sundayOff && d.getUTCDay() === 0 ? 'tatil' : 'yok', worked_minutes: null });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// ZKTeco (ve benzeri) parmak izi cihazı dışa aktarımı: CSV / Excel'den kaydedilmiş metin.
// Sütun adları cihaz/yazılıma göre değişir; esnek okunur. Her kişi-gün için ilk giriş / son çıkış.
// ---------------------------------------------------------------------------------------------
export interface Punch { deviceId: string; name: string; at: Date }
export interface PunchDay { deviceId: string; name: string; date: string; firstIn: string; lastOut: string; minutes: number; punches: number }

const norm = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşöçı]/g, '');
const ID_COLS = ['acno', 'no', 'userid', 'kullanıcıno', 'personelno', 'sicilno', 'enrollno', 'id', 'pin', 'kartno'];
const NAME_COLS = ['name', 'ad', 'adsoyad', 'isim', 'personel', 'adısoyadı', 'adsoyadı'];
const DT_COLS = ['time', 'datetime', 'tarihsaat', 'checktime', 'zaman', 'datetime', 'tarihvesaat'];
const DATE_COLS = ['date', 'tarih'];
const TIME_COLS = ['saat', 'hour', 'timeonly'];

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === sep && !q) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** "26.09.2026 07:58", "2026-09-26 07:58:12", "9/26/2026 7:58 AM" → Date (yerel saat) */
export function parseStamp(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m) {
    let hh = +m[4];
    if (m[7]) { if (/pm/i.test(m[7]) && hh < 12) hh += 12; if (/am/i.test(m[7]) && hh === 12) hh = 0; }
    // AM/PM varsa ABD (ay/gün), yoksa Türkiye (gün.ay)
    const [day, mon] = m[7] ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return new Date(+m[3], mon - 1, day, hh, +m[5], +(m[6] ?? 0));
  }
  return null;
}

export function parseAttendanceFile(text: string): { days: PunchDay[]; skipped: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { days: [], skipped: 0 };
  const sep = [';', '\t', ','].map((s) => [s, lines[0].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const head = splitLine(lines[0], sep).map(norm);
  const find = (cands: string[]) => head.findIndex((h) => cands.includes(h));
  const iId = find(ID_COLS); const iName = find(NAME_COLS); const iDt = find(DT_COLS); const iDate = find(DATE_COLS); const iTime = find(TIME_COLS);
  const punches: Punch[] = []; let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = splitLine(line, sep);
    const id = iId >= 0 ? c[iId] : '';
    const stamp = iDt >= 0 ? c[iDt] : iDate >= 0 && iTime >= 0 ? `${c[iDate]} ${c[iTime]}` : '';
    const at = stamp ? parseStamp(stamp) : null;
    if (!id || !at) { skipped++; continue; }
    punches.push({ deviceId: id.replace(/^0+(?=\d)/, ''), name: iName >= 0 ? c[iName] : '', at });
  }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const groups = new Map<string, Punch[]>();
  for (const p of punches) {
    const k = `${p.deviceId}|${iso(p.at)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const days: PunchDay[] = [...groups.values()].map((ps) => {
    const sorted = [...ps].sort((a, b) => a.at.getTime() - b.at.getTime());
    const first = sorted[0]; const last = sorted[sorted.length - 1];
    return {
      deviceId: first.deviceId, name: first.name || sorted.find((x) => x.name)?.name || '', date: iso(first.at),
      firstIn: hm(first.at), lastOut: hm(last.at), minutes: Math.round((last.at.getTime() - first.at.getTime()) / 60000), punches: ps.length,
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.deviceId.localeCompare(b.deviceId));
  return { days, skipped };
}

// ---------------------------------------------------------------------------------------------
// Personel defteri → canlı bakiye (pozitif = firmanın personele borcu)
// ---------------------------------------------------------------------------------------------
export const LEDGER_SIGN: Record<string, 1 | -1> = { hakedis: 1, prim: 1, avans: -1, kesinti: -1, odeme: -1 };
export function ledgerBalance(rows: Array<{ kind: string; amount: number }>): number {
  return r2(rows.reduce((s, r) => s + (LEDGER_SIGN[r.kind] ?? 0) * Number(r.amount), 0));
}
