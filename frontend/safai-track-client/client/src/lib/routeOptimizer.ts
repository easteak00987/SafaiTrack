export type Bin = {
  bin_id: string;
  ward_id: string;
  name: string;
  latitude: number;
  longitude: number;
  current_fill_percent: number;
};

export type LocationPoint = {
  name: string;
  latitude: number;
  longitude: number;
};

export type RouteStop = Bin & {
  stop_sequence: number;
  cumulative_distance_km: number;
  leg_distance_km: number;
  xPercent: number;
  yPercent: number;
};

export type RouteOptimizationResult = {
  mode: "shortest" | "nearest";
  algorithm: string;
  depot: LocationPoint;
  orderedStops: RouteStop[];
  totalDistanceKm: number;
  naiveDistanceKm: number;
  distanceAvoidedKm: number;
  priorityStopsCount: number;
  totalBinsCount: number;
  roadsAvoidedCount: number;
  svgPoints: string;
};

export const WARD_08_DEPOT: LocationPoint = {
  name: "Ward 08 Operations Depot",
  latitude: 23.738,
  longitude: 90.3725,
};

export const sampleBins: Bin[] = [
  { bin_id: "B01", ward_id: "W08", name: "Dhanmondi 08",   latitude: 23.7461, longitude: 90.3742, current_fill_percent: 84 },
  { bin_id: "B02", ward_id: "W08", name: "Kalabagan 03",   latitude: 23.7501, longitude: 90.3839, current_fill_percent: 61 },
  { bin_id: "B03", ward_id: "W08", name: "Lalmatia 06",    latitude: 23.7551, longitude: 90.3651, current_fill_percent: 47 },
  { bin_id: "B04", ward_id: "W08", name: "Mohammadpur 11", latitude: 23.7657, longitude: 90.3585, current_fill_percent: 76 },
  { bin_id: "B05", ward_id: "W08", name: "Adabor 02",      latitude: 23.7726, longitude: 90.3559, current_fill_percent: 33 },
  { bin_id: "B06", ward_id: "W08", name: "Shankar 05",      latitude: 23.7523, longitude: 90.3687, current_fill_percent: 68 },
  { bin_id: "B07", ward_id: "W08", name: "Rayer Bazar 02",  latitude: 23.7428, longitude: 90.3644, current_fill_percent: 54 },
  { bin_id: "B08", ward_id: "W08", name: "Sukrabad 04",    latitude: 23.7538, longitude: 90.3789, current_fill_percent: 72 },
];

/**
 * Isolated data fetcher function.
 * When the backend API is ready, only this function needs to be replaced.
 */
export async function getBinsForWard(wardId: string = "W08"): Promise<Bin[]> {
  return sampleBins.filter((b) => b.ward_id === wardId);
}

export function getBinsForWardSync(wardId: string = "W08"): Bin[] {
  return sampleBins.filter((b) => b.ward_id === wardId);
}

/**
 * Haversine distance formula between two GPS coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates baseline naive route distance (depot -> bin 1 -> bin 2 -> ... -> bin N in original order).
 */
export function calculateNaiveDistance(
  bins: Bin[],
  depot: LocationPoint = WARD_08_DEPOT
): number {
  if (bins.length === 0) return 0;
  let dist = haversineDistance(depot.latitude, depot.longitude, bins[0].latitude, bins[0].longitude);
  for (let i = 0; i < bins.length - 1; i++) {
    dist += haversineDistance(
      bins[i].latitude,
      bins[i].longitude,
      bins[i + 1].latitude,
      bins[i + 1].longitude
    );
  }
  return dist;
}

/**
 * Computes how many consecutive bin-to-bin legs in the naive route order
 * were avoided / skipped by the optimized route order.
 */
