# Relief Operations Platform

This project is split into:

- frontend at the repo root: React + Vite, intended for Vercel
- backend in `backend/`: Node + Express + MongoDB, intended for Render

## Local setup

Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Backend `backend/.env`

```env
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173
MONGODB_URI=your_mongodb_uri
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

Run locally:

```bash
npm install
cd backend && npm install
npm run dev
cd backend && npm run dev
```

## Deploy backend on Render

Use the included `render.yaml` or create a new Web Service manually.

Settings:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Set these environment variables in Render:

- `PORT=10000`
- `FRONTEND_ORIGIN=https://your-frontend-domain.vercel.app`
- `MONGODB_URI=...`
- `GEMINI_API_KEY=...`
- `FIREBASE_PROJECT_ID=...`
- `FIREBASE_CLIENT_EMAIL=...`
- `FIREBASE_PRIVATE_KEY=...`

After deployment, note your backend URL, for example:

`https://solutions-challenge-backend.onrender.com`

## Deploy frontend on Vercel

Import the root project directory into Vercel.

Framework preset:

- `Vite`

Build settings:

- Build Command: `npm run build`
- Output Directory: `dist`

Set these environment variables in Vercel:

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com`
- `VITE_FIREBASE_API_KEY=...`
- `VITE_FIREBASE_AUTH_DOMAIN=...`
- `VITE_FIREBASE_PROJECT_ID=...`
- `VITE_FIREBASE_STORAGE_BUCKET=...`
- `VITE_FIREBASE_MESSAGING_SENDER_ID=...`
- `VITE_FIREBASE_APP_ID=...`

The included `vercel.json` only handles client-side route rewrites for the Vite app. The frontend should call the Render backend through `VITE_API_BASE_URL`.

## Deployment order

1. Deploy backend to Render
2. Copy the Render backend URL
3. Add that URL as `VITE_API_BASE_URL` in Vercel
4. Deploy frontend to Vercel
5. Update `FRONTEND_ORIGIN` in Render to the final Vercel domain

## Post-deploy checks

- Open `https://your-render-backend.onrender.com/api/health`
- Open the Vercel site and verify dashboard data loads
- Test login and protected actions
- Test API flows that require Firebase authentication
