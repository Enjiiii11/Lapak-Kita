import { describe, expect, it } from 'vitest';
import { formatDateTime, formatRupiah, formatWeight } from '@/lib/format';

describe('formatRupiah', () => {
  it('formats and rounds rupiah amounts', () => {
    expect(formatRupiah(12345.6)).toBe('Rp12.346');
    expect(formatRupiah(0)).toBe('Rp0');
  });
});

describe('formatWeight', () => {
  it('formats weights with at most two decimal places', () => {
    expect(formatWeight(1.25)).toBe('1.25 kg');
    expect(formatWeight(2)).toBe('2 kg');
  });
});

describe('formatDateTime', () => {
  it('formats dates with an English day, month, year, and time', () => {
    expect(formatDateTime('2024-01-02T03:04:00.000Z')).toMatch(/^\d{2} Jan 2024, \d{2}:\d{2}$/);
  });
});
