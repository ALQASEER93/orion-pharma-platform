export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const encodedHeaders = headers.map((header) => escapeCsvCell(header));
  const encodedRows = rows.map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(','),
  );

  return [encodedHeaders.join(','), ...encodedRows].join('\n');
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  const escaped = text.replace(/"/g, '""');

  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}
