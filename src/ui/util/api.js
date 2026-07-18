// Lightweight fetch-based API client with offline cache + submission outbox.
//
// GET requests to SC-facing endpoints are cached in IndexedDB.
// POST/PUT/DELETE for committee/workshop submissions and PUT for notes queue locally when offline.

import {
  URL_CACHE_KEY,
  setCacheEntry,
  getCacheEntry,
  saveSession,
  getCachedSession,
  clearSession,
} from './offlineStorage.js';
import {
  queueOfflineWrite,
  notifyOutboxChange,
  RESOURCE_TYPES,
} from './offlineSync.js';

let authExpiredHandler = null;

export const setAuthExpiredHandler = (handler) => {
  authExpiredHandler = handler;
};

export const onSessionExpired = async () => {
  await clearSession();
  authExpiredHandler?.();
};

const isLoginRequest = (url) => url.split('?')[0] === '/api/auth/login';

const handleUnauthorized = async (url) => {
  if (isLoginRequest(url)) {
    return;
  }
  await onSessionExpired();
};

// Captive portals / flaky proxies can answer with HTML instead of JSON.
// Never treat those responses as real API answers.
const isJsonPayload = (data) => data !== null && typeof data === 'object';

const isAuthStatusUrl = (url) => url.split('?')[0] === '/api/auth/status';

// Returns true only for a trustworthy answer from our server.
const applyAuthStatusResult = async (data) => {
  if (!isJsonPayload(data) || data.success !== true) {
    return false;
  }
  if (data.authenticated) {
    await saveSession({
      success: true,
      authenticated: true,
      admin: Boolean(data.admin),
      user: data.user,
    });
  } else {
    await clearSession();
  }
  return true;
};

const OFFLINE_WRITE_ROUTES = [
  { match: /^\/api\/committee-submissions\/?$/, method: 'POST', resourceType: RESOURCE_TYPES.COMMITTEE_SUBMISSION },
  { match: /^\/api\/committee-submissions\/[^/]+$/, method: 'PUT', resourceType: RESOURCE_TYPES.COMMITTEE_SUBMISSION },
  { match: /^\/api\/committee-submissions\/[^/]+$/, method: 'DELETE', resourceType: RESOURCE_TYPES.COMMITTEE_SUBMISSION },
  { match: /^\/api\/workshop-submissions\/?$/, method: 'POST', resourceType: RESOURCE_TYPES.WORKSHOP_SUBMISSION },
  { match: /^\/api\/workshop-submissions\/[^/]+$/, method: 'PUT', resourceType: RESOURCE_TYPES.WORKSHOP_SUBMISSION },
  { match: /^\/api\/workshop-submissions\/[^/]+$/, method: 'DELETE', resourceType: RESOURCE_TYPES.WORKSHOP_SUBMISSION },
  { match: /^\/api\/notes\/?$/, method: 'PUT', resourceType: RESOURCE_TYPES.NOTES },
];

const CACHE_URL_BY_RESOURCE = {
  [RESOURCE_TYPES.COMMITTEE_SUBMISSION]: '/api/committee-submissions',
  [RESOURCE_TYPES.WORKSHOP_SUBMISSION]: '/api/workshop-submissions',
  [RESOURCE_TYPES.NOTES]: '/api/notes',
};

const getOfflineWriteConfig = (method, url) => {
  const path = url.split('?')[0];
  return OFFLINE_WRITE_ROUTES.find(
    (route) => route.method === method && route.match.test(path)
  );
};

const buildMeta = ({ fromCache = false, cachedAt = null, offline = false } = {}) => ({
  fromCache,
  cachedAt,
  offline,
});

async function requestDirect(method, url, body) {
  const options = { method, credentials: 'include', headers: {} };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    // Only trust a 401 that carries our server's JSON body — a portal/proxy
    // 401 with an HTML page must not wipe the saved login.
    if (response.status === 401 && isJsonPayload(data)) {
      await handleUnauthorized(url);
    }
    const message = (data && data.error) || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.response = { status: response.status, data };
    throw error;
  }

  return { data, status: response.status };
}

async function readCachedGet(url) {
  const cacheKey = URL_CACHE_KEY[url.split('?')[0]];
  if (!cacheKey) return null;

  const entry = await getCacheEntry(cacheKey);
  if (!entry) return null;

  if (entry.status === 404) {
    const error = new Error(entry.data?.error || 'Not found');
    error.response = { status: 404, data: entry.data };
    error.fromCache = true;
    error.cachedAt = entry.updatedAt;
    throw error;
  }

  return {
    data: entry.data,
    status: entry.status,
    meta: buildMeta({ fromCache: true, cachedAt: entry.updatedAt, offline: !navigator.onLine }),
  };
}

