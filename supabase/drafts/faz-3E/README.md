# Faz 3E taslakları — canlıya henüz uygulanmadı

Bu oturumda Supabase'e yazma (apply_migration) her denemede iptal oldu. Büyük dry-run da 60 sn zaman aşımına uğradı.
Aşağıdaki dosyalar sırayla uygulanmaya hazır. Uygulanınca `supabase/migrations/<sürüm>_<ad>.sql` olarak birebir taşınır.

| Sıra | Dosya | İçerik | Doğrulama |
|---|---|---|---|
| 1 | `stock_lots.migration.sql` | Parti tablosu, FEFO/FIFO çıkış, fatura ↔ sipariş teslimi eşleştirme, `receive_stock` / `consume_stock`, `v_stock_by_supplier`, `v_lot_trace` | Komutlar canlıda `begin…rollback` ile hatasız çalıştı; test kendi sayım hatasında durdu (düzeltildi, test baştan sona yeniden koşulmadı) |
| 2 | `ingredient_aliases.migration.sql` | `norm_tr`, takma adlar (trigram), alternatif birimler, `recipes.meals`, fiyat geçmişi ekleri, düzensiz fiyat (%3), verim testi, PO satırları, talep kaydı, `match_invoice_line`, `confirm_alias`, `merge_ingredients` | `norm_tr` ifadesi canlıda salt-okur sorguyla doğrulandı; tam dry-run zaman aşımı |
| 3 | `stock_seed.migration.sql` | 564 stok kartı + takma adlar + alternatif birimler, 331 yemek (öğünleriyle). `scripts/gen_stock_seed.py` üretir | Değerler canlı CHECK listeleriyle karşılaştırıldı: hepsi geçerli. 9 kalemde KDV boş → %1 ile açılır, "KDV teyit edilmeli" notu düşer |

Testler: `stock_lots.test.sql` → `supabase/tests/`, `security_fixes.patch` uygulanır.
Davranış değişikliği: sipariş teslimi sonrası gelen fatura artık hata vermez, partiyi tamamlar.

İstemci tarafı hazır: `src/lib/normTr.ts` (veritabanı `norm_tr` ile aynı kural, vitest).
