const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

/**
 * Trakya Catering logosu (EK-1 / Not 12, seçenek 1: kapaklı servis + başak).
 * Kaynak SVG'ler `public/` altında; metinler path'e çevrili, yazı tipi bağımlılığı yok.
 * `Logo` = kare uygulama işareti (kenar çubuğu, küçük yerler); `mono` = zeminsiz işaret.
 */
export function Logo({ size = 36, mono = false }: { size?: number; mono?: boolean }) {
  return <img src={asset(mono ? 'logo-isaret.svg' : 'logo-mark.svg')} width={size} height={size} alt="" aria-hidden="true" className="shrink-0" />;
}

/** Yatay logo (işaret + "Trakya Catering"). Giriş ekranı, raporlar ve antet. `dark` = koyu zemin sürümü. */
export function LogoFull({ height = 40, dark = false, className }: { height?: number; dark?: boolean; className?: string }) {
  return <img src={asset(dark ? 'logo-dark.svg' : 'logo.svg')} height={height} style={{ height, width: 'auto' }} alt="Trakya Catering" className={className} />;
}

/** Geriye uyumlu ad: raporlar ve ayarlar yatay logoyu kullanır. */
export function LogoLockup({ size = 40 }: { size?: number; subtitle?: string; mono?: boolean }) {
  return <LogoFull height={size} />;
}

/** Holografik mühür — raporların köşesinde kurumsal doğrulama işareti */
export function HoloSeal({ size = 88, label = 'ONAYLI RAPOR' }: { size?: number; label?: string }) {
  return (
    <div className="tc-holo-seal relative grid place-items-center rounded-full" style={{ width: size, height: size }} aria-hidden="true">
      <div className="absolute inset-[6%] rounded-full bg-white/85 grid place-items-center">
        <div className="flex flex-col items-center">
          <Logo size={size * 0.34} />
          <div className="font-bold tracking-[0.14em] text-[#221F1B] mt-1" style={{ fontSize: Math.max(6, size * 0.075) }}>{label}</div>
        </div>
      </div>
    </div>
  );
}
