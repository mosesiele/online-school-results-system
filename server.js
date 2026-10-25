const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const session = require('express-session');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'mpongwe-school-results-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userRole = req.session.user.role;
    const allowed = roles.includes(userRole) || userRole === 'admin';

    if (!allowed) {
      return res.status(403).send('Access denied. You do not have permission for this page.');
    }

    next();
  };
}

function getAverage(values) {
  const filtered = values.filter((value) => Number.isFinite(value) && value !== null && value !== undefined);
  if (!filtered.length) return 0;
  return filtered.reduce((total, v) => total + Number(v), 0) / filtered.length;
}

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  };

  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/dashboard', requireRole(), (req, res) => {
  const totalPupils = db.prepare('SELECT COUNT(*) AS total FROM pupils').get().total;
  const totalClasses = db.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
  const totalSubjects = db.prepare('SELECT COUNT(*) AS total FROM subjects').get().total;
  const totalMarks = db.prepare('SELECT COUNT(*) AS total FROM results').get().total;
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();

  const classSummary = classes.map((schoolClass) => {
    const pupils = db.prepare('SELECT * FROM pupils WHERE class_id = ?').all(schoolClass.id);
    const subjectRows = db.prepare(
      `SELECT r.test1, r.test2, r.test3, s.name AS subject_name
       FROM results r
       JOIN subjects s ON s.id = r.subject_id
       WHERE s.class_id = ?`
    ).all(schoolClass.id);

    const pupilCount = pupils.length;
    const subjectCount = subjectRows.length;
    const average = getAverage(subjectRows.flatMap((item) => [item.test1, item.test2, item.test3]));

    return {
      ...schoolClass,
      pupilCount,
      subjectCount,
      average: Number(average).toFixed(2)
    };
  });

  const summary = {
    totalPupils,
    totalClasses,
    totalSubjects,
    totalMarks
  };

  res.render('dashboard', { summary, classSummary });
});

app.get('/classes', requireRole(), (req, res) => {
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
  res.render('classes', { classes, success: null, error: null });
});

app.post('/classes', requireRole(['admin', 'teacher']), (req, res) => {
  const name = (req.body.name || '').trim();

  if (!name) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    return res.render('classes', {
      classes,
      success: null,
      error: 'Class name is required.'
    });
  }

  try {
    db.prepare('INSERT INTO classes (name) VALUES (?)').run(name);
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    return res.render('classes', {
      classes,
      success: 'Class added successfully.',
      error: null
    });
  } catch (error) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    return res.render('classes', {
      classes,
      success: null,
      error: 'Class already exists or could not be added.'
    });
  }
});

app.get('/pupils', requireRole(), (req, res) => {
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
  const pupils = db.prepare(`
    SELECT p.*, c.name AS class_name
    FROM pupils p
    JOIN classes c ON c.id = p.class_id
    ORDER BY c.name ASC, p.full_name ASC
  `).all();
  res.render('pupils', { pupils, classes, success: null, error: null });
});

app.post('/pupils', requireRole(['admin', 'teacher']), (req, res) => {
  const fullName = (req.body.full_name || '').trim();
  const admissionNo = (req.body.admission_no || '').trim();
  const classId = Number(req.body.class_id || 0);
  const gender = (req.body.gender || '').trim();
  const dateOfBirth = req.body.date_of_birth || null;

  if (!fullName || !admissionNo || !classId) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const pupils = db.prepare(`
      SELECT p.*, c.name AS class_name
      FROM pupils p
      JOIN classes c ON c.id = p.class_id
      ORDER BY c.name ASC, p.full_name ASC
    `).all();
    return res.render('pupils', {
      pupils,
      classes,
      success: null,
      error: 'Please complete all required fields.'
    });
  }

  try {
    db.prepare(
      'INSERT INTO pupils (admission_no, full_name, class_id, gender, date_of_birth) VALUES (?, ?, ?, ?, ?)'
    ).run(admissionNo, fullName, classId, gender, dateOfBirth);

    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const pupils = db.prepare(`
      SELECT p.*, c.name AS class_name
      FROM pupils p
      JOIN classes c ON c.id = p.class_id
      ORDER BY c.name ASC, p.full_name ASC
    `).all();
    return res.render('pupils', {
      pupils,
      classes,
      success: 'Pupil added successfully.',
      error: null
    });
  } catch (error) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const pupils = db.prepare(`
      SELECT p.*, c.name AS class_name
      FROM pupils p
      JOIN classes c ON c.id = p.class_id
      ORDER BY c.name ASC, p.full_name ASC
    `).all();
    return res.render('pupils', {
      pupils,
      classes,
      success: null,
      error: 'Admission number already exists or data is invalid.'
    });
  }
});