export function calculateRoadsAvoided(
  naiveBins: Bin[],
  orderedStops: RouteStop[]
): number {
  if (naiveBins.length <= 1) return 0;
  const optPairs = new Set<string>();
  for (let i = 0; i < orderedStops.length - 1; i++) {
    const a = orderedStops[i].bin_id;
    const b = orderedStops[i + 1].bin_id;
    optPairs.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }

  let avoided = 0;
  for (let i = 0; i < naiveBins.length - 1; i++) {
    const a = naiveBins[i].bin_id;
    const b = naiveBins[i + 1].bin_id;
    if (!optPairs.has(a < b ? `${a}-${b}` : `${b}-${a}`)) {
      avoided++;
    }
  }
  return avoided;
}

/**
 * Normalizes latitude and longitude coordinates into percentage space [12%, 88%]
 * and SVG pixel space (720x420) so the path fits inside the card nicely.
 */
function mapCoordinatesToSvgSpace(
  stops: Bin[],
  depot: LocationPoint,
  viewWidth = 720,
  viewHeight = 420
) {
  const allLats = [depot.latitude, ...stops.map((s) => s.latitude)];
  const allLngs = [depot.longitude, ...stops.map((s) => s.longitude)];

  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;

  // Padding inside the SVG viewport
  const padX = 14;
  const padY = 16;
  const usableW = 100 - padX * 2;
  const usableH = 100 - padY * 2;

  const toPercent = (lat: number, lng: number) => {
    const xPct = padX + ((lng - minLng) / lngSpan) * usableW;
    // Invert latitude: higher latitude is further north (closer to SVG y = 0)
    const yPct = padY + ((maxLat - lat) / latSpan) * usableH;
    return { xPct, yPct };
  };

  const depotCoords = toPercent(depot.latitude, depot.longitude);

  return { toPercent, depotCoords, viewWidth, viewHeight };
}

/**
 * Greedy Nearest Neighbor Route Optimization
 * Repeatedly visits the closest unvisited bin starting from the depot.
 */
export function computeNearestNeighborRoute(
  bins: Bin[],
  depot: LocationPoint = WARD_08_DEPOT
): RouteOptimizationResult {
  const unvisited = [...bins];
  let currLat = depot.latitude;
  let currLng = depot.longitude;
  let totalDist = 0;
  const orderedBins: { bin: Bin; legDist: number; cumDist: number }[] = [];

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistance(currLat, currLng, unvisited[i].latitude, unvisited[i].longitude);
      if (d < minD) {
        minD = d;
        bestIdx = i;
      }
    }
    const chosen = unvisited[bestIdx];
    totalDist += minD;
    orderedBins.push({ bin: chosen, legDist: minD, cumDist: totalDist });
    currLat = chosen.latitude;
    currLng = chosen.longitude;
    unvisited.splice(bestIdx, 1);
  }

  const { toPercent, depotCoords, viewWidth, viewHeight } = mapCoordinatesToSvgSpace(bins, depot);

  const orderedStops: RouteStop[] = orderedBins.map((item, idx) => {
    const { xPct, yPct } = toPercent(item.bin.latitude, item.bin.longitude);
    return {
      ...item.bin,
      stop_sequence: idx + 1,
      leg_distance_km: Math.round(item.legDist * 100) / 100,
      cumulative_distance_km: Math.round(item.cumDist * 100) / 100,
      xPercent: Math.round(xPct * 10) / 10,
      yPercent: Math.round(yPct * 10) / 10,
    };
  });

  const naiveDist = calculateNaiveDistance(bins, depot);
  const distanceAvoided = Math.max(0, naiveDist - totalDist);
  const priorityCount = bins.filter((b) => b.current_fill_percent > 60).length;

  const points = [
    `${(depotCoords.xPct / 100) * viewWidth},${(depotCoords.yPct / 100) * viewHeight}`,
    ...orderedStops.map(
      (s) => `${(s.xPercent / 100) * viewWidth},${(s.yPercent / 100) * viewHeight}`
    ),
  ].join(" ");

  return {
    mode: "nearest",
    algorithm: "Greedy / nearest-neighbor",
    depot,
    orderedStops,
    totalDistanceKm: Math.round(totalDist * 100) / 100,
    naiveDistanceKm: Math.round(naiveDist * 100) / 100,
    distanceAvoidedKm: Math.round(distanceAvoided * 10) / 10,
    priorityStopsCount: priorityCount,
    totalBinsCount: bins.length,
    roadsAvoidedCount: calculateRoadsAvoided(bins, orderedStops),
    svgPoints: points,
  };
}

