// icons.jsx — Clean Dog line-art icon set. Stroke-based, monochrome, scales by font.
// Usage: <Icon name="bath" size={28} />

const ICON_PATHS = {
  // Dog silhouettes for sizes (XS → XL get progressively chunkier)
  dogXS: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 32c0-3 2-5 5-5h12c3 0 5 2 5 5v6h-4l-1 4h-3v-3h-7v3h-3l-1-4h-3z" />
      <path d="M19 27c-1-3 0-6 2-7l1 3 2-2 1 3 2-2v5" />
      <circle cx="20" cy="32" r="0.8" fill="currentColor"/>
    </g>
  ),
  dogS: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 30c0-4 3-7 7-7h14c4 0 7 3 7 7v8h-5l-1 4h-4v-3h-8v3h-4l-1-4h-5z" />
      <path d="M18 23c-1-4 0-8 3-9l1 3 3-3 1 3 3-3v9" />
      <circle cx="20" cy="30" r="1" fill="currentColor"/>
    </g>
  ),
  dogM: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 28c0-5 4-8 8-8h16c5 0 8 3 8 8v10h-5l-1 4h-5v-3h-10v3h-5l-1-4h-5z" />
      <path d="M16 20c-1-5 1-9 4-10l1 3 3-3 1 3 3-3v10" />
      <circle cx="20" cy="29" r="1.2" fill="currentColor"/>
      <path d="M14 32q3 1 6 0" />
    </g>
  ),
  dogL: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 26c0-5 4-9 10-9h17c6 0 10 4 10 9v12h-6l-1 4h-5v-3h-13v3h-5l-1-4h-6z" />
      <path d="M15 18c-1-6 1-11 5-12l1 4 4-4 1 4 3-3v11" />
      <circle cx="20" cy="28" r="1.3" fill="currentColor"/>
      <path d="M13 32q4 1.5 8 0" />
    </g>
  ),
  dogXL: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 24c0-6 5-10 11-10h18c6 0 11 4 11 10v14h-7l-1 4h-6v-3h-12v3h-6l-1-4h-7z" />
      <path d="M14 16c-1-7 1-12 6-13l1 4 4-4 1 4 4-4v13" />
      <circle cx="21" cy="27" r="1.5" fill="currentColor"/>
      <path d="M12 31q5 2 9 0" />
    </g>
  ),

  // Coat types
  coatShort: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22q12-6 24 0t-3 12h-18q-6-6-3-12z" />
      <path d="M12 24l1 2M16 23l1 2M20 22.5l1 2M24 23l1 2M28 24l1 2"/>
    </g>
  ),
  coatMed: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22q12-6 24 0t-3 12h-18q-6-6-3-12z" />
      <path d="M11 25l1 4M14 24l1 5M18 23l1 6M22 23l1 6M26 24l1 5M29 25l1 4"/>
    </g>
  ),
  coatLong: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22q12-6 24 0" />
      <path d="M9 22q-1 8 0 14M13 24q-1 8 0 12M17 24q-1 8 0 12M21 24q-1 8 0 12M25 24q-1 8 0 12M29 24q-1 8 0 12M33 22q1 8 0 14"/>
    </g>
  ),
  coatCurly: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22q12-6 24 0t-3 12h-18q-6-6-3-12z" />
      <circle cx="13" cy="24" r="1.6"/><circle cx="18" cy="22.5" r="1.6"/>
      <circle cx="23" cy="22.5" r="1.6"/><circle cx="28" cy="24" r="1.6"/>
      <circle cx="14" cy="29" r="1.6"/><circle cx="20" cy="28" r="1.6"/>
      <circle cx="26" cy="29" r="1.6"/>
    </g>
  ),

  // Services
  bath: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h30v6a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" />
      <path d="M9 22V14a3 3 0 0 1 6 0v2" />
      <path d="M13 16h6" />
      <path d="M11 36l-1 4M30 36l1 4M20 36v4" />
      <path d="M22 8c1 1 1 2 0 3M26 6c1 1 1 2 0 3M30 9c1 1 1 2 0 3" />
    </g>
  ),
  scissors: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="14" r="4"/>
      <circle cx="11" cy="30" r="4"/>
      <path d="M14 17l20 14M14 27l20-14"/>
    </g>
  ),
  full: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 6l3 6 6 1-4.5 4.5L28 24l-6-3-6 3 1.5-6.5L13 13l6-1z"/>
      <path d="M10 32h24M14 36h16M18 40h8"/>
    </g>
  ),
  nails: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14c0-3 2-5 5-5h6c3 0 5 2 5 5v18c0 3-2 5-5 5h-6c-3 0-5-2-5-5z"/>
      <path d="M14 18h12M14 22h12M14 26h12"/>
      <path d="M17 9c0-2 1-4 3-4s3 2 3 4"/>
    </g>
  ),
  shield: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 6l12 4v10c0 9-6 16-12 18-6-2-12-9-12-18V10z"/>
      <path d="M16 22l4 4 8-8"/>
    </g>
  ),

  // UI
  arrowRight: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 22h26M28 14l8 8-8 8"/>
    </g>
  ),
  arrowLeft: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35 22H9M16 14l-8 8 8 8"/>
    </g>
  ),
  check: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22l9 9 19-19"/>
    </g>
  ),
  clock: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22" cy="22" r="14"/>
      <path d="M22 14v8l5 3"/>
    </g>
  ),
  calendar: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="10" width="32" height="28" rx="4"/>
      <path d="M6 18h32M14 6v8M30 6v8"/>
      <circle cx="14" cy="26" r="1.2" fill="currentColor"/>
      <circle cx="22" cy="26" r="1.2" fill="currentColor"/>
      <circle cx="30" cy="26" r="1.2" fill="currentColor"/>
    </g>
  ),
  bell: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 8c-6 0-10 4-10 10v6l-3 4h26l-3-4v-6c0-6-4-10-10-10z"/>
      <path d="M22 8V5M19 34a3 3 0 0 0 6 0"/>
    </g>
  ),
  paw: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="22" cy="30" rx="7" ry="6"/>
      <ellipse cx="12" cy="20" rx="3" ry="4"/>
      <ellipse cx="32" cy="20" rx="3" ry="4"/>
      <ellipse cx="17" cy="12" rx="2.5" ry="3.5"/>
      <ellipse cx="27" cy="12" rx="2.5" ry="3.5"/>
    </g>
  ),
  phone: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="13" y="5" width="18" height="34" rx="4"/>
      <path d="M19 8h6"/>
      <circle cx="22" cy="34" r="1.4" fill="currentColor"/>
    </g>
  ),
  edit: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 8l8 8L18 34l-10 2 2-10z"/>
      <path d="M24 12l8 8"/>
    </g>
  ),
  sparkle: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 6v8M22 30v8M6 22h8M30 22h8M11 11l5 5M28 28l5 5M11 33l5-5M28 16l5-5"/>
    </g>
  ),
  close: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 10l24 24M34 10L10 34"/>
    </g>
  ),
};

