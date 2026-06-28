/** SC posting in a dorm where one of their own council JCs lives. */
export const councilHasPostingSeparationViolation = (council) => {
  if (council?.hasPostingSeparationViolation) {
    return true;
  }

  const postingName = council?.scPostingDorm?.name;
  if (!postingName || postingName === 'No Dorm Assigned') {
    return false;
  }

  return (council.juniorCounselors || []).some(
    (jc) => jc.dorm && jc.dorm !== 'No Dorm' && jc.dorm === postingName
  );
};

/** SC/JC fields that move together when swapping pairings between council slots. */
export const COUNCIL_PAIRING_FIELDS = [
  'seniorCounselor',
  'seniorCounselorId',
  'juniorCounselors',
  'scPostingDorm',
  'hasPostingSeparationViolation',
];

export const swapCouncilPairings = (councils, fromCouncilIdx, toCouncilIdx) => {
  const next = (councils || []).map((council) => ({ ...council }));
  const fromCouncil = next[fromCouncilIdx];
  const toCouncil = next[toCouncilIdx];
  if (!fromCouncil || !toCouncil || fromCouncilIdx === toCouncilIdx) {
    return next;
  }

  for (const field of COUNCIL_PAIRING_FIELDS) {
    const temp = fromCouncil[field];
    fromCouncil[field] = toCouncil[field];
    toCouncil[field] = temp;
  }

  return next;
};

/** "Jane Doe - K *" -> "Jane Doe" */
export const parseSeniorCounselorName = (label) => {
  const text = String(label || '');
  const idx = text.lastIndexOf(' - ');
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
};

const parseFirstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

const collectJcsInDorm = (councils, dormName) => {
  const firstNames = [];
  for (const council of councils || []) {
    for (const jc of council.juniorCounselors || []) {
      if (jc.dorm && jc.dorm !== 'No Dorm' && jc.dorm === dormName) {
        firstNames.push(parseFirstName(jc.name));
      }
    }
  }
  return firstNames.join(', ');
};

export const enrichPostingDorms = (councils) => {
  const next = (councils || []).map((council) => ({
    ...council,
    scPostingDorm: council.scPostingDorm
      ? { ...council.scPostingDorm }
      : { name: 'No Dorm Assigned', jcs: '', partner: null },
  }));

  for (let i = 0; i < next.length; i += 1) {
    const council = next[i];
    const postingName = council.scPostingDorm?.name;

    if (!postingName || postingName === 'No Dorm Assigned') {
      council.scPostingDorm = { name: 'No Dorm Assigned', jcs: '', partner: null };
      continue;
    }

    let partner = null;
    for (let j = 0; j < next.length; j += 1) {
      if (i === j) continue;
      const other = next[j];
      if (other.scPostingDorm?.name === postingName) {
        partner = parseFirstName(parseSeniorCounselorName(other.seniorCounselor));
        break;
      }
    }

    council.scPostingDorm = {
      name: postingName,
      jcs: collectJcsInDorm(next, postingName),
      partner,
    };
  }

  return next;
};

export const updateCouncilPostingDorm = (councils, councilIdx, dormName) => {
  const next = (councils || []).map((council, i) => {
    if (i !== councilIdx) {
      return {
        ...council,
        scPostingDorm: council.scPostingDorm ? { ...council.scPostingDorm } : undefined,
      };
    }

    return {
      ...council,
      scPostingDorm: {
        name: dormName || 'No Dorm Assigned',
        jcs: '',
        partner: null,
      },
    };
  });

  return enrichPostingDorms(next);
};

export const swapCouncilRooms = (councils, fromCouncilIdx, toCouncilIdx) => {
  const next = (councils || []).map((council) => ({ ...council }));
  const fromCouncil = next[fromCouncilIdx];
  const toCouncil = next[toCouncilIdx];
  if (!fromCouncil || !toCouncil || fromCouncilIdx === toCouncilIdx) {
    return next;
  }

  const temp = fromCouncil.room;
  fromCouncil.room = toCouncil.room;
  toCouncil.room = temp;

  return next;
};
