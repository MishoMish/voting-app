import { initDatabase, runTransaction } from '../db.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize database schema and seed data
export function initializeDatabase() {
  console.log('Initializing database...');
  
  const db = initDatabase();
  
  // Create tables
  runTransaction((database) => {
    // Users table
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        logged_in BOOLEAN DEFAULT 0,
        voted BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if role column exists, add if not (for existing databases)
    try {
      database.prepare('SELECT role FROM users LIMIT 1').get();
    } catch (error) {
      if (error.code === 'SQLITE_ERROR') {
        console.log('Adding role column to existing users table...');
        database.exec('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"');
      }
    }
    
    // Votes table
    database.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        options_json TEXT NOT NULL,
        max_selections INTEGER DEFAULT 1,
        active BOOLEAN DEFAULT 0,
        anonymous BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME
      )
    `);
    
    // Submissions table
    database.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        vote_id INTEGER NOT NULL,
        choices_json TEXT NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(vote_id) REFERENCES votes(id),
        UNIQUE(user_id, vote_id)
      )
    `);
    
    console.log('Database tables created successfully');
  });
  
  // Seed initial data
  seedData(db);
  
  return db;
}

function seedData(db) {
  console.log('Seeding initial data...');
  
  runTransaction((database) => {
    // Check if users already exist
    const existingUsers = database.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (existingUsers.count === 0) {
      // Create admin user
      const adminPassword = bcrypt.hashSync('admin123', 10);
      database.prepare(`
        INSERT INTO users (username, password_hash, role) 
        VALUES (?, ?, ?)
      `).run('admin', adminPassword, 'admin');
      
      // Create test users
      const users = [
        { username: 'student1', password: 'password1', role: 'user' },
        { username: 'student2', password: 'password2', role: 'user' },
        { username: 'student3', password: 'password3', role: 'user' },
        { username: 'student4', password: 'password4', role: 'user' },
        { username: 'student5', password: 'password5', role: 'user' },
        { username: 'teacher1', password: 'teacher123', role: 'user' },
        { username: 'teacher2', password: 'teacher456', role: 'user' },
        { username: 'alice', password: 'alice123', role: 'user' },
        { username: 'bob', password: 'bob123', role: 'user' },
        { username: 'charlie', password: 'charlie123', role: 'user' }
      ];
      
      const insertUser = database.prepare(`
        INSERT INTO users (username, password_hash, role) 
        VALUES (?, ?, ?)
      `);
      
      for (const user of users) {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        insertUser.run(user.username, hashedPassword, user.role);
      }
      
      console.log(`Created admin user and ${users.length} test users`);
    }
    
    // Create a sample vote for testing (inactive by default)
    const existingVotes = database.prepare('SELECT COUNT(*) as count FROM votes').get();
    
    if (existingVotes.count === 0) {
      const sampleVote = {
        title: 'Class President Election',
        description: 'Vote for your preferred candidate for class president',
        options: JSON.stringify([
          'Alice Johnson',
          'Bob Smith', 
          'Charlie Davis',
          'Diana Wilson'
        ]),
        maxSelections: 1,
        active: false
      };
      
      database.prepare(`
        INSERT INTO votes (title, description, options_json, max_selections, active)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        sampleVote.title,
        sampleVote.description, 
        sampleVote.options,
        sampleVote.maxSelections,
        sampleVote.active ? 1 : 0
      );
      
      console.log('Created sample vote');
    }
  });
  
  console.log('Database seeding completed');
}

// Run initialization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    initializeDatabase();
    console.log('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

export default initializeDatabase;
