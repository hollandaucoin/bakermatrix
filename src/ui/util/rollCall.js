import { parseNamesFromCsv } from './parseRollCallCsv.js';
import { onSessionExpired } from './api.js';

export const parseParenthesisLines = (text) => {
  const matches = [...String(text || '').matchAll(/\(([^)]+)\)/g)];
  return matches
    .map((match) => match[1].trim())
    .filter(Boolean);
};

const ROLL_CALL_MARKER = /ROLL\s*CALL[,!\s]+MT\.?\s*BAKER\s*2026/i;

/** Last parenthesis name before the ROLL CALL reveal line in the script. */
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

export const normalizeRollCallName = (name) => String(name)
  // Curly quotes/apostrophes (’ ‘ “ ”) vs straight ones — CSVs from Excel/Sheets
  // and Claude's output often disagree; treat them as the same character.
  .replace(/[\u2018\u2019\u02BC]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  // Collapse repeated whitespace (double spaces, non-breaking spaces).
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const compareRollCallNames = (csvNames, parsedNames) => {
  const parsedSet = new Set(parsedNames.map(normalizeRollCallName));
  const csvSet = new Set(csvNames.map(normalizeRollCallName));

  const missing = csvNames.filter((name) => !parsedSet.has(normalizeRollCallName(name)));
  const extra = parsedNames.filter((name) => !csvSet.has(normalizeRollCallName(name)));

  return {
    csvCount: csvNames.length,
    parsedCount: parsedNames.length,
    missing,
    extra,
    isCompleteMatch: missing.length === 0 && extra.length === 0 && csvNames.length > 0,
  };
};

const readJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        'Server returned HTML instead of JSON. Restart the backend with `npm run dev` so the roll-call API routes load.'
      );
    }
    if (/^\s*import\s/m.test(text)) {
      throw new Error(
        'Server returned JavaScript instead of a file. The roll-call API may not be running on this host.'
      );
    }
    throw new Error(text.slice(0, 200) || 'Invalid server response');
  }
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const isJsonBody = (data) => data !== null && typeof data === 'object';

const postBlob = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'Request failed';
    let errorBody = null;
    try {
      errorBody = await readJsonResponse(response);
      message = errorBody?.error || message;
    } catch (err) {
      message = err.message || message;
    }
    // Only a real JSON 401 from our server clears the saved login.
    if (response.status === 401 && isJsonBody(errorBody)) {
      await onSessionExpired();
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const errorBody = await readJsonResponse(response);
    throw new Error(errorBody?.error || 'Server returned an error instead of a PowerPoint file');
  }
  if (contentType.includes('text/html') || contentType.includes('javascript')) {
    throw new Error('Server returned an unexpected response. The roll-call API may not be deployed correctly.');
  }

  return response.blob();
};

const requestJson = async (url, { method = 'GET', body } = {}) => {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    if (response.status === 401 && isJsonBody(data)) {
      await onSessionExpired();
    }
    throw new Error(data?.error || 'Request failed');
  }
  return data;
};

export const fetchRollCallCapabilities = async () => {
  return requestJson('/api/roll-call/capabilities');
};

export const fetchRollCallFiles = async () => {
  const data = await requestJson('/api/roll-call/files');
  return data.files;
};

export const createRollCallFile = async ({ fileName, csvText, sourceNames }) => {
  return requestJson('/api/roll-call/files', {
    method: 'POST',
    body: { fileName, csvText, sourceNames },
  });
};

export const fetchRollCallFile = async (fileId) => {
  return requestJson(`/api/roll-call/files/${fileId}`);
};

export const fetchRollCallStories = async (fileId) => {
  const data = await requestJson(`/api/roll-call/files/${fileId}/stories`);
  return data.stories;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateRollCallStory = async (fileId, { names, csv } = {}) => {
  const started = await requestJson(`/api/roll-call/files/${fileId}/stories/generate`, {
    method: 'POST',
    body: { names, csv },
  });

  // New servers return a job and we poll. Keep a fallback for any old
  // deploy that still returns the finished story synchronously.
  if (!started?.jobId) {
    return started;
  }

  const jobId = started.jobId;
  // Full camp rosters (~250 names) with Opus + skill audits routinely take
  // 15–30+ minutes. Keep polling long enough that the browser doesn't give up
  // while the server is still working.
  const deadline = Date.now() + 45 * 60 * 1000; // 45 minutes

  while (Date.now() < deadline) {
    await sleep(5000);
    const status = await requestJson(`/api/roll-call/stories/generate/${jobId}`);
    if (status.status === 'done') {
      return status;
    }
    if (status.status === 'error') {
      throw new Error(status.error || 'Failed to generate script');
    }
  }

  throw new Error(
    'Still generating after 45 minutes. Refresh the page and check your saved stories — it may have finished in the background.'
  );
};

export const updateRollCallStory = async (storyId, { story, breakName }) => {
  return requestJson(`/api/roll-call/stories/${storyId}`, {
    method: 'PUT',
    body: { story, breakName },
  });
};

export const parseRollCallCsv = (csv) => {
  const names = parseNamesFromCsv(csv);
  if (names.length === 0) {
    throw new Error('No names found in CSV');
  }
  return names;
};

export const downloadStoryText = (story, fileName = 'rollcall.txt') => {
  const blob = new Blob([story], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, fileName);
};

export const generateRollCallPowerpoint = async ({ text, breakName }) => {
  const blob = await postBlob('/api/roll-call/powerpoint', { text, breakName });
  downloadBlob(blob, 'roll-call.pptx');
};