app.get('/subjects', requireRole(), (req, res) => {
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
  const subjects = db.prepare(`
    SELECT s.*, c.name AS class_name
    FROM subjects s
    JOIN classes c ON c.id = s.class_id
    ORDER BY c.name ASC, s.name ASC
  `).all();
  res.render('subjects', { subjects, classes, success: null, error: null });
});

app.post('/subjects', requireRole(['admin', 'teacher']), (req, res) => {
  const name = (req.body.name || '').trim();
  const classId = Number(req.body.class_id || 0);

  if (!name || !classId) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const subjects = db.prepare(`
      SELECT s.*, c.name AS class_name
      FROM subjects s
      JOIN classes c ON c.id = s.class_id
      ORDER BY c.name ASC, s.name ASC
    `).all();
    return res.render('subjects', {
      subjects,
      classes,
      success: null,
      error: 'Subject name and class are required.'
    });
  }

  try {
    db.prepare('INSERT INTO subjects (name, class_id) VALUES (?, ?)').run(name, classId);
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const subjects = db.prepare(`
      SELECT s.*, c.name AS class_name
      FROM subjects s
      JOIN classes c ON c.id = s.class_id
      ORDER BY c.name ASC, s.name ASC
    `).all();
    return res.render('subjects', {
      subjects,
      classes,
      success: 'Subject added successfully.',
      error: null
    });
  } catch (error) {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
    const subjects = db.prepare(`
      SELECT s.*, c.name AS class_name
      FROM subjects s
      JOIN classes c ON c.id = s.class_id
      ORDER BY c.name ASC, s.name ASC
    `).all();
    return res.render('subjects', {
      subjects,
      classes,
      success: null,
      error: 'Subject already exists for this class.'
    });
  }
});

app.get('/marks', requireRole(['teacher', 'admin']), (req, res) => {
  const classId = Number(req.query.classId || 0);
  const subjectId = Number(req.query.subjectId || 0);
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
  const subjectOptions = classId ? db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC').all(classId) : [];
  const pupils = classId ? db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId) : [];

  const existingMarks = {};
  if (classId && subjectId) {
    const marks = db.prepare('SELECT * FROM results WHERE subject_id = ?').all(subjectId);
    for (const item of marks) {
      existingMarks[item.pupil_id] = item;
    }
  }

  res.render('marks', {
    classes,
    pupils,
    subjectOptions,
    classId,
    subjectId,
    existingMarks,
    success: null,
    error: null
  });
});

app.post('/marks', requireRole(['teacher', 'admin']), (req, res) => {
  const classId = Number(req.body.classId || 0);
  const subjectId = Number(req.body.subjectId || 0);

  if (!classId || !subjectId) {
    return res.redirect('/marks');
  }

  const pupils = db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId);

  for (const pupil of pupils) {
    const test1 = Number(req.body[`test1_${pupil.id}`] || 0);
    const test2 = Number(req.body[`test2_${pupil.id}`] || 0);
    const test3 = Number(req.body[`test3_${pupil.id}`] || 0);

    db.prepare(`
      INSERT INTO results (pupil_id, subject_id, test1, test2, test3)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(pupil_id, subject_id)
      DO UPDATE SET test1 = excluded.test1, test2 = excluded.test2, test3 = excluded.test3
    `).run(pupil.id, subjectId, test1, test2, test3);
  }

  return res.redirect(`/results?classId=${classId}`);
});

