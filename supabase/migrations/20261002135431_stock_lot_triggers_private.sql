-- Faz 3E-1e: parti tetikleyici fonksiyonları (security definer) API'ye açık public şemasından private şemaya taşınır.
-- Tetikleyiciler fonksiyona OID ile bağlı olduğu için çalışmaya devam eder; advisor 0028/0029 uyarısı kalkar.
alter function public.stock_lot_match() set schema private;
alter function public.stock_lot_open() set schema private;
alter function public.stock_lot_consume() set schema private;
alter function public.stock_lots_unit_convert() set schema private;