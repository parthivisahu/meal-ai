# Deployment (Free + No Secrets)

This project can be deployed for free using Render + a free MySQL host.

## 1) Database (MySQL)

Recommended: Aiven free MySQL.

Create a MySQL instance and collect:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Keep these private. Do not commit them.

## 2) Backend (Render Web Service)

Service settings:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Environment variables:

```
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
OPENAI_API_KEY=
GROQ_API_KEY=
HUGGINGFACE_API_KEY=
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
CORS_ORIGINS=https://YOUR-FRONTEND-URL.onrender.com
```

Note: `CORS_ORIGINS` can contain multiple comma-separated origins.

## 3) Frontend (Render Static Site)

Site settings:

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Environment variable:

```
VITE_API_URL=https://YOUR-BACKEND-URL.onrender.com/api
```

## 4) Health Check

After deployment, confirm:

- Backend: `GET /api/health`
- Frontend loads and can login

## 5) Notes

- Render free tier sleeps after 15 minutes of inactivity.
- Puppeteer automation is best run locally; on Render it may not have full browser support.