app.get('/results', requireRole(), (req, res) => {
  const classId = Number(req.query.classId || 0);
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();
  const subjects = classId
    ? db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC').all(classId)
    : [];
  const pupils = classId
    ? db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId)
    : [];

  const marks = classId
    ? db.prepare(`
        SELECT r.pupil_id, r.subject_id, r.test1, r.test2, r.test3, s.name AS subject_name
        FROM results r
        JOIN subjects s ON s.id = r.subject_id
        WHERE s.class_id = ?
      `).all(classId)
    : [];

  const marksMap = {};
  for (const mark of marks) {
    if (!marksMap[mark.pupil_id]) {
      marksMap[mark.pupil_id] = {};
    }
    marksMap[mark.pupil_id][mark.subject_id] = mark;
  }

  res.render('results', {
    classes,
    classId,
    subjects,
    pupils,
    marksMap,
    getAverage
  });
});

app.get('/class-summary', requireRole(), (req, res) => {
  const classId = Number(req.query.classId || 0);
  const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all();

  const selectedClass = classId ? db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) : null;
  const pupils = classId ? db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId) : [];
  const subjects = classId ? db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC').all(classId) : [];

  const pupilSummary = pupils.map((pupil) => {
    const results = db.prepare('SELECT * FROM results WHERE pupil_id = ?').all(pupil.id);
    const subjectAverage = results.length
      ? results.map((item) => Number((Number(item.test1) + Number(item.test2) + Number(item.test3)) / 3)).reduce((a, b) => a + b, 0) / results.length
      : 0;

    return {
      pupil,
      subjectAverage: Number(subjectAverage).toFixed(2),
      results
    };
  });

  const subjectSummary = subjects.map((subject) => {
    const rows = db.prepare('SELECT * FROM results WHERE subject_id = ?').all(subject.id);
    const subjectAverages = rows.map((row) => getAverage([row.test1, row.test2, row.test3]));

    return {
      subject,
      classAverage: subjectAverages.length ? Number(subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length).toFixed(2) : 0
    };
  });

  res.render('class-summary', {
    classes,
    classId,
    selectedClass,
    pupils,
    subjectSummary,
    pupilSummary
  });
});

app.get('/report-card/:pupilId', requireRole(), (req, res) => {
  const pupilId = Number(req.params.pupilId || 0);
  const pupil = db.prepare(`
    SELECT p.*, c.name AS class_name
    FROM pupils p
    JOIN classes c ON c.id = p.class_id
    WHERE p.id = ?
  `).get(pupilId);

  if (!pupil) {
    return res.redirect('/pupils');
  }

  const subjects = db.prepare(`
    SELECT s.id, s.name, r.test1, r.test2, r.test3
    FROM subjects s
    LEFT JOIN results r ON r.subject_id = s.id AND r.pupil_id = ?
    WHERE s.class_id = ?
    ORDER BY s.name ASC
  `).all(pupilId, pupil.class_id);

  const subjectRows = subjects.map((subject) => {
    const average = getAverage([subject.test1, subject.test2, subject.test3]);
    return {
      ...subject,
      average: Number(average).toFixed(2)
    };
  });

  const overallAverage = subjectRows.length
    ? Number(subjectRows.reduce((total, item) => total + Number(item.average), 0) / subjectRows.length).toFixed(2)
    : 0;

  res.render('report-card', {
    pupil,
    subjectRows,
    overallAverage
  });
});

app.get('/departments', requireRole(['admin']), (req, res) => {
  const departments = db.prepare("SELECT * FROM users WHERE role = 'department' ORDER BY name ASC").all();
  res.render('departments', { departments, success: null, error: null });
});

