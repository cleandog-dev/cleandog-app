'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

type Props = {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  allowDecimal?: boolean;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
};

/**
 * Numeric input that lets the user clear the field and type freely.
 * Internally tracks a string so "0" doesn't block input and decimals
 * (e.g. "2,50") aren't normalized while typing.
 */
export function NumericInput({
  value,
  onChange,
  placeholder = '0',
  allowDecimal = false,
  className,
  min,
  max,
  disabled,
}: Props) {
  const [raw, setRaw] = useState<string>(value == null ? '' : String(value).replace('.', ','));

  // Re-sync when external value changes drastically (e.g. dialog reopens)
  useEffect(() => {
    const current = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const currentNum = current === '' ? null : Number(current);
    if (currentNum !== value && !(Number.isNaN(currentNum) && value == null)) {
      setRaw(value == null ? '' : String(value).replace('.', ','));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(v: string) {
    const allowed = allowDecimal ? /[^0-9.,]/g : /[^0-9]/g;
    let cleaned = v.replace(allowed, '');
    if (allowDecimal) {
      const firstSep = cleaned.search(/[.,]/);
      if (firstSep !== -1) {
        cleaned = cleaned.slice(0, firstSep + 1) + cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
      }
    }
    setRaw(cleaned);
    if (cleaned === '' || cleaned === ',' || cleaned === '.') {
      onChange(null);
      return;
    }
    const normalized = cleaned.replace(',', '.');
    const n = Number(normalized);
    if (Number.isFinite(n)) {
      onChange(n);
    }
  }

  // Clamp on blur (not while typing — annoying)
  function handleBlur() {
    if (raw === '') return;
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    if (min != null && n < min) {
      setRaw(String(min));
      onChange(min);
    } else if (max != null && n > max) {
      setRaw(String(max));
      onChange(max);
    }
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={raw}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      onChange={(e) => handle(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
