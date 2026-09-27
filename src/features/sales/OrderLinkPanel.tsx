import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import qrcode from 'qrcode-generator';
import { Copy, Download, MessageCircle, RefreshCw } from 'lucide-react';
import { useCan } from '@/app/session';
import { hrefFor } from '@/app/router';
import { supabase, unwrap } from '@/lib/supabase';
import { normalizeTrPhone, whatsappUrl } from '@/reports/share';
import { askConfirm } from '@/ui/confirm';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import type { Customer } from './api';

/** Firmanın giriş yapmadan kişi sayısı girdiği link (router moduna göre: hash ise /#/siparis/…). */
export function orderLinkUrl(token: string, origin = window.location.origin, base = import.meta.env.BASE_URL): string {
  const dir = base.startsWith('/') ? base : new URL(base, window.location.href).pathname;
  return `${origin}${dir.endsWith('/') ? dir : `${dir}/`}${hrefFor(`/siparis/${token}`).replace(/^\//, '')}`;
}

function qrDataUrl(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(8, 4);
}

/** QR görselini PNG olarak indirir (kütüphane GIF üretir; tuvalle PNG'ye çevrilir). */
async function downloadPng(src: string, filename: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png'); a.download = filename; a.click();
}

/** EK-1 / Not 8: müşteri kartındaki "Sipariş linki" sekmesi. */
export function OrderLinkPanel({ customer }: { customer: Customer }) {
  const toast = useToast();
  const qc = useQueryClient();
  const canRotate = useCan(['yonetici']);
  const [token, setToken] = useState(customer.order_token);
  const url = orderLinkUrl(token);
  const qr = useMemo(() => qrDataUrl(url), [url]);
  const phone = normalizeTrPhone(customer.phone);
  const message = `Merhaba, ${customer.name} için yemek sayısını her gün bu linkten girebilirsiniz (ertesi günün sayısı saat 16:00'ya kadar değişir):\n${url}\n\nTrakya Catering`;

  const rotate = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('rotate_order_token', { p_customer: customer.id })) as string,
    onSuccess: (t) => { setToken(t); qc.invalidateQueries({ queryKey: ['customers'] }); },
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.ok('Link kopyalandı'); } catch { toast.error('Kopyalanamadı; linki elle seçip kopyalayın'); }
  };
  const renew = async () => {
    if (!(await askConfirm('Link yenilenecek. Firmadaki eski link hemen geçersiz olur; yeni linki firmaya tekrar göndermeniz gerekir. Devam edilsin mi?'))) return;
    try { await rotate.mutateAsync(); toast.ok('Yeni link oluşturuldu; eski link artık açılmaz'); } catch (e) { toast.error(e); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Firma bu linkle <b>giriş yapmadan</b> önümüzdeki günlerin kişi sayısını girer. Ertesi günün sayısı saat 16:00'ya kadar değişebilir.</p>
      <div className="rounded-2xl ring-1 ring-line bg-card p-3">
        <div className="text-[11px] uppercase tracking-wider text-ink-3 mb-1">Sipariş linki</div>
        <div className="font-mono text-xs break-all text-ink select-all" data-testid="order-link">{url}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Copy className="w-4 h-4" />} onClick={copy}>Kopyala</Button>
        {phone ? (
          <Button icon={<MessageCircle className="w-4 h-4" />} onClick={() => window.open(whatsappUrl(message, phone), '_blank', 'noopener')}>WhatsApp ile gönder</Button>
        ) : (
          <Button icon={<MessageCircle className="w-4 h-4" />} disabled title="Müşteri kartına telefon ekleyin">WhatsApp (telefon ekleyin)</Button>
        )}
        <Button icon={<Download className="w-4 h-4" />} onClick={() => downloadPng(qr, `siparis-linki-${customer.name.replace(/\s+/g, '-').toLocaleLowerCase('tr')}.png`)}>QR indir (PNG)</Button>
        {canRotate && <Button variant="danger" icon={<RefreshCw className="w-4 h-4" />} onClick={renew} loading={rotate.isPending}>Linki yenile</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <img src={qr} alt="Sipariş linki QR kodu" className="w-40 h-40 rounded-xl ring-1 ring-line bg-white p-1" style={{ imageRendering: 'pixelated' }} />
        <div className="text-xs text-ink-3 space-y-1">
          <div>Son kullanım: <b className="text-ink-2">{customer.order_link_used_at ? new Date(customer.order_link_used_at).toLocaleString('tr-TR') : 'henüz kullanılmadı'}</b></div>
          <div>QR'ı yazdırıp firmanın yemekhanesine asabilirsiniz.</div>
          {!canRotate && <div>Linki yalnız yönetici yenileyebilir.</div>}
        </div>
      </div>
      {canRotate && <PortalPin customerId={customer.id} />}
    </div>
  );
}

/** Portal PIN'i (4–6 hane, bcrypt): bakiye yalnız PIN veya müşteri girişiyle görünür (Faz 4). Yalnız yönetici belirler. */
function PortalPin({ customerId }: { customerId: string }) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const setPortalPin = useMutation({
    mutationFn: async (p: string | null) => unwrap(await supabase.rpc('set_portal_pin', { p_customer: customerId, p_pin: p as string })),
  });
  const submit = async (p: string | null) => {
    if (p !== null && !/^\d{4,6}$/.test(p)) return toast.error('PIN 4–6 haneli rakam olmalı');
    try { await setPortalPin.mutateAsync(p); setPin(''); toast.ok(p ? 'PIN kaydedildi; firmaya ayrı bir kanaldan iletin' : 'PIN kaldırıldı'); } catch (e) { toast.error(e); }
  };
  return (
    <div className="rounded-2xl ring-1 ring-line bg-card p-3">
      <div className="text-sm font-semibold text-ink">Portal PIN'i</div>
      <p className="mt-0.5 text-xs text-ink-3">Linki bilen herkes sipariş girebilir; bakiye (Faz 4) ise yalnız PIN'le görünür. PIN saklanmaz, yalnız özeti tutulur; 5 hatalı denemede 15 dakika kilitlenir.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="tc-input tc-num !w-32" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4–6 hane" aria-label="Portal PIN" />
        <Button size="sm" variant="primary" onClick={() => submit(pin)} loading={setPortalPin.isPending}>PIN belirle</Button>
        <Button size="sm" onClick={() => submit(null)} loading={setPortalPin.isPending}>PIN'i kaldır</Button>
      </div>
    </div>
  );
}
