import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessagesSquare, SendHorizontal, X } from 'lucide-react';
import { useMember } from '@/app/session';
import { DEMO, supabase, unwrap } from '@/lib/supabase';
import { cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';

// Ekip sohbeti: kanal bazlı, sosyal medya mesajlaşması sadeliğinde.
// Hazır "talep" düğmeleri: şoför/müşteri istekleri tek dokunuşla mutfağa/depoya düşer.

const CHANNELS: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'genel', label: 'Genel', emoji: '💬' },
  { id: 'mutfak', label: 'Mutfak', emoji: '🍳' },
  { id: 'sevkiyat', label: 'Sevkiyat', emoji: '🚚' },
  { id: 'satinalma', label: 'Satınalma', emoji: '🛒' },
];
const QUICK: Record<string, string[]> = {
  sevkiyat: ['🧂 Firma tuzluk istedi', '🧻 Peçete bitti, 2 koli', '🥫 Ketçap-mayonez eksik', '⏰ 15 dk gecikiyoruz', '✅ Teslim edildi'],
  mutfak: ['✅ Yemek hazır', '⚠️ Malzeme eksik', '🔥 Kazan arızalı', '🧊 Soğuk odaya alındı'],
  satinalma: ['📦 Sipariş verildi', '🚚 Mal geldi', '💸 Fiyat arttı'],
  genel: ['👍 Tamam', '📞 Beni arayın'],
};
const SEEN_KEY = 'tc_chat_seen';
function readSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}

function useMessages() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['chat'],
    refetchInterval: DEMO ? 8000 : 30000,
    queryFn: async () => unwrap(await supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(300)),
  });
  // Gerçek kurulumda anlık: yeni mesaj gelince listeyi tazele
  useEffect(() => {
    if (DEMO) return;
    const ch = supabase.channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => void qc.invalidateQueries({ queryKey: ['chat'] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  return q;
}

const time = (iso: string) => {
  const d = new Date(iso); const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('tr-TR', today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function ChatButton() {
  const member = useMember();
  const toast = useToast();
  const qc = useQueryClient();
  const messages = useMessages();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState('genel');
  const [text, setText] = useState('');
  const [seen, setSeen] = useState<Record<string, string>>(readSeen);
  const endRef = useRef<HTMLDivElement>(null);

  const all = messages.data ?? [];
  const unreadBy = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of all) if (x.author_id !== member.userId && x.created_at > (seen[x.channel] ?? '')) m[x.channel] = (m[x.channel] ?? 0) + 1;
    return m;
  }, [all, seen, member.userId]);
  const totalUnread = Object.values(unreadBy).reduce((s, n) => s + n, 0);
  const list = all.filter((x) => x.channel === channel).slice().reverse();

  // Açık kanal görüldü sayılır
  useEffect(() => {
    if (!open) return;
    const latest = all.find((x) => x.channel === channel)?.created_at;
    if (latest && latest !== seen[channel]) {
      const next = { ...seen, [channel]: latest };
      setSeen(next);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* yok say */ }
    }
  }, [open, channel, all, seen]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }); }, [open, channel, list.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = useMutation({
    mutationFn: async (body: string) => unwrap(await supabase.from('chat_messages').insert({ channel, body, author_name: member.fullName }).select('id')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
    onError: (e) => toast.error(e),
  });
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    send.mutate(body);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Sohbet (${totalUnread} okunmamış)`}
        className="relative p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink">
        <MessagesSquare className="w-5 h-5" />
        {totalUnread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand text-on-brand text-[11px] font-bold grid place-items-center tc-num">{totalUnread}</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Kapat" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Ekip sohbeti" className="tc-holo-slide overflow-hidden h-full w-full sm:max-w-md bg-surface shadow-2xl flex flex-col">
            <header className="px-4 pt-4 pb-3 border-b border-line bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Ekip sohbeti</h2>
                  <p className="text-xs text-ink-3">Talepler, gecikmeler, mutfak notları</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-ink-3 hover:bg-surface-2" aria-label="Kapat"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-1.5 mt-3 overflow-x-auto tc-scroll">
                {CHANNELS.map((c) => (
                  <button key={c.id} type="button" onClick={() => setChannel(c.id)}
                    className={cx('shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1',
                      channel === c.id ? 'bg-brand text-on-brand ring-brand' : 'bg-card text-ink-2 ring-line hover:ring-brand/50')}>
                    <span aria-hidden>{c.emoji}</span>{c.label}
                    {(unreadBy[c.id] ?? 0) > 0 && channel !== c.id && <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-stop text-white text-[10px] grid place-items-center">{unreadBy[c.id]}</span>}
                  </button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto tc-scroll px-4 py-4 space-y-3">
              {list.length === 0 && <div className="text-center text-sm text-ink-3 py-10">Bu kanalda henüz mesaj yok.</div>}
              {list.map((m, i) => {
                const mine = m.author_id === member.userId;
                const showName = !mine && list[i - 1]?.author_id !== m.author_id;
                return (
                  <div key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
                    {showName && <span className="text-[11px] font-semibold text-ink-3 mb-0.5 ml-2">{m.author_name}</span>}
                    <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug shadow-sm',
                      mine ? 'bg-brand text-on-brand rounded-br-md' : 'bg-card text-ink ring-1 ring-line rounded-bl-md')}>
                      {m.body}
                      <div className={cx('text-[10px] mt-1 text-right', mine ? 'opacity-75' : 'text-ink-3')}>{time(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-line bg-card px-3 pt-2.5 pb-3">
              <div className="flex gap-1.5 overflow-x-auto tc-scroll pb-2">
                {(QUICK[channel] ?? []).map((q) => (
                  <button key={q} type="button" onClick={() => send.mutate(q)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-brand-soft hover:text-brand">
                    {q}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="flex items-center gap-2">
                <input className="tc-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yazın…" maxLength={2000} aria-label="Mesaj" />
                <button type="submit" disabled={!text.trim() || send.isPending} className="p-2.5 rounded-xl bg-brand text-on-brand disabled:opacity-50" aria-label="Gönder">
                  <SendHorizontal className="w-5 h-5" />
                </button>
              </form>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
