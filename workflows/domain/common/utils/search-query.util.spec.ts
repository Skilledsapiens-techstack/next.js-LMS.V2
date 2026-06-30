import { escapePostgrestPattern, normalizeSearch } from './search-query.util';

describe('search query utilities', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeSearch('  MCLP   Cohort  ')).toBe('mclp cohort');
  });

  it('escapes PostgREST filter metacharacters', () => {
    expect(escapePostgrestPattern('a%b_c,d\\e')).toBe('a\\%b\\_c\\,d\\\\e');
  });
});
