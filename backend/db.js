import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'votes.db');

let db;

export function initDatabase() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    console.log('Database connection established');
    return db;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    db = initDatabase();
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Transaction wrapper for better error handling
export function runTransaction(operations) {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    return operations(database);
  });
  
  return transaction();
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  runTransaction
};
