/**
 * Trakya Catering logosu.
 * İşaret: Trakya'nın ayçiçeği tarlası (8 yaprak) + ortada kazan (tencere) silueti; altında kazan kapağı çizgisi.
 */
export function Logo({ size = 36, mono = false }: { size?: number; mono?: boolean }) {
  const bg = mono ? 'currentColor' : 'var(--tc-brand)';
  const petal = mono ? '#fff' : 'var(--tc-accent)';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={bg} />
      <g fill={petal} transform="translate(32 29)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <ellipse key={a} rx="4.4" ry="9.2" cy="-14.5" transform={`rotate(${a})`} />
        ))}
      </g>
      {/* kazan: gövde + kulp */}
      <circle cx="32" cy="29" r="8.6" fill={mono ? bg : '#221F1B'} />
      <path d="M26.5 28.5h11v3.2a5.5 4 0 0 1-11 0z" fill={petal} opacity=".95" />
      <path d="M25 28.5h14" stroke={petal} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 52h36" stroke={petal} strokeWidth="3" strokeLinecap="round" />
      <path d="M29 55.5h6" stroke={petal} strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/** İşaret + yazı (yatay). Raporlarda ve giriş ekranında kullanılır. */
export function LogoLockup({ size = 40, subtitle = 'CATERING · TOPLU YEMEK', mono = false }: { size?: number; subtitle?: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} mono={mono} />
      <div className="leading-none">
        <div className="font-display font-extrabold tracking-[0.08em]" style={{ fontSize: size * 0.5 }}>TRAKYA</div>
        <div className="font-semibold tracking-[0.22em] mt-1 opacity-80" style={{ fontSize: Math.max(9, size * 0.2) }}>{subtitle}</div>
      </div>
    </div>
  );
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
