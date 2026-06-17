const DB_NAME = 'bakermatrix-offline';
const DB_VERSION = 1;
const CACHE_STORE = 'cache';
const OUTBOX_STORE = 'outbox';

export const CACHE_KEYS = {
  SESSION: 'session',
  MATRIX_SELECTED: 'matrix/selected',
  COMMITTEES_LIST: 'committees/list',
  WORKSHOPS_LIST: 'workshops/list',
  COMMITTEE_SUBMISSION: 'committee/submission',
  WORKSHOP_SUBMISSION: 'workshop/submission',
};

export const URL_CACHE_KEY = {
  '/api/auth/status': CACHE_KEYS.SESSION,
  '/api/matrices/selected': CACHE_KEYS.MATRIX_SELECTED,
  '/api/committees': CACHE_KEYS.COMMITTEES_LIST,
  '/api/workshops': CACHE_KEYS.WORKSHOPS_LIST,
  '/api/committee-submissions': CACHE_KEYS.COMMITTEE_SUBMISSION,
  '/api/workshop-submissions': CACHE_KEYS.WORKSHOP_SUBMISSION,
};

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      db.createObjectStore(CACHE_STORE);
    }
    if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
      const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      outbox.createIndex('resourceType', 'resourceType', { unique: false });
      outbox.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runStore = async (storeName, mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
};

export const setCacheEntry = async (key, entry) => {
  await runStore(CACHE_STORE, 'readwrite', (store) => {
    store.put(entry, key);
  });
};

export const getCacheEntry = async (key) => {
  return runStore(CACHE_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }));
};

export const clearCacheEntry = async (key) => {
  await runStore(CACHE_STORE, 'readwrite', (store) => {
    store.delete(key);
  });
};

export const saveSession = async (session) => {
  await setCacheEntry(CACHE_KEYS.SESSION, {
    data: session,
    status: 200,
    updatedAt: Date.now(),
  });
};

export const getCachedSession = async () => {
  const entry = await getCacheEntry(CACHE_KEYS.SESSION);
  return entry?.data ?? null;
};

export const clearSession = async () => {
  await clearCacheEntry(CACHE_KEYS.SESSION);
};

export const addOutboxItem = async (item) => {
  const id = item.id || crypto.randomUUID();
  const record = {
    id,
    method: item.method,
    url: item.url,
    body: item.body,
    resourceType: item.resourceType,
    createdAt: item.createdAt || new Date().toISOString(),
  };

  await runStore(OUTBOX_STORE, 'readwrite', (store) => {
    store.put(record);
  });

  return id;
};

export const updateOutboxItem = async (id, updates) => {
  const items = await readAllOutboxItems();
  const existing = items.find((item) => item.id === id);
  if (!existing) return null;

  const next = { ...existing, ...updates };
  await runStore(OUTBOX_STORE, 'readwrite', (store) => {
    store.put(next);
  });
  return next;
};

export const removeOutboxItem = async (id) => {
  await runStore(OUTBOX_STORE, 'readwrite', (store) => {
    store.delete(id);
  });
};

export const clearOutboxForResourceType = async (resourceType) => {
  const items = await readAllOutboxItems();
  const ids = items.filter((item) => item.resourceType === resourceType).map((item) => item.id);
  if (ids.length === 0) return;

  await runStore(OUTBOX_STORE, 'readwrite', (store) => {
    ids.forEach((id) => store.delete(id));
  });
};

const readAllOutboxItems = async () => runStore(OUTBOX_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
  const request = store.getAll();
  request.onsuccess = () => {
    const items = request.result || [];
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    resolve(items);
  };
  request.onerror = () => reject(request.error);
}));

const VALID_RESOURCE_TYPES = new Set(['committee-submission', 'workshop-submission']);

export const sanitizeOutbox = async () => {
  const items = await readAllOutboxItems();
  if (items.length === 0) return;

  const invalidIds = items
    .filter((item) => !item.resourceType || !VALID_RESOURCE_TYPES.has(item.resourceType))
    .map((item) => item.id);

  if (invalidIds.length > 0) {
    await runStore(OUTBOX_STORE, 'readwrite', (store) => {
      invalidIds.forEach((id) => store.delete(id));
    });
  }

  await getOutboxItems({ prune: true });

  const remaining = await readAllOutboxItems();
  if (remaining.length > 2) {
    await clearOutbox();
  }
};

export const getOutboxItems = async ({ prune = false } = {}) => {
  const items = await readAllOutboxItems();
  const validItems = items.filter(
    (item) => item.resourceType && VALID_RESOURCE_TYPES.has(item.resourceType),
  );
  const latestByResource = new Map();

  for (const item of validItems) {
    latestByResource.set(item.resourceType, item);
  }

  const deduped = Array.from(latestByResource.values())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (prune) {
    const keepIds = new Set(deduped.map((item) => item.id));
    const staleIds = items.filter((item) => !keepIds.has(item.id)).map((item) => item.id);
    if (staleIds.length > 0) {
      await runStore(OUTBOX_STORE, 'readwrite', (store) => {
        staleIds.forEach((id) => store.delete(id));
      });
    }
  }

  return deduped;
};

export const getOutboxCount = async () => {
  const items = await getOutboxItems();
  return items.length;
};

export const getOutboxByResource = async (resourceType) => {
  const items = await getOutboxItems();
  return items.filter((item) => item.resourceType === resourceType);
};

export const clearOutbox = async () => {
  await runStore(OUTBOX_STORE, 'readwrite', (store) => {
    store.clear();
  });
};
