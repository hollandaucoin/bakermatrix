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
