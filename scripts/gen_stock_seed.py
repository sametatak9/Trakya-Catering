"""Faz 3E-0b: docs/claude/ana-stok-listesi.csv (564) + yemek-listesi.csv (331) → idempotent seed migration parçaları.
Kullanım: python3 scripts/gen_stock_seed.py <klasör>  → seed_01_*.sql, seed_02_*.sql … (her biri en çok ~25 KB)
Kanonik ad sabit; var olan kart/yemek (kod veya ad aynı) değiştirilmez (on conflict do nothing).
KDV oranı boş satırlar %1 ile açılır ve notta "KDV teyit edilmeli" yazar (muhasebe teyidi)."""
import csv, os, sys

def q(s):
    return "null" if s is None or s == "" else "'" + s.replace("'", "''") + "'"

def arr(items):
    return "'{}'::text[]" if not items else "array[" + ",".join(q(x) for x in items) + "]::text[]"

def chunks(rows, limit=22000):
    cur, size = [], 0
    for r in rows:
        if cur and size + len(r) > limit:
            yield cur; cur, size = [], 0
        cur.append(r); size += len(r) + 2
    if cur: yield cur

stok = list(csv.DictReader(open("docs/claude/ana-stok-listesi.csv", encoding="utf-8-sig")))
yemek = list(csv.DictReader(open("docs/claude/yemek-listesi.csv", encoding="utf-8-sig")))
parts = []

rows = []
for r in stok:
    vat = r["kdv_orani"].strip()
    notes = "; ".join(x for x in [r["alt_kategori"] and f"Alt kategori: {r['alt_kategori']}", not vat and "KDV teyit edilmeli", r["not"]] if x)
    rows.append(f"  ({q(r['kod'])}, {q(r['standart_ad'].strip())}, {q(r['kategori'])}, {q(r['birim'])}, {vat or 1}, "
                f"{arr([a for a in r['alerjen'].split('|') if a])}, {q(notes)})")
for c in chunks(rows):
    parts.append(("stok_kartlari", "insert into public.ingredients (code, name, category, stock_unit, vat_rate, allergens, notes) values\n"
                  + ",\n".join(c) + "\non conflict do nothing;\n"))

rows = []
for r in stok:
    for a in dict.fromkeys(x.strip() for x in r["es_anlamlar"].split("|") if x.strip()):
        rows.append(f"  ({q(r['kod'])}, {q(a)})")
for c in chunks(rows):
    parts.append(("takma_adlar", "insert into public.ingredient_aliases (ingredient_id, supplier_id, alias_raw, confirmed)\n"
                  "select i.id, null, v.alias, true from (values\n" + ",\n".join(c) +
                  "\n) v(code, alias) join public.ingredients i on i.code = v.code\nwhere public.norm_tr(v.alias) is not null\non conflict do nothing;\n"))

rows = [f"  ({q(r['kod'])}, {q(r['alternatif_birim'])}, {r['donusum_katsayisi']})"
        for r in stok if r["alternatif_birim"].strip() and r["donusum_katsayisi"].strip()]
for c in chunks(rows):
    parts.append(("koli_birimleri", "insert into public.ingredient_pack_units (ingredient_id, pack_name, factor_to_stock)\n"
                  "select i.id, v.pack, v.factor from (values\n" + ",\n".join(c) +
                  "\n) v(code, pack, factor) join public.ingredients i on i.code = v.code\non conflict do nothing;\n"))

rows = [f"  ({q(r['kod'])}, {q(r['yemek_adi'].strip())}, {q(r['kategori'])}, {arr([m for m in r['ogun'].split('|') if m])})" for r in yemek]
for c in chunks(rows):
    parts.append(("yemekler", "insert into public.recipes (code, name, category_code, meals) values\n" + ",\n".join(c) + "\non conflict do nothing;\n"))

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for i, (name, body) in enumerate(parts, 1):
    with open(os.path.join(out, f"seed_{i:02d}_{name}.sql"), "w") as f:
        f.write(f"-- Faz 3E-0b ana stok iskeleti, parça {i}/{len(parts)} ({name}). scripts/gen_stock_seed.py üretir; elle düzenlemeyin.\n" + body)
print(len(parts), "parça")
