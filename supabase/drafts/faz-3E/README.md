# Faz 3E-1 taslağı — stok partileri (henüz canlıya uygulanmadı)

- `stock_lots.migration.sql`: parti tablosu, FEFO/FIFO çıkış, fatura ↔ sipariş teslimi eşleştirme, `receive_stock` / `consume_stock`, `v_stock_by_supplier`, `v_lot_trace`.
  - Komutlar canlıda `begin…rollback` ile hatasız çalıştı. Test, test dosyasındaki bir sayım hatasında (finans görünürlüğü) durdu; o hata düzeltildi ama test baştan sona yeniden koşulmadı.
- Canlıya uygulama kullanıcı onayı bekliyor. Onaylanınca `supabase/migrations/<sürüm>_stock_lots.sql` olarak birebir taşınır.
- `stock_lots.test.sql` → `supabase/tests/`; `security_fixes.patch` uygulanır.
  - Davranış değişikliği: sipariş teslimi sonrası gelen fatura hata vermez, partiyi tamamlar.
