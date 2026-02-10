import {
  getAllPersons as getAllPersonsFromDb,
  getPersonById as getPersonByIdFromDb,
  createPerson as insertPersonToDb,
  updatePersonName as updatePersonNameInDb,
  deletePersonById as deletePersonFromDb,
  getAllFaces as getAllFacesFromDb,
  updateFacePersonId,
  getFaceById
} from './sqliteDatabase.js';

interface Person {
  id: number;
  name: string;
  representative_face_id: number | null;
  face_count: number;
  created_at: string;
}

interface PersonPhoto {
  filename: string;
  face_count: number;
}

export function getAllPersons(): Person[] {
  const persons = getAllPersonsFromDb();
  const faces = getAllFacesFromDb();

  return persons.map(person => {
    const personFaces = faces.filter(f => f.person_id === person.id);
    const faceCount = personFaces.length;

    // Use representative_face_id if available, otherwise use first face
    let thumbnailFaceId = person.representative_face_id;
    if (!thumbnailFaceId && personFaces.length > 0) {
      thumbnailFaceId = personFaces[0].id;
    }

    return {
      ...person,
      face_count: faceCount,
      thumbnail_face_id: thumbnailFaceId // Add for direct thumbnail access
    };
  }).sort((a, b) => a.id - b.id);
}

export function getPersonById(personId: number): Person | undefined {
  const person = getPersonByIdFromDb(personId);
  if (!person) return undefined;

  const faces = getAllFacesFromDb();
  const faceCount = faces.filter(f => f.person_id === personId).length;

  return {
    ...person,
    face_count: faceCount
  };
}

export function createPerson(name: string): Person {
  const person = insertPersonToDb(name);

  return {
    ...person,
    face_count: 0
  };
}

export function updatePerson(personId: number, name: string): void {
  updatePersonNameInDb(personId, name);
}

export function deletePerson(personId: number): void {
  deletePersonFromDb(personId);
}

export function getPersonPhotos(personId: number): PersonPhoto[] {
  const faces = getAllFacesFromDb().filter(f => f.person_id === personId);

  // Group by photo filename
  const photoMap = new Map<string, number>();
  for (const face of faces) {
    const count = photoMap.get(face.photo_filename) || 0;
    photoMap.set(face.photo_filename, count + 1);
  }

  return Array.from(photoMap.entries())
    .map(([filename, face_count]) => ({ filename, face_count }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function setRepresentativeFace(personId: number, faceId: number): void {
  // Representative face functionality - implement if needed with SQLite
  // For now, this is a placeholder
}

export function assignFaceToPerson(faceId: number, personId: number): void {
  updateFacePersonId(faceId, personId);
}

export function unassignFace(faceId: number): void {
  updateFacePersonId(faceId, null);
}

export function mergePerson(sourcePersonId: number, targetPersonId: number): void {
  // Move all faces from source to target
  const faces = getAllFacesFromDb().filter(f => f.person_id === sourcePersonId);
  faces.forEach(face => {
    updateFacePersonId(face.id, targetPersonId);
  });

  // Delete source person
  deletePersonFromDb(sourcePersonId);
}
