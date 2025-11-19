// src/app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = require('./db');

// Validate URL
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Generate random 6–8 character code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ----------------------
// Middleware
// ----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static ONLY under /public (not at root!)
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// ----------------------
// View Engine
// ----------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// ----------------------
// Healthcheck
// ----------------------
app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    version: '1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});


// ----------------------
// DASHBOARD PAGE
// ----------------------
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


// ----------------------
// API ROUTES
// ----------------------
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

// app.get('/:code', async (req, res) => {
//   const { code } = req.params;

//   // Skip only REAL prefixes
//   if (['api', 'public', 'code', 'healthz', 'favicon.ico'].includes(code)) {
//     return res.status(404).render('404', { message: 'Not found' });
//   }

//   try {
//     const result = await db.query(
//       `UPDATE links
//        SET total_clicks = total_clicks + 1,
//            last_clicked_at = NOW()
//        WHERE code = $1 AND deleted_at IS NULL
//        RETURNING target_url`,
//       [code]
//     );

//     if (result.rowCount === 0) {
//       return res
//         .status(404)
//         .render('404', { message: 'Short link not found or deleted' });
//     }

//     let targetUrl = result.rows[0].target_url;

//     // Normalize URLs missing protocol
//     if (!/^https?:\/\//i.test(targetUrl)) {
//       targetUrl = 'https://' + targetUrl;
//     }

//     return res.redirect(302, targetUrl);
//   } catch (err) {
//     console.error('Redirect error:', err);
//     return res
//       .status(500)
//       .render('404', { message: 'Something went wrong while redirecting' });
//   }
// });

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

// ----------------------
// REDIRECT ROUTE (LAST)
// ----------------------
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  // Skip system paths
  if (['api', 'public', 'code', 'healthz', 'favicon.ico'].includes(code)) {
    return res.status(404).render('404', { message: 'Not found' });
  }

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
      return res.status(404).render('404', { message: 'Short link not found' });
    }

    let target = result.rows[0].target_url;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    return res.redirect(302, target);
  } catch (err) {
    console.error('Redirect error:', err);
    return res.status(500).render('404', { message: 'Redirect failed' });
  }
});


// ----------------------
// ERROR HANDLER
// ----------------------
app.use((err, req, res, next) => {
  console.error(err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).render('404', { message: 'Something went wrong.' });
});

// ----------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
