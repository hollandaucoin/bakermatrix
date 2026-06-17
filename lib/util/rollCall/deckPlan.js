const MAX_ROWS = 16;
const MAX_COLUMNS = 3;
const MAX_PER_SLIDE = MAX_ROWS * MAX_COLUMNS;

export const ROLL_CALL_SUBTITLE = 'MT. BAKER 2026 - REACH';
export const ROLL_CALL_ENDING_TITLE = 'WELCOME TO \nMT. BAKER';

export const parseParenthesisLines = (text) => {
  const matches = [...String(text || '').matchAll(/\(([^)]+)\)/g)];
  return matches
    .map((match) => match[1].trim())
    .filter(Boolean);
};

// The reveal line the skill places about a third of the way through the script.
// Tolerates punctuation/spacing variants: "ROLL CALL, MT. BAKER 2026!".
const ROLL_CALL_MARKER = /ROLL\s*CALL[,!\s]+MT\.?\s*BAKER\s*2026/i;

/**
 * Auto-pick the deck break: the delegate whose parenthetical marker appears last
 * BEFORE the "ROLL CALL, MT. BAKER 2026" reveal line. The deck's "ROLL CALL"
 * title slide is inserted right after that delegate, so the break lands wherever
 * the reveal sits in the story (about a third of the way in). Returns '' if the
 * reveal line or a preceding name isn't found.
 */
export const deriveBreakName = (text) => {
  const source = String(text || '');
  const markerIndex = source.search(ROLL_CALL_MARKER);
  if (markerIndex === -1) {
    return '';
  }

  let breakName = '';
  for (const match of source.matchAll(/\(([^)]+)\)/g)) {
    if (match.index < markerIndex) {
      breakName = match[1].trim();
    } else {
      break;
    }
  }
  return breakName;
};

export { parseNamesFromCsv } from './parseCsv.js';

/**
 * Mirrors the slide/grid logic from the original Keynote AppleScript.
 */
export const buildRollCallDeck = (rawNames, breakName) => {
  const breakUpper = String(breakName || '').trim().toUpperCase();
  if (!breakUpper) {
    throw new Error('Break name is required');
  }

  const deck = [];
  let currentGrid = [];
  let row = 0;
  let column = 1;
  let countOnSlide = 0;
  let foundBreak = false;

  const flushGrid = () => {
    if (currentGrid.length > 0) {
      deck.push({ type: 'grid', items: [...currentGrid] });
      currentGrid = [];
    }
  };

  for (const rawName of rawNames) {
    const name = String(rawName).trim().toUpperCase();
    if (!name) continue;

    countOnSlide += 1;
    currentGrid.push({
      name,
      x: column * 70,
      y: row * 45,
      width: 300,
      height: 100,
    });

    if (name === breakUpper) {
      foundBreak = true;
      flushGrid();
      deck.push({
        type: 'title-break',
        title: 'ROLL CALL',
        subtitle: ROLL_CALL_SUBTITLE,
      });
      row = 0;
      column = 1;
      countOnSlide = 0;
      continue;
    }

    if (countOnSlide % MAX_ROWS === 0) {
      column += 4.75;
      row = 0;
    } else {
      row += 1;
    }

    if (countOnSlide % MAX_PER_SLIDE === 0) {
      flushGrid();
      column = 1;
      countOnSlide = 0;
    }
  }

  flushGrid();

  if (!foundBreak) {
    throw new Error(`Break name "${breakName}" was not found in the roll call names`);
  }

  deck.push({
    type: 'ending',
    title: ROLL_CALL_ENDING_TITLE,
  });

  return deck;
};