function Icon({ name, size = 28, color, style, ...rest }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44"
         style={{ display: 'inline-block', verticalAlign: 'middle', color, flexShrink: 0, ...style }}
         {...rest}>
      {path}
    </svg>
  );
}

// Brand wordmark — Clean Dog logotype
function Logo({ size = 28, color = 'var(--sage-800)' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color }}>
      <svg width={size + 4} height={size + 4} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
        <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {/* Stylized dog head + leaf */}
          <path d="M10 26c0-5 4-9 9-9h6c5 0 9 4 9 9v4c0 4-3 7-7 7h-10c-4 0-7-3-7-7z"/>
          <circle cx="17" cy="25" r="0.9" fill="currentColor"/>
          <circle cx="27" cy="25" r="0.9" fill="currentColor"/>
          <path d="M22 28v2M20 31h4"/>
          <path d="M14 18c-1-5 1-9 4-10 1 2 2 4 2 6"/>
          <path d="M30 18c1-5-1-9-4-10-1 2-2 4-2 6"/>
          {/* leaf accent */}
          <path d="M34 11c2 0 4 2 4 4-2 0-4-2-4-4z" fill="currentColor" fillOpacity="0.25"/>
        </g>
      </svg>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: size * 0.95,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}>
        Clean<span style={{ fontStyle: 'italic', color: 'var(--brown-700)', marginLeft: 4 }}>Dog</span>
      </span>
    </div>
  );
}

Object.assign(window, { Icon, Logo });
