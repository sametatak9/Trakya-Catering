import type React from 'react';
import { useEffect, useState } from 'react';
import { parseNum } from '@/lib/format';
import { cx } from './primitives';

/** Tablo içi sayı hücresi: yazarken yerel, Enter/odak kaybında kaydeder. */
export function NumCell({ value, onCommit, disabled, placeholder, className = '', allowEmpty = false, label }: {
  value: number | null | undefined; onCommit: (v: number | null) => void; disabled?: boolean; placeholder?: string;
  className?: string; allowEmpty?: boolean; label: string;
}) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  useEffect(() => { setText(fmt(value)); }, [value]);
  const commit = () => {
    const n = text.trim() === '' ? null : parseNum(text);
    if (n === null && !allowEmpty) { setText(fmt(value)); return; }
    if (n !== null && n < 0) { setText(fmt(value)); return; }
    if (n === (value ?? null)) return;
    onCommit(n);
  };
  return (
    <input className={cx('tc-input tc-num !py-1.5 !px-2 text-right', className)} inputMode="decimal" value={text} disabled={disabled}
      placeholder={placeholder} aria-label={label}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setText(fmt(value)); }} />
  );
}

/** Serbest sayı alanı: yazılanı olduğu gibi tutar ("12," gibi ara hâller kaybolmaz), çözülen değeri anında bildirir. */
export function NumInput({ value, onValue, className = '', dotDecimal, ...rest }: {
  value: number | null | undefined; onValue: (v: number | null) => void; className?: string; dotDecimal?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    setText((t) => ((t.trim() === '' ? null : parseNum(t, { dotDecimal })) === (value ?? null) ? t : fmt(value)));
  }, [value, dotDecimal]);
  return (
    <input {...rest} className={cx('tc-input tc-num', className)} inputMode="decimal" value={text}
      onChange={(e) => { setText(e.target.value); onValue(e.target.value.trim() === '' ? null : parseNum(e.target.value, { dotDecimal })); }} />
  );
}