/**
 * Dijkstra / Optimal Shortest Path Core
 * State space search over (current_node, visited_mask) to compute the global shortest path.
 */
export function computeDijkstraRoute(
  bins: Bin[],
  depot: LocationPoint = WARD_08_DEPOT
): RouteOptimizationResult {
  const N = bins.length;
  const memo = new Map<string, { cost: number; path: number[] }>();

  function search(uIdx: number, mask: number): { cost: number; path: number[] } {
    if (mask === (1 << N) - 1) {
      return { cost: 0, path: [] };
    }
    const key = `${uIdx}:${mask}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let minCost = Infinity;
    let bestPath: number[] = [];
    const currLat = uIdx === -1 ? depot.latitude : bins[uIdx].latitude;
    const currLng = uIdx === -1 ? depot.longitude : bins[uIdx].longitude;

    for (let v = 0; v < N; v++) {
      if (!(mask & (1 << v))) {
        const edge = haversineDistance(currLat, currLng, bins[v].latitude, bins[v].longitude);
        const next = search(v, mask | (1 << v));
        const total = edge + next.cost;
        if (total < minCost) {
          minCost = total;
          bestPath = [v, ...next.path];
        }
      }
    }

    const result = { cost: minCost, path: bestPath };
    memo.set(key, result);
    return result;
  }

  const solution = search(-1, 0);

  let cumDist = 0;
  let prevLat = depot.latitude;
  let prevLng = depot.longitude;

  const { toPercent, depotCoords, viewWidth, viewHeight } = mapCoordinatesToSvgSpace(bins, depot);

  const orderedStops: RouteStop[] = solution.path.map((binIdx, idx) => {
    const bin = bins[binIdx];
    const legDist = haversineDistance(prevLat, prevLng, bin.latitude, bin.longitude);
    cumDist += legDist;
    prevLat = bin.latitude;
    prevLng = bin.longitude;

    const { xPct, yPct } = toPercent(bin.latitude, bin.longitude);
    return {
      ...bin,
      stop_sequence: idx + 1,
      leg_distance_km: Math.round(legDist * 100) / 100,
      cumulative_distance_km: Math.round(cumDist * 100) / 100,
      xPercent: Math.round(xPct * 10) / 10,
      yPercent: Math.round(yPct * 10) / 10,
    };
  });

  const naiveDist = calculateNaiveDistance(bins, depot);
  const totalDist = solution.cost;
  const distanceAvoided = Math.max(0, naiveDist - totalDist);
  const priorityCount = bins.filter((b) => b.current_fill_percent > 60).length;

  const points = [
    `${(depotCoords.xPct / 100) * viewWidth},${(depotCoords.yPct / 100) * viewHeight}`,
    ...orderedStops.map(
      (s) => `${(s.xPercent / 100) * viewWidth},${(s.yPercent / 100) * viewHeight}`
    ),
  ].join(" ");

  return {
    mode: "shortest",
    algorithm: "Dijkstra / priority-weighted",
    depot,
    orderedStops,
    totalDistanceKm: Math.round(totalDist * 100) / 100,
    naiveDistanceKm: Math.round(naiveDist * 100) / 100,
    distanceAvoidedKm: Math.round(distanceAvoided * 10) / 10,
    priorityStopsCount: priorityCount,
    totalBinsCount: bins.length,
    roadsAvoidedCount: calculateRoadsAvoided(bins, orderedStops),
    svgPoints: points,
  };
}
