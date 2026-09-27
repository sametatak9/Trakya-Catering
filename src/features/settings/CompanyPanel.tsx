import { useEffect, useState } from 'react';
import { Building } from 'lucide-react';
import { LogoLockup } from '@/ui/Logo';
import { Button, Field, Loading, Panel } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useCompany, useSaveCompany } from './api';

/** Rapor antetinde görünen firma bilgileri (yalnız yönetici düzenler) */
export function CompanyPanel() {
  const toast = useToast();
  const company = useCompany();
  const save = useSaveCompany();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!company.data) return;
    const c = company.data;
    setF({ legal_name: c.legal_name, short_name: c.short_name, slogan: c.slogan ?? '', tax_office: c.tax_office ?? '', tax_no: c.tax_no ?? '',
      address: c.address ?? '', city: c.city ?? '', phone: c.phone ?? '', email: c.email ?? '', website: c.website ?? '', report_footer: c.report_footer ?? '' });
  }, [company.data]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.legal_name?.trim()) return toast.error('Unvan zorunlu');
    try {
      await save.mutateAsync(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || (k === 'legal_name' || k === 'short_name' ? f.legal_name : null)])));
      toast.ok('Firma bilgileri kaydedildi');
    } catch (e) { toast.error(e); }
  };

  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Building className="w-4 h-4 text-brand" />Firma bilgileri (rapor anteti)</span>}
      subtitle="Tüm raporların başlığında logo ile birlikte görünür"
      action={<Button variant="holo" size="sm" onClick={submit} loading={save.isPending}>Kaydet</Button>}>
      {company.isLoading ? <Loading /> : (
        <div className="grid md:grid-cols-[auto_1fr] gap-5">
          <div className="rounded-2xl bg-surface-2 p-4 grid place-items-center gap-2"><LogoLockup size={48} /><a className="text-xs text-brand underline" href={`${import.meta.env.BASE_URL}iletisim.html`} target="_blank" rel="noopener">Girişsiz iletişim sayfası</a></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Ticari unvan" className="sm:col-span-2"><input className="tc-input" value={f.legal_name ?? ''} onChange={set('legal_name')} placeholder="Trakya Catering Gıda San. ve Tic. Ltd. Şti." /></Field>
            <Field label="Vergi dairesi"><input className="tc-input" value={f.tax_office ?? ''} onChange={set('tax_office')} /></Field>
            <Field label="VKN"><input className="tc-input tc-num" value={f.tax_no ?? ''} onChange={set('tax_no')} inputMode="numeric" /></Field>
            <Field label="Adres" className="sm:col-span-2"><input className="tc-input" value={f.address ?? ''} onChange={set('address')} /></Field>
            <Field label="İl / ilçe"><input className="tc-input" value={f.city ?? ''} onChange={set('city')} placeholder="Çorlu / Tekirdağ" /></Field>
            <Field label="Telefon"><input className="tc-input" value={f.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label="E-posta"><input className="tc-input" value={f.email ?? ''} onChange={set('email')} /></Field>
            <Field label="Web"><input className="tc-input" value={f.website ?? ''} onChange={set('website')} /></Field>
            <Field label="Rapor alt notu" className="sm:col-span-2"><input className="tc-input" value={f.report_footer ?? ''} onChange={set('report_footer')} /></Field>
          </div>
        </div>
      )}
    </Panel>
  );
}
