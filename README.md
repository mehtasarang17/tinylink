# TinyLink – URL Shortener (Take-Home Assignment)

TinyLink is a minimal URL shortener inspired by bit.ly.  
Users can create short links, view click statistics, and manage (delete) links.

This project is built as a take-home assignment for Aganitha.

---

## Live Demo & Repos

- **Live App:** https://<YOUR-RENDER-APP>.onrender.com
- **GitHub Repo:** https://github.com/<your-username>/tinylink
- **Demo Video:** <link to Loom / YouTube / Drive>
- **ChatGPT Transcript:** <link to this conversation>

---

## Tech Stack

- **Backend:** Node.js, Express
- **View Layer:** EJS templates
- **Styling:** Tailwind CSS (via CDN)
- **Database:** Postgres (Neon)
- **Hosting:** Render (Node Web Service) + Neon Postgres

---

## Features

### Core Features

- Shorten a long URL into a code like `/abc123`
- Optional **custom code** (6–8 alphanumeric characters)
- HTTP 302 redirect from `/{code}` → original URL
- Each redirect:
  - Increments `total_clicks`
  - Updates `last_clicked_at`
- Soft delete:
  - Deleted links no longer redirect (return 404)
  - Links are hidden from the dashboard

### UI

- Dashboard with:
  - Table of all links:
    - Short code
    - Target URL (truncated with ellipsis)
    - Total clicks
    - Last clicked time
  - Actions:
    - Create (with optional custom code)
    - Copy short URL
    - Delete
- Stats page per code:
  - Short URL
  - Full URL
  - Total clicks
  - Last clicked time
  - Created time
- Healthcheck page (`/healthz`) returning JSON with uptime and version.

---

## Data Model

Single table: `links`

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
