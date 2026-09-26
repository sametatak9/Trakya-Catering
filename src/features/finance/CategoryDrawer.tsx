import { useState } from 'react';
import { Button, Drawer, ErrorNote, Field, Tabs } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useFinanceCategories, useSaveCategory } from './api';

function slug(s: string) {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return s.toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => map[c]).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

/** "Ucu açık" kategori ekleme: yeni gider/gelir kalemi ve fatura tespiti için anahtar kelimeler */
export function CategoryDrawer({ onClose, defaultKind = 'gider' }: { onClose: () => void; defaultKind?: 'gelir' | 'gider' }) {
  const toast = useToast();
  const cats = useFinanceCategories();
  const save = useSaveCategory();
  const [kind, setKind] = useState<'gelir' | 'gider'>(defaultKind);
  const groups = Array.from(new Set((cats.data ?? []).filter((c) => c.kind === kind).map((c) => c.group_name)));
  const [name, setName] = useState('');
  const [group, setGroup] = useState(groups[0] ?? 'Diğer');
  const [newGroup, setNewGroup] = useState('');
  const [keywords, setKeywords] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const code = slug(name);
    if (!code) return setErr('Kategori adı girin.');
    if ((cats.data ?? []).some((c) => c.code === code)) return setErr('Bu adla bir kategori zaten var.');
    try {
      await save.mutateAsync({
        code, name: name.trim(), kind, group_name: (group === '__new' ? newGroup.trim() : group) || 'Diğer',
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean), sort: 500,
      });
      toast.ok('Kategori eklendi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open onClose={onClose} title="Yeni kategori" subtitle="Takip etmek istediğiniz her kalem için bir kategori açabilirsiniz"
      footer={<><Button onClick={onClose}>Vazgeç</Button><Button variant="holo" onClick={submit} loading={save.isPending}>Ekle</Button></>}>
      <div className="space-y-4">
        <Tabs value={kind} onChange={setKind} items={[{ id: 'gider', label: 'Gider' }, { id: 'gelir', label: 'Gelir' }]} />
        <Field label="Kategori adı"><input className="tc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jeneratör bakımı" /></Field>
        <Field label="Grup">
          <select className="tc-input" value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            <option value="__new">+ Yeni grup…</option>
          </select>
        </Field>
        {group === '__new' && <Field label="Yeni grup adı"><input className="tc-input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} /></Field>}
        {kind === 'gider' && (
          <Field label="Anahtar kelimeler" hint="Virgülle ayırın. Gelen faturanın unvanında veya kalemlerinde geçerse bu kategori önerilir.">
            <input className="tc-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="jeneratör, aksa, dizel jeneratör" />
          </Field>
        )}
        {err && <ErrorNote>{err}</ErrorNote>}
      </div>
    </Drawer>
  );
}
