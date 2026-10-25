<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Department Management | Mpongwe Results</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="inner">
        <div class="brand">Mpongwe Day Secondary School</div>
        <nav class="nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/classes">Classes</a>
          <a href="/pupils">Pupils</a>
          <a href="/subjects">Subjects</a>
          <a href="/marks">Marks</a>
          <a href="/results">Results</a>
          <a href="/class-summary">Class Summary</a>
          <% if (user && user.role === 'admin') { %>
            <a href="/departments">Departments</a>
          <% } %>
          <a href="/logout">Logout</a>
        </nav>
        <% if (user) { %>
          <div class="user-chip"><%= user.name %> • <%= user.role %></div>
        <% } %>
      </div>
    </header>

    <main class="container">
      <div class="page-header">
        <h1>Manage Departments</h1>
      </div>

      <% if (success) { %>
        <div class="alert alert-success"><%= success %></div>
      <% } %>
      <% if (error) { %>
        <div class="alert alert-error"><%= error %></div>
      <% } %>

      <div class="form-wrap">
        <form method="POST" action="/departments">
          <div class="form-grid">
            <div class="field">
              <label for="name">Department Name</label>
              <input id="name" name="name" type="text" required />
            </div>
            <div class="field">
              <label for="username">Username</label>
              <input id="username" name="username" type="text" required />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" required />
            </div>
            <div class="field" style="justify-content: flex-end;">
              <button type="submit" class="btn btn-primary">Add Department User</button>
            </div>
          </div>
        </form>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <% departments.forEach((department) => { %>
              <tr>
                <td data-label="Name"><%= department.name %></td>
                <td data-label="Username"><%= department.username %></td>
                <td data-label="Role"><span class="badge"><%= department.role %></span></td>
              </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
    </main>
  </body>
</html>