app.post('/departments', requireRole(['admin']), (req, res) => {
  const name = (req.body.name || '').trim();
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!name || !username || !password) {
    const departments = db.prepare("SELECT * FROM users WHERE role = 'department' ORDER BY name ASC").all();
    return res.render('departments', {
      departments,
      success: null,
      error: 'Name, username and password are required.'
    });
  }

  try {
    db.prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)').run(
      name,
      username,
      bcrypt.hashSync(password, 10),
      'department'
    );

    const departments = db.prepare("SELECT * FROM users WHERE role = 'department' ORDER BY name ASC").all();
    return res.render('departments', {
      departments,
      success: 'Department user added successfully.',
      error: null
    });
  } catch (error) {
    const departments = db.prepare("SELECT * FROM users WHERE role = 'department' ORDER BY name ASC").all();
    return res.render('departments', {
      departments,
      success: null,
      error: 'Department username already exists.'
    });
  }
});

app.get('/export/class/:classId/excel', requireRole(), async (req, res) => {
  const classId = Number(req.params.classId || 0);
  const schoolClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!schoolClass) {
    return res.status(404).send('Class not found.');
  }

  const subjects = db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC').all(classId);
  const pupils = db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Results');

  sheet.addRow(['Admission No', 'Student Name', 'Gender', 'Class']);
  subjects.forEach((subject) => {
    sheet.addRow([``, '', '', '']);
    sheet.addRow(['', '', '', '']);
  });

  const header = ['Admission No', 'Student Name', 'Gender', 'Class'];
  for (const subject of subjects) {
    header.push(`${subject.name} Test 1`, `${subject.name} Test 2`, `${subject.name} Test 3`);
  }
  sheet.addRow(header);

  for (const pupil of pupils) {
    const row = [pupil.admission_no, pupil.full_name, pupil.gender || '', schoolClass.name];
    for (const subject of subjects) {
      const result = db.prepare('SELECT * FROM results WHERE pupil_id = ? AND subject_id = ?').get(pupil.id, subject.id) || {};
      row.push(result.test1 || 0, result.test2 || 0, result.test3 || 0);
    }
    sheet.addRow(row);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${schoolClass.name.replace(/\s+/g, '-')}-results.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.get('/export/class/:classId/pdf', requireRole(), (req, res) => {
  const classId = Number(req.params.classId || 0);
  const schoolClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);

  if (!schoolClass) {
    return res.status(404).send('Class not found.');
  }

  const subjects = db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name ASC').all(classId);
  const pupils = db.prepare('SELECT * FROM pupils WHERE class_id = ? ORDER BY full_name ASC').all(classId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${schoolClass.name.replace(/\s+/g, '-')}-results.pdf"`);

  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.pipe(res);
  doc.fontSize(18).text(`${schoolClass.name} Results Report`, { underline: true });
  doc.moveDown();

  const columns = ['Student', ...subjects.map((subject) => `${subject.name}`)];
  let y = 120;
  let x = 30;

  for (let i = 0; i < columns.length; i += 1) {
    doc.fontSize(8).text(columns[i], x, y, { width: 130 });
    x += 130;
  }

  y += 25;
  pupils.forEach((pupil) => {
    let currentX = 30;
    doc.fontSize(8).text(pupil.full_name, currentX, y, { width: 130 });
    currentX += 130;

    for (const subject of subjects) {
      const result = db.prepare('SELECT * FROM results WHERE pupil_id = ? AND subject_id = ?').get(pupil.id, subject.id) || {};
      const average = getAverage([result.test1, result.test2, result.test3]);
      doc.fontSize(8).text(Number(average).toFixed(2), currentX, y, { width: 120 });
      currentX += 130;
    }
    y += 18;
  });

  doc.end();
});

app.listen(PORT, () => {
  console.log(`School Results System is running on http://localhost:${PORT}`);
});
