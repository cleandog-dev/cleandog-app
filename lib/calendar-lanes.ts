// Greedy lane assignment for time-interval items (calendar blocks).
// Computes a column index ("lane") per item so overlapping items render side-by-side
// instead of stacking on top of each other.
//
// Algorithm:
//   1. Sort items by startsAt ascending.
//   2. Walk items, keep array of currently-active lanes (endsAt of last item placed).
//      For each item, pick first lane whose endsAt <= item.startsAt; else create new.
//   3. Items in the same "overlap cluster" share laneCount = max lanes used in cluster.
//      Items in a cluster of size 1 keep laneCount = 1 (render full-width).

export type LaneAssignment = { laneIndex: number; laneCount: number };

interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

export function assignLanes<T extends TimeRange>(items: T[]): Array<T & LaneAssignment> {
  if (items.length === 0) return [];

  // Stable copy sorted by startsAt
  const sorted = items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const d = a.item.startsAt.getTime() - b.item.startsAt.getTime();
      return d !== 0 ? d : a.idx - b.idx;
    });

  // Output buffer aligned to sorted order; we fill laneIndex first, laneCount after clustering.
  const out: Array<{ item: T; laneIndex: number; clusterId: number }> = new Array(sorted.length);

  // Active lanes: array of endsAt; index = lane number.
  let laneEnds: Date[] = [];
  let clusterId = 0;
  let clusterMaxLanes = 0;
  const clusterRange: number[] = []; // index = clusterId, value = max lanes in that cluster

  for (let i = 0; i < sorted.length; i++) {
    const { item } = sorted[i]!;

    // If all active lanes have ended before this item starts → cluster boundary
    const stillActive = laneEnds.some((e) => e > item.startsAt);
    if (!stillActive && laneEnds.length > 0) {
      clusterRange[clusterId] = clusterMaxLanes;
      clusterId++;
      clusterMaxLanes = 0;
      laneEnds = [];
    }

    // Find first lane that has ended
    let laneIdx = laneEnds.findIndex((e) => e <= item.startsAt);
    if (laneIdx === -1) {
      laneIdx = laneEnds.length;
      laneEnds.push(item.endsAt);
    } else {
      laneEnds[laneIdx] = item.endsAt;
    }

    if (laneEnds.length > clusterMaxLanes) clusterMaxLanes = laneEnds.length;
    out[i] = { item, laneIndex: laneIdx, clusterId };
  }
  // Flush last cluster
  if (laneEnds.length > 0) clusterRange[clusterId] = clusterMaxLanes;

  // Map back to original order; attach laneCount from cluster
  const result: Array<T & LaneAssignment> = new Array(items.length);
  for (let i = 0; i < sorted.length; i++) {
    const entry = out[i]!;
    const originalIdx = sorted[i]!.idx;
    result[originalIdx] = {
      ...entry.item,
      laneIndex: entry.laneIndex,
      laneCount: clusterRange[entry.clusterId] ?? 1,
    };
  }
  return result;
}
