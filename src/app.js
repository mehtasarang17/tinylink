// src/app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = require('./db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Healthcheck
app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    version: '1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -----------------------------
// DASHBOARD (MUST BE ABOVE REDIRECT)
// -----------------------------
app.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT code, target_url, total_clicks, last_clicked_at, created_at
       FROM links
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );

    res.render('dashboard', {
      links: result.rows,
      baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('404', { message: 'Something went wrong.' });
  }
});

// -----------------------------
// STATS PAGE
// -----------------------------
app.get('/code/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      `SELECT code, target_url, total_clicks, last_clicked_at, created_at
       FROM links
       WHERE code = $1 AND deleted_at IS NULL`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).render('404', { message: 'Short link not found' });
    }

    res.render('stats', {
      link: result.rows[0],
      baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { message: 'Something went wrong' });
  }
});

// -----------------------------
// API ROUTES
// -----------------------------
app.post('/api/links', async (req, res) => {
  try {
    let { url, code } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (code && !/^[A-Za-z0-9]{6,8}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 6–8 alphanumeric characters' });
    }

    if (!code) {
      let unique = false;
      while (!unique) {
        code = generateCode(6);
        const exists = await db.query(
          'SELECT 1 FROM links WHERE code = $1 AND deleted_at IS NULL',
          [code]
        );
        if (exists.rowCount === 0) unique = true;
      }
    }

    const conflict = await db.query(
      'SELECT 1 FROM links WHERE code = $1 AND deleted_at IS NULL',
      [code]
    );
    if (conflict.rowCount > 0) {
      return res.status(409).json({ error: 'Code already exists' });
    }

    const result = await db.query(
      `INSERT INTO links (code, target_url)
       VALUES ($1, $2)
       RETURNING code, target_url, total_clicks, last_clicked_at, created_at`,
      [code, url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/links', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT code, target_url, total_clicks, last_clicked_at, created_at
       FROM links
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      `SELECT code, target_url, total_clicks, last_clicked_at, created_at
       FROM links
       WHERE code = $1 AND deleted_at IS NULL`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      `UPDATE links
       SET deleted_at = NOW()
       WHERE code = $1 AND deleted_at IS NULL
       RETURNING code`,
      [code]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------
// SHORT URL REDIRECT (MUST BE LAST BEFORE STATIC)
// -----------------------------
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      `UPDATE links
       SET total_clicks = total_clicks + 1,
           last_clicked_at = NOW()
       WHERE code = $1 AND deleted_at IS NULL
       RETURNING target_url`,
      [code]
    );

    if (result.rowCount === 0) {
      return res.status(404).render('404', { message: 'Short link not found.' });
    }

    return res.redirect(result.rows[0].target_url);
  } catch (err) {
    console.error('Redirect error:', err);
    return res.status(500).render('404', { message: 'Redirect failed.' });
  }
});

// -----------------------------
// STATIC FILES (MUST BE LAST)
// -----------------------------
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// -----------------------------
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
