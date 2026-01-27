import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/db.json');

interface Face {
  id: number;
  photo_filename: string;
  face_index: number;
  bounding_box: string;
  encoding: string;
  person_id: number | null;
  confidence: number | null;
  created_at: string;
}

interface Person {
  id: number;
  name: string;
  representative_face_id: number | null;
  created_at: string;
}

interface ProcessingStatus {
  photo_filename: string;
  status: string;
  faces_count: number;
  processed_at: string | null;
  error_message: string | null;
}

interface Database {
  faces: Face[];
  persons: Person[];
  processing_status: ProcessingStatus[];
  next_face_id: number;
  next_person_id: number;
}

let db: Database | null = null;

function getDefaultDb(): Database {
  return {
    faces: [],
    persons: [],
    processing_status: [],
    next_face_id: 1,
    next_person_id: 1
  };
}

function loadDb(): Database {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('Error loading database, creating new one:', e);
      db = getDefaultDb();
    }
  } else {
    db = getDefaultDb();
  }

  return db!;
}

function saveDb(): void {
  if (db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }
}

// Initialize on module load
loadDb();

// ============ Generic Helpers ============

export function getDb(): Database {
  return loadDb();
}

export async function initDatabase(): Promise<void> {
  loadDb();
  saveDb();
}

// ============ Face Operations ============

export function getAllFacesFromDb(): Face[] {
  return getDb().faces;
}

export function getFacesByPhoto(photoFilename: string): Face[] {
  return getDb().faces.filter(f => f.photo_filename === photoFilename);
}

export function getFaceById(id: number): Face | undefined {
  return getDb().faces.find(f => f.id === id);
}

export function insertFace(face: Omit<Face, 'id'>): number {
  const database = getDb();
  const id = database.next_face_id++;
  database.faces.push({ ...face, id });
  saveDb();
  return id;
}

export function updateFacePersonId(faceId: number, personId: number | null): void {
  const database = getDb();
  const face = database.faces.find(f => f.id === faceId);
  if (face) {
    face.person_id = personId;
    saveDb();
  }
}

export function deleteFacesByPhoto(photoFilename: string): void {
  const database = getDb();
  database.faces = database.faces.filter(f => f.photo_filename !== photoFilename);
  saveDb();
}

// ============ Person Operations ============

export function getAllPersonsFromDb(): Person[] {
  return getDb().persons;
}

export function getPersonByIdFromDb(id: number): Person | undefined {
  return getDb().persons.find(p => p.id === id);
}

export function insertPerson(name: string): number {
  const database = getDb();
  const id = database.next_person_id++;
  database.persons.push({
    id,
    name,
    representative_face_id: null,
    created_at: new Date().toISOString()
  });
  saveDb();
  return id;
}

export function updatePersonName(personId: number, name: string): void {
  const database = getDb();
  const person = database.persons.find(p => p.id === personId);
  if (person) {
    person.name = name;
    saveDb();
  }
}

export function updatePersonRepFace(personId: number, faceId: number): void {
  const database = getDb();
  const person = database.persons.find(p => p.id === personId);
  if (person) {
    person.representative_face_id = faceId;
    saveDb();
  }
}

export function deletePersonFromDb(personId: number): void {
  const database = getDb();
  // Unassign faces
  database.faces.forEach(f => {
    if (f.person_id === personId) {
      f.person_id = null;
    }
  });
  // Delete person
  database.persons = database.persons.filter(p => p.id !== personId);
  saveDb();
}

// ============ Processing Status ============

export function getProcessingStatus(photoFilename: string): ProcessingStatus | undefined {
  return getDb().processing_status.find(p => p.photo_filename === photoFilename);
}

export function setProcessingStatus(status: ProcessingStatus): void {
  const database = getDb();
  const existing = database.processing_status.findIndex(p => p.photo_filename === status.photo_filename);
  if (existing >= 0) {
    database.processing_status[existing] = status;
  } else {
    database.processing_status.push(status);
  }
  saveDb();
}

export function getCompletedPhotosCount(): number {
  return getDb().processing_status.filter(p => p.status === 'completed').length;
}

// ============ Stats ============

export function getFacesCount(): number {
  return getDb().faces.length;
}

export function getPersonsCount(): number {
  return getDb().persons.length;
}
