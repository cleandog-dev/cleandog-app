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
    <span className="inline-flex items-center gap-2">
      <Image src="/logo.png" alt="CleanDOG" width={size} height={size} priority className="rounded-full" />
      {showText && (
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>
          <span style={{ color: 'var(--sage-800)' }}>Clean</span>
          <span style={{ color: 'var(--brown-700)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500 }}>Dog</span>
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}
