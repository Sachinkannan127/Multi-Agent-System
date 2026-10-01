/**
 * Frontend Configuration
 * Set your deployed Render backend URL here:
 * Example: window.__API_BASE__ = 'https://multi-agent-backend.onrender.com';
 */
window.__API_BASE__ = window.__API_BASE__
    || localStorage.getItem('ma_api_base')
    || (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname) ? 'http://127.0.0.1:8990' : '');

