import Image from 'next/image';
import Link from 'next/link';

export function Logo({
  size = 32,
  showText = true,
  href = '/',
}: {
  size?: number;
  showText?: boolean;
  href?: string | null;
}) {
  const inner = (
    <span className="inline-flex items-center gap-2" style={{ lineHeight: 1 }}>
      <Image
        src="/logo.png"
        alt="CleanDOG"
        width={size}
        height={size}
        priority
        className="rounded-full"
        style={{ display: 'block', flexShrink: 0 }}
      />
      {showText && (
        <span style={{ fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1, display: 'inline-flex', alignItems: 'baseline' }}>
          <span style={{ color: 'var(--sage-800)' }}>Clean</span>
          <span style={{ color: 'var(--brown-700)', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>DOG</span>
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" style={{ lineHeight: 1 }}>
      {inner}
    </Link>
  );
}
