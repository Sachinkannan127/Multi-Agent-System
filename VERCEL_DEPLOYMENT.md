# ⚡ Deploying Frontend to Vercel

This repository is ready to deploy the frontend to [Vercel](https://vercel.com).

---

## 🚀 Step-by-Step Vercel Deployment

### 1. Import Repository
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Import your **`Sachinkannan127/Multi-Agent-System`** GitHub repository.

### 2. Configure Project Settings
In the **Configure Project** screen:

| Setting | Value |
|---|---|
| **Project Name** | `multi-agent-system` (or any name you choose) |
| **Framework Preset** | `Other` |
| **Root Directory** | Click **Edit** and select **`frontend`** *(⚠️ Highly Recommended)* |
| **Build Command** | Leave empty (or `npm run build`) |
| **Output Directory** | Leave empty |

### 3. Click Deploy
Click **Deploy**. Vercel will deploy the frontend in under 30 seconds and give you a live URL (e.g. `https://multi-agent-system.vercel.app`).

---

## 🔗 Connecting Frontend to Your Render Backend

Once your backend is live on Render (e.g. `https://multi-agent-backend.onrender.com`):

### Option A: Edit `frontend/config.js` (Permanent)
In [`frontend/config.js`](./frontend/config.js):
```javascript
window.__API_BASE__ = 'https://your-backend.onrender.com';
```
Commit and push to GitHub, and Vercel will automatically redeploy.

### Option B: Set via Browser Console (Instant / No Code Change)
Open your deployed Vercel site in your browser, press `F12` to open the Console, and run:
```javascript
localStorage.setItem('ma_api_base', 'https://your-backend.onrender.com');
location.reload();
```
The frontend will immediately point to your Render backend!

---

## 📋 Deployed Pages Routing
- **Landing Page**: `https://your-site.vercel.app/`
- **AI Chat App**: `https://your-site.vercel.app/app` (or `/app.html`)
- **API Docs**: `https://your-site.vercel.app/docs` (or `/docs.html`)
