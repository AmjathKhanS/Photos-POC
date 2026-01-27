/**
 * Face Clustering Service using DBSCAN
 *
 * Cross-platform layer: Pure algorithm, works identically on all platforms
 * Uses L2 (Euclidean) distance on L2-normalized embeddings
 *
 * For normalized embeddings: L2 distance = sqrt(2 - 2 * cosine_similarity)
 * Distance 0 = identical, Distance sqrt(2) ≈ 1.414 = orthogonal, Distance 2 = opposite
 *
 * Typical thresholds for face recognition:
 * - eps = 0.6: Very strict (same person, similar pose)
 * - eps = 0.8: Moderate (same person, different poses)
 * - eps = 1.0: Loose (might include similar-looking people)
 */

import {
  getAllUnassignedFaces,
  getAllPersons,
  createPerson,
  assignFaceToPerson,
  updateFacePerson,
  getFacesByPerson,
  deletePerson,
  updatePersonCentroid,
  getAllFaces,
} from './faceDatabase';

export interface ClusteringResult {
  clustersCreated: number;
  facesAssigned: number;
  outliers: number;
  totalFaces: number;
}

/**
 * L2 (Euclidean) distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * DBSCAN clustering algorithm
 * https://en.wikipedia.org/wiki/DBSCAN
 *
 * @param embeddings - Array of embedding vectors
 * @param eps - Maximum distance between two samples to be considered neighbors
 * @param minPts - Minimum number of samples in a neighborhood to form a core point
 * @returns Array of cluster labels (-1 = noise/outlier)
 */
function dbscan(embeddings: number[][], eps: number, minPts: number): number[] {
  const n = embeddings.length;
  const labels = new Array(n).fill(-1);  // -1 = unvisited/noise
  let clusterId = 0;

  // Precompute distance matrix for efficiency
  console.log('Computing distance matrix...');
  const distMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
      } else if (j < i) {
        distMatrix[i][j] = distMatrix[j][i];
      } else {
        distMatrix[i][j] = euclideanDistance(embeddings[i], embeddings[j]);
      }
    }
  }

  // Log distance statistics
  const allDists: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allDists.push(distMatrix[i][j]);
    }
  }
  if (allDists.length > 0) {
    allDists.sort((a, b) => a - b);
    console.log(`Distance stats (${allDists.length} pairs):`);
    console.log(`  Min: ${allDists[0].toFixed(4)}`);
    console.log(`  25%: ${allDists[Math.floor(allDists.length * 0.25)].toFixed(4)}`);
    console.log(`  50%: ${allDists[Math.floor(allDists.length * 0.5)].toFixed(4)}`);
    console.log(`  75%: ${allDists[Math.floor(allDists.length * 0.75)].toFixed(4)}`);
    console.log(`  Max: ${allDists[allDists.length - 1].toFixed(4)}`);
  }

  // Find neighbors within eps distance
  function getNeighbors(pointIdx: number): number[] {
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      if (distMatrix[pointIdx][j] <= eps) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  // Expand cluster from a core point
  function expandCluster(pointIdx: number, neighbors: number[], cluster: number): void {
    labels[pointIdx] = cluster;

    const queue = [...neighbors];
    const visited = new Set<number>([pointIdx]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current)) continue;
      visited.add(current);

      if (labels[current] === -1) {
        labels[current] = cluster;
      }

      const currentNeighbors = getNeighbors(current);
      if (currentNeighbors.length >= minPts) {
        // Current point is also a core point, add its neighbors
        for (const neighbor of currentNeighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
            if (labels[neighbor] === -1) {
              labels[neighbor] = cluster;
            }
          }
        }
      }
    }
  }

  // Main DBSCAN loop
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;  // Already processed

    const neighbors = getNeighbors(i);

    if (neighbors.length < minPts) {
      // Mark as noise (might be reassigned later)
      labels[i] = -1;
    } else {
      // Start new cluster
      expandCluster(i, neighbors, clusterId);
      clusterId++;
    }
  }

  return labels;
}

/**
 * Cluster unassigned faces using DBSCAN
 *
 * @param eps - Distance threshold (default 0.8 for normalized embeddings)
 * @param minPts - Minimum cluster size (default 1 to allow single-face persons)
 */
