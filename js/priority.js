import { clamp } from "./utils.js";

export const MUNICIPAL_CLASS_LABELS = [
  "High Socio / Low Hazard",
  "High Socio / High Hazard",
  "Low Socio / Low Hazard",
  "Low Socio / High Hazard",
];

export function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) {
    const keys = Object.keys(weights);
    const fallback = 1 / keys.length;
    return Object.fromEntries(keys.map((key) => [key, fallback]));
  }
  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, Number(value || 0) / total]),
  );
}

export function hazardScore(city, weights) {
  const w = normalizeWeights(weights);
  return (
    (Number(city.FSI_n || 0) * w.flood) +
    (Number(city.DSI_n || 0) * w.drought) +
    (Number(city.FRI_n || 0) * w.wildfire)
  );
}

export function adaptiveCapacityScore(city, weights) {
  const w = normalizeWeights(weights);
  return (
    (Number(city.GDP_Class_n || city.GDP_Class || 0) * w.gdp) +
    (Number(city.HDI_n || 0) * w.hdi)
  );
}

export function priorityScore(city, weights) {
  const hazard = hazardScore(city, weights.hazardComponents);
  const capacity = adaptiveCapacityScore(city, weights.adaptiveCapacity);
  const vulnerability = 1 - capacity;
  const hazardWeight = clamp(Number(weights.hazardWeight || 0.6), 0, 1);
  const priority = 100 * (hazardWeight * hazard + (1 - hazardWeight) * vulnerability);
  return { hazard, capacity, vulnerability, priority };
}

function meanPoint(points, fallback) {
  if (!points.length) return { ...fallback };
  return {
    hazard: points.reduce((sum, point) => sum + point.hazard, 0) / points.length,
    socio: points.reduce((sum, point) => sum + point.socio, 0) / points.length,
  };
}

function squaredDistance(a, b) {
  return ((a.hazard - b.hazard) ** 2) + ((a.socio - b.socio) ** 2);
}

