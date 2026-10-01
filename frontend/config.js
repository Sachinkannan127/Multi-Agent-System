/**
 * Frontend Configuration
 * Permanent Deployed Render Backend URL
 */
window.__PERMANENT_BACKEND_URL__ = 'https://multi-agent-system-nn5b.onrender.com';
window.__API_BASE__ = window.__API_BASE__
    || localStorage.getItem('ma_api_base')
    || window.__PERMANENT_BACKEND_URL__;
