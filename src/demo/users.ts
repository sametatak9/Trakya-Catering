// Demo kullanıcıları (rol seçimli giriş). Ana pakete yalnız bu küçük liste girer.
export const DEMO_USERS: Array<{ user_id: string; full_name: string; role: string; blurb: string }> = [
  { user_id: 'a0000000-0000-4000-8000-000000000001', full_name: 'Selin Kaya', role: 'yonetici', blurb: 'Patron gözü: maliyet, kasa, alacak, uyarılar' },
  { user_id: 'a0000000-0000-4000-8000-000000000002', full_name: 'Ahmet Usta', role: 'asci_basi', blurb: 'Günlük hazırlık, mutfak ekranı, üretim emri' },
  { user_id: 'a0000000-0000-4000-8000-000000000003', full_name: 'Dyt. Elif Demir', role: 'diyetisyen', blurb: 'Menü planı, reçete gramajı, firma menüleri' },
  { user_id: 'a0000000-0000-4000-8000-000000000004', full_name: 'Murat Çelik', role: 'muhasebe', blurb: 'Giderler, e-fatura kutusu, kasa' },
  { user_id: 'a0000000-0000-4000-8000-000000000005', full_name: 'Kemal Aydın', role: 'satinalma', blurb: 'Faturalar, hammadde fiyatları' },
  { user_id: 'a0000000-0000-4000-8000-000000000006', full_name: 'Zeynep Arslan', role: 'pazarlamaci', blurb: 'Müşteriler ve siparişler' },
  { user_id: 'a0000000-0000-4000-8000-000000000007', full_name: 'Hasan Yıldız', role: 'sofor', blurb: 'Sevkiyat ve sohbet' },
  { user_id: 'a0000000-0000-4000-8000-000000000008', full_name: 'Emre Şahin', role: 'depo', blurb: 'Hammadde ve stok' },
];

export const demoEmail = (role: string) => `${role.replace('_', '')}@demo.trakyacatering.test`;
