/**
 * MPD Comparator - Diff engine for normalized MPDs
 */

/**
 * Compare two normalized MPDs
 * @param {Object} prev - Previous normalized MPD
 * @param {Object} curr - Current normalized MPD
 * @returns {Object} Comparison result
 */
export function compareMPDs(prev, curr) {
  return {
    publishTimeChanged: prev.publishTime !== curr.publishTime,
    periodsAdded: findAddedPeriods(prev.periods, curr.periods),
    periodsRemoved: findRemovedPeriods(prev.periods, curr.periods),
    periodsModified: findModifiedPeriods(prev.periods, curr.periods),
    segmentChanges: compareSegments(prev, curr),
  };
}

/**
 * Find periods that were added
 * @param {Array} prevPeriods - Previous periods
 * @param {Array} currPeriods - Current periods
 * @returns {Array} Added periods
 */
function findAddedPeriods(prevPeriods, currPeriods) {
  const prevIds = new Set(prevPeriods.map((p) => p.id).filter(Boolean));
  return currPeriods.filter((p) => p.id && !prevIds.has(p.id));
}

/**
 * Find periods that were removed
 * @param {Array} prevPeriods - Previous periods
 * @param {Array} currPeriods - Current periods
 * @returns {Array} Removed periods
 */
function findRemovedPeriods(prevPeriods, currPeriods) {
  const currIds = new Set(currPeriods.map((p) => p.id).filter(Boolean));
  return prevPeriods.filter((p) => p.id && !currIds.has(p.id));
}

/**
 * Find periods that were modified
 * @param {Array} prevPeriods - Previous periods
 * @param {Array} currPeriods - Current periods
 * @returns {Array} Modified periods with changes
 */
function findModifiedPeriods(prevPeriods, currPeriods) {
  const modified = [];

  for (const currPeriod of currPeriods) {
    if (!currPeriod.id) continue;

    const prevPeriod = prevPeriods.find((p) => p.id === currPeriod.id);
    if (!prevPeriod) continue;

    const changes = comparePeriods(prevPeriod, currPeriod);
    if (Object.keys(changes).length > 0) {
      modified.push({
        id: currPeriod.id,
        changes,
      });
    }
  }

  return modified;
}

/**
 * Compare two periods
 * @param {Object} prev - Previous period
 * @param {Object} curr - Current period
 * @returns {Object} Changes object
 */
function comparePeriods(prev, curr) {
  const changes = {};

  if (prev.start !== curr.start) {
    changes.startChanged = { prev: prev.start, curr: curr.start };
  }

  if (prev.drmPresent !== curr.drmPresent) {
    changes.drmChanged = { prev: prev.drmPresent, curr: curr.drmPresent };
  }

  // Compare adaptations
  const adaptationChanges = compareAdaptations(
    prev.adaptations,
    curr.adaptations
  );
  if (Object.keys(adaptationChanges).length > 0) {
    changes.adaptations = adaptationChanges;
  }

  return changes;
}

/**
 * Compare adaptations between periods
 * @param {Array} prevAdaptations - Previous adaptations
 * @param {Array} currAdaptations - Current adaptations
 * @returns {Object} Adaptation changes
 */
function compareAdaptations(prevAdaptations, currAdaptations) {
  const changes = {};

  // Group by type
  const prevByType = groupByType(prevAdaptations);
  const currByType = groupByType(currAdaptations);

  for (const type of ["video", "audio"]) {
    const prev = prevByType[type];
    const curr = currByType[type];

    if (!prev && curr) {
      changes[`${type}Added`] = true;
    } else if (prev && !curr) {
      changes[`${type}Removed`] = true;
    } else if (prev && curr) {
      const segmentChanges = compareRepresentationSegments(prev, curr);
      if (Object.keys(segmentChanges).length > 0) {
        changes[type] = segmentChanges;
      }
    }
  }

  return changes;
}

/**
 * Group adaptations by type
 * @param {Array} adaptations - Adaptations array
 * @returns {Object} Adaptations grouped by type
 */
