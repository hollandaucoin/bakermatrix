import {
  CACHE_KEYS,
  addOutboxItem,
  clearOutbox,
  clearOutboxForResourceType,
  getCacheEntry,
  getOutboxItems,
  setCacheEntry,
} from './offlineStorage.js';

export const RESOURCE_TYPES = {
  COMMITTEE_SUBMISSION: 'committee-submission',
  WORKSHOP_SUBMISSION: 'workshop-submission',
  NOTES: 'notes',
};

const SUBMISSION_GET_URL = {
  [RESOURCE_TYPES.COMMITTEE_SUBMISSION]: '/api/committee-submissions',
  [RESOURCE_TYPES.WORKSHOP_SUBMISSION]: '/api/workshop-submissions',
  [RESOURCE_TYPES.NOTES]: '/api/notes',
};

const buildOptimisticSubmission = (existing, body, resourceType) => {
  const now = new Date().toISOString();
  const localId = existing?.data?._id || `local-${crypto.randomUUID()}`;

  if (resourceType === RESOURCE_TYPES.COMMITTEE_SUBMISSION) {
    return {
      ...(existing?.data || {}),
      _id: localId,
      assignments: (body.assignments || []).map((assignment) => ({
        name: assignment.name,
        committee: assignment.committee
          ? (typeof assignment.committee === 'object'
            ? assignment.committee
            : { _id: assignment.committee })
          : null,
      })),
      updatedAt: now,
      pendingSync: true,
    };
  }

  return {
    ...(existing?.data || {}),
    _id: localId,
    assignments: (body.assignments || []).map((assignment) => ({
      name: assignment.name,
      workshop1: assignment.workshop1
        ? (typeof assignment.workshop1 === 'object'
          ? assignment.workshop1
          : { _id: assignment.workshop1 })
        : null,
      workshop2: assignment.workshop2
        ? (typeof assignment.workshop2 === 'object'
          ? assignment.workshop2
          : { _id: assignment.workshop2 })
        : null,
    })),
    updatedAt: now,
    pendingSync: true,
  };
};

const cacheKeyForResource = (resourceType) => {
  if (resourceType === RESOURCE_TYPES.COMMITTEE_SUBMISSION) {
    return CACHE_KEYS.COMMITTEE_SUBMISSION;
  }
  if (resourceType === RESOURCE_TYPES.WORKSHOP_SUBMISSION) {
    return CACHE_KEYS.WORKSHOP_SUBMISSION;
  }
  if (resourceType === RESOURCE_TYPES.NOTES) {
    return CACHE_KEYS.NOTES;
  }
  return null;
};

const buildOptimisticNotes = (existing, body) => ({
  ...(existing?.data || {}),
  ...body,
  updatedAt: new Date().toISOString(),
  pendingSync: true,
});

export const queueOfflineWrite = async ({ method, url, body, resourceType }) => {
  const cacheKey = cacheKeyForResource(resourceType);

  if (resourceType === RESOURCE_TYPES.NOTES) {
    await clearOutboxForResourceType(resourceType);
    await addOutboxItem({
      method: 'PUT',
      url: SUBMISSION_GET_URL[RESOURCE_TYPES.NOTES],
      body,
      resourceType,
    });

    const existing = cacheKey ? await getCacheEntry(cacheKey) : null;
    const optimistic = buildOptimisticNotes(existing, body);
    if (cacheKey) {
      await setCacheEntry(cacheKey, {
        data: optimistic,
        status: 200,
        updatedAt: Date.now(),
      });
    }

    return { data: optimistic, status: 202, offline: true, queued: true };
  }

  const existing = cacheKey ? await getCacheEntry(cacheKey) : null;
  const serverId = existing?.data?._id;
  const hasServerId = serverId && !String(serverId).startsWith('local-');

  const createUrl = SUBMISSION_GET_URL[resourceType];

  await clearOutboxForResourceType(resourceType);

  if (method === 'DELETE') {
    if (hasServerId) {
      await addOutboxItem({ method: 'DELETE', url, body, resourceType });
    }
    if (cacheKey) {
      await setCacheEntry(cacheKey, { data: null, status: 404, updatedAt: Date.now() });
    }
    return { data: null, status: 200, offline: true, queued: true };
  }

  const outboxMethod = hasServerId ? 'PUT' : 'POST';
  const outboxUrl = hasServerId ? url : createUrl;

  await addOutboxItem({
    method: outboxMethod,
    url: outboxUrl,
    body,
    resourceType,
  });

  const optimistic = buildOptimisticSubmission(existing, body, resourceType);
  if (cacheKey) {
    await setCacheEntry(cacheKey, {
      data: optimistic,
      status: 200,
      updatedAt: Date.now(),
    });
  }

  return { data: optimistic, status: 202, offline: true, queued: true };
};

const applySyncResult = async (item, responseData, status) => {
  const cacheKey = cacheKeyForResource(item.resourceType);
  if (!cacheKey) return;

  if (item.method === 'DELETE') {
    await setCacheEntry(cacheKey, { data: null, status: 404, updatedAt: Date.now() });
    return;
  }

  await setCacheEntry(cacheKey, {
    data: responseData,
    status,
    updatedAt: Date.now(),
  });
};

const resolveSyncItem = async (item, requestFn) => {
  if (item.resourceType === RESOURCE_TYPES.NOTES) {
    return item;
  }

  if (item.method !== 'POST') return item;

  const getUrl = SUBMISSION_GET_URL[item.resourceType];
  if (!getUrl) return item;

  const cacheKey = cacheKeyForResource(item.resourceType);
  const cached = cacheKey ? await getCacheEntry(cacheKey) : null;
  const cachedId = cached?.data?._id;
  if (cachedId && !String(cachedId).startsWith('local-')) {
    return {
      ...item,
      method: 'PUT',
      url: `${getUrl}/${cachedId}`,
    };
  }

  try {
    const { data } = await requestFn('GET', getUrl);
    if (data?._id) {
      return {
        ...item,
        method: 'PUT',
        url: `${getUrl}/${data._id}`,
      };
    }
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
  }

  return item;
};

let syncInFlight = null;

export const syncOutbox = async (requestFn) => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = syncOutboxOnce(requestFn).finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
};

const syncOutboxOnce = async (requestFn) => {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, remaining: await getOutboxItems() };
  }

  const items = await getOutboxItems();
  if (items.length === 0) {
    return { synced: 0, failed: 0, remaining: [] };
  }

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const resolvedItem = await resolveSyncItem(item, requestFn);
      const response = await requestFn(resolvedItem.method, resolvedItem.url, resolvedItem.body);
      await applySyncResult(resolvedItem, response.data, response.status);
      await clearOutboxForResourceType(resolvedItem.resourceType);
      synced += 1;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message || '';

      if (
        item.method === 'POST'
        && (status === 409 || /already exists|duplicate/i.test(message))
      ) {
        await clearOutboxForResourceType(item.resourceType);
        synced += 1;
        continue;
      }

      failed += 1;
      break;
    }
  }

  if (synced > 0 && failed === 0) {
    await clearOutbox();
  }

  const remaining = await getOutboxItems();
  return { synced, failed, remaining };
};

export const notifyOutboxChange = () => {
  window.dispatchEvent(new Event('offline-outbox-change'));
};
