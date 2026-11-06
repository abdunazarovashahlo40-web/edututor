import { describe, expect, it } from 'vitest';
import uz from '../i18n/uz';
import ru from '../i18n/ru';
import en from '../i18n/en';

function keys(o: unknown, p = ''): string[] {
  if (Array.isArray(o)) return [p + '[]'];
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
  return [p];
}

describe('tarjimalar (uz/ru/en)', () => {
  it('uchala tilda kalitlar bir xil', () => {
    const base = keys(uz).sort();
    expect(keys(ru).sort()).toEqual(base);
    expect(keys(en).sort()).toEqual(base);
  });
  it('bo\'sh tarjima yo\'q', () => {
    for (const d of [uz, ru, en]) {
      const flat = JSON.stringify(d);
      expect(flat).not.toContain('""');
    }
  });
});
