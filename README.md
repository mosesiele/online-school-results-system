# Mpongwe Day Secondary School Results Management System

A full online results management system built for school administration, teachers, and department users.

Features
- Admin dashboard
- Teacher login
- Department user login
- Add pupil
- Add class
- Add subject
- Enter Test 1, Test 2, Test 3 marks
- Class summary
- Results table view
- Report cards
- Mobile responsive design
- Excel export
- PDF export

Supported classes
- Form 1E, 1L, 1M, 1N, 1S, 1W, 1Y
- Form 2E, 2L, 2V

Default login accounts
- Admin: username = admin, password = admin123
- Teacher: username = teacher, password = teacher123
- Department: username = department, password = dept123

Quick start
1. Install dependencies:
   npm install
2. Start the app:
   npm start
3. Open in browser:
   http://localhost:3000

Project structure
- server.js - application server and routes
- db.js - SQLite database setup and seed data
- views/ - EJS templates for dashboard, forms, reports, and tables
- public/styles.css - responsive styling
- data/school.db - SQLite database created automatically on first run

Export functionality
- Results page includes direct Excel export and direct PDF export for each selected class.

This project uses:
- Express.js
- EJS views
- SQLite database via better-sqlite3
- ExcelJS for Excel export
- PDFKit for PDF export