function bestClassAssignment(centroids, bounds) {
  const classCorners = [
    { label: "High Socio / Low Hazard", hazard: bounds.minHazard, socio: bounds.maxSocio },
    { label: "High Socio / High Hazard", hazard: bounds.maxHazard, socio: bounds.maxSocio },
    { label: "Low Socio / Low Hazard", hazard: bounds.minHazard, socio: bounds.minSocio },
    { label: "Low Socio / High Hazard", hazard: bounds.maxHazard, socio: bounds.minSocio },
  ];
  const permutations = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
    [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
    [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
  ];
  let best = permutations[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const permutation of permutations) {
    const distance = permutation.reduce(
      (sum, classIndex, centroidIndex) => sum + squaredDistance(centroids[centroidIndex], classCorners[classIndex]),
      0,
    );
    if (distance < bestDistance) {
      best = permutation;
      bestDistance = distance;
    }
  }
  return best.map((classIndex) => classCorners[classIndex].label);
}

export function buildDynamicMunicipalClasses(cityFeatures, weights) {
  const points = cityFeatures
    .map((city) => ({
      id: city.ADM2_CODE ?? city.uid,
      hazard: hazardScore(city, weights.hazardComponents),
      socio: adaptiveCapacityScore(city, weights.adaptiveCapacity),
    }))
    .filter((point) => point.id !== undefined && Number.isFinite(point.hazard) && Number.isFinite(point.socio));

  if (points.length < 4) {
    return { byId: new Map(), counts: {}, centroids: [] };
  }

  const hazardMedian = percentile(points.map((point) => point.hazard), 0.5);
  const socioMedian = percentile(points.map((point) => point.socio), 0.5);
  const bounds = {
    minHazard: Math.min(...points.map((point) => point.hazard)),
    maxHazard: Math.max(...points.map((point) => point.hazard)),
    minSocio: Math.min(...points.map((point) => point.socio)),
    maxSocio: Math.max(...points.map((point) => point.socio)),
  };
  let centroids = [
    meanPoint(points.filter((point) => point.socio >= socioMedian && point.hazard < hazardMedian), { hazard: bounds.minHazard, socio: bounds.maxSocio }),
    meanPoint(points.filter((point) => point.socio >= socioMedian && point.hazard >= hazardMedian), { hazard: bounds.maxHazard, socio: bounds.maxSocio }),
    meanPoint(points.filter((point) => point.socio < socioMedian && point.hazard < hazardMedian), { hazard: bounds.minHazard, socio: bounds.minSocio }),
    meanPoint(points.filter((point) => point.socio < socioMedian && point.hazard >= hazardMedian), { hazard: bounds.maxHazard, socio: bounds.minSocio }),
  ];

  let assignments = new Array(points.length).fill(0);
  for (let iteration = 0; iteration < 40; iteration += 1) {
    let changed = false;
    assignments = points.map((point, index) => {
      const next = centroids.reduce(
        (best, centroid, centroidIndex) => {
          const distance = squaredDistance(point, centroid);
          return distance < best.distance ? { centroidIndex, distance } : best;
        },
        { centroidIndex: 0, distance: Number.POSITIVE_INFINITY },
      ).centroidIndex;
      if (next !== assignments[index]) changed = true;
      return next;
    });
    centroids = centroids.map((centroid, centroidIndex) =>
      meanPoint(points.filter((_, pointIndex) => assignments[pointIndex] === centroidIndex), centroid),
    );
    if (!changed) break;
  }

  const labelsByCentroid = bestClassAssignment(centroids, bounds);
  const byId = new Map();
  const counts = Object.fromEntries(MUNICIPAL_CLASS_LABELS.map((label) => [label, 0]));
  points.forEach((point, index) => {
    const label = labelsByCentroid[assignments[index]];
    counts[label] = (counts[label] || 0) + 1;
    byId.set(String(point.id), {
      dynamic_cluster: label,
      dynamic_hazard: point.hazard,
      dynamic_socio: point.socio,
    });
  });

  return { byId, counts, centroids: centroids.map((centroid, index) => ({ ...centroid, label: labelsByCentroid[index] })) };
}

export function percentile(values, fraction) {
  if (!values.length) return Number.NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = fraction * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  const weight = index - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function tierForPriority(priority, thresholds) {
  if (!Number.isFinite(priority)) return { tier: 4, label: "Tier 4", color: "#8aa4bd" };
  if (priority >= thresholds.p90) return { tier: 1, label: "Tier 1", color: "#d62828" };
  if (priority >= thresholds.p75) return { tier: 2, label: "Tier 2", color: "#f08c1a" };
  if (priority >= thresholds.p50) return { tier: 3, label: "Tier 3", color: "#f6bd60" };
  return { tier: 4, label: "Tier 4", color: "#8aa4bd" };
}

export function buildPriorityRows(cityFeatures, filters, weights) {
  const filtered = cityFeatures
    .filter((city) => {
      if (filters.country && filters.country !== "all" && city.ADM0_NAME !== filters.country) return false;
      if (filters.state && filters.state !== "all" && city.ADM1_NAME !== filters.state) return false;
      if (filters.popGroup && filters.popGroup !== "all" && city.PopGroup !== filters.popGroup) return false;
      if (filters.search) {
        const haystack = `${city.ADM2_NAME || ""} ${city.ADM1_NAME || ""} ${city.ADM0_NAME || ""}`.toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    })
    .map((city) => {
      const metrics = priorityScore(city, weights);
      return { ...city, ...metrics };
    });

  const priorities = filtered.map((item) => item.priority).filter(Number.isFinite);
  const thresholds = {
    p50: percentile(priorities, 0.5),
    p75: percentile(priorities, 0.75),
    p90: percentile(priorities, 0.9),
  };

  const withTiers = filtered.map((row) => {
    const tier = tierForPriority(row.priority, thresholds);
    return { ...row, ...tier };
  });

  const metricKey = filters.rankBy === "population"
    ? "TotPop"
    : filters.rankBy === "impervious"
      ? "ImpRate"
      : "priority";

  withTiers.sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0));
  const topN = filters.topN === "all" ? withTiers.length : Math.max(1, Number(filters.topN || withTiers.length));
  const ranked = withTiers.slice(0, topN);
  return { ranked, thresholds, filteredCount: filtered.length };
}

export function markerRadius(totalPopulation) {
  const population = Math.max(1, Number(totalPopulation || 1));
  return clamp(3 + Math.log10(population) * 1.7, 4, 14);
}