function groupByType(adaptations) {
  const grouped = {};
  for (const adaptation of adaptations) {
    grouped[adaptation.type] = adaptation;
  }
  return grouped;
}

/**
 * Compare segments across representations
 * @param {Object} prevAdaptation - Previous adaptation
 * @param {Object} currAdaptation - Current adaptation
 * @returns {Object} Segment changes
 */
function compareRepresentationSegments(prevAdaptation, currAdaptation) {
  const changes = {};

  // Compare first representation segments (they should all be the same)
  const prevSegments = prevAdaptation.representations[0]?.segments || [];
  const currSegments = currAdaptation.representations[0]?.segments || [];

  if (!segmentsEqual(prevSegments, currSegments)) {
    changes.segmentsChanged = {
      added: currSegments.length - prevSegments.length,
      timeline: compareSegmentTimelines(prevSegments, currSegments),
    };
  }

  return changes;
}

/**
 * Compare segment timelines
 * @param {Array} prev - Previous segments
 * @param {Array} curr - Current segments
 * @returns {Object} Timeline comparison
 */
function compareSegmentTimelines(prev, curr) {
  const added = [];
  const removed = [];

  // Simple approach: find segments by start time
  const prevByStart = new Map(prev.map((s) => [s.t, s]));
  const currByStart = new Map(curr.map((s) => [s.t, s]));

  // Find added segments
  for (const [start, segment] of currByStart) {
    if (!prevByStart.has(start)) {
      added.push(segment);
    }
  }

  // Find removed segments
  for (const [start, segment] of prevByStart) {
    if (!currByStart.has(start)) {
      removed.push(segment);
    }
  }

  return { added, removed };
}

/**
 * Compare all segments between two MPDs
 * @param {Object} prev - Previous MPD
 * @param {Object} curr - Current MPD
 * @returns {Object} Segment changes summary
 */
function compareSegments(prev, curr) {
  let totalAdded = 0;
  let totalRemoved = 0;
  const byPeriod = {};

  for (let i = 0; i < Math.max(prev.periods.length, curr.periods.length); i++) {
    const prevPeriod = prev.periods[i];
    const currPeriod = curr.periods[i];

    if (!prevPeriod || !currPeriod) continue;

    const periodChanges = comparePeriodSegments(prevPeriod, currPeriod);
    if (periodChanges.added > 0 || periodChanges.removed > 0) {
      byPeriod[currPeriod.id || i] = periodChanges;
      totalAdded += periodChanges.added;
      totalRemoved += periodChanges.removed;
    }
  }

  return {
    totalAdded,
    totalRemoved,
    byPeriod,
  };
}

/**
 * Compare segments within a period
 * @param {Object} prevPeriod - Previous period
 * @param {Object} currPeriod - Current period
 * @returns {Object} Period segment changes
 */
function comparePeriodSegments(prevPeriod, currPeriod) {
  let added = 0;
  let removed = 0;

  // Compare by adaptation type
  const prevByType = groupByType(prevPeriod.adaptations);
  const currByType = groupByType(currPeriod.adaptations);

  for (const type of ["video", "audio"]) {
    const prev = prevByType[type];
    const curr = currByType[type];

    if (prev && curr) {
      const prevSegments = prev.representations[0]?.segments || [];
      const currSegments = curr.representations[0]?.segments || [];

      const diff = currSegments.length - prevSegments.length;
      if (diff > 0) {
        added += diff;
      } else if (diff < 0) {
        removed += Math.abs(diff);
      }
    }
  }

  return { added, removed };
}

/**
 * Check if two segment arrays are equal
 * @param {Array} a - First segment array
 * @param {Array} b - Second segment array
 * @returns {boolean} True if segments are equal
 */
export function segmentsEqual(a, b) {
  if (a.length !== b.length) return false;

  return a.every(
    (s, i) => Math.abs(s.t - b[i].t) < 1e-6 && Math.abs(s.d - b[i].d) < 1e-6
  );
}
