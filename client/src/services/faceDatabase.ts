import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface StoredFace {
  id?: number;
  photoId: string;
  photoFilename: string;
  faceIndex: number;
  boundingBox: { top: number; right: number; bottom: number; left: number };
  embedding: number[];
  personId: number | null;
  createdAt: string;
}

export interface StoredPerson {
  id?: number;
  name: string;
  representativeFaceId: number | null;
  centroid: number[] | null;
  createdAt: string;
}

interface FaceDBSchema extends DBSchema {
  faces: {
    key: number;
    value: StoredFace;
    indexes: { 'by-photo': string; 'by-person': number };
  };
  persons: {
    key: number;
    value: StoredPerson;
  };
  processingStatus: {
    key: string;
    value: {
      photoId: string;
      status: 'pending' | 'completed' | 'failed';
      facesCount: number;
      processedAt: string | null;
      errorMessage: string | null;
    };
  };
}

let dbInstance: IDBPDatabase<FaceDBSchema> | null = null;

export async function getDb(): Promise<IDBPDatabase<FaceDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<FaceDBSchema>('photo-viewer-faces', 1, {
    upgrade(db) {
      const facesStore = db.createObjectStore('faces', {
        keyPath: 'id',
        autoIncrement: true,
      });
      facesStore.createIndex('by-photo', 'photoId');
      facesStore.createIndex('by-person', 'personId');

      db.createObjectStore('persons', {
        keyPath: 'id',
        autoIncrement: true,
      });

      db.createObjectStore('processingStatus', {
        keyPath: 'photoId',
      });
    },
  });

  return dbInstance;
}

// Face operations
export async function saveFace(face: Omit<StoredFace, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('faces', face as StoredFace);
}

export async function getFacesByPhoto(photoId: string): Promise<StoredFace[]> {
  const db = await getDb();
  return db.getAllFromIndex('faces', 'by-photo', photoId);
}

export async function getFacesByPerson(personId: number): Promise<StoredFace[]> {
  const db = await getDb();
  return db.getAllFromIndex('faces', 'by-person', personId);
}

export async function getAllFaces(): Promise<StoredFace[]> {
  const db = await getDb();
  return db.getAll('faces');
}

export async function getAllUnassignedFaces(): Promise<StoredFace[]> {
  const db = await getDb();
  const allFaces = await db.getAll('faces');
  return allFaces.filter(f => f.personId === null);
}

export async function updateFacePerson(faceId: number, personId: number | null): Promise<void> {
  const db = await getDb();
  const face = await db.get('faces', faceId);
  if (face) {
    face.personId = personId;
    await db.put('faces', face);
  }
}

// Person operations
export async function createPerson(name: string): Promise<number> {
  const db = await getDb();
  return db.add('persons', {
    name,
    representativeFaceId: null,
    centroid: null,
    createdAt: new Date().toISOString(),
  } as StoredPerson);
}

export async function getAllPersons(): Promise<StoredPerson[]> {
  const db = await getDb();
  return db.getAll('persons');
}

export async function getPerson(personId: number): Promise<StoredPerson | undefined> {
  const db = await getDb();
  return db.get('persons', personId);
}

export async function updatePerson(person: StoredPerson): Promise<void> {
  const db = await getDb();
  await db.put('persons', person);
}

export async function deletePerson(personId: number): Promise<void> {
  const db = await getDb();

  // Unassign all faces from this person
  const faces = await getFacesByPerson(personId);
  for (const face of faces) {
    face.personId = null;
    await db.put('faces', face);
  }

  await db.delete('persons', personId);
}

export async function assignFaceToPerson(faceId: number, personId: number): Promise<void> {
  const db = await getDb();
  const face = await db.get('faces', faceId);
  if (face) {
    face.personId = personId;
    await db.put('faces', face);
    await updatePersonCentroid(personId);
  }
}

export async function updatePersonCentroid(personId: number): Promise<void> {
  const db = await getDb();
  const personFaces = await getFacesByPerson(personId);

  if (personFaces.length === 0) return;

  // Compute average embedding (dimension-agnostic)
  const embeddingDim = personFaces[0].embedding.length;
  const centroid = new Array(embeddingDim).fill(0);

  for (const face of personFaces) {
    for (let i = 0; i < embeddingDim; i++) {
      centroid[i] += face.embedding[i];
    }
  }
  for (let i = 0; i < embeddingDim; i++) {
    centroid[i] /= personFaces.length;
  }

  // L2 normalize the centroid
  let norm = 0;
  for (let i = 0; i < embeddingDim; i++) {
    norm += centroid[i] * centroid[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < embeddingDim; i++) {
      centroid[i] /= norm;
    }
  }

  const person = await db.get('persons', personId);
  if (person) {
    person.centroid = centroid;
    person.representativeFaceId = personFaces[0].id!;
    await db.put('persons', person);
  }
}

// Processing status
export async function getProcessingStatus(photoId: string) {
  const db = await getDb();
  return db.get('processingStatus', photoId);
}

export async function setProcessingStatus(
  photoId: string,
  status: 'pending' | 'completed' | 'failed',
  facesCount: number,
  errorMessage: string | null = null
): Promise<void> {
  const db = await getDb();
  await db.put('processingStatus', {
    photoId,
    status,
    facesCount,
    processedAt: new Date().toISOString(),
    errorMessage,
  });
}

// Stats
export async function getStats() {
  const db = await getDb();
  const faces = await db.getAll('faces');
  const persons = await db.getAll('persons');
  const statuses = await db.getAll('processingStatus');

  return {
    totalPhotos: statuses.length,
    processedPhotos: statuses.filter(s => s.status === 'completed').length,
    totalFaces: faces.length,
    totalPersons: persons.length,
  };
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await db.clear('faces');
  await db.clear('persons');
  await db.clear('processingStatus');
}