async function writeCachedGet(url, data, status) {
  const cacheKey = URL_CACHE_KEY[url.split('?')[0]];
  if (!cacheKey) return;

  // Don't overwrite good cached data with portal HTML or other non-JSON noise.
  if (data !== null && !isJsonPayload(data)) return;

  await setCacheEntry(cacheKey, {
    data,
    status,
    updatedAt: Date.now(),
  });
}

const inflightGets = new Map();

async function request(method, url, body) {
  if (method === 'GET') {
    const path = url.split('?')[0];
    const existing = inflightGets.get(path);
    if (existing) return existing;

    const promise = requestInner(method, url, body).finally(() => {
      inflightGets.delete(path);
    });
    inflightGets.set(path, promise);
    return promise;
  }

  return requestInner(method, url, body);
}

async function requestInner(method, url, body) {
  const cacheKey = URL_CACHE_KEY[url.split('?')[0]];
  const offlineWrite = getOfflineWriteConfig(method, url);

  if (offlineWrite && !navigator.onLine) {
    const queued = await queueOfflineWrite({
      method,
      url,
      body,
      resourceType: offlineWrite.resourceType,
    });
    notifyOutboxChange();
    return { ...queued, meta: buildMeta({ offline: true }) };
  }

  if (method === 'GET' && cacheKey) {
    if (!navigator.onLine) {
      const cached = await readCachedGet(url);
      if (cached) return cached;
      throw new Error('You are offline and this data is not cached yet. Connect to Wi‑Fi once to download it.');
    }

    try {
      const response = await requestDirect(method, url, body);
      if (isAuthStatusUrl(url)) {
        const trustworthy = await applyAuthStatusResult(response.data);
        if (!trustworthy) {
          // Garbage answer (captive portal, proxy). Use the saved login instead.
          const cached = await readCachedGet(url).catch(() => null);
          if (cached) return cached;
          throw new Error('Could not verify login. Check your connection.');
        }
      }
      await writeCachedGet(url, response.data, response.status);
      return { ...response, meta: buildMeta() };
    } catch (error) {
      if (error.response?.status === 404) {
        await writeCachedGet(url, error.response.data, 404);
      }
      if (error.response?.status === 401) {
        throw error;
      }
      const cached = await readCachedGet(url).catch(() => null);
      if (cached) return cached;
      throw error;
    }
  }

  if (!navigator.onLine) {
    throw new Error('You are offline. Connect to Wi‑Fi to complete this action.');
  }

  try {
    const response = await requestDirect(method, url, body);

    if (isAuthStatusUrl(url)) {
      await applyAuthStatusResult(response.data);
    }

    if (method === 'GET' && cacheKey) {
      await writeCachedGet(url, response.data, response.status);
    }

    if (offlineWrite && (method === 'POST' || method === 'PUT')) {
      const cacheUrl = CACHE_URL_BY_RESOURCE[offlineWrite.resourceType];
      if (cacheUrl) {
        await writeCachedGet(cacheUrl, response.data, response.status);
      }
    }

    if (offlineWrite && method === 'DELETE') {
      const deleteCacheUrl = CACHE_URL_BY_RESOURCE[offlineWrite.resourceType];
      if (deleteCacheUrl) {
        await writeCachedGet(deleteCacheUrl, null, 404);
      }
    }

    if (url === '/api/auth/logout') {
      await clearSession();
    }

    return { ...response, meta: buildMeta() };
  } catch (error) {
    if (error.response?.status === 401) {
      throw error;
    }
    if (method === 'GET' && cacheKey) {
      const cached = await readCachedGet(url).catch(() => null);
      if (cached) return cached;
    }
    throw error;
  }
}

export const syncRequest = (method, url, body) => requestDirect(method, url, body);

export const restoreCachedAuth = async () => {
  const session = await getCachedSession();
  if (session?.authenticated) {
    return {
      authenticated: true,
      admin: Boolean(session.admin),
      user: session.user,
    };
  }
  return null;
};

export const saveOfflineSessionFromLogin = async (user) => {
  await saveSession({
    success: true,
    authenticated: true,
    admin: Boolean(user?.admin),
    user: {
      username: user?.username,
      admin: Boolean(user?.admin),
      userType: user?.userType,
    },
  });
};

const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  delete: (url) => request('DELETE', url),
};

export default api;
