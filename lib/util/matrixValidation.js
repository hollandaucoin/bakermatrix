/** Parse "School Name - 12" labels stored on matrix councils. */
export const parseSchoolLabel = (label) => {
  const match = String(label || '').match(/^(.+?)\s*-\s*(\d+)\s*$/);
  if (!match) {
    return { name: String(label || '').trim(), delegateCount: 0 };
  }
  return { name: match[1].trim(), delegateCount: Number(match[2]) };
};

export const formatSchoolLabel = (name, delegateCount) => `${name} - ${delegateCount}`;

export const normalizeSchoolName = (name) => String(name || '').replace(/\s+High School/gi, ' HS').trim();

/** "Jane Doe - K *" -> "Jane Doe" */
export const parseSeniorCounselorName = (label) => {
  const text = String(label || '');
  const idx = text.lastIndexOf(' - ');
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
};

/**
 * School ids an SC must not council: associated + previous schools for SC and paired JCs.
 */
export const getConflictingSchoolIds = (seniorCounselor) => {
  const conflictingIds = new Set();
  if (!seniorCounselor) return conflictingIds;

  if (seniorCounselor._associatedSchool) {
    const school = seniorCounselor._associatedSchool;
    const id = school._id ? school._id.toString() : String(school);
    conflictingIds.add(id);
  }
  if (seniorCounselor._previousSchools?.length) {
    seniorCounselor._previousSchools.forEach((school) => {
      if (!school) return;
      const id = school._id ? school._id.toString() : String(school);
      conflictingIds.add(id);
    });
  }

  for (const jc of [seniorCounselor._jcPairing, seniorCounselor._jcPairing2]) {
    if (!jc) continue;
    if (jc._associatedSchool) {
      const id = jc._associatedSchool._id
        ? jc._associatedSchool._id.toString()
        : String(jc._associatedSchool);
      conflictingIds.add(id);
    }
    if (jc._previousSchools?.length) {
      jc._previousSchools.forEach((school) => {
        if (!school) return;
        const id = school._id ? school._id.toString() : String(school);
        conflictingIds.add(id);
      });
    }
  }

  return conflictingIds;
};

export const buildSchoolLookup = (schools) => {
  const byNormalizedName = new Map();
  schools.forEach((school) => {
    const id = school._id.toString();
    byNormalizedName.set(normalizeSchoolName(school.name), id);
    byNormalizedName.set(school.name.trim(), id);
  });
  return byNormalizedName;
};

export const findSchoolIdForLabel = (label, schoolLookup) => {
  const { name } = parseSchoolLabel(label);
  return schoolLookup.get(normalizeSchoolName(name))
    || schoolLookup.get(name.trim())
    || null;
};

const resolveSeniorCounselor = (council, seniorCounselors) => {
  if (council.seniorCounselorId) {
    const byId = seniorCounselors.find((sc) => sc._id.toString() === council.seniorCounselorId);
    if (byId) return byId;
  }

  const targetName = parseSeniorCounselorName(council.seniorCounselor).toLowerCase();
  return seniorCounselors.find((sc) => sc.name.trim().toLowerCase() === targetName);
};

