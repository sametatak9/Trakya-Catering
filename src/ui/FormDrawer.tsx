import { useState, type ReactNode } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { parseNum } from '@/lib/format';
import { askConfirm } from './confirm';
import { Button, Drawer, ErrorNote, Field, cx } from './primitives';

// Alan tanımından form: kaydet / güncelle / sil tüm modüllerde aynı davranır.

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox' | 'tags' | 'tel' | 'email';
export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  /** 1 = yarım satır (varsayılan), 2 = tam satır */
  span?: 1 | 2;
  hint?: ReactNode;
  placeholder?: string;
  /** Boş seçeneğin metni (select) — verilmezse seçim zorunlu gibi davranır */
  emptyLabel?: string;
  show?: (v: Record<string, unknown>) => boolean;
}

type Values = Record<string, unknown>;

function toInput(v: unknown, type: FieldType): string {
  if (v === null || v === undefined) return '';
  if (type === 'tags') return Array.isArray(v) ? v.join(', ') : String(v);
  if (type === 'number' || type === 'money') return String(v).replace('.', ',');
  if (type === 'time') return String(v).slice(0, 5);
  return String(v);
}

export function FormDrawer({ open, title, subtitle, fields, initial, onClose, onSave, onDelete, saving, deleting, readOnly, extra, deleteLabel }: {
  open: boolean; title: ReactNode; subtitle?: ReactNode; fields: FieldDef[]; initial: Values;
  onClose: () => void; onSave: (values: Values) => Promise<void> | void; onDelete?: () => Promise<void> | void;
  saving?: boolean; deleting?: boolean; readOnly?: boolean; extra?: ReactNode; deleteLabel?: string;
}) {
  const [v, setV] = useState<Record<string, string | boolean>>(() => Object.fromEntries(
    fields.map((f) => [f.key, f.type === 'checkbox' ? Boolean(initial[f.key] ?? false) : toInput(initial[f.key], f.type ?? 'text')]),
  ));
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, val: string | boolean) => setV((x) => ({ ...x, [k]: val }));

  const parsed = (): Values | null => {
    const out: Values = {};
    for (const f of fields) {
      const raw = v[f.key];
      const t = f.type ?? 'text';
      if (f.show && !f.show(Object.fromEntries(Object.entries(v)))) { continue; }
      if (t === 'checkbox') { out[f.key] = Boolean(raw); continue; }
      const s = String(raw ?? '').trim();
      if (f.required && !s) { setErr(`“${f.label}” zorunlu.`); return null; }
      if (t === 'number' || t === 'money') {
        if (!s) { out[f.key] = null; continue; }
        const n = parseNum(s);
        if (n === null) { setErr(`“${f.label}” sayı olmalı.`); return null; }
        out[f.key] = n;
      } else if (t === 'tags') out[f.key] = s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [];
      else out[f.key] = s || null;
    }
    return out;
  };

  const submit = async () => {
    setErr(null);
    const vals = parsed();
    if (!vals) return;
    try { await onSave(vals); } catch (e) { setErr((e as { message?: string }).message ?? 'Kaydedilemedi'); }
  };
  const remove = async () => {
    if (!onDelete || !(await askConfirm(`${deleteLabel ?? 'Kayıt'} silinsin mi?`))) return;
    try { await onDelete(); } catch (e) { setErr((e as { message?: string }).message ?? 'Silinemedi'); }
  };

  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle}
      footer={!readOnly && (
        <>
          {onDelete && <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={deleting}>Sil</Button>}
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="holo" icon={<Save className="w-4 h-4" />} onClick={submit} loading={saving}>Kaydet</Button>
        </>
      )}>
      <fieldset disabled={readOnly} className="grid grid-cols-2 gap-3">
        {fields.filter((f) => !f.show || f.show(Object.fromEntries(Object.entries(v)))).map((f) => {
          const t = f.type ?? 'text';
          const val = v[f.key];
          const cls = cx(f.span === 2 || t === 'textarea' ? 'col-span-2' : 'col-span-2 sm:col-span-1');
          if (t === 'checkbox') return (
            <label key={f.key} className={cx(cls, 'flex items-center gap-2 text-sm text-ink-2 pt-6')}>
              <input type="checkbox" checked={Boolean(val)} onChange={(e) => set(f.key, e.target.checked)} className="w-4 h-4 accent-[var(--tc-brand)]" /> {f.label}
            </label>
          );
          return (
            <Field key={f.key} label={f.required ? `${f.label} *` : f.label} hint={f.hint} className={cls}>
              {t === 'select' ? (
                <select className="tc-input" value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                  {(f.emptyLabel !== undefined || !f.required) && <option value="">{f.emptyLabel ?? '—'}</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : t === 'textarea' ? (
                <textarea className="tc-input" rows={3} value={String(val ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input className={cx('tc-input', (t === 'number' || t === 'money') && 'tc-num')}
                  type={t === 'date' ? 'date' : t === 'time' ? 'time' : t === 'tel' ? 'tel' : t === 'email' ? 'email' : 'text'}
                  inputMode={t === 'number' || t === 'money' ? 'decimal' : undefined}
                  placeholder={f.placeholder ?? (t === 'tags' ? 'virgülle ayırın' : undefined)}
                  value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          );
        })}
      </fieldset>
      {extra && <div className="mt-5">{extra}</div>}
      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
    </Drawer>
  );
}
