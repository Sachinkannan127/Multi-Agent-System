# 🚀 Deploying Backend to Render

This repository is pre-configured for seamless deployment to [Render](https://render.com).

---

## ⚡ Option A: Blueprint Deployment (Fastest & Recommended)

Render will automatically read the [`render.yaml`](./render.yaml) file in this repository.

1. Push your repository to **GitHub** or **GitLab**.
2. Go to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your repository.
5. Render will detect `render.yaml` and configure the service automatically.
6. Enter your secret environment variables when prompted:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `MISTRAL_API_KEY`
   - `SGAI_API_KEY`
   - `TAVILY_API_KEY`
   - `MONGODB_URI`
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
7. Click **Apply**. Render will build and deploy your backend!

---

## 🛠️ Option B: Manual Web Service Deployment

If you prefer to configure the Web Service manually:

1. In [Render Dashboard](https://dashboard.render.com), click **New +** > **Web Service**.
2. Connect your Git repository.
3. Fill in the following settings:

| Setting | Value |
|---|---|
| **Name** | `multi-agent-backend` (or any name you prefer) |
| **Language / Runtime** | `Python 3` |
| **Branch** | `main` |
| **Root Directory** | `backend` *(⚠️ Critical! Since code is in `backend/`)* |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | `Free` |

4. Expand **Advanced** and set:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`

5. Add the following **Environment Variables**:

| Variable | Description / Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | `multiagent_db` |
| `MONGODB_COLLECTION_NAME` | `vector_chunks` |
| `VECTOR_INDEX_NAME` | `vector_index` |
| `GEMINI_API_KEY` | Your Google Gemini API Key |
| `GROQ_API_KEY` | Your Groq API Key |
| `MISTRAL_API_KEY` | Your Mistral API Key |
| `TAVILY_API_KEY` | Your Tavily Search API Key |
| `SGAI_API_KEY` | Your ScrapeGraphAI API Key |
| `CLERK_PUBLISHABLE_KEY` | Your Clerk Publishable Key (`pk_...`) |
| `CLERK_SECRET_KEY` | Your Clerk Secret Key (`sk_...`) |

6. Click **Create Web Service**.

---

## 🔒 Crucial Pre-Deployment Checks

### 1. MongoDB Atlas Network Access
Make sure your MongoDB Atlas cluster allows connections from Render:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Go to **Network Access** under Security.
3. Click **Add IP Address** -> Select **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Click **Confirm**.

### 2. Connect Your Frontend to the Deployed Backend
Once Render deploys, you will receive your public backend URL (e.g. `https://multi-agent-backend.onrender.com`).

To point your frontend to this Render backend:
- Create or update `frontend/.env`:
  ```env
  VITE_API_BASE=https://multi-agent-backend.onrender.com
  ```
- Or run in browser developer console for immediate live testing:
  ```js
  localStorage.setItem('ma_api_base', 'https://multi-agent-backend.onrender.com');
  ```
