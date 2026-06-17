import PptxGenJS from 'pptxgenjs';
import { buildRollCallDeck, parseParenthesisLines } from './deckPlan.js';
import { getRollCallSlideBackground } from './slideBackground.js';

const LIGHT_TEXT = 'F8FAFC';

// LAYOUT_16x9 is 10" × 5.625"
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;
const GRID_MARGIN_LEFT = 0.5;
const GRID_MARGIN_RIGHT = 0.15;
const GRID_MARGIN_Y = 0.22;
const GRID_COLUMNS = 3;
const GRID_ROWS = 16;

const applySlideBackground = (slide, background) => {
  slide.background = background;
};

const addGridSlide = (pptx, slideDef, background) => {
  const slide = pptx.addSlide();
  applySlideBackground(slide, background);

  const columnMap = new Map();
  slideDef.items.forEach((item) => {
    if (!columnMap.has(item.x)) {
      columnMap.set(item.x, []);
    }
    columnMap.get(item.x).push(item);
  });

  const columnKeys = [...columnMap.keys()].sort((a, b) => a - b);
  const usableWidth = SLIDE_WIDTH - GRID_MARGIN_LEFT - GRID_MARGIN_RIGHT;
  const usableHeight = SLIDE_HEIGHT - GRID_MARGIN_Y * 2;
  const colWidth = usableWidth / GRID_COLUMNS;
  const rowHeight = usableHeight / GRID_ROWS;
  const colGap = 0.06;

  columnKeys.forEach((xKey, colIndex) => {
    const colItems = columnMap.get(xKey).sort((a, b) => a.y - b.y);
    colItems.forEach((item, rowIndex) => {
      slide.addText(item.name, {
        x: GRID_MARGIN_LEFT + colIndex * colWidth + colGap / 2,
        y: GRID_MARGIN_Y + rowIndex * rowHeight,
        w: colWidth - colGap,
        h: rowHeight,
        fontSize: 9,
        fontFace: 'Arial',
        bold: true,
        color: LIGHT_TEXT,
        valign: 'middle',
        align: 'left',
        margin: 0,
        fit: 'shrink',
      });
    });
  });
};

const addTitleSlide = (pptx, { title, subtitle }, background) => {
  const slide = pptx.addSlide();
  applySlideBackground(slide, background);
  slide.addText(title, {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 1.2,
    fontSize: 44,
    fontFace: 'Arial',
    bold: true,
    color: LIGHT_TEXT,
    align: 'center',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 3.1,
      w: 9,
      h: 0.8,
      fontSize: 24,
      fontFace: 'Arial',
      bold: true,
      color: LIGHT_TEXT,
      align: 'center',
    });
  }
};

const addEndingSlide = (pptx, { title }, background) => {
  const slide = pptx.addSlide();
  applySlideBackground(slide, background);
  slide.addText(title, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.6,
    fontSize: 40,
    fontFace: 'Arial',
    bold: true,
    color: LIGHT_TEXT,
    align: 'center',
    valign: 'middle',
  });
};

export const generateRollCallPowerpointBuffer = async ({ names, breakName, text }) => {
  const parsedNames = names?.length ? names : parseParenthesisLines(text);
  if (!parsedNames.length) {
    throw new Error('No roll call names found');
  }

  const deck = buildRollCallDeck(parsedNames, breakName);
  const background = getRollCallSlideBackground();
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Bakermatrix';
  pptx.title = 'Roll Call';

  deck.forEach((slideDef) => {
    if (slideDef.type === 'grid') {
      addGridSlide(pptx, slideDef, background);
    } else if (slideDef.type === 'title-break') {
      addTitleSlide(pptx, slideDef, background);
    } else if (slideDef.type === 'ending') {
      addEndingSlide(pptx, slideDef, background);
    }
  });

  return pptx.write({ outputType: 'nodebuffer' });
};
