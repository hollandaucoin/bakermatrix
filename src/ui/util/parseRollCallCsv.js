const REQUIRED_COLUMNS = 2;

const stripBom = (text) => String(text || '').replace(/^\uFEFF/, '');

const detectDelimiter = (line) => {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;

  if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) {
    return '\t';
  }
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    return ';';
  }
  return ',';
};

const parseCsvRow = (line, delimiter) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const isHeaderRow = (cells) => {
  const normalized = cells.map((cell) => cell.toLowerCase());
  const hasFirst = normalized.some((cell) => /first/.test(cell));
  const hasLast = normalized.some((cell) => /last/.test(cell));

  if (hasFirst && hasLast) {
    return true;
  }

  return normalized.every((cell) => /^(name|first|last|delegate|preferred)$/i.test(cell));
};

const formatNameFromCells = (cells) => {
  const first = cells[0].trim();
  const last = cells[1].trim();
  if (!first && !last) {
    return null;
  }
  return [first, last].filter(Boolean).join(' ');
};

export const parseNamesFromCsv = (text) => {
  const cleaned = stripBom(text);
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const names = [];
  let headerSkipped = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const cells = parseCsvRow(line, delimiter);
    if (cells.every((cell) => !cell)) {
      return;
    }

    if (cells.length !== REQUIRED_COLUMNS) {
      throw new Error(
        `CSV must have exactly 2 columns (first and last). Row ${lineNumber} has ${cells.length}.`
      );
    }

    if (!headerSkipped && isHeaderRow(cells)) {
      headerSkipped = true;
      return;
    }

    const name = formatNameFromCells(cells);
    if (name) {
      names.push(name);
    }
  });

  return names;
};
