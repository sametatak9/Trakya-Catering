-- Kullanıcı notu B + C (Faz 3E'ye katlandı): elle stok güncellemesinde zorunlu neden, tedarikçili giriş,
-- faturasız (pazar) alımda tedarikçiye borç kaydı. YALNIZCA EKLEMELİ: yeni nullable sütunlar, yeni sütunlara
-- check kısıtları, index, yeni fonksiyon + tetikleyici. Mevcut satırlar değişmez (reason null kalır).
-- Faturaya istinaden giriş istemcide source='fatura', source_id=<fatura> ile yazılır; mükerrer stok
-- mevcut stock_movements_src_uidx + stock_single_entry (Faz 3A) ile engellenir; borcu fatura oluşturur.

alter table public.stock_movements add column if not exists reason text;
alter table public.stock_movements add column if not exists reason_note text;

alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason is null or reason in ('faturaya_istinaden','pazar_alisverisi','sayim_duzeltmesi','imha_zayiat','iade','diger'));
alter table public.stock_movements add constraint stock_movements_reason_note_check
  check (reason is distinct from 'diger' or length(btrim(coalesce(reason_note, ''))) >= 3);
alter table public.stock_movements add constraint stock_movements_pazar_supplier_check
  check (reason is distinct from 'pazar_alisverisi' or (supplier_id is not null and unit_cost is not null and kind = 'giris'));
alter table public.stock_movements add constraint stock_movements_fatura_ref_check
  check (reason is distinct from 'faturaya_istinaden' or (source = 'fatura' and source_id is not null));

create index if not exists stock_movements_reason_idx on public.stock_movements (reason, move_date desc) where reason is not null;

comment on column public.stock_movements.reason is
  'Elle hareketin nedeni (zorunlu, istemci): faturaya_istinaden | pazar_alisverisi (faturasız, tedarikçiye borç) | sayim_duzeltmesi | imha_zayiat | iade | diger (açıklama zorunlu). Fatura stok artırır, üretim düşürür; elle hareket istisnadır.';

-- Faturasız (pazar) alım: tedarikçiye borç (gider, bekliyor). Fatura yok, belge bu harekettir.
create or replace function public.stock_manual_payable()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sup record;
  v_ing text;
begin
  if new.reason = 'pazar_alisverisi' and new.kind = 'giris' and new.supplier_id is not null and new.unit_cost is not null then
    select name, payment_term_days into v_sup from public.suppliers where id = new.supplier_id;
    select name into v_ing from public.ingredients where id = new.ingredient_id;
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, vat_amount,
                                        counterparty, status, due_date, source, source_id, created_by)
    values (new.move_date, 'gider', 'gida_hammadde',
            format('Faturasız alım (pazar): %s · %s × %s ₺', v_ing, trim_scale(new.qty), trim_scale(new.unit_cost)),
            round(new.qty * new.unit_cost, 2), 0, v_sup.name, 'bekliyor',
            new.move_date + coalesce(v_sup.payment_term_days, 0), 'manuel', new.id, new.created_by)
    on conflict (source, source_id) where source_id is not null do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.stock_manual_payable() from public, anon, authenticated;
create trigger stock_movements_manual_payable after insert on public.stock_movements
  for each row execute function public.stock_manual_payable();
