import {
  assertJournalLineValues,
  isBalanced,
} from './utils/journal-validation';

describe('journal-validation', () => {
  it('validates balanced journals', () => {
    expect(
      isBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).toBe(true);

    expect(
      isBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 90 },
      ]),
    ).toBe(false);
  });

  it('rejects invalid line values', () => {
    expect(() => assertJournalLineValues(-1, 0)).toThrow(
      'Debit and credit must be non-negative.',
    );
    expect(() => assertJournalLineValues(1, 1)).toThrow(
      'Line cannot have both debit and credit.',
    );
    expect(() => assertJournalLineValues(0, 0)).toThrow(
      'Line requires debit or credit amount.',
    );
  });
});
