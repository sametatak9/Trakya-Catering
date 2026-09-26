// Alan sözlükleri — veritabanındaki CHECK kısıtlarıyla aynı kodlar.

export type AppRole = 'yonetici' | 'asci_basi' | 'depo' | 'satinalma' | 'muhasebe' | 'sofor' | 'musteri';

export const ROLE_LABELS: Record<AppRole, string> = {
  yonetici: 'Yönetici',
  asci_basi: 'Aşçıbaşı',
  depo: 'Depo',
  satinalma: 'Satınalma',
  muhasebe: 'Muhasebe',
  sofor: 'Şoför',
  musteri: 'Müşteri (portal)',
};

export const INGREDIENT_CATEGORIES: Record<string, string> = {
  et_tavuk: 'Et / Tavuk',
  balik: 'Balık',
  sebze_meyve: 'Sebze / Meyve',
  bakliyat_tahil: 'Bakliyat / Tahıl',
  sut_urunleri: 'Süt Ürünleri',
  yag: 'Yağlar',
  baharat_sos: 'Baharat / Sos',
  kuru_gida: 'Kuru Gıda',
  icecek: 'İçecek',
  ekmek_unlu: 'Ekmek / Unlu',
  temizlik_sarf: 'Temizlik / Sarf',
  diger: 'Diğer',
};

/** TGK / AB 14 alerjen */
export const ALLERGENS: Record<string, string> = {
  gluten: 'Gluten',
  kabuklu_deniz: 'Kabuklu deniz ürünü',
  yumurta: 'Yumurta',
  balik: 'Balık',
  yer_fistigi: 'Yer fıstığı',
  soya: 'Soya',
  sut: 'Süt / Laktoz',
  sert_kabuklu: 'Sert kabuklu meyve',
  kereviz: 'Kereviz',
  hardal: 'Hardal',
  susam: 'Susam',
  sulfit: 'Sülfit',
  aci_bakla: 'Acı bakla (lupin)',
  yumusakca: 'Yumuşakça',
};

export const MENU_KINDS: Record<string, string> = {
  '3_kap': '3 Kap',
  '4_kap': '4 Kap',
  kahvalti: 'Kahvaltı',
  diyet: 'Diyet',
  ozel: 'Özel',
};

export const MEALS: Record<string, string> = {
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle',
  aksam: 'Akşam',
  gece: 'Gece / Sahur',
};

/** Stok birimleri (hammadde kartında seçilebilenler) */
export const STOCK_UNITS: Array<{ code: string; label: string; base: 'g' | 'ml' | 'adet'; toBase: number }> = [
  { code: 'kg', label: 'kg', base: 'g', toBase: 1000 },
  { code: 'lt', label: 'lt', base: 'ml', toBase: 1000 },
  { code: 'adet', label: 'adet', base: 'adet', toBase: 1 },
  { code: 'g', label: 'g', base: 'g', toBase: 1 },
  { code: 'ml', label: 'ml', base: 'ml', toBase: 1 },
];

export function unitInfo(code: string) {
  return STOCK_UNITS.find((u) => u.code === code) ?? { code, label: code, base: 'adet' as const, toBase: 1 };
}

/** Fiyatı bu kadar günden eski hammaddeler "güncel değil" sayılır */
export const PRICE_STALE_DAYS = 14;