export const computePostingSeparationViolation = (council) => {
  const postingName = council?.scPostingDorm?.name;
  if (!postingName || postingName === 'No Dorm Assigned') {
    return false;
  }

  return (council.juniorCounselors || []).some(
    (jc) => jc.dorm && jc.dorm !== 'No Dorm' && jc.dorm === postingName
  );
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

/** Recompute JC list and posting partners from posting dorm names across councils. */
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

/**
 * Posting rules (matches matrix generator):
 * - Male SCs post in female dorms.
 * - Female SCs post in male dorms (1–2 SCs per male dorm).
 */
export const computePostingDormIssues = (councils, dorms, seniorCounselors) => {
  const issues = [];
  const femaleDormNames = (dorms || [])
    .filter((dorm) => dorm.type === 'female')
    .map((dorm) => dorm.name);
  const maleDormNames = (dorms || [])
    .filter((dorm) => dorm.type === 'male')
    .map((dorm) => dorm.name);

  const postingsByDorm = new Map();
  for (const council of councils || []) {
    const postingName = council.scPostingDorm?.name;
    if (!postingName || postingName === 'No Dorm Assigned') {
      issues.push(`${parseSeniorCounselorName(council.seniorCounselor)} has no posting dorm`);
      continue;
    }
    postingsByDorm.set(postingName, (postingsByDorm.get(postingName) || 0) + 1);

    const sc = resolveSeniorCounselor(council, seniorCounselors);
    if (!sc) continue;

    if (sc.gender === 'male' && !femaleDormNames.includes(postingName)) {
      issues.push(`${sc.name} (male SC) must post in a female dorm, not ${postingName}`);
    }
    if (sc.gender === 'female' && !maleDormNames.includes(postingName)) {
      issues.push(`${sc.name} (female SC) must post in a male dorm, not ${postingName}`);
    }
  }

  for (const dormName of femaleDormNames) {
    const count = postingsByDorm.get(dormName) || 0;
    if (count === 0) {
      issues.push(`${dormName} (female dorm) has no posting SC`);
    }
  }

  for (const dormName of maleDormNames) {
    const count = postingsByDorm.get(dormName) || 0;
    if (count === 0) {
      issues.push(`${dormName} (male dorm) has no posting SC`);
    } else if (count > 2) {
      issues.push(`${dormName} (male dorm) has ${count} posting SCs (max 2)`);
    }
  }

  return issues;
};

export const validateMatrixCouncils = (councils, seniorCounselors, schools) => {
  const schoolLookup = buildSchoolLookup(schools);

  return enrichPostingDorms(councils).map((council) => {
    const sc = resolveSeniorCounselor(council, seniorCounselors);
    const conflictIds = getConflictingSchoolIds(sc);
    const conflictingSchools = [];

    for (const schoolLabel of council.schools || []) {
      const schoolId = findSchoolIdForLabel(schoolLabel, schoolLookup);
      if (schoolId && conflictIds.has(schoolId)) {
        conflictingSchools.push(schoolLabel);
      }
    }

    const delegateCount = (council.schools || []).reduce(
      (sum, label) => sum + parseSchoolLabel(label).delegateCount,
      0
    );

    const validatedCouncil = {
      ...council,
      seniorCounselorId: council.seniorCounselorId || (sc ? sc._id.toString() : undefined),
      delegateCount,
      conflictingSchools,
      hasConflicts: conflictingSchools.length > 0,
    };

    validatedCouncil.hasPostingSeparationViolation = computePostingSeparationViolation(validatedCouncil);

    return validatedCouncil;
  });
};

const COMMITTEE_LETTER_TO_NAME = {
  K: 'knowledge',
  C: 'compassion',
  H: 'humor',
  O: 'other',
};

export const parseSeniorCounselorCommittee = (label) => {
  const text = String(label || '');
  const idx = text.lastIndexOf(' - ');
  if (idx === -1) return { committee: null, committeeLead: false };

  const suffix = text.slice(idx + 3).trim();
  const committeeLead = /\s*\*$/.test(suffix);
  const letter = suffix.replace(/\s*\*$/, '').trim().toUpperCase();
  const committee = COMMITTEE_LETTER_TO_NAME[letter] || null;

  return { committee, committeeLead };
};

const halfStatsFromCouncils = (councilList) => {
  const stats = {
    size: councilList.length,
    committee: { knowledge: 0, compassion: 0, humor: 0, other: 0 },
    leads: { knowledge: 0, compassion: 0, humor: 0, other: 0 },
  };

  for (const council of councilList) {
    const { committee, committeeLead } = parseSeniorCounselorCommittee(council.seniorCounselor);
    if (!committee) continue;
    stats.committee[committee]++;
    if (committeeLead) stats.leads[committee]++;
  }

  return stats;
};

export const computeMatrixBalance = (councils, group1Size) => {
  const list = councils || [];
  const splitAt = group1Size ?? Math.ceil(list.length / 2);
  const half1 = list.filter((council) => council.number <= splitAt);
  const half2 = list.filter((council) => council.number > splitAt);

  const g1Stats = halfStatsFromCouncils(half1);
  const g2Stats = halfStatsFromCouncils(half2);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const issues = [];

  for (const committee of ['knowledge', 'compassion', 'humor', 'other']) {
    if (Math.abs(g1Stats.committee[committee] - g2Stats.committee[committee]) > 1) {
      issues.push(
        `${cap(committee)} members are uneven across halves (${g1Stats.committee[committee]} vs ${g2Stats.committee[committee]})`
      );
    }
    const totalLeads = g1Stats.leads[committee] + g2Stats.leads[committee];
    if (totalLeads >= 2 && (g1Stats.leads[committee] === 0 || g2Stats.leads[committee] === 0)) {
      issues.push(
        `${cap(committee)} leads are not on both halves (${g1Stats.leads[committee]} vs ${g2Stats.leads[committee]})`
      );
    }
  }

  return { group1: g1Stats, group2: g2Stats, issues };
};
