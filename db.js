const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'school.db'));

function ensureUser(name, username, password, role) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!exists) {
    db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)').run(
      name,
      username,
      bcrypt.hashSync(password, 10),
      role
    );
  }
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher'
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS pupils (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_no TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      gender TEXT,
      date_of_birth TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      UNIQUE(name, class_id),
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pupil_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      test1 REAL DEFAULT 0,
      test2 REAL DEFAULT 0,
      test3 REAL DEFAULT 0,
      UNIQUE(pupil_id, subject_id),
      FOREIGN KEY(pupil_id) REFERENCES pupils(id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id)
    );
  `);

  const schoolClasses = [
    'Form 1E', 'Form 1L', 'Form 1M', 'Form 1N', 'Form 1S', 'Form 1W', 'Form 1Y',
    'Form 2E', 'Form 2L', 'Form 2V'
  ];

  for (const schoolClass of schoolClasses) {
    db.prepare('INSERT OR IGNORE INTO classes (name) VALUES (?)').run(schoolClass);
  }

  const defaultSubjects = [
    'English',
    'Mathematics',
    'Science',
    'Social Studies',
    'Computer Studies',
    'Religious Education',
    'Geography',
    'Agriculture',
    'Commerce',
    'History'
  ];

  const classes = db.prepare('SELECT id FROM classes').all();
  for (const classRow of classes) {
    for (const subject of defaultSubjects) {
      db.prepare('INSERT OR IGNORE INTO subjects (name, class_id) VALUES (?, ?)').run(subject, classRow.id);
    }
  }

  ensureUser('System Admin', 'admin', 'admin123', 'admin');
  ensureUser('Teacher User', 'teacher', 'teacher123', 'teacher');
  ensureUser('Department User', 'department', 'dept123', 'department');
}

initializeDatabase();

module.exports = { db, initializeDatabase };
