import api from './api.js';

// Keep in sync with ADDITIONAL_ROOMS_SESSIONS in lib/util/constants.js
export const SESSION_LOCATIONS = [
  'Little Theater',
  'Evergreen',
  'Meeting Hall',
  'Career',
  'Mt. St. Helens',
  'Plant',
  'Star',
  'Education Classroom',
  'Library',
  'Hampton 1',
  'Hampton 2',
  'Wildlife',
  'Survival',
  'Water Resources',
  'Mammal',
  'Cafeteria',
  'Pavilion',
  'Kitchen Porch',
  'Gym',
  'Sasquatch',
];

export const formatActivityWithLocation = (name, location) => (
  location ? `${name} — ${location}` : name
);

/**
 * Load location assignments for workshops or committees (kept independent).
 * @param {'workshop'|'committee'} kind
 * @returns {Promise<Array<{ key: string, location: string, label: string }>>}
 */
export const fetchLocationAssignments = async (kind) => {
  const path = kind === 'workshop' ? '/api/workshops' : '/api/committees';
  const labelPrefix = kind === 'workshop' ? 'Workshop' : 'Committee';
  try {
    const { data } = await api.get(path);
    const items = Array.isArray(data) ? data : [];
    return items
      .filter((item) => item?.location)
      .map((item) => ({
        key: `${kind}:${item._id}`,
        location: item.location,
        label: `${labelPrefix}: ${item.name}`,
      }));
  } catch (err) {
    // Empty lists currently 404 from these endpoints.
    if (err?.response?.status === 404) {
      return [];
    }
    console.error(`Failed to load ${kind} locations:`, err);
    return [];
  }
};

/**
 * Split session rooms into available vs occupied (excluding the current activity's own room).
 */
export const partitionSessionLocations = (currentLocation, assignments, currentKey) => {
  const takenBy = new Map();
  for (const assignment of assignments) {
    if (!assignment.location || assignment.key === currentKey) continue;
    takenBy.set(assignment.location, assignment);
  }

  const available = SESSION_LOCATIONS.filter((room) => !takenBy.has(room));
  const occupied = SESSION_LOCATIONS
    .filter((room) => takenBy.has(room))
    .map((room) => ({
      location: room,
      label: takenBy.get(room).label,
    }));

  // Keep the current selection visible even if the assignments list is stale.
  if (currentLocation && !available.includes(currentLocation) && !occupied.some((item) => item.location === currentLocation)) {
    available.push(currentLocation);
  }

  return { available, occupied };
};