export async function clusterFaces(
  eps: number = 0.8,
  minPts: number = 1
): Promise<ClusteringResult> {
  const unassignedFaces = await getAllUnassignedFaces();
  const n = unassignedFaces.length;

  console.log(`Starting DBSCAN clustering with ${n} unassigned faces`);
  console.log(`Parameters: eps=${eps}, minPts=${minPts}`);

  if (n === 0) {
    return {
      clustersCreated: 0,
      facesAssigned: 0,
      outliers: 0,
      totalFaces: 0,
    };
  }

  // Extract embeddings
  const embeddings = unassignedFaces.map(f => f.embedding);

  // Run DBSCAN
  console.log('Running DBSCAN...');
  const labels = dbscan(embeddings, eps, minPts);

  // Count clusters and outliers
  const uniqueLabels = new Set(labels);
  const numClusters = Array.from(uniqueLabels).filter(l => l >= 0).length;
  const numOutliers = labels.filter(l => l === -1).length;

  console.log(`DBSCAN found ${numClusters} clusters, ${numOutliers} outliers`);

  // Group faces by cluster
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (label >= 0) {
      if (!clusterMap.has(label)) {
        clusterMap.set(label, []);
      }
      clusterMap.get(label)!.push(i);
    }
  }

  // Log cluster sizes
  for (const [label, indices] of clusterMap) {
    const files = indices.slice(0, 3).map(i => unassignedFaces[i].photoFilename);
    console.log(`Cluster ${label}: ${indices.length} faces (${files.join(', ')}${indices.length > 3 ? '...' : ''})`);
  }

  // Create persons for each cluster
  const existingPersons = await getAllPersons();
  let personCount = existingPersons.length;
  let facesAssigned = 0;

  for (const [, indices] of clusterMap) {
    personCount++;
    const personId = await createPerson(`Person ${personCount}`);

    for (const idx of indices) {
      const face = unassignedFaces[idx];
      await assignFaceToPerson(face.id!, personId);
      facesAssigned++;
    }
  }

  // Handle outliers - create individual persons for each
  const outlierIndices = labels.map((l, i) => l === -1 ? i : -1).filter(i => i >= 0);
  for (const idx of outlierIndices) {
    personCount++;
    const personId = await createPerson(`Person ${personCount}`);
    const face = unassignedFaces[idx];
    await assignFaceToPerson(face.id!, personId);
    facesAssigned++;
  }

  console.log(`Clustering complete: ${numClusters + outlierIndices.length} persons created, ${facesAssigned} faces assigned`);

  return {
    clustersCreated: numClusters,
    facesAssigned,
    outliers: numOutliers,
    totalFaces: n,
  };
}

/**
 * Find matching person for a new face embedding
 */
export async function findMatchingPerson(
  embedding: number[],
  threshold: number = 0.8
): Promise<number | null> {
  const persons = await getAllPersons();

  let bestMatch: { personId: number; distance: number } | null = null;

  for (const person of persons) {
    if (!person.centroid || !person.id) continue;

    const distance = euclideanDistance(embedding, person.centroid);

    if (distance < threshold) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { personId: person.id, distance };
      }
    }
  }

  return bestMatch?.personId ?? null;
}

/**
 * Reassign a face to a different person
 */
export async function reassignFace(
  faceId: number,
  targetPersonId: number | null
): Promise<void> {
  if (targetPersonId === null) {
    await updateFacePerson(faceId, null);
  } else {
    await assignFaceToPerson(faceId, targetPersonId);
  }
}

/**
 * Merge two persons into one
 */
export async function mergePersons(
  sourcePersonId: number,
  targetPersonId: number
): Promise<void> {
  const sourceFaces = await getFacesByPerson(sourcePersonId);

  for (const face of sourceFaces) {
    await assignFaceToPerson(face.id!, targetPersonId);
  }

  await deletePerson(sourcePersonId);
  await updatePersonCentroid(targetPersonId);
}

/**
 * Get clustering statistics
 */
export async function getClusteringStats(): Promise<{
  totalFaces: number;
  assignedFaces: number;
  unassignedFaces: number;
  totalPersons: number;
}> {
  const allFaces = await getAllFaces();
  const persons = await getAllPersons();
  const assigned = allFaces.filter(f => f.personId !== null).length;

  return {
    totalFaces: allFaces.length,
    assignedFaces: assigned,
    unassignedFaces: allFaces.length - assigned,
    totalPersons: persons.length,
  };
}
