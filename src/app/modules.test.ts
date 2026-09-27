import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/lib/domain';
import { ALIASES, IN_PROGRESS, MODULES, resolveAlias, resolveRoute, visibleModules, visibleTabs, type PermissionMaps } from './modules';

const paths = (role: AppRole, perms?: PermissionMaps) => visibleModules(role, perms).map((m) => m.path);
const tabsOf = (path: string, role: AppRole) => visibleTabs(MODULES.find((m) => m.path === path)!, role).map((t) => t.id);
const perms = (role: Record<string, string> = {}, member: Record<string, string> = {}): PermissionMaps =>
  ({ role: new Map(Object.entries(role)), member: new Map(Object.entries(member)) });

describe('sade navigasyon (30 → 14)', () => {
  it('menüde en çok 15 modül görünür (kurucu, yapımı süren hariç)', () => {
    expect(paths('kurucu').length).toBeLessThanOrEqual(15);
    expect(MODULES.length).toBeLessThanOrEqual(16);
  });
  it('her rolün modül listesi', () => {
    expect(paths('yonetici')).toEqual(['/', '/uretim', '/menuler', '/receteler', '/stok', '/satinalma', '/siparisler', '/cari', '/personel', '/finans', '/kasa', '/ayarlar']);
    expect(paths('asci_basi')).toEqual(['/', '/uretim', '/menuler', '/receteler', '/stok', '/siparisler']);
    expect(paths('depo')).toEqual(['/', '/uretim', '/stok', '/satinalma']);
    expect(paths('satinalma')).toEqual(['/', '/menuler', '/receteler', '/stok', '/satinalma', '/cari', '/finans']);
    expect(paths('muhasebe')).toEqual(['/', '/menuler', '/receteler', '/stok', '/siparisler', '/cari', '/personel', '/finans', '/kasa']);
    expect(paths('pazarlamaci')).toEqual(['/', '/menuler', '/siparisler', '/cari']);
    expect(paths('sofor')).toEqual(['/', '/stok']);
    expect(paths('musteri')).toEqual([]);
  });
  it('sekme düzeyi: satınalma Finans\'ta yalnız gelen faturaları, şoför Stok\'ta yalnız firmalara gideni görür', () => {
    expect(tabsOf('/finans', 'satinalma')).toEqual(['faturalar']);
    expect(tabsOf('/stok', 'sofor')).toEqual(['sevk']);
    expect(tabsOf('/uretim', 'yonetici')).toEqual(['gunluk', 'emir', 'kalibrasyon', 'mutfak']);
    expect(tabsOf('/uretim', 'depo')).toEqual(['gunluk', 'mutfak']);
    expect(tabsOf('/ayarlar', 'yonetici')).toEqual(['ekip']);
    expect(tabsOf('/ayarlar', 'kurucu')).toEqual(['ekip', 'yetkiler']);
  });
  it('kurucu ayarı: sekme gizlenir; tüm sekmeler gizlenirse modül menüden kalkar; kişiye özel istisna rol ayarını ezer', () => {
    const p = perms({ 'satinalma|/finans#faturalar': 'yok' });
    expect(paths('satinalma', p)).not.toContain('/finans');
    expect(paths('satinalma', perms({ 'satinalma|/finans#faturalar': 'yok' }, { '/finans#faturalar': 'gor' }))).toContain('/finans');
    expect(paths('depo', perms({ 'depo|/finans#ozet': 'gor' }))).toContain('/finans');
    expect(paths('asci_basi', perms({ 'asci_basi|/stok': 'yok' }))).not.toContain('/stok');
  });
  it('yapımı süren modüller menüde görünmez', () => {
    for (const p of IN_PROGRESS) expect(paths('kurucu')).not.toContain(p);
  });
});

describe('eski adresler (yer imleri)', () => {
  it.each(Object.entries(ALIASES))('%s → %s', (from, to) => {
    expect(resolveAlias(from)).toBe(to);
    const target = resolveRoute(to, 'kurucu');
    expect(target.mod).toBeDefined();
  });
  it('alt yollar korunur, yeni yollar yönlendirilmez', () => {
    expect(resolveAlias('/kahvalti')).toBe('/uretim/gunluk/kahvalti');
    expect(resolveAlias('/giderler/x')).toBe('/finans/giderler/x');
    expect(resolveAlias('/finans')).toBeNull();
    expect(resolveAlias('/receteler/yeni')).toBeNull();
  });
});

describe('yol çözümü', () => {
  it('modül + sekme + kalan parça', () => {
    const r = resolveRoute('/uretim/gunluk/kahvalti', 'asci_basi');
    expect([r.mod?.path, r.tab?.id, r.rest]).toEqual(['/uretim', 'gunluk', ['kahvalti']]);
    expect(resolveRoute('/receteler/abc', 'asci_basi').rest).toEqual(['abc']);
  });
  it('sekme yazılmamışsa rolün ilk görebildiği sekme açılır', () => {
    expect(resolveRoute('/finans', 'satinalma').tab?.id).toBe('faturalar');
    expect(resolveRoute('/finans', 'muhasebe').tab?.id).toBe('ozet');
    expect(resolveRoute('/stok', 'sofor').tab?.id).toBe('sevk');
  });
});
