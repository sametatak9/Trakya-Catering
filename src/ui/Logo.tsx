/** Trakya Catering işareti: ayçiçeği + kazan kapağı çizgisi */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--tc-brand)" />
      <g fill="var(--tc-accent)" transform="translate(32 30)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <ellipse key={a} rx="4.2" ry="9" cy="-15" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle cx="32" cy="30" r="8" fill="#221F1B" />
      <path d="M14 52h36" stroke="var(--tc-accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
