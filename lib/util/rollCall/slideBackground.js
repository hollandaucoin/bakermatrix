import { existsSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');
const DEFAULT_BACKGROUND_PATH = join(PROJECT_ROOT, 'lib/assets/rollCall/background.png');
const FALLBACK_COLOR = '1A1A2E';

const resolveBackgroundPath = () => {
  const configured = process.env.ROLL_CALL_SLIDE_BACKGROUND?.trim();
  if (!configured) {
    return DEFAULT_BACKGROUND_PATH;
  }
  return isAbsolute(configured) ? configured : resolve(PROJECT_ROOT, configured);
};

/**
 * Slide background for roll call PowerPoint export.
 * Uses ROLL_CALL_SLIDE_BACKGROUND or lib/assets/rollCall/background.png.
 * Falls back to solid color when no image file is present.
 */
export const getRollCallSlideBackground = () => {
  const path = resolveBackgroundPath();
  if (!existsSync(path)) {
    return { color: FALLBACK_COLOR };
  }
  return { path };
};
