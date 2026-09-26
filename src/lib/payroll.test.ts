import { describe, expect, it } from 'vitest';
import { dayPay, fillMissingDays, ledgerBalance, monthPay, parseAttendanceFile, parseStamp } from './payroll';

const yev = { pay_type: 'yevmiye', monthly_salary: null, daily_wage: 1500, daily_hours: 10, overtime_rate: 1.5 };
const ayl = { pay_type: 'aylik', monthly_salary: 36000, daily_wage: null, daily_hours: 10, overtime_rate: 1.5 };

describe('10 saat kuralı', () => {
  it('yevmiyeli: tam gün = gün ücreti', () => {
    expect(dayPay(yev, { work_date: '2026-09-01', status: 'var', worked_minutes: 600 }).amount).toBe(1500);
  });
  it('yevmiyeli: 8 saat → eksik 2 saat kesilir', () => {
    const d = dayPay(yev, { work_date: '2026-09-01', status: 'var', worked_minutes: 480 });
    expect(d.missingHours).toBe(2);
    expect(d.amount).toBe(1200);
  });
  it('yevmiyeli: 12 saat → 2 saat ×1,5 mesai', () => {
    const d = dayPay(yev, { work_date: '2026-09-01', status: 'var', worked_minutes: 720 });
    expect(d.overtimeHours).toBe(2);
    expect(d.amount).toBe(1500 + 2 * 150 * 1.5);
  });
  it('raporlu ve yok ücretsiz; izinli ücretli', () => {
    expect(dayPay(yev, { work_date: '2026-09-01', status: 'raporlu', worked_minutes: null }).amount).toBe(0);
    expect(dayPay(yev, { work_date: '2026-09-01', status: 'yok', worked_minutes: null }).amount).toBe(0);
    expect(dayPay(yev, { work_date: '2026-09-01', status: 'izinli', worked_minutes: null }).amount).toBe(1500);
  });
  it('aylıkçı: maaş − yok/raporlu gün − eksik saat + mesai', () => {
    const days = [
      { work_date: '2026-09-01', status: 'var', worked_minutes: 600 },
      { work_date: '2026-09-02', status: 'var', worked_minutes: 660 },   // +1 saat mesai
      { work_date: '2026-09-03', status: 'var', worked_minutes: 540 },   // −1 saat
      { work_date: '2026-09-04', status: 'raporlu', worked_minutes: null }, // −1 gün
      { work_date: '2026-09-05', status: 'yok', worked_minutes: null },     // −1 gün
    ];
    const m = monthPay(ayl, days);
    // günlük 1200, saatlik 120 → +180 − 120 − 2400
    expect(m.total).toBe(36000 + 180 - 120 - 2400);
    expect(m.daysAbsent).toBe(1);
    expect(m.daysReport).toBe(1);
    expect(m.deduction).toBe(120 + 2400);
  });
  it('kaydı olmayan iş günü yok, pazar tatil', () => {
    const d = fillMissingDays([{ work_date: '2026-09-01', status: 'var', worked_minutes: 600 }], '2026-09-01', '2026-09-06');
    expect(d.map((x) => x.status)).toEqual(['var', 'yok', 'yok', 'yok', 'yok', 'tatil']);
  });
});

describe('parmak izi (ZKTeco) dosyası', () => {
  it('Türkçe tarih ve ; ayraçlı dosyayı kişi-gün olarak toplar', () => {
    const csv = 'AC-No.;Name;Time;State\n001;Ahmet Usta;26.09.2026 07:02;C/In\n001;Ahmet Usta;26.09.2026 12:31;C/Out\n001;Ahmet Usta;26.09.2026 17:32;C/Out\n002;Ayşe;26.09.2026 08:00;C/In\nbozuk;satır\n';
    const { days, skipped } = parseAttendanceFile(csv);
    expect(skipped).toBe(1);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ deviceId: '1', name: 'Ahmet Usta', date: '2026-09-26', firstIn: '07:02', lastOut: '17:32', minutes: 630, punches: 3 });
    expect(days[1].minutes).toBe(0);
  });
  it('ayrı tarih/saat sütunlu ve ISO biçimli dosyayı okur', () => {
    const csv = 'User ID,Date,Saat\n7,2026-09-25,06:55\n7,2026-09-25,17:05\n';
    expect(parseAttendanceFile(csv).days[0]).toMatchObject({ deviceId: '7', minutes: 610 });
  });
  it('AM/PM ABD biçimi', () => {
    expect(parseStamp('9/26/2026 5:30 PM')?.getHours()).toBe(17);
  });
});

it('personel bakiyesi: hakediş + prim − avans − kesinti − ödeme', () => {
  expect(ledgerBalance([{ kind: 'hakedis', amount: 36000 }, { kind: 'prim', amount: 1000 }, { kind: 'avans', amount: 5000 }, { kind: 'odeme', amount: 30000 }])).toBe(2000);
});
