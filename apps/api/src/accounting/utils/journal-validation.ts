export function assertJournalLineValues(debit: number, credit: number) {
  if (debit < 0 || credit < 0) {
    throw new Error('Debit and credit must be non-negative.');
  }

  if (debit > 0 && credit > 0) {
    throw new Error('Line cannot have both debit and credit.');
  }

  if (debit === 0 && credit === 0) {
    throw new Error('Line requires debit or credit amount.');
  }
}

export function isBalanced(
  lines: Array<{ debit: number; credit: number }>,
): boolean {
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  return Math.abs(debit - credit) < 0.000001;
}
