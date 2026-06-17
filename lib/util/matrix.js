import storage from '../storage/index.js';
import { ROOMS_BY_SIZE } from './constants.js';
import { getConflictingSchoolIds } from './matrixValidation.js';

// ============================================================================
// SPECIAL-CASE CONFIGURATION
// ----------------------------------------------------------------------------
// These senior counselors need special placement. They are looked up by _id;
// if an id is not present in the current roster the related handling is simply
// skipped, so the generator always produces a valid matrix even after a reseed.
// Update these ids when the roster changes.
// ============================================================================
const SPECIAL = {
  // SC Chief is always council #1.
  chiefId: '6850f1a3fb1790e1884a903a',
  // These SCs must stay on the same half of camp (same balancing group).
  keepTogetherIds: ['6850e1539e325b9f0c3de757', '6850f37333eaae39735d2a3c'],
};

// Federal Way's SC is assigned to the school group containing the school whose
// name contains this (case-insensitive) substring.
const FEDERAL_WAY_SCHOOL_MATCH = 'federal way';

// ============================================================================
// GENERIC HELPERS
// ============================================================================

// Fisher-Yates in-place shuffle.
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Maximum bipartite matching (Kuhn's algorithm).
 * @param {number[][]} adjacency - adjacency[u] = list of right-node indices u may match.
 * @param {number} leftCount
 * @param {number} rightCount
 * @returns {number[]} matchRight - matchRight[v] = left index matched to right v, or -1.
 */
const maxBipartiteMatching = (adjacency, leftCount, rightCount) => {
  const matchRight = new Array(rightCount).fill(-1);

  const augment = (u, seen) => {
    for (const v of adjacency[u]) {
      if (seen[v]) { continue; }
      seen[v] = true;
      if (matchRight[v] === -1 || augment(matchRight[v], seen)) {
        matchRight[v] = u;
        return true;
      }
    }
    return false;
  };

  for (let u = 0; u < leftCount; u++) {
    augment(u, new Array(rightCount).fill(false));
  }
  return matchRight;
};

// ============================================================================
// SENIOR COUNSELOR HALF-DISTRIBUTION
// ----------------------------------------------------------------------------
// Splits SCs into two balanced halves (group1 / group2) by gender, committee,
// and committee-lead counts, then enforces the special cases (chief to council
// #1, keep-together SCs on the same half).
// ============================================================================
const distributeSeniorCounselors = (seniorCounselors) => {
  const group1 = [];
  const group2 = [];
  const maxSize = Math.ceil(seniorCounselors.length / 2);

  const idOf = (sc) => sc._id.toString();
  const groupArr = (g) => (g === 1 ? group1 : group2);
  const groupOfId = (id) =>
    group1.some((sc) => idOf(sc) === id) ? 1 : (group2.some((sc) => idOf(sc) === id) ? 2 : 0);
  const lockedIds = new Set([SPECIAL.chiefId, ...SPECIAL.keepTogetherIds]);
  const COMMITTEES = ['knowledge', 'compassion', 'humor', 'other'];
  const countIn = (group, pred) => group.reduce((n, sc) => n + (pred(sc) ? 1 : 0), 0);
  const committeeCount = (g, committee) => countIn(groupArr(g), (sc) => sc.committee === committee);

  // Move one SC to the other half. Swaps are always done in matched pairs below,
  // so the two halves stay equal in size.
  const moveToOtherHalf = (sc, fromGroup) => {
    const from = groupArr(fromGroup);
    const idx = from.findIndex((s) => idOf(s) === idOf(sc));
    if (idx === -1) { return; }
    from.splice(idx, 1);
    groupArr(fromGroup === 1 ? 2 : 1).push(sc);
  };

  // ----- Deterministic balanced placement -----
  // Place each SC in the half that best preserves balance. Committee membership
  // dominates the cost, then committee leads, then half size, then gender. Leads
  // are placed first so they split evenly before non-leads fill in, and a hard
  // size cap keeps the two halves equal (within one).
  const placeBalanced = (sc) => {
    if (group1.length >= maxSize) { group2.push(sc); return; }
    if (group2.length >= maxSize) { group1.push(sc); return; }
    const cost = (group) => {
      let c = countIn(group, (x) => x.committee === sc.committee) * 1000;
      if (sc.committeeLead) {
        c += countIn(group, (x) => x.committee === sc.committee && x.committeeLead) * 100;
      }
      c += group.length * 10;
      c += countIn(group, (x) => x.gender === sc.gender);
      return c;
    };
    const c1 = cost(group1);
    const c2 = cost(group2);
    const target = c1 < c2 ? 1 : (c2 < c1 ? 2 : (Math.random() < 0.5 ? 1 : 2));
    groupArr(target).push(sc);
  };

  const leads = shuffle(seniorCounselors.filter((sc) => sc.committeeLead));
  const nonLeads = shuffle(seniorCounselors.filter((sc) => !sc.committeeLead));
  for (const sc of [...leads, ...nonLeads]) { placeBalanced(sc); }

  // --------------------------------------------------------------------------
  // Enforce hard constraints with BALANCED (size-preserving) swaps, repair any
  // committee-member imbalance the swaps introduced, then guarantee a lead of
  // each committee on each half.
  // --------------------------------------------------------------------------

  // Best SC in `group` to swap the other way: same committee + lead status if
  // possible, never the chief or a keep-together member.
  const pickCounterpart = (group, committee, committeeLead) => {
    const eligible = group.filter((sc) => !lockedIds.has(idOf(sc)));
    return eligible.find((sc) => sc.committee === committee && sc.committeeLead === committeeLead)
      || eligible.find((sc) => sc.committee === committee)
      || eligible.find((sc) => sc.committeeLead === committeeLead)
      || eligible[0]
      || null;
  };

  // 1) Keep-together: if split, move one member to the partner's half and swap a
  //    matching counterpart back.
  if (SPECIAL.keepTogetherIds.length === 2) {
    const [aId, bId] = SPECIAL.keepTogetherIds;
    const aGroup = groupOfId(aId);
    const bGroup = groupOfId(bId);
    if (aGroup && bGroup && aGroup !== bGroup) {
      const moveId = bId !== SPECIAL.chiefId ? bId : aId; // never move the chief
      const sourceGroup = groupOfId(moveId);
      const targetGroup = sourceGroup === 1 ? 2 : 1;
      const mover = groupArr(sourceGroup).find((sc) => idOf(sc) === moveId);
      if (mover) {
        const counterpart = pickCounterpart(groupArr(targetGroup), mover.committee, mover.committeeLead);
        moveToOtherHalf(mover, sourceGroup);
        if (counterpart) { moveToOtherHalf(counterpart, targetGroup); }
      }
    }
  }

  // 2) Chief -> group1, swapping with a matching group1 counterpart.
  const chief = [...group1, ...group2].find((sc) => idOf(sc) === SPECIAL.chiefId);
  if (chief && groupOfId(SPECIAL.chiefId) === 2) {
    const counterpart = pickCounterpart(group1, chief.committee, chief.committeeLead);
    moveToOtherHalf(chief, 2);
    if (counterpart) { moveToOtherHalf(counterpart, 1); }
  }

  // 3) Clean up the rare committee imbalance a hard-constraint swap can introduce.
  //    We repair members, then leads, then members again so committee-member
  //    balance gets the final say (lead fixes usually stay within a committee,
  //    but a cross-committee fallback can shift members, so we repair once more).

  // Even committee MEMBERS across halves. With equal halves the committee diffs
  // sum to zero, so a committee over-represented on one half implies another is
  // over-represented on the other - trade one of each to even both out.
  const repairMembers = () => {
    for (let iter = 0; iter < 50; iter++) {
      const diffs = {};
      COMMITTEES.forEach((c) => { diffs[c] = committeeCount(1, c) - committeeCount(2, c); });
      if (!COMMITTEES.some((c) => Math.abs(diffs[c]) >= 2)) { break; }

      let moved = false;
      for (const heavy of COMMITTEES.filter((c) => diffs[c] >= 2)) {
        const mover = groupArr(1).find((sc) => sc.committee === heavy && !lockedIds.has(idOf(sc)));
        if (!mover) { continue; }
        const back = COMMITTEES
          .filter((c) => c !== heavy && diffs[c] <= -1)
          .sort((a, b) => diffs[a] - diffs[b])
          .map((c) => groupArr(2).find((sc) => sc.committee === c && !lockedIds.has(idOf(sc))))
          .find(Boolean);
        if (back) { moveToOtherHalf(mover, 1); moveToOtherHalf(back, 2); moved = true; break; }
      }
      if (!moved) {
        for (const heavy of COMMITTEES.filter((c) => diffs[c] <= -2)) {
          const mover = groupArr(2).find((sc) => sc.committee === heavy && !lockedIds.has(idOf(sc)));
          if (!mover) { continue; }
          const back = COMMITTEES
            .filter((c) => c !== heavy && diffs[c] >= 1)
            .sort((a, b) => diffs[b] - diffs[a])
            .map((c) => groupArr(1).find((sc) => sc.committee === c && !lockedIds.has(idOf(sc))))
            .find(Boolean);
          if (back) { moveToOtherHalf(mover, 2); moveToOtherHalf(back, 1); moved = true; break; }
        }
      }
      if (!moved) { break; }
    }
  };

  // For each committee with >=2 leads overall, guarantee each half has a lead of
  // that committee (prefer swapping a same-committee non-lead back so member
  // balance is preserved; fall back to any non-lead only when forced).
  const fixLeads = () => {
    for (const committee of COMMITTEES) {
      const leadsOf = (g) => countIn(groupArr(g), (sc) => sc.committee === committee && sc.committeeLead);
      if (leadsOf(1) + leadsOf(2) < 2) { continue; }
      for (const deficient of [1, 2]) {
        if (leadsOf(deficient) > 0) { continue; }
        const sourceGroup = deficient === 1 ? 2 : 1;
        const lead = groupArr(sourceGroup).find(
          (sc) => sc.committee === committee && sc.committeeLead && !lockedIds.has(idOf(sc))
        );
        if (!lead) { continue; }
        const back = groupArr(deficient).find(
          (sc) => !sc.committeeLead && sc.committee === committee && !lockedIds.has(idOf(sc))
        ) || groupArr(deficient).find((sc) => !sc.committeeLead && !lockedIds.has(idOf(sc)));
        if (!back) { continue; }
        moveToOtherHalf(lead, sourceGroup);
        moveToOtherHalf(back, deficient);
      }
    }
  };

  repairMembers();
  fixLeads();
  repairMembers();

  // 4) Reduce avoidable gender skew with balance-neutral swaps: trade a
  //    same-committee, same-lead-status, opposite-gender pair across halves. Such
  //    a swap leaves every committee/lead count and both half sizes unchanged, so
  //    it can only improve gender. Whatever skew remains is locked in by the
  //    roster's committee x gender mix and cannot be removed without breaking
  //    committee or lead balance.
  for (let iter = 0; iter < 50; iter++) {
    const maleDiff = countIn(group1, (sc) => sc.gender === 'male')
      - countIn(group2, (sc) => sc.gender === 'male');
    if (Math.abs(maleDiff) <= 1) { break; }
    const heavy = maleDiff > 0 ? 1 : 2; // half with too many males
    const other = heavy === 1 ? 2 : 1;
    let swapped = false;
    for (const male of groupArr(heavy).filter((sc) => sc.gender === 'male' && !lockedIds.has(idOf(sc)))) {
      const female = groupArr(other).find(
        (sc) => sc.gender === 'female'
          && sc.committee === male.committee
          && sc.committeeLead === male.committeeLead
          && !lockedIds.has(idOf(sc))
      );
      if (female) { moveToOtherHalf(male, heavy); moveToOtherHalf(female, other); swapped = true; break; }
    }
    if (!swapped) { break; }
  }

  // 5) Place the chief first in group1 so they become council #1.
  if (chief) {
    const idx = group1.findIndex((sc) => idOf(sc) === SPECIAL.chiefId);
    if (idx > 0) {
      group1.splice(idx, 1);
      group1.unshift(chief);
    } else if (idx === -1) {
      const g2idx = group2.findIndex((sc) => idOf(sc) === SPECIAL.chiefId);
      if (g2idx !== -1) { group2.splice(g2idx, 1); group1.unshift(chief); }
    }
  }

  return { group1, group2 };
};

// ============================================================================
// SCHOOL GROUPING (size balance, randomized)
// ----------------------------------------------------------------------------
// Greedily distributes schools across `count` groups, always adding the next
// (largest) school to a group with the fewest delegates so far. To keep
// per-council totals even while still varying which schools pair up between
// runs, equal-size schools are shuffled and ties for the lowest total are
// broken at random.
// ============================================================================
const buildSchoolGroups = (activeSchools, count) => {
  const schoolGroups = [];
  for (let i = 0; i < count; i++) {
    schoolGroups.push({ groupId: i + 1, schools: [], totalDelegates: 0 });
  }

  // Shuffle first so equal-delegate schools are ordered randomly; the stable
  // sort then keeps them grouped by size but in a random within-size order.
  const sortedSchools = shuffle([...activeSchools]).sort((a, b) => b.delegateCount - a.delegateCount);

  for (const school of sortedSchools) {
    const minDelegates = Math.min(...schoolGroups.map((g) => g.totalDelegates));
    const candidates = schoolGroups.filter((g) => g.totalDelegates === minDelegates);
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    target.schools.push(school);
    target.totalDelegates += school.delegateCount;
  }
  return schoolGroups;
};

// ============================================================================
// SCHOOL-GROUP -> SENIOR COUNSELOR ASSIGNMENT (exact / optimal)
// ----------------------------------------------------------------------------
// Federal Way's SC is force-assigned to the Federal Way group. The remaining
// SCs and groups are matched with maximum bipartite matching over conflict-free
// edges, which guarantees a zero-conflict assignment whenever one exists and
// otherwise minimizes the number of councils that carry a conflict.
// `orderedSCs` is [...group1, ...group2]; the returned assignments preserve that
// order, so the Chief (first in group1) stays council #1.
// ============================================================================
const assignSchoolGroups = (orderedSCs, schoolGroups, federalWayCounselor) => {
  const conflictSets = new Map();
  orderedSCs.forEach((sc) => conflictSets.set(sc._id.toString(), getConflictingSchoolIds(sc)));

  const groupHasConflict = (group, conflictSet) =>
    group.schools.some((s) => conflictSet.has(s._id.toString()));

  const assignmentByScId = new Map();
  const usedGroupIds = new Set();

  // 1) Force Federal Way (takes priority even if the group carries a conflict).
  if (federalWayCounselor) {
    const fwGroup = schoolGroups.find((g) =>
      g.schools.some((s) => s.name.toLowerCase().includes(FEDERAL_WAY_SCHOOL_MATCH))
    );
    if (fwGroup) {
      assignmentByScId.set(federalWayCounselor._id.toString(), fwGroup);
      usedGroupIds.add(fwGroup.groupId);
    }
  }

  // 2) Optimally match the rest over conflict-free edges.
  const remainingSCs = orderedSCs.filter((sc) => !assignmentByScId.has(sc._id.toString()));
  const remainingGroups = schoolGroups.filter((g) => !usedGroupIds.has(g.groupId));

  const adjacency = remainingSCs.map((sc) => {
    const conflictSet = conflictSets.get(sc._id.toString());
    const edges = [];
    remainingGroups.forEach((group, gi) => {
      if (!groupHasConflict(group, conflictSet)) { edges.push(gi); }
    });
    return edges;
  });

  const matchRight = maxBipartiteMatching(adjacency, remainingSCs.length, remainingGroups.length);

  const matchedSCIndices = new Set();
  matchRight.forEach((scIdx, gIdx) => {
    if (scIdx !== -1) {
      assignmentByScId.set(remainingSCs[scIdx]._id.toString(), remainingGroups[gIdx]);
      matchedSCIndices.add(scIdx);
    }
  });

  // 3) Fill any unmatched SCs with leftover groups (the unavoidable conflicts).
  const leftoverGroups = remainingGroups.filter((_, gi) => matchRight[gi] === -1);
  const unmatchedSCs = remainingSCs.filter((_, si) => !matchedSCIndices.has(si));
  unmatchedSCs.forEach((sc, i) => assignmentByScId.set(sc._id.toString(), leftoverGroups[i]));

  // 4) Build assignments in council order.
  return orderedSCs.map((sc) => {
    const group = assignmentByScId.get(sc._id.toString());
    const conflictSet = conflictSets.get(sc._id.toString());
    const conflictingSchools = group.schools.filter((s) => conflictSet.has(s._id.toString()));
    return {
      seniorCounselor: sc,
      schoolGroup: group,
      hasConflicts: conflictingSchools.length > 0,
      conflictingSchools,
    };
  });
};

// ============================================================================
// ROOM ASSIGNMENT (size-based)
// ----------------------------------------------------------------------------
// Council #1 (Chief) gets the Pavilion. The remaining councils are sorted by
// delegate count (largest first) and handed the largest available rooms first,
// guaranteeing larger councils get larger rooms.
// Returns an array of room names indexed by council position, or null if there
// are not enough rooms for the number of councils.
// ============================================================================
const assignRooms = (orderedAssignments) => {
  const roomsBySizeDesc = Object.entries(ROOMS_BY_SIZE)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Council #1 takes the Pavilion; everyone else competes for the sized rooms.
  if (orderedAssignments.length - 1 > roomsBySizeDesc.length) {
    return null; // Not enough rooms.
  }

  const rooms = new Array(orderedAssignments.length);
  rooms[0] = 'Pavilion';

  const others = orderedAssignments
    .map((assignment, index) => ({ index, delegates: assignment.schoolGroup.totalDelegates }))
    .filter((entry) => entry.index !== 0)
    .sort((a, b) => b.delegates - a.delegates);

  others.forEach((entry, rank) => { rooms[entry.index] = roomsBySizeDesc[rank]; });
  return rooms;
};

// ============================================================================
// POSTING DORM ASSIGNMENT
// ----------------------------------------------------------------------------
// Male SCs post in female dorms (1 per dorm); female SCs post in male dorms
// (up to 2 per dorm). Constraints, in priority order:
//   1. Separation - an SC is not posted in a dorm housing their own council JC.
//   2. Posting partners - two SCs sharing a male dorm were not posting partners
//      the prior year (`_previousPostingPartner`).
// Male->female is solved exactly (bipartite matching over separation-safe
// edges). Female->male (capacity 2 + partner constraint) is solved with many
// randomized-greedy attempts, keeping the assignment with the fewest weighted
// violations.
// Returns Map(scId -> dorm).
// ============================================================================
const assignPostingDorms = (assignments, allDorms) => {
  const maleDorms = allDorms.filter((d) => ['male', 'Male', 'M'].includes(d.type));
  const femaleDorms = allDorms.filter((d) => ['female', 'Female', 'F'].includes(d.type));

  const maleSCs = assignments.map((a) => a.seniorCounselor).filter((sc) => sc.gender === 'male');
  const femaleSCs = assignments.map((a) => a.seniorCounselor).filter((sc) => sc.gender === 'female');

  // Does `dorm` house one of this SC's council JCs?
  const dormHousesOwnJC = (sc, dorm) => {
    return [sc._jcPairing, sc._jcPairing2]
      .filter(Boolean)
      .some((jc) => jc._dorm && jc._dorm._id.toString() === dorm._id.toString());
  };

  const wasPriorPartner = (scA, scB) => {
    const aPrev = scA._previousPostingPartner ? scA._previousPostingPartner.toString() : null;
    const bPrev = scB._previousPostingPartner ? scB._previousPostingPartner.toString() : null;
    return aPrev === scB._id.toString() || bPrev === scA._id.toString();
  };

  const dormAssignments = new Map();

  // --- Male SCs -> female dorms (1 per dorm), separation as hard edges. ---
  if (maleSCs.length > 0 && femaleDorms.length > 0) {
    const adjacency = maleSCs.map((sc) => {
      const edges = [];
      femaleDorms.forEach((dorm, di) => { if (!dormHousesOwnJC(sc, dorm)) { edges.push(di); } });
      return edges;
    });
    const matchRight = maxBipartiteMatching(adjacency, maleSCs.length, femaleDorms.length);

    const matchedSC = new Set();
    matchRight.forEach((scIdx, di) => {
      if (scIdx !== -1) { dormAssignments.set(maleSCs[scIdx]._id.toString(), femaleDorms[di]); matchedSC.add(scIdx); }
    });
    // Place any unmatched SCs in leftover dorms (separation may be violated).
    const leftoverDorms = femaleDorms.filter((_, di) => matchRight[di] === -1);
    const unmatched = maleSCs.filter((_, si) => !matchedSC.has(si));
    unmatched.forEach((sc, i) => {
      if (leftoverDorms[i]) { dormAssignments.set(sc._id.toString(), leftoverDorms[i]); }
    });
  }

  // --- Female SCs -> male dorms (<=2 per dorm), minimize violations. ---
  if (femaleSCs.length > 0 && maleDorms.length > 0) {
    const SEPARATION_WEIGHT = 10;
    const PARTNER_WEIGHT = 3;
    const ATTEMPTS = 400;

    let best = null;
    let bestCost = Infinity;

    for (let attempt = 0; attempt < ATTEMPTS && bestCost > 0; attempt++) {
      const scOrder = shuffle([...femaleSCs]);
      const occupancy = new Map(maleDorms.map((d) => [d._id.toString(), []]));
      let cost = 0;

      for (const sc of scOrder) {
        let chosen = null;
        let chosenCost = Infinity;
        const dormOrder = shuffle([...maleDorms]);
        for (const dorm of dormOrder) {
          const occupants = occupancy.get(dorm._id.toString());
          if (occupants.length >= 2) { continue; } // capacity
          let placementCost = 0;
          if (dormHousesOwnJC(sc, dorm)) { placementCost += SEPARATION_WEIGHT; }
          if (occupants.some((other) => wasPriorPartner(sc, other))) { placementCost += PARTNER_WEIGHT; }
          if (placementCost < chosenCost) { chosen = dorm; chosenCost = placementCost; }
          if (placementCost === 0) { break; } // perfect placement
        }
        if (!chosen) {
          // Every dorm is full (more SCs than capacity) - reuse least-filled.
          chosen = [...maleDorms].sort(
            (a, b) => occupancy.get(a._id.toString()).length - occupancy.get(b._id.toString()).length
          )[0];
          chosenCost = SEPARATION_WEIGHT; // treated as a violation for scoring
        }
        occupancy.get(chosen._id.toString()).push(sc);
        cost += chosenCost;
      }

      if (cost < bestCost) {
        bestCost = cost;
        best = occupancy;
      }
    }

    if (best) {
      for (const [dormId, occupants] of best.entries()) {
        const dorm = maleDorms.find((d) => d._id.toString() === dormId);
        occupants.forEach((sc) => dormAssignments.set(sc._id.toString(), dorm));
      }
    }
  }

  return dormAssignments;
};

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
export default {
  generateContents: async () => {
    try {
      // ----- Data retrieval -----
      const seniorCounselors = await storage.model('SeniorCounselor')
        .find({})
        .populate('_jcPairing _jcPairing2 _associatedSchool _previousSchools');
      if (seniorCounselors.length === 0) { return { error: 'No senior counselors found' }; }

      // Populate dorm info for each paired JC.
      for (const sc of seniorCounselors) {
        if (sc._jcPairing) { await sc.populate('_jcPairing._dorm'); }
        if (sc._jcPairing2) { await sc.populate('_jcPairing2._dorm'); }
      }

      const activeSchools = await storage.model('School').find({ delegateCount: { $gte: 1 } });
      if (activeSchools.length === 0) { return { error: 'No active schools found' }; }

      const allDorms = await storage.model('Dorm').find({ type: { $ne: 'staff' } });
      if (allDorms.length === 0) { return { error: 'No non-staff dorms found' }; }

      // Guard: there must be enough rooms (Pavilion + sized rooms) for every council.
      if (seniorCounselors.length > Object.keys(ROOMS_BY_SIZE).length + 1) {
        return { error: `Too many councils (${seniorCounselors.length}) for the available rooms (${Object.keys(ROOMS_BY_SIZE).length + 1})` };
      }

      // ----- Analysis -----
      const analysis = {
        total: seniorCounselors.length,
        gender: {
          male: seniorCounselors.filter((sc) => sc.gender === 'male').length,
          female: seniorCounselors.filter((sc) => sc.gender === 'female').length,
        },
        committee: {
          knowledge: seniorCounselors.filter((sc) => sc.committee === 'knowledge').length,
          compassion: seniorCounselors.filter((sc) => sc.committee === 'compassion').length,
          humor: seniorCounselors.filter((sc) => sc.committee === 'humor').length,
          other: seniorCounselors.filter((sc) => sc.committee === 'other').length,
        },
        committeeLeads: seniorCounselors.filter((sc) => sc.committeeLead).length,
        schools: {
          total: activeSchools.length,
          totalDelegates: activeSchools.reduce((sum, s) => sum + s.delegateCount, 0),
        },
      };

      // ----- Balance SCs into two halves; enforce chief / keep-together -----
      const { group1, group2 } = distributeSeniorCounselors(seniorCounselors);
      const orderedSCs = [...group1, ...group2];

      // ----- Group schools, then optimally assign groups to SCs -----
      const schoolGroups = buildSchoolGroups(activeSchools, seniorCounselors.length);
      const federalWayCounselor = seniorCounselors.find((sc) => sc.federalWay === true);
      const assignments = assignSchoolGroups(orderedSCs, schoolGroups, federalWayCounselor);

      // ----- Posting dorms -----
      const dormAssignments = assignPostingDorms(assignments, allDorms);

      // ----- Rooms -----
      const rooms = assignRooms(assignments);
      if (!rooms) { return { error: 'Not enough rooms for the number of councils' }; }

      // ----- Build councils -----
      const councils = assignments.map((assignment, index) => {
        const sc = assignment.seniorCounselor;
        const number = index + 1;

        const juniorCounselors = [sc._jcPairing, sc._jcPairing2]
          .filter(Boolean)
          .map((jc) => ({ name: jc.name, dorm: jc._dorm ? jc._dorm.name : 'No Dorm' }));

        // Posting dorm details: which JCs live there, and the SC's posting partner.
        const postingDorm = dormAssignments.get(sc._id.toString());
        let scPostingDorm = { name: 'No Dorm Assigned', jcs: '', partner: null };
        if (postingDorm) {
          const dormId = postingDorm._id.toString();

          // JCs (across all councils) housed in this dorm.
          const jcFirstNames = [];
          for (const other of assignments) {
            const otherSc = other.seniorCounselor;
            for (const jc of [otherSc._jcPairing, otherSc._jcPairing2]) {
              if (jc && jc._dorm && jc._dorm._id.toString() === dormId) {
                jcFirstNames.push(jc.name.split(' ')[0]);
              }
            }
          }

          // Posting partner = another SC posted in the same dorm.
          let partner = null;
          for (const other of assignments) {
            const otherSc = other.seniorCounselor;
            if (otherSc._id.toString() === sc._id.toString()) { continue; }
            const otherDorm = dormAssignments.get(otherSc._id.toString());
            if (otherDorm && otherDorm._id.toString() === dormId) {
              partner = otherSc.name.split(' ')[0];
              break;
            }
          }

          scPostingDorm = { name: postingDorm.name, jcs: jcFirstNames.join(', '), partner };
        }

        const hasPostingSeparationViolation = postingDorm
          ? [sc._jcPairing, sc._jcPairing2]
            .filter(Boolean)
            .some((jc) => jc._dorm && jc._dorm._id.toString() === postingDorm._id.toString())
          : false;

        return {
          number,
          room: rooms[index],
          delegateCount: assignment.schoolGroup.totalDelegates,
          schools: assignment.schoolGroup.schools.map((school) => `${school.name} - ${school.delegateCount}`),
          conflictingSchools: assignment.conflictingSchools.map((school) => `${school.name} - ${school.delegateCount}`),
          seniorCounselor: `${sc.name} - ${sc.committee.charAt(0).toUpperCase()}${sc.committeeLead ? ' *' : ''}`,
          seniorCounselorId: sc._id.toString(),
          juniorCounselors,
          scPostingDorm,
          hasConflicts: assignment.hasConflicts,
          hasPostingSeparationViolation,
        };
      });

      // ----- Balance summary (per-half committee / lead / gender counts) -----
      const halfStats = (group) => {
        const stats = {
          size: group.length,
          gender: { male: 0, female: 0 },
          committee: { knowledge: 0, compassion: 0, humor: 0, other: 0 },
          leads: { knowledge: 0, compassion: 0, humor: 0, other: 0 },
        };
        for (const sc of group) {
          if (sc.gender === 'male' || sc.gender === 'female') { stats.gender[sc.gender]++; }
          stats.committee[sc.committee]++;
          if (sc.committeeLead) { stats.leads[sc.committee]++; }
        }
        return stats;
      };

      const g1Stats = halfStats(group1);
      const g2Stats = halfStats(group2);
      const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      const issues = [];
      for (const committee of ['knowledge', 'compassion', 'humor', 'other']) {
        if (Math.abs(g1Stats.committee[committee] - g2Stats.committee[committee]) > 1) {
          issues.push(`${cap(committee)} members are uneven across halves (${g1Stats.committee[committee]} vs ${g2Stats.committee[committee]})`);
        }
        const totalLeads = g1Stats.leads[committee] + g2Stats.leads[committee];
        if (totalLeads >= 2 && (g1Stats.leads[committee] === 0 || g2Stats.leads[committee] === 0)) {
          issues.push(`${cap(committee)} leads are not on both halves (${g1Stats.leads[committee]} vs ${g2Stats.leads[committee]})`);
        }
      }
      if (Math.abs(g1Stats.gender.male - g2Stats.gender.male) > 2) {
        issues.push(`Gender is uneven across halves (group 1: ${g1Stats.gender.male}M/${g1Stats.gender.female}F, group 2: ${g2Stats.gender.male}M/${g2Stats.gender.female}F)`);
      }

      const balance = { group1: g1Stats, group2: g2Stats, issues };

      return {
        success: true,
        analysis,
        councils,
        balance,
      };
    } catch (error) {
      console.error('Error generating contents:', error);
      throw error;
    }
  },
};
