import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/lib/domain';
import { resolveRoute } from './modules';
import { ROLE_CARDS, hasManagerHome, workspaceCards } from './workspaces';

const ids = (role: AppRole) => workspaceCards(role).map((c) => c.id);

describe('rol çalışma alanı (Bugün)', () => {
  it('yönetici ve kurucu Özet · Onaylar görür; diğerleri kendi kart setini', () => {
    expect(hasManagerHome('yonetici')).toBe(true);
    expect(hasManagerHome('kurucu')).toBe(true);
    expect(hasManagerHome('muhasebe')).toBe(false);
  });
  it('her rolün kart seti', () => {
    expect(ids('asci_basi')).toEqual(['yarin_uretim', 'bugun_recetesiz', 'bugun_fiyatsiz_malzeme', 'kritik_stok', 'menu_plani_bos']);
    expect(ids('diyetisyen')).toEqual(['yarin_uretim', 'menu_plani_bos', 'bugun_recetesiz', 'bugun_fiyatsiz_malzeme']);
    expect(ids('depo')).toEqual(['kritik_stok', 'bugun_stok_cikis', 'bugun_sevk', 'yarin_uretim']);
    expect(ids('satinalma')).toEqual(['acik_satinalma', 'kritik_stok', 'eski_fiyat', 'taslak_fatura']);
    expect(ids('muhasebe')).toEqual(['vadesi_gelen', 'taslak_fatura', 'fiyatsiz_siparis', 'bekleyen_talep']);
    expect(ids('pazarlamaci')).toEqual(['siparis_girmeyen', 'fiyatsiz_siparis', 'aktif_musteri']);
    expect(ids('sofor')).toEqual(['bugun_teslim', 'bugun_sevk']);
  });
  it('kart hedefi o rolde açılabilen bir yer (tıklayınca "sayfa yok" çıkmaz)', () => {
    for (const role of Object.keys(ROLE_CARDS) as AppRole[]) {
      for (const c of workspaceCards(role)) {
        if (!c.to) continue;
        const r = resolveRoute(c.to, role);
        expect(r.mod, `${role} → ${c.to}`).toBeDefined();
      }
    }
  });
  it('kurucu bir kartın hedefini gizlerse kart da gizlenir', () => {
    const perms = { role: new Map([['muhasebe|/kasa', 'yok']]), member: new Map<string, string>() };
    expect(workspaceCards('muhasebe', perms).map((c) => c.id)).not.toContain('vadesi_gelen');
  });
});
