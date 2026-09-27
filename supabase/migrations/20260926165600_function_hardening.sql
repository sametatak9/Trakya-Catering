-- TRAKYA CATERING ERP — 3: fonksiyon sertleştirme (Supabase security advisor)
-- Trigger fonksiyonları API üzerinden çağrılamaz.
revoke execute on function public.bootstrap_first_user() from public, anon, authenticated;
revoke execute on function public.guard_last_admin() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Saf yardımcılar: sabit search_path
alter function public.base_unit(text) set search_path = public;
alter function public.gross_qty(numeric, numeric) set search_path = public;

-- Bilinçli açık bırakılanlar:
--   needs_bootstrap()  → anon: giriş ekranı "ilk kurulum" mu diye sorar, yalnız boolean döner.
--   current_app_role(), has_role(), is_staff(), current_customer_id() → authenticated: yalnız çağıranın kendi rolünü döndürür.
--   list_team(), list_pending_users() → authenticated, içeride yönetici kontrolü var.
