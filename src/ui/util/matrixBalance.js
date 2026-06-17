const COMMITTEE_LETTER_TO_NAME = {
  K: 'knowledge',
  C: 'compassion',
  H: 'humor',
  O: 'other',
};

/** "Jane Doe - K *" -> { committee: 'knowledge', committeeLead: true } */
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

export const hasCommitteeBalanceIssues = (balance) => (
  (balance?.issues || []).some((issue) => /members are uneven|leads are not on both halves/.test(issue))
);
