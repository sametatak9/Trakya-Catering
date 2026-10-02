"""Faz 3E-0b: docs/claude/ana-stok-listesi.csv (564) + yemek-listesi.csv (331) → idempotent seed migration.
Kullanım: python3 scripts/gen_stock_seed.py > supabase/drafts/faz-3E/stock_seed.migration.sql
Kanonik ad sabit; var olan kart/yemek (kod veya ad aynı) değiştirilmez (on conflict do nothing)."""
import csv, sys

def q(s):
    return "null" if s is None or s == "" else "'" + s.replace("'", "''") + "'"

def arr(items):
    return "'{}'::text[]" if not items else "array[" + ",".join(q(x) for x in items) + "]::text[]"

stok = list(csv.DictReader(open("docs/claude/ana-stok-listesi.csv", encoding="utf-8-sig")))
yemek = list(csv.DictReader(open("docs/claude/yemek-listesi.csv", encoding="utf-8-sig")))
out = sys.stdout
out.write("-- Faz 3E-0b: ana stok iskeleti (564 kanonik kalem + takma adlar + alternatif birimler) ve 331 yemek adı.\n")
out.write("-- scripts/gen_stock_seed.py ile üretildi; elle düzenlemeyin. İdempotent: var olan kod/ad atlanır.\n")
out.write("-- KDV oranı boş satırlar %1 ile açılır ve notta \"KDV teyit edilmeli\" yazar (muhasebe teyidi).\n\n")
out.write("insert into public.ingredients (code, name, category, stock_unit, vat_rate, allergens, notes) values\n")
rows = []
for r in stok:
    vat = r["kdv_orani"].strip()
    notes = "; ".join(x for x in [r["alt_kategori"] and f"Alt kategori: {r['alt_kategori']}", not vat and "KDV teyit edilmeli", r["not"]] if x)
    rows.append(f"  ({q(r['kod'])}, {q(r['standart_ad'].strip())}, {q(r['kategori'])}, {q(r['birim'])}, {vat or 1}, "
                f"{arr([a for a in r['alerjen'].split('|') if a])}, {q(notes)})")
out.write(",\n".join(rows) + "\non conflict do nothing;\n\n")

out.write("insert into public.ingredient_aliases (ingredient_id, supplier_id, alias_raw, confirmed)\n"
          "select i.id, null, v.alias, true from (values\n")
rows = []
for r in stok:
    for a in dict.fromkeys(x.strip() for x in r["es_anlamlar"].split("|") if x.strip()):
        rows.append(f"  ({q(r['kod'])}, {q(a)})")
out.write(",\n".join(rows) + "\n) v(code, alias) join public.ingredients i on i.code = v.code\n"
          "where public.norm_tr(v.alias) is not null\non conflict do nothing;\n\n")

rows = [f"  ({q(r['kod'])}, {q(r['alternatif_birim'])}, {r['donusum_katsayisi']})"
        for r in stok if r["alternatif_birim"].strip() and r["donusum_katsayisi"].strip()]
out.write("insert into public.ingredient_pack_units (ingredient_id, pack_name, factor_to_stock)\n"
          "select i.id, v.pack, v.factor from (values\n" + ",\n".join(rows) +
          "\n) v(code, pack, factor) join public.ingredients i on i.code = v.code\non conflict do nothing;\n\n")

out.write("insert into public.recipes (code, name, category_code, meals) values\n")
rows = [f"  ({q(r['kod'])}, {q(r['yemek_adi'].strip())}, {q(r['kategori'])}, {arr([m for m in r['ogun'].split('|') if m])})" for r in yemek]
out.write(",\n".join(rows) + "\non conflict do nothing;\n")
