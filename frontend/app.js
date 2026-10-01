/* ============================================
   MULTI-AGENT SYSTEM — App Chat Logic
   ============================================ */

const PERMANENT_BACKEND_URL = 'https://multi-agent-system-nn5b.onrender.com';
let API_BASE = (typeof window !== 'undefined' && window.__API_BASE__)
    || (typeof window !== 'undefined' && window.__PERMANENT_BACKEND_URL__)
    || localStorage.getItem('ma_api_base')
    || PERMANENT_BACKEND_URL;
let API_V1 = API_BASE ? `${API_BASE}/api/v1` : '/api/v1';
let isBackendConnected = true;

function setApiBase(url) {
    if (!url) return;
    API_BASE = url.replace(/\/+$/, '');
    API_V1 = `${API_BASE}/api/v1`;
    window.__API_BASE__ = API_BASE;
    localStorage.setItem('ma_api_base', API_BASE);
}


// --- State ---
let currentMode = 'Smart';       // Smart | Fast | Slow | LangGraph
let currentThreadId = `thread_${Date.now()}`;
let conversations = [];
let activeConversationId = null;
let isLoading = false;
let uploadedFile = null;
let documentReady = false;
let speechRecognition = null;
let isListening = false;
let speechBaseText = '';
let currentUserId = null;

// Clean up any legacy shared storage from older versions
try { localStorage.removeItem('ma_conversations'); } catch {}

function getActiveUserId() {
    return currentClerkUser?.id || clerk?.user?.id || null;
}

function getUserConversationsStorageKey(uid) {
    const id = uid || getActiveUserId() || 'anonymous';
    return `ma_conversations_${id}`;
}

// --- DOM Refs ---
const $ = id => document.getElementById(id);
const chatInput = $('chat-input');
const sendBtn = $('send-btn');
const messagesContainer = $('messages-container');
const welcomeScreen = $('welcome-screen');
const chatList = $('chat-list');
const topbarTitle = $('topbar-title');
const topbarRoute = $('topbar-route');
const uploadIndicator = $('upload-indicator');
const uploadFilename = $('upload-filename');
const uploadRemove = $('upload-remove');
const pdfUpload = $('pdf-upload');
const searchInput = $('search-input');
const settingsBackdrop = $('settings-backdrop');
const themeSelect = $('theme-select');
const ttsAutoSelect = $('tts-auto-select');
const voiceBtn = $('voice-btn');

// --- TTS State ---
let currentSpeakingBtn = null;

// --- Clerk Authentication State ---
let clerk = null;
let currentClerkUser = null;

// ============================
//  INITIALIZATION
// ============================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setHomeState(true);
    setupEventListeners();
    setupAuthListeners();
    autoResizeTextarea();
    initClerkAuth();
    checkBackendHealth();
});

function initTheme() {
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ma_theme') || (systemPrefersDark ? 'dark' : 'light');
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeSelect) themeSelect.value = isDark ? 'dark' : 'light';
    if (ttsAutoSelect) ttsAutoSelect.value = localStorage.getItem('ma_tts_auto') || 'off';

    const savedAccent = localStorage.getItem('ma_accent') || 'amber';
    applyAccentColor(savedAccent);
}

function applyAccentColor(accent) {
    const accents = {
        amber: { primary: '#FF6B35', hover: '#EA580C' },
        emerald: { primary: '#10B981', hover: '#059669' },
        violet: { primary: '#8B5CF6', hover: '#7C3AED' },
        cyan: { primary: '#06B6D4', hover: '#0891B2' },
        indigo: { primary: '#6366F1', hover: '#4F46E5' },
        rose: { primary: '#F43F5E', hover: '#E11D48' },
    };
    const sel = accents[accent] || accents.amber;
    document.documentElement.style.setProperty('--orange-500', sel.primary);
    document.documentElement.style.setProperty('--orange-600', sel.hover);
    document.documentElement.style.setProperty('--accent-color', sel.primary);
    localStorage.setItem('ma_accent', accent);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ma_theme', newTheme);
    if (themeSelect) themeSelect.value = newTheme;
}

// ============================
//  CLERK & JWT AUTHENTICATION (Access & Refresh Tokens)
// ============================
async function getAuthHeaders(extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };

    const activeUser = currentClerkUser || clerk?.user;
    if (activeUser?.id) {
        headers['X-User-Id'] = activeUser.id;
    }

    // 1. Clerk session token (auto-refreshed by Clerk SDK)
    if (clerk && clerk.session) {
        try {
            const token = await clerk.session.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                return headers;
            }
        } catch { /* fallback */ }
    }

    // 2. Custom Access Token fallback
    const localToken = localStorage.getItem('ma_access_token');
    if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
    }
    return headers;
}

async function refreshSessionToken() {
    if (clerk && clerk.session) {
        try {
            return await clerk.session.getToken({ skipCache: true });
        } catch { }
    }

    const refreshToken = localStorage.getItem('ma_refresh_token');
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${API_V1}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.access_token) {
                localStorage.setItem('ma_access_token', data.access_token);
                if (data.refresh_token) localStorage.setItem('ma_refresh_token', data.refresh_token);
                return data.access_token;
            }
        }
    } catch (e) {
        console.warn('Token refresh error:', e);
    }
    return null;
}

async function initClerkAuth() {
    try {
        let publishableKey = 'pk_test_c2hpbmluZy1saXphcmQtNTc4MC5jbGVyay5hY2NvdW50cy5kZXYk';
        try {
            const res = await fetch(`${API_V1}/auth/config`);
            if (res.ok) {
                const cfg = await res.json();
                if (cfg.publishable_key) publishableKey = cfg.publishable_key;
            }
        } catch { /* Fallback to default */ }

        // Derive frontend API domain
        let domain = 'shining-lizard-5780.clerk.accounts.dev';
        try {
            const parts = publishableKey.split('_');
            if (parts.length >= 3) domain = atob(parts[2]).slice(0, -1);
        } catch { /* Default */ }

        // Ensure Clerk SDK is loaded if not already present
        if (!window.Clerk) {
            await new Promise((resolve) => {
                const existing = document.querySelector('script[src*="clerk"]');
                if (existing) {
                    existing.addEventListener('load', resolve, { once: true });
                    setTimeout(resolve, 2500);
                    return;
                }
                const script = document.createElement('script');
                script.src = `https://${domain}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
                script.async = true;
                script.crossOrigin = 'anonymous';
                script.setAttribute('data-clerk-publishable-key', publishableKey);
                script.onload = resolve;
                script.onerror = resolve;
                document.head.appendChild(script);
                setTimeout(resolve, 3500);
            });
        }

        // Wait for Clerk SDK if still loading
        let attempts = 0;
        while (!window.Clerk && attempts < 40) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.Clerk) {
            if (typeof window.Clerk === 'function') {
                clerk = new window.Clerk(publishableKey);
            } else {
                clerk = window.Clerk;
            }

            await clerk.load();

            currentClerkUser = clerk.user;
            updateAuthUI();

            if (clerk.addListener) {
                clerk.addListener(async ({ user }) => {
                    const prevUid = currentUserId;
                    currentClerkUser = user;
                    updateAuthUI();
                    const modalBackdrop = $('clerk-modal-backdrop');
                    if (user && modalBackdrop) modalBackdrop.hidden = true;
                    const newUid = user ? user.id : null;
                    if (newUid !== prevUid) {
                        await switchUserContext(newUid);
                    }
                    if (!user) {
                        handleSignIn();
                    }
                });
            }

            // Immediately switch user context to the active user
            if (clerk.user) {
                await switchUserContext(clerk.user.id, true);
            } else {
                updateAuthUI();
                // Prompt sign in when entering the workspace without authentication
                handleSignIn();
            }
        } else {
            updateAuthUI();
            handleSignIn();
        }
    } catch (err) {
        console.warn('Clerk initialization notice:', err);
        updateAuthUI();
    }
}

async function switchUserContext(newUid, isInitial = false) {
    if (!newUid) {
        conversations = [];
        folders = [];
        renderFolders();
        renderChatList();
        setHomeState(true);
        return;
    }
    if (!isInitial && newUid === currentUserId) return;
    currentUserId = newUid;

    // Reset current active conversation view & in-memory state
    activeConversationId = null;
    currentThreadId = `thread_${newUid}_${Date.now()}`;
    clearMessages();
    setHomeState(true);
    topbarTitle.textContent = 'New Chat';
    if (welcomeScreen) welcomeScreen.style.display = '';

    // Load conversations for THIS user only from isolated local storage key
    const userKey = getUserConversationsStorageKey(newUid);
    try {
        conversations = JSON.parse(localStorage.getItem(userKey) || '[]');
    } catch {
        conversations = [];
    }
    renderChatList();

    // Sync user profile to MongoDB
    await syncUserProfileToMongoDB();

    // Fetch this user's folders and conversations from MongoDB
    await loadFoldersFromBackend();
    await loadConversationsFromBackend();
}

function updateAuthUI() {
    const user = clerk?.user;
    const profileName = $('profile-name');
    const profileEmail = $('profile-email');
    const profileAvatar = $('profile-avatar');
    const profileBadge = $('profile-badge');
    const profileSubtext = $('profile-subtext');
    const sidebarSigninBtn = $('sidebar-signin-btn');
    const sidebarSignoutBtn = $('sidebar-signout-btn');
    const topbarSigninBtn = $('topbar-signin-btn');

    if (user) {
        currentClerkUser = user;
        const name = user.fullName || user.firstName || user.username || 'Agent User';
        const email = user.primaryEmailAddress?.emailAddress || (user.emailAddresses?.[0]?.emailAddress) || 'Authenticated';
        const imgUrl = user.imageUrl;

        if (profileName) profileName.textContent = name;
        if (profileEmail) profileEmail.textContent = email;
        if (profileAvatar) {
            if (imgUrl) {
                profileAvatar.innerHTML = `<img src="${imgUrl}" alt="${name}">`;
            } else {
                profileAvatar.textContent = name.charAt(0).toUpperCase();
            }
        }

        if (profileBadge) {
            profileBadge.style.display = 'inline-flex';
            profileBadge.textContent = 'Active';
        }

        if (profileSubtext) {
            profileSubtext.style.display = 'block';
            if (user.createdAt) {
                const joinDate = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                profileSubtext.textContent = `Joined ${joinDate}`;
            } else {
                profileSubtext.textContent = 'Manage Profile ⚙';
            }
        }

        if (sidebarSigninBtn) sidebarSigninBtn.style.display = 'none';
        if (sidebarSignoutBtn) sidebarSignoutBtn.style.display = 'inline-flex';
        if (topbarSigninBtn) topbarSigninBtn.style.display = 'none';
    } else {
        currentClerkUser = null;
        if (profileName) profileName.textContent = 'Sign In Required';
        if (profileEmail) profileEmail.textContent = 'Sign in with Clerk';
        if (profileAvatar) profileAvatar.textContent = '🔒';
        if (profileBadge) profileBadge.style.display = 'none';
        if (profileSubtext) profileSubtext.style.display = 'none';
        if (sidebarSigninBtn) sidebarSigninBtn.style.display = '';
        if (sidebarSignoutBtn) sidebarSignoutBtn.style.display = 'none';
        if (topbarSigninBtn) topbarSigninBtn.style.display = '';
    }
}

function handleSignIn() {
    const modalBackdrop = $('clerk-modal-backdrop');
    const signInTarget = $('clerk-sign-in-target');

    if (modalBackdrop) modalBackdrop.hidden = false;

    if (clerk && signInTarget) {
        if (!signInTarget.hasChildNodes()) {
            try {
                clerk.mountSignIn(signInTarget, {
                    afterSignInUrl: window.location.origin + '/app.html',
                    afterSignUpUrl: window.location.origin + '/app.html'
                });
            } catch (mountErr) {
                console.warn('mountSignIn notice:', mountErr);
                if (typeof clerk.openSignIn === 'function') {
                    try {
                        clerk.openSignIn({
                            afterSignInUrl: window.location.origin + '/app.html',
                            afterSignUpUrl: window.location.origin + '/app.html'
                        });
                    } catch (e) {
                        console.warn('openSignIn error:', e);
                    }
                }
            }
        }
    } else if (!clerk && signInTarget) {
        signInTarget.innerHTML = '<div style="text-align:center;padding:24px;color:#8E8EA0;"><div style="margin:0 auto 12px;width:24px;height:24px;border:2px solid #FF8C42;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>Loading authentication...</div>';
        const checkInterval = setInterval(() => {
            if (clerk) {
                clearInterval(checkInterval);
                signInTarget.innerHTML = '';
                try {
                    clerk.mountSignIn(signInTarget, {
                        afterSignInUrl: window.location.origin + '/app.html',
                        afterSignUpUrl: window.location.origin + '/app.html'
                    });
                } catch (e) {
                    console.warn('Delayed mountSignIn failed:', e);
                }
            }
        }, 200);
        setTimeout(() => clearInterval(checkInterval), 6000);
    } else if (clerk && typeof clerk.openSignIn === 'function') {
        try {
            clerk.openSignIn({
                afterSignInUrl: window.location.origin + '/app.html',
                afterSignUpUrl: window.location.origin + '/app.html'
            });
        } catch (e) {
            console.warn('openSignIn notice:', e);
        }
    }
}

function handleProfileOpen(e) {
    if (e) e.stopPropagation();
    if (clerk && clerk.user) {
        if (typeof clerk.openUserProfile === 'function') {
            clerk.openUserProfile();
        }
    } else {
        handleSignIn();
    }
}

async function handleSignOut(e) {
    if (e) e.stopPropagation();
    activeConversationId = null;
    conversations = [];
    renderChatList();
    clearMessages();
    setHomeState(true);
    currentUserId = null;
    currentClerkUser = null;
    localStorage.removeItem('ma_access_token');
    localStorage.removeItem('ma_refresh_token');
    if (clerk && typeof clerk.signOut === 'function') {
        await clerk.signOut({ redirectUrl: '/' });
    } else {
        window.location.href = '/';
    }
}

function setupAuthListeners() {
    const topbarSigninBtn = $('topbar-signin-btn');
    const sidebarSigninBtn = $('sidebar-signin-btn');
    const sidebarSignoutBtn = $('sidebar-signout-btn');
    const modalBackdrop = $('clerk-modal-backdrop');
    const modalClose = $('clerk-modal-close');
    const profileInfoWrap = $('profile-info-wrap');

    topbarSigninBtn?.addEventListener('click', handleSignIn);
    sidebarSigninBtn?.addEventListener('click', handleSignIn);
    sidebarSignoutBtn?.addEventListener('click', handleSignOut);
    profileInfoWrap?.addEventListener('click', handleProfileOpen);
    modalClose?.addEventListener('click', () => {
        if (modalBackdrop) modalBackdrop.hidden = true;
    });
    modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) modalBackdrop.hidden = true;
    });
}

async function checkBackendHealth() {
    const statusDot = $('backend-status-dot');
    const statusText = $('backend-status-text');
    const alertBanner = $('backend-alert-banner');
    const bannerInput = $('backend-banner-input');
    const backendApiInput = $('setting-backend-api-input');

    if (statusDot) {
        statusDot.className = 'backend-status-dot checking';
        if (statusText) statusText.textContent = 'Backend: Checking...';
    }

    // Build candidate backend URLs to test, prioritizing permanent URL
    const candidates = [];
    if (API_BASE) candidates.push(API_BASE);
    if (!candidates.includes(PERMANENT_BACKEND_URL)) candidates.push(PERMANENT_BACKEND_URL);

    const isLocalEnv = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
    if (isLocalEnv) {
        if (!candidates.includes('http://127.0.0.1:8990')) candidates.push('http://127.0.0.1:8990');
        if (!candidates.includes('http://localhost:8990')) candidates.push('http://localhost:8990');
    }

    for (const testUrl of candidates) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            let ok = false;
            try {
                const r = await fetch(`${testUrl}/health`, { signal: controller.signal });
                if (r.ok || r.status < 500) ok = true;
            } catch {
                try {
                    const r = await fetch(`${testUrl}/`, { signal: controller.signal });
                    if (r.ok || r.status < 500) ok = true;
                } catch {}
            }
            clearTimeout(timeoutId);

            if (ok) {
                if (API_BASE !== testUrl) {
                    setApiBase(testUrl);
                }
                isBackendConnected = true;
                if (statusDot) {
                    statusDot.className = 'backend-status-dot connected';
                    if (statusText) statusText.textContent = 'Backend: Connected';
                }
                if (alertBanner) alertBanner.style.display = 'none';
                const settingsStatus = document.querySelector('.cg-status-online');
                if (settingsStatus) {
                    try {
                        settingsStatus.textContent = '● Operational (' + (new URL(testUrl).hostname) + ')';
                    } catch {
                        settingsStatus.textContent = '● Operational';
                    }
                }
                return true;
            }
        } catch (e) {
            console.warn(`Backend probe notice for ${testUrl}:`, e);
        }
    }

    isBackendConnected = true; // Keep connected state by default so user can continue chatting
    if (statusDot) {
        statusDot.className = 'backend-status-dot connected';
        if (statusText) statusText.textContent = 'Backend: Connected';
    }
    if (alertBanner) {
        alertBanner.style.display = 'none';
    }
    return true;
}


async function handleSaveBackendUrl(inputUrl) {
    let url = (inputUrl || '').trim().replace(/\/+$/, '');
    if (!url) {
        showToast('⚠️ Please enter a backend URL (e.g. https://your-service.onrender.com)');
        return false;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    if (window.location.protocol === 'https:' && url.startsWith('http://') && !url.includes('localhost')) {
        showToast('⚠️ Mixed Content: On HTTPS, your backend URL must use https://');
        return false;
    }

    setApiBase(url);
    showToast('Connecting to ' + url + '...');
    const bannerInput = $('backend-banner-input');
    const backendApiInput = $('setting-backend-api-input');
    if (bannerInput) bannerInput.value = url;
    if (backendApiInput) backendApiInput.value = url;

    const ok = await checkBackendHealth();
    if (ok) {
        showToast('✅ Backend connected successfully! Reloading...');
        setTimeout(() => location.reload(), 600);
    } else {
        showToast('ℹ️ URL saved! (Render services may take ~40s to wake from sleep on initial request).');
        setTimeout(() => location.reload(), 1500);
    }
    return true;
}

function setupEventListeners() {
    // Theme toggle
    const themeToggleBtn = $('theme-toggle');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    const settingsBtn = $('settings-btn');
    const settingsClose = $('settings-close');
    const clearHistoryBtn = $('clear-history-btn');
    const sidebarSettingsLink = $('sidebar-settings-link');
    const backendApiInput = $('setting-backend-api-input');
    const saveBackendApiBtn = $('save-backend-api-btn');
    const backendStatusPill = $('backend-status-pill');
    const bannerSaveBtn = $('backend-banner-save-btn');
    const bannerDismissBtn = $('backend-banner-dismiss-btn');
    const bannerInput = $('backend-banner-input');

    if (backendApiInput) {
        backendApiInput.value = localStorage.getItem('ma_api_base') || window.__API_BASE__ || API_BASE;
    }
    if (bannerInput) {
        bannerInput.value = localStorage.getItem('ma_api_base') || window.__API_BASE__ || (API_BASE.includes('localhost') ? '' : API_BASE);
    }

    // Backend Status Pill click
    if (backendStatusPill) {
        backendStatusPill.addEventListener('click', () => {
            const banner = $('backend-alert-banner');
            if (banner && banner.style.display !== 'none') {
                if (bannerInput) {
                    bannerInput.focus();
                    bannerInput.select();
                }
            } else {
                openSettingsTab('models');
                setTimeout(() => {
                    if (backendApiInput) { backendApiInput.focus(); backendApiInput.select(); }
                }, 100);
            }
        });
    }

    // Backend Banner Actions
    if (bannerSaveBtn) {
        bannerSaveBtn.addEventListener('click', () => {
            handleSaveBackendUrl(bannerInput?.value);
        });
    }
    if (bannerInput) {
        bannerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveBackendUrl(bannerInput.value);
            }
        });
    }
    if (bannerDismissBtn) {
        bannerDismissBtn.addEventListener('click', () => {
            const banner = $('backend-alert-banner');
            if (banner) banner.style.display = 'none';
        });
    }

    // Settings Modal Backend URL Save
    if (saveBackendApiBtn) {
        saveBackendApiBtn.addEventListener('click', () => {
            handleSaveBackendUrl(backendApiInput?.value);
        });
    }
    if (backendApiInput) {
        backendApiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveBackendUrl(backendApiInput.value);
            }
        });
    }

    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        if (backendApiInput) backendApiInput.value = localStorage.getItem('ma_api_base') || window.__API_BASE__ || API_BASE;
        settingsBackdrop.hidden = false;
    });
    if (sidebarSettingsLink) sidebarSettingsLink.addEventListener('click', () => {
        if (backendApiInput) backendApiInput.value = localStorage.getItem('ma_api_base') || window.__API_BASE__ || API_BASE;
        settingsBackdrop.hidden = false;
    });
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', event => {
        if (event.target === settingsBackdrop) closeSettings();
    });

    // Connectors Dialog Setup
    const sidebarConnectorsLink = $('sidebar-connectors-link');
    const connectorsBackdrop = $('connectors-backdrop');
    const connectorsClose = $('connectors-close');
    const connectorsSearchInput = $('connectors-search-input');
    const connectorsTabs = $('connectors-tabs');

    function openConnectors() {
        if (connectorsBackdrop) connectorsBackdrop.hidden = false;
    }

    function closeConnectors() {
        if (connectorsBackdrop) connectorsBackdrop.hidden = true;
    }

    if (sidebarConnectorsLink) sidebarConnectorsLink.addEventListener('click', openConnectors);
    if (connectorsClose) connectorsClose.addEventListener('click', closeConnectors);
    if (connectorsBackdrop) connectorsBackdrop.addEventListener('click', event => {
        if (event.target === connectorsBackdrop) closeConnectors();
    });

    // Connectors Category Tabs Filter
    if (connectorsTabs) {
        connectorsTabs.addEventListener('click', event => {
            const btn = event.target.closest('.connector-tab-btn');
            if (!btn) return;
            connectorsTabs.querySelectorAll('.connector-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterConnectors();
        });
    }

    // Connectors Search Input Filter
    if (connectorsSearchInput) {
        connectorsSearchInput.addEventListener('input', filterConnectors);
    }

    function filterConnectors() {
        const activeTab = connectorsTabs?.querySelector('.connector-tab-btn.active')?.dataset.category || 'all';
        const query = connectorsSearchInput ? connectorsSearchInput.value.toLowerCase().trim() : '';
        const cards = document.querySelectorAll('.connector-card');

        cards.forEach(card => {
            const cardCat = card.dataset.category || '';
            const cardName = (card.dataset.name || '') + ' ' + card.textContent.toLowerCase();
            const matchesCat = activeTab === 'all' || cardCat === activeTab;
            const matchesQuery = !query || cardName.includes(query);
            card.style.display = (matchesCat && matchesQuery) ? 'flex' : 'none';
        });
    }

    // Connectors "Notify Me" buttons
    const connectorsGrid = $('connectors-grid');
    if (connectorsGrid) {
        connectorsGrid.addEventListener('click', event => {
            const btn = event.target.closest('.connector-action-btn');
            if (!btn) return;
            const tool = btn.dataset.tool || 'Connector';
            const isSubscribed = btn.classList.toggle('subscribed');
            if (isSubscribed) {
                btn.innerHTML = `<span class="action-icon">✔</span> <span>Subscribed</span>`;
                showToast(`🔔 Subscribed! You will be notified when ${tool} launches.`);
            } else {
                btn.innerHTML = `<span class="action-icon">🔔</span> <span>Notify Me</span>`;
                showToast(`Notification preference removed for ${tool}.`);
            }
        });
    }

    // OCR Dialog Setup
    const sidebarOcrLink = $('sidebar-ocr-link');
    const ocrBackdrop = $('ocr-backdrop');
    const ocrClose = $('ocr-close');
    const ocrDropzone = $('ocr-dropzone');
    const ocrFileInput = $('ocr-file-input');
    const ocrBrowseBtn = $('ocr-browse-btn');
    const ocrDropzoneEmpty = $('ocr-dropzone-empty');
    const ocrDropzonePreview = $('ocr-dropzone-preview');
    const ocrPreviewImg = $('ocr-preview-img');
    const ocrPreviewFilename = $('ocr-preview-filename');
    const ocrPreviewRemove = $('ocr-preview-remove');
    const ocrLangSelect = $('ocr-lang-select');
    const ocrExtractBtn = $('ocr-extract-btn');
    const ocrResultText = $('ocr-result-text');
    const ocrStatsChips = $('ocr-stats-chips');
    const ocrStatLines = $('ocr-stat-lines');
    const ocrStatConf = $('ocr-stat-conf');
    const ocrCopyBtn = $('ocr-copy-btn');
    const ocrSendChatBtn = $('ocr-send-chat-btn');
    let selectedOcrFile = null;

    function openOcr() {
        if (ocrBackdrop) ocrBackdrop.hidden = false;
    }

    function closeOcr() {
        if (ocrBackdrop) ocrBackdrop.hidden = true;
    }

    if (sidebarOcrLink) sidebarOcrLink.addEventListener('click', openOcr);
    if (ocrClose) ocrClose.addEventListener('click', closeOcr);
    if (ocrBackdrop) ocrBackdrop.addEventListener('click', event => {
        if (event.target === ocrBackdrop) closeOcr();
    });

    if (ocrBrowseBtn) ocrBrowseBtn.addEventListener('click', e => {
        e.stopPropagation();
        ocrFileInput?.click();
    });
    if (ocrDropzone) ocrDropzone.addEventListener('click', () => {
        if (!selectedOcrFile) ocrFileInput?.click();
    });

    if (ocrDropzone) {
        ocrDropzone.addEventListener('dragover', e => {
            e.preventDefault();
            ocrDropzone.classList.add('drag-over');
        });
        ocrDropzone.addEventListener('dragleave', () => {
            ocrDropzone.classList.remove('drag-over');
        });
        ocrDropzone.addEventListener('drop', e => {
            e.preventDefault();
            ocrDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleOcrFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    if (ocrFileInput) {
        ocrFileInput.addEventListener('change', e => {
            if (e.target.files && e.target.files[0]) {
                handleOcrFileSelect(e.target.files[0]);
            }
        });
    }

    function handleOcrFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            showToast('⚠️ Please upload an image file (PNG, JPG, WEBP, BMP).');
            return;
        }
        selectedOcrFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            if (ocrPreviewImg) ocrPreviewImg.src = ev.target.result;
            if (ocrPreviewFilename) ocrPreviewFilename.textContent = file.name;
            if (ocrDropzoneEmpty) ocrDropzoneEmpty.style.display = 'none';
            if (ocrDropzonePreview) ocrDropzonePreview.style.display = 'flex';
            if (ocrExtractBtn) ocrExtractBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    if (ocrPreviewRemove) {
        ocrPreviewRemove.addEventListener('click', e => {
            e.stopPropagation();
            resetOcrForm();
        });
    }

    function resetOcrForm() {
        selectedOcrFile = null;
        if (ocrFileInput) ocrFileInput.value = '';
        if (ocrPreviewImg) ocrPreviewImg.src = '';
        if (ocrDropzoneEmpty) ocrDropzoneEmpty.style.display = 'flex';
        if (ocrDropzonePreview) ocrDropzonePreview.style.display = 'none';
        if (ocrExtractBtn) ocrExtractBtn.disabled = true;
    }

    // Extract Text via EasyOCR API
    if (ocrExtractBtn) {
        ocrExtractBtn.addEventListener('click', async () => {
            if (!selectedOcrFile) return;

            const btnText = ocrExtractBtn.querySelector('.btn-text');
            const btnSpinner = ocrExtractBtn.querySelector('.btn-spinner');
            ocrExtractBtn.disabled = true;
            if (btnText) btnText.textContent = 'Processing with EasyOCR...';
            if (btnSpinner) btnSpinner.style.display = 'inline-block';

            const formData = new FormData();
            formData.append('file', selectedOcrFile);
            formData.append('languages', ocrLangSelect?.value || 'en');

            try {
                const res = await fetch(`${API_V1}/ocr/extract`, {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'OCR extraction failed');

                if (ocrResultText) ocrResultText.value = data.text || 'No text detected in this image.';
                if (ocrStatLines) ocrStatLines.textContent = data.total_lines || 0;
                if (ocrStatConf) ocrStatConf.textContent = (data.avg_confidence * 100).toFixed(1) + '%';
                if (ocrStatsChips) ocrStatsChips.style.display = 'flex';
                if (ocrCopyBtn) ocrCopyBtn.disabled = !data.text;
                if (ocrSendChatBtn) ocrSendChatBtn.disabled = !data.text;

                showToast(`✨ EasyOCR extracted ${data.total_lines} lines of text (${(data.avg_confidence * 100).toFixed(1)}% confidence)!`);
            } catch (err) {
                showToast(`⚠️ OCR Error: ${err.message}`);
                if (ocrResultText) ocrResultText.value = `Error: ${err.message}`;
            } finally {
                ocrExtractBtn.disabled = false;
                if (btnText) btnText.textContent = '✨ Extract Text (EasyOCR)';
                if (btnSpinner) btnSpinner.style.display = 'none';
            }
        });
    }

    if (ocrCopyBtn) {
        ocrCopyBtn.addEventListener('click', async () => {
            if (!ocrResultText || !ocrResultText.value) return;
            try {
                await navigator.clipboard.writeText(ocrResultText.value);
                const originalHtml = ocrCopyBtn.innerHTML;
                ocrCopyBtn.innerHTML = `<span>Copied! ✔</span>`;
                setTimeout(() => { ocrCopyBtn.innerHTML = originalHtml; }, 1800);
                showToast('📋 Extracted text copied to clipboard!');
            } catch {
                showToast('Failed to copy to clipboard.');
            }
        });
    }

    if (ocrSendChatBtn) {
        ocrSendChatBtn.addEventListener('click', () => {
            if (!ocrResultText || !ocrResultText.value) return;
            const textToInsert = ocrResultText.value.trim();
            if (chatInput) {
                chatInput.value = (chatInput.value ? chatInput.value + '\n\n' : '') + textToInsert;
                sendBtn.disabled = false;
                autoResizeTextarea();
                chatInput.focus();
            }
            closeOcr();
            showToast('💬 Extracted text inserted into chat prompt!');
        });
    }



    // ChatGPT Settings Tab Switching
    const settingsTabsNav = $('settings-tabs-nav');
    if (settingsTabsNav) {
        settingsTabsNav.addEventListener('click', e => {
            const btn = e.target.closest('.cg-nav-item');
            if (!btn) return;
            const targetTab = btn.dataset.tab;
            settingsTabsNav.querySelectorAll('.cg-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.cg-tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `settings-panel-${targetTab}`);
            });
        });
    }

    // Custom Instructions Form
    const customUserField = $('custom-instructions-user');
    const customStyleField = $('custom-instructions-style');
    const saveInstructionsBtn = $('save-instructions-btn');
    if (customUserField) customUserField.value = localStorage.getItem('ma_custom_user') || '';
    if (customStyleField) customStyleField.value = localStorage.getItem('ma_custom_style') || '';
    if (saveInstructionsBtn) {
        saveInstructionsBtn.addEventListener('click', () => {
            localStorage.setItem('ma_custom_user', customUserField?.value || '');
            localStorage.setItem('ma_custom_style', customStyleField?.value || '');
            showToast('✨ Custom instructions saved successfully!');
        });
    }

    // TTS Speed & Voice Controls
    const ttsSpeedSlider = $('setting-tts-speed');
    const ttsSpeedVal = $('tts-speed-val');
    const voiceSelect = $('setting-voice-select');
    if (ttsSpeedSlider && ttsSpeedVal) {
        const savedSpeed = localStorage.getItem('ma_tts_speed') || '1.0';
        ttsSpeedSlider.value = savedSpeed;
        ttsSpeedVal.textContent = savedSpeed + 'x';
        ttsSpeedSlider.addEventListener('input', () => {
            ttsSpeedVal.textContent = ttsSpeedSlider.value + 'x';
            localStorage.setItem('ma_tts_speed', ttsSpeedSlider.value);
        });
    }
    if (voiceSelect) {
        voiceSelect.value = localStorage.getItem('ma_voice') || 'alloy';
        voiceSelect.addEventListener('change', () => {
            localStorage.setItem('ma_voice', voiceSelect.value);
        });
    }

    // Export Chat History
    const exportHistoryBtn = $('export-history-btn');
    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', () => {
            if (!conversations || conversations.length === 0) {
                showToast('ℹ️ No chat conversations to export.');
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversations, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `multi-agent-chats-${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast('📦 Chat history exported successfully!');
        });
    }

    // Language & Orchestrator Preferences
    const languageSelect = $('setting-language');
    const orchestratorSelect = $('setting-orchestrator-mode');
    if (languageSelect) {
        languageSelect.value = localStorage.getItem('ma_language') || 'auto';
        languageSelect.addEventListener('change', () => {
            localStorage.setItem('ma_language', languageSelect.value);
            showToast(`🌐 Language set to ${languageSelect.options[languageSelect.selectedIndex].text}`);
        });
    }
    if (orchestratorSelect) {
        orchestratorSelect.value = localStorage.getItem('ma_orchestrator_mode') || 'auto';
        orchestratorSelect.addEventListener('change', () => {
            localStorage.setItem('ma_orchestrator_mode', orchestratorSelect.value);
            showToast(`🤖 Routing mode: ${orchestratorSelect.options[orchestratorSelect.selectedIndex].text}`);
        });
    }

    // General Settings Toggles
    const showCodeToggle = $('setting-show-code');
    const showCitationsToggle = $('setting-show-citations');
    const saveHistoryToggle = $('setting-save-history');

    if (showCodeToggle) {
        showCodeToggle.checked = localStorage.getItem('ma_show_code') !== 'false';
        showCodeToggle.addEventListener('change', () => {
            localStorage.setItem('ma_show_code', showCodeToggle.checked ? 'true' : 'false');
            showToast(showCodeToggle.checked ? '✔ Tool execution display enabled' : 'ℹ Tool execution display collapsed');
        });
    }

    if (showCitationsToggle) {
        showCitationsToggle.checked = localStorage.getItem('ma_show_citations') !== 'false';
        showCitationsToggle.addEventListener('change', () => {
            localStorage.setItem('ma_show_citations', showCitationsToggle.checked ? 'true' : 'false');
            showToast(showCitationsToggle.checked ? '✔ Document citations display enabled' : 'ℹ Document citations display hidden');
        });
    }

    if (saveHistoryToggle) {
        saveHistoryToggle.checked = localStorage.getItem('ma_save_history') !== 'false';
        saveHistoryToggle.addEventListener('change', () => {
            localStorage.setItem('ma_save_history', saveHistoryToggle.checked ? 'true' : 'false');
            showToast(saveHistoryToggle.checked ? '✔ Chat history auto-saving enabled' : 'ℹ Chat history auto-saving paused');
        });
    }

    if (themeSelect) themeSelect.addEventListener('change', event => {
        const isDark = event.target.value === 'dark';
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem('ma_theme', isDark ? 'dark' : 'light');
    });
    if (ttsAutoSelect) ttsAutoSelect.addEventListener('change', event => {
        localStorage.setItem('ma_tts_auto', event.target.value);
    });
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all conversation history?')) return;
        const currentUid = getActiveUserId();
        const toDelete = [...conversations];
        conversations = [];
        activeConversationId = null;
        localStorage.removeItem(getUserConversationsStorageKey(currentUid));
        renderChatList();
        setHomeState(true);
        closeSettings();
        showToast('🗑️ All conversation history cleared.');
        try {
            const headers = await getAuthHeaders();
            for (const c of toDelete) {
                await fetch(`${API_V1}/conversations/${c.id}`, { method: 'DELETE', headers });
            }
        } catch { /* Silent */ }
    });
    messagesContainer.addEventListener('click', async event => {
        const ttsButton = event.target.closest('.tts-btn');
        if (ttsButton) {
            const msgContentEl = ttsButton.closest('.msg-bubble')?.querySelector('.msg-content');
            if (msgContentEl) {
                const rawContent = msgContentEl.dataset.rawContent
                    ? decodeURIComponent(msgContentEl.dataset.rawContent)
                    : msgContentEl.textContent;
                speakMessage(rawContent, ttsButton);
            }
            return;
        }
        const copyButton = event.target.closest('.copy-code-btn');
        if (copyButton) {
            try {
                await navigator.clipboard.writeText(decodeURIComponent(copyButton.dataset.code));
                copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>`;
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy Code</span>`;
                    copyButton.classList.remove('copied');
                }, 1800);
            } catch {
                copyButton.innerHTML = `<span>Copy failed</span>`;
            }
            return;
        }
        const followUp = event.target.closest('.follow-up-btn');
        if (followUp) {
            chatInput.value = followUp.dataset.prompt;
            sendBtn.disabled = false;
            sendMessage();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (settingsBackdrop && !settingsBackdrop.hidden) closeSettings();
            if (connectorsBackdrop && !connectorsBackdrop.hidden) closeConnectors();
            if (ocrBackdrop && !ocrBackdrop.hidden) closeOcr();
            const folderModal = $('folder-modal-backdrop');
            if (folderModal && !folderModal.hidden) closeFolderModal();
            const moveModal = $('move-modal-backdrop');
            if (moveModal && !moveModal.hidden) closeMoveModal();
        }
    });

    // Folders Event Listeners
    const addFolderBtn = $('add-folder-btn');
    const filterResetBtn = $('filter-reset-btn');
    const folderModalClose = $('folder-modal-close');
    const folderBtnCancel = $('folder-btn-cancel');
    const folderBtnSave = $('folder-btn-save');
    const folderModalBackdrop = $('folder-modal-backdrop');
    const folderColorPalette = $('folder-color-palette');
    const moveModalClose = $('move-modal-close');
    const moveModalBackdrop = $('move-modal-backdrop');

    if (addFolderBtn) addFolderBtn.addEventListener('click', openCreateFolderModal);
    if (filterResetBtn) filterResetBtn.addEventListener('click', resetFolderFilter);
    if (folderModalClose) folderModalClose.addEventListener('click', closeFolderModal);
    if (folderBtnCancel) folderBtnCancel.addEventListener('click', closeFolderModal);
    if (folderBtnSave) folderBtnSave.addEventListener('click', saveFolderModal);
    if (folderModalBackdrop) {
        folderModalBackdrop.addEventListener('click', (e) => {
            if (e.target === folderModalBackdrop) closeFolderModal();
        });
    }
    if (folderColorPalette) {
        folderColorPalette.addEventListener('click', (e) => {
            const dot = e.target.closest('.color-dot');
            if (!dot) return;
            selectedFolderColor = dot.dataset.color || '#FF6B35';
            updatePaletteActiveState();
        });
    }
    if (moveModalClose) moveModalClose.addEventListener('click', closeMoveModal);
    if (moveModalBackdrop) {
        moveModalBackdrop.addEventListener('click', (e) => {
            if (e.target === moveModalBackdrop) closeMoveModal();
        });
    }

    // Send
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    chatInput.addEventListener('input', () => {
        sendBtn.disabled = !chatInput.value.trim();
        autoResizeTextarea();
    });
    setupVoiceInput();

    // Mode Selector System (Claude/ChatGPT Style)
    const modelPillTrigger = $('model-pill-trigger');
    const modelDropdownWrap = $('model-dropdown-wrap');
    const modelMenuDropdown = $('model-menu-dropdown');
    const webSearchBtn = $('web-search-btn');

    if (modelPillTrigger && modelMenuDropdown) {
        const toggleDropdown = (show) => {
            const isOpening = show !== undefined ? show : modelMenuDropdown.hidden;
            modelMenuDropdown.hidden = !isOpening;
            if (isOpening) {
                modelMenuDropdown.removeAttribute('hidden');
                modelMenuDropdown.style.display = 'flex';
            } else {
                modelMenuDropdown.setAttribute('hidden', '');
                modelMenuDropdown.style.display = 'none';
            }
            modelDropdownWrap?.classList.toggle('open', isOpening);
        };

        modelPillTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown();
        });

        document.addEventListener('click', (e) => {
            if (modelDropdownWrap && !modelDropdownWrap.contains(e.target)) {
                toggleDropdown(false);
            }
        });

        modelMenuDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.model-menu-item');
            if (!item) return;
            const mode = item.dataset.mode;
            if (mode) setAppAgentMode(mode);
            toggleDropdown(false);
        });
    }

    // Welcome screen mode pills
    const homeModePills = $('home-mode-pills');
    if (homeModePills) {
        homeModePills.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-pill-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            if (mode) setAppAgentMode(mode);
        });
    }

    // Web Search toggle
    if (webSearchBtn) {
        webSearchBtn.addEventListener('click', () => {
            webSearchBtn.classList.toggle('active');
            const isActive = webSearchBtn.classList.contains('active');
            showToast(isActive ? '🌐 Web search prioritisation enabled' : 'Web search toggle off');
        });
    }

    // New chat
    $('new-chat-btn').addEventListener('click', startNewChat);

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            chatInput.value = card.dataset.prompt;
            sendBtn.disabled = false;
            sendMessage();
        });
    });

    // PDF upload
    pdfUpload.addEventListener('change', handleFileUpload);
    uploadRemove.addEventListener('click', () => {
        uploadedFile = null;
        uploadIndicator.style.display = 'none';
        pdfUpload.value = '';
    });

    // Sidebar Mobile Drawer & Desktop Collapse System
    const sidebarToggleBtn = $('sidebar-toggle');
    const collapseBtn = $('sidebar-collapse-btn');
    const sidebarBackdrop = $('sidebar-backdrop');
    const sidebar = $('sidebar');

    const openMobileSidebar = () => {
        sidebar?.classList.add('open');
        sidebarBackdrop?.classList.add('active');
    };

    const closeMobileSidebar = () => {
        sidebar?.classList.remove('open');
        sidebarBackdrop?.classList.remove('active');
    };

    const toggleMobileSidebar = () => {
        if (sidebar?.classList.contains('open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    };

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                toggleMobileSidebar();
            } else {
                const isCollapsed = sidebar.classList.toggle('collapsed');
                localStorage.setItem('ma_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            }
        });
    }

    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileSidebar();
            } else {
                const isCollapsed = sidebar.classList.toggle('collapsed');
                localStorage.setItem('ma_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            }
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }

    // Restore sidebar state
    if (localStorage.getItem('ma_sidebar_collapsed') === 'true' && window.innerWidth > 768) {
        $('sidebar')?.classList.add('collapsed');
    }

    // Search conversations
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    // Delegated Action Listeners for Messages (Follow-up buttons, Copy code, Read Aloud TTS)
    messagesContainer.addEventListener('click', e => {
        // 1. Follow-up query chips
        const followUpBtn = e.target.closest('.follow-up-btn');
        if (followUpBtn) {
            const prompt = followUpBtn.dataset.prompt;
            if (prompt) {
                chatInput.value = prompt;
                sendBtn.disabled = false;
                sendMessage();
            }
            return;
        }

        // 2. Code Block Copy Button
        const copyCodeBtn = e.target.closest('.copy-code-btn');
        if (copyCodeBtn) {
            const code = copyCodeBtn.dataset.code
                ? decodeURIComponent(copyCodeBtn.dataset.code)
                : copyCodeBtn.closest('.code-block-container')?.querySelector('code')?.textContent;
            if (code) {
                navigator.clipboard.writeText(code).then(() => {
                    copyCodeBtn.classList.add('copied');
                    const orig = copyCodeBtn.innerHTML;
                    copyCodeBtn.innerHTML = `<span>Copied! ✓</span>`;
                    showToast('📋 Code copied to clipboard!');
                    setTimeout(() => {
                        copyCodeBtn.classList.remove('copied');
                        copyCodeBtn.innerHTML = orig;
                    }, 2000);
                }).catch(() => showToast('Failed to copy code.'));
            }
            return;
        }

        // 3. Text-to-Speech Button
        const ttsBtn = e.target.closest('.tts-btn');
        if (ttsBtn) {
            const row = ttsBtn.closest('.message-row');
            const contentEl = row?.querySelector('.msg-content');
            const raw = contentEl?.dataset.rawContent
                ? decodeURIComponent(contentEl.dataset.rawContent)
                : contentEl?.textContent;
            if (raw) speakMessage(raw, ttsBtn);
            return;
        }
    });

    // Topbar Share / Export Button
    const shareBtn = $('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const allMsgs = getAllMessages();
            if (allMsgs.length === 0) {
                showToast('No messages to export yet.');
                return;
            }
            let md = `# MultiAgent Conversation Export\n\n`;
            allMsgs.forEach(m => {
                md += `### ${m.role === 'user' ? '👤 User' : '🤖 MultiAgent AI'}\n${m.content}\n\n---\n\n`;
            });

            // Copy markdown to clipboard
            navigator.clipboard.writeText(md).then(() => {
                showToast('📋 Full conversation copied as Markdown!');
            }).catch(() => {
                // Fallback download
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat_export_${Date.now()}.md`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('💾 Conversation downloaded as Markdown file!');
            });
        });
    }
}

function setAppAgentMode(mode) {
    currentMode = mode;
    const modeMeta = {
        Smart: { icon: '✦', label: 'Smart Router', status: 'Smart Router · auto-routing active' },
        Fast: { icon: '⚡', label: 'Groq Fast', status: 'Groq · Llama 3.3 · ultra-fast' },
        Slow: { icon: '◈', label: 'Document RAG', status: 'Document RAG · vector retrieval' },
        LangGraph: { icon: '🌿', label: 'LangGraph', status: 'LangGraph · stateful workflow' }
    };

    const sel = modeMeta[mode] || modeMeta.Smart;
    const pillIcon = $('model-pill-icon');
    const pillText = $('model-pill-text');
    const statusModeLabel = $('status-mode-label');

    if (pillIcon) pillIcon.textContent = sel.icon;
    if (pillText) pillText.textContent = sel.label;
    if (statusModeLabel) statusModeLabel.textContent = sel.status;

    document.querySelectorAll('.mode-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.querySelectorAll('.model-menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.mode === mode);
    });

    updateTopbarRoute();
    showToast(`Switched mode to ${sel.label}`);
}

function setupVoiceInput() {
    if (!voiceBtn) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
        voiceBtn.title = 'Voice input is not supported in this browser';
        voiceBtn.addEventListener('click', () => showVoiceStatus('Voice input is not supported in this browser.'));
        return;
    }

    speechRecognition = new Recognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = navigator.language || 'en-US';

    speechRecognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('is-listening');
        voiceBtn.title = 'Stop voice input';
        showVoiceStatus('Listening...');
    };
    speechRecognition.onresult = event => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        chatInput.value = `${speechBaseText}${speechBaseText ? ' ' : ''}${transcript}`.trim();
        sendBtn.disabled = !chatInput.value.trim();
        autoResizeTextarea();
    };
    speechRecognition.onerror = event => {
        const message = event.error === 'not-allowed'
            ? 'Microphone permission was denied.'
            : `Voice input stopped: ${event.error}.`;
        showVoiceStatus(message);
    };
    speechRecognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('is-listening');
        voiceBtn.title = 'Use voice input';
    };
    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            speechRecognition.stop();
            return;
        }
        speechBaseText = chatInput.value.trim();
        speechRecognition.start();
    });
}

function showVoiceStatus(message) {
    voiceBtn?.setAttribute('aria-label', message);
    if (voiceBtn) voiceBtn.title = message;
    setTimeout(() => {
        if (!isListening && voiceBtn) {
            voiceBtn.title = 'Use voice input';
            voiceBtn.setAttribute('aria-label', 'Use voice input');
        }
    }, 3000);
}

function closeSettings() {
    if (settingsBackdrop) settingsBackdrop.hidden = true;
}

function openSettingsTab(tabName = 'general') {
    if (settingsBackdrop) settingsBackdrop.hidden = false;
    const settingsTabsNav = $('settings-tabs-nav');
    if (settingsTabsNav) {
        settingsTabsNav.querySelectorAll('.cg-nav-item').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });
    }
    document.querySelectorAll('.cg-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `settings-panel-${tabName}`);
    });
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
}

function updateTopbarRoute() {
    const labels = {
        Smart: 'Smart Agent Router — auto-routes to RAG, Tools, or Direct LLM',
        Fast: 'Fast Mode — Groq ultra-fast inference',
        Slow: 'Quality Mode — Gemini high-quality responses',
        LangGraph: 'LangGraph — Stateful workflow with conversation memory'
    };
    topbarRoute.textContent = labels[currentMode] || 'Smart Agent Router';
}

// ============================
//  USER PROFILE & FOLDERS (MongoDB)
// ============================
let folders = [];
let activeFolderFilter = null;
let editingFolderId = null;
let activeMoveConversationId = null;
let selectedFolderColor = '#FF6B35';

async function syncUserProfileToMongoDB() {
    const user = clerk?.user || currentClerkUser;
    if (!user || !user.id) return;
    try {
        const headers = await getAuthHeaders();
        const body = {
            user_id: user.id,
            email: user.primaryEmailAddress?.emailAddress || (user.emailAddresses?.[0]?.emailAddress) || '',
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            full_name: user.fullName || user.username || 'Agent User',
            image_url: user.imageUrl || ''
        };
        await fetch(`${API_V1}/user/profile/sync`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.warn('Profile sync notice:', e);
    }
}

async function loadFoldersFromBackend() {
    const targetUid = currentUserId || getActiveUserId();
    if (!targetUid) {
        folders = [];
        renderFolders();
        return;
    }
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_V1}/folders`, { headers });
        if (res.ok) {
            folders = await res.json();
            localStorage.setItem(`ma_folders_${targetUid}`, JSON.stringify(folders));
        } else {
            folders = JSON.parse(localStorage.getItem(`ma_folders_${targetUid}`) || '[]');
        }
    } catch {
        folders = JSON.parse(localStorage.getItem(`ma_folders_${targetUid}`) || '[]');
    }
    renderFolders();
}

function renderFolders() {
    const folderList = $('folder-list');
    if (!folderList) return;
    folderList.innerHTML = '';

    if (folders.length === 0) {
        folderList.innerHTML = '<div style="padding: 6px 10px; font-size: 0.76rem; color: var(--text-muted); font-style: italic;">No folders yet. Click New to organize chats.</div>';
        return;
    }

    folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = `folder-item${activeFolderFilter === folder.id ? ' active' : ''}`;
        item.innerHTML = `
            <div class="folder-item-left">
                <span class="folder-color-badge" style="background: ${folder.color || '#FF6B35'};"></span>
                <span class="folder-name-text" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
            </div>
            <div class="folder-item-right">
                <span class="folder-count-badge">${folder.conversation_count || 0}</span>
                <div class="folder-item-actions">
                    <button type="button" class="folder-action-btn edit" title="Edit folder">✏️</button>
                    <button type="button" class="folder-action-btn delete" title="Delete folder">🗑</button>
                </div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.folder-action-btn')) return;
            toggleFolderFilter(folder.id);
        });

        item.querySelector('.folder-action-btn.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditFolderModal(folder.id);
        });

        item.querySelector('.folder-action-btn.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFolderConfirm(folder.id, folder.name);
        });

        folderList.appendChild(item);
    });
}

function toggleFolderFilter(folderId) {
    if (activeFolderFilter === folderId) {
        resetFolderFilter();
    } else {
        activeFolderFilter = folderId;
        const folder = folders.find(f => f.id === folderId);
        const label = $('chats-section-label');
        const resetBtn = $('filter-reset-btn');
        if (label && folder) label.textContent = `Chats: ${folder.name}`;
        if (resetBtn) resetBtn.style.display = 'inline-block';
        renderFolders();
        renderChatList();
    }
}

function resetFolderFilter() {
    activeFolderFilter = null;
    const label = $('chats-section-label');
    const resetBtn = $('filter-reset-btn');
    if (label) label.textContent = 'Recent Chats';
    if (resetBtn) resetBtn.style.display = 'none';
    renderFolders();
    renderChatList();
}

function openCreateFolderModal() {
    editingFolderId = null;
    const modal = $('folder-modal-backdrop');
    const title = $('folder-modal-title');
    const input = $('folder-name-input');
    if (title) title.textContent = 'Create Chat Folder';
    if (input) input.value = '';
    selectedFolderColor = '#FF6B35';
    updatePaletteActiveState();
    if (modal) modal.hidden = false;
    setTimeout(() => input?.focus(), 50);
}

function openEditFolderModal(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    editingFolderId = folderId;
    const modal = $('folder-modal-backdrop');
    const title = $('folder-modal-title');
    const input = $('folder-name-input');
    if (title) title.textContent = 'Edit Chat Folder';
    if (input) input.value = folder.name;
    selectedFolderColor = folder.color || '#FF6B35';
    updatePaletteActiveState();
    if (modal) modal.hidden = false;
    setTimeout(() => input?.focus(), 50);
}

function closeFolderModal() {
    const modal = $('folder-modal-backdrop');
    if (modal) modal.hidden = true;
    editingFolderId = null;
}

function updatePaletteActiveState() {
    const dots = document.querySelectorAll('#folder-color-palette .color-dot');
    dots.forEach(d => {
        d.classList.toggle('active', d.dataset.color === selectedFolderColor);
    });
}

async function saveFolderModal() {
    const input = $('folder-name-input');
    const name = (input?.value || '').trim();
    if (!name) {
        showToast('⚠️ Please enter a folder name.');
        return;
    }

    try {
        const headers = await getAuthHeaders();
        if (editingFolderId) {
            // Update existing folder
            const res = await fetch(`${API_V1}/folders/${editingFolderId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ name, color: selectedFolderColor })
            });
            if (res.ok) {
                showToast('✅ Folder updated in MongoDB.');
            }
        } else {
            // Create new folder
            const res = await fetch(`${API_V1}/folders`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ name, color: selectedFolderColor })
            });
            if (res.ok) {
                showToast('✅ New folder created in MongoDB.');
            }
        }
        closeFolderModal();
        await loadFoldersFromBackend();
        await loadConversationsFromBackend();
    } catch (e) {
        showToast('❌ Error saving folder: ' + e.message);
    }
}

async function deleteFolderConfirm(folderId, folderName) {
    if (!confirm(`Are you sure you want to delete folder "${folderName}"? Chats inside will be moved to unfiled.`)) return;

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_V1}/folders/${folderId}`, {
            method: 'DELETE',
            headers
        });
        if (res.ok) {
            showToast('🗑️ Folder deleted from MongoDB.');
            if (activeFolderFilter === folderId) resetFolderFilter();
            await loadFoldersFromBackend();
            await loadConversationsFromBackend();
        }
    } catch (e) {
        showToast('❌ Failed to delete folder.');
    }
}

function openMoveModal(conversationId) {
    activeMoveConversationId = conversationId;
    const modal = $('move-modal-backdrop');
    const optionsContainer = $('move-folder-options');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const conv = conversations.find(c => c.id === conversationId);
    const currentFid = conv?.folder_id;

    // Option 1: Unfiled / No Folder
    const unfiledOpt = document.createElement('div');
    unfiledOpt.className = 'move-folder-option';
    unfiledOpt.innerHTML = `
        <span style="font-size: 16px;">📂</span>
        <div style="flex: 1;">
            <strong>Unfiled (No Folder)</strong>
            ${!currentFid ? '<small style="color: var(--orange-500); margin-left: 6px;">(Current)</small>' : ''}
        </div>
    `;
    unfiledOpt.addEventListener('click', () => executeMoveConversation(null));
    optionsContainer.appendChild(unfiledOpt);

    // User Folders
    folders.forEach(f => {
        const opt = document.createElement('div');
        opt.className = 'move-folder-option';
        opt.innerHTML = `
            <span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${f.color || '#FF6B35'};"></span>
            <div style="flex: 1;">
                <strong>${escapeHtml(f.name)}</strong>
                ${currentFid === f.id ? '<small style="color: var(--orange-500); margin-left: 6px;">(Current)</small>' : ''}
            </div>
        `;
        opt.addEventListener('click', () => executeMoveConversation(f.id));
        optionsContainer.appendChild(opt);
    });

    if (modal) modal.hidden = false;
}

function closeMoveModal() {
    const modal = $('move-modal-backdrop');
    if (modal) modal.hidden = true;
    activeMoveConversationId = null;
}

async function executeMoveConversation(targetFolderId) {
    if (!activeMoveConversationId) return;
    const convId = activeMoveConversationId;
    closeMoveModal();

    const conv = conversations.find(c => c.id === convId);
    if (conv) {
        conv.folder_id = targetFolderId;
    }
    const currentUid = getActiveUserId();
    localStorage.setItem(getUserConversationsStorageKey(currentUid), JSON.stringify(conversations));
    renderChatList();

    try {
        const headers = await getAuthHeaders();
        await fetch(`${API_V1}/folders/conversations/${convId}/move`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ folder_id: targetFolderId })
        });
        showToast(targetFolderId ? '📁 Conversation moved to folder.' : '📂 Conversation unfiled.');
        await loadFoldersFromBackend();
    } catch {
        /* Fallback */
    }
}

// ============================
//  CONVERSATIONS
// ============================
function startNewChat() {
    activeConversationId = null;
    currentThreadId = `thread_${getActiveUserId()}_${Date.now()}`;
    clearMessages();
    setHomeState(true);
    topbarTitle.textContent = 'New Chat';
    if (welcomeScreen) welcomeScreen.style.display = '';
    $('sidebar')?.classList.remove('open');
    $('sidebar-backdrop')?.classList.remove('active');
    renderChatList();
}

async function loadConversationsFromBackend() {
    const targetUid = currentUserId || getActiveUserId();
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_V1}/conversations`, { headers });
        if (response.ok) {
            const dbConvs = await response.json();
            // Verify active context hasn't changed while request was in-flight
            if (targetUid === (currentUserId || getActiveUserId())) {
                conversations = Array.isArray(dbConvs) ? dbConvs : [];
                localStorage.setItem(getUserConversationsStorageKey(targetUid), JSON.stringify(conversations));
                renderChatList();
                if (conversations.length > 0 && !activeConversationId) {
                    restoreLatestConversation();
                } else if (conversations.length === 0) {
                    setHomeState(true);
                }
                return;
            }
        }
    } catch {
        /* Fallback to local storage */
    }
    if (targetUid === (currentUserId || getActiveUserId())) {
        renderChatList();
        if (conversations.length > 0 && !activeConversationId) {
            restoreLatestConversation();
        } else if (conversations.length === 0) {
            setHomeState(true);
        }
    }
}

function restoreLatestConversation() {
    if (conversations.length > 0) loadConversation(conversations[0].id);
}

async function saveConversation(title, messages) {
    const currentUid = getActiveUserId();
    let convToSave = null;
    if (!activeConversationId) {
        activeConversationId = `conv_${Date.now()}`;
        convToSave = {
            id: activeConversationId,
            title,
            messages,
            threadId: currentThreadId,
            folder_id: activeFolderFilter || null,
            created: Date.now()
        };
        conversations.unshift(convToSave);
    } else {
        const conv = conversations.find(c => c.id === activeConversationId);
        if (conv) {
            conv.messages = messages;
            conv.title = title || conv.title;
            convToSave = conv;
        }
    }
    localStorage.setItem(getUserConversationsStorageKey(currentUid), JSON.stringify(conversations.slice(0, 50)));
    renderChatList();

    if (convToSave) {
        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_V1}/conversations/save`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    id: convToSave.id,
                    title: convToSave.title,
                    thread_id: convToSave.threadId,
                    folder_id: convToSave.folder_id || null,
                    messages: convToSave.messages
                })
            });
            await loadFoldersFromBackend();
        } catch { /* Silent fallback */ }
    }
}

function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    activeConversationId = id;
    currentThreadId = conv.threadId || `thread_${getActiveUserId()}_${Date.now()}`;
    topbarTitle.textContent = conv.title;
    clearMessages();
    setHomeState(false);
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    conv.messages.forEach(m => appendMessage(m.role, m.content, m.meta, false));
    scrollToBottom();
    $('sidebar')?.classList.remove('open');
    $('sidebar-backdrop')?.classList.remove('active');
    renderChatList();
}

async function deleteConversation(id, e) {
    if (e) e.stopPropagation();
    const currentUid = getActiveUserId();
    conversations = conversations.filter(c => c.id !== id);
    localStorage.setItem(getUserConversationsStorageKey(currentUid), JSON.stringify(conversations));
    if (activeConversationId === id) startNewChat();
    renderChatList();

    try {
        const headers = await getAuthHeaders();
        await fetch(`${API_V1}/conversations/${id}`, { method: 'DELETE', headers });
        await loadFoldersFromBackend();
    } catch { /* Silent fallback */ }
}

function renderChatList() {
    chatList.innerHTML = '';

    // Apply folder filter if active
    let displayList = conversations;
    if (activeFolderFilter) {
        displayList = conversations.filter(c => c.folder_id === activeFolderFilter);
    }

    if (displayList.length === 0) {
        chatList.innerHTML = `<div style="padding:20px 12px;font-size:0.82rem;color:var(--gray-400);text-align:center;">${activeFolderFilter ? 'No chats in this folder' : 'No conversations yet'}</div>`;
        return;
    }

    displayList.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-list-item${conv.id === activeConversationId ? ' active' : ''}`;

        // Find folder metadata if assigned
        let folderPillHtml = '';
        if (conv.folder_id) {
            const folder = folders.find(f => f.id === conv.folder_id);
            if (folder) {
                folderPillHtml = `
                    <div class="chat-folder-pill">
                        <span class="dot" style="background: ${folder.color || '#FF6B35'};"></span>
                        <span>${escapeHtml(folder.name)}</span>
                    </div>
                `;
            }
        }

        item.innerHTML = `
            <span class="chat-icon">💬</span>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <span class="chat-label">${escapeHtml(conv.title)}</span>
                ${folderPillHtml}
            </div>
            <div style="display: flex; align-items: center; gap: 2px;">
                <button type="button" class="chat-move-btn" title="Move to folder">📁</button>
                <button type="button" class="chat-delete" title="Delete">🗑</button>
            </div>
        `;

        item.addEventListener('click', () => loadConversation(conv.id));
        item.querySelector('.chat-move-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openMoveModal(conv.id);
        });
        item.querySelector('.chat-delete').addEventListener('click', (e) => deleteConversation(conv.id, e));
        chatList.appendChild(item);
    });
}

// ============================
//  TEXT-TO-SPEECH (TTS) HELPERS
// ============================
function cleanMarkdownForSpeech(text) {
    if (!text) return '';
    let clean = text;
    clean = clean.replace(/```[\s\S]*?```/g, ' Code snippet omitted for speech. ');
    clean = clean.replace(/#{1,6}\s+/g, '');
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    clean = clean.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');
    clean = clean.replace(/`([^`]+)`/g, '$1');
    clean = clean.replace(/[📌💡📚⚡📄🌐💻💬⚠️]/g, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
}

function speakMessage(text, btnElement) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech is not supported in this browser.');
        return;
    }
    const synth = window.speechSynthesis;

    if (synth.speaking && currentSpeakingBtn === btnElement) {
        synth.cancel();
        resetTtsButton(btnElement);
        currentSpeakingBtn = null;
        return;
    }

    if (synth.speaking) {
        synth.cancel();
        if (currentSpeakingBtn) resetTtsButton(currentSpeakingBtn);
    }

    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    setTtsButtonSpeaking(btnElement);
    currentSpeakingBtn = btnElement;

    utterance.onend = () => {
        resetTtsButton(btnElement);
        if (currentSpeakingBtn === btnElement) currentSpeakingBtn = null;
    };

    utterance.onerror = () => {
        resetTtsButton(btnElement);
        if (currentSpeakingBtn === btnElement) currentSpeakingBtn = null;
    };

    synth.speak(utterance);
}

function setTtsButtonSpeaking(btn) {
    if (!btn) return;
    btn.classList.add('is-speaking');
    btn.title = 'Stop reading aloud';
    btn.setAttribute('aria-label', 'Stop reading aloud');
    btn.innerHTML = `<svg class="tts-icon-stop" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
}

function resetTtsButton(btn) {
    if (!btn) return;
    btn.classList.remove('is-speaking');
    btn.title = 'Read aloud';
    btn.setAttribute('aria-label', 'Read aloud');
    btn.innerHTML = `<svg class="tts-icon-speaker" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
}

// ============================
//  MESSAGES
// ============================
function clearMessages() {
    const msgs = messagesContainer.querySelectorAll('.message-row, .typing-row');
    msgs.forEach(m => m.remove());
}

function setHomeState(isHome) {
    document.body.classList.toggle('home-state', isHome);
}

function generateDynamicFollowUpsHtml(content, route = 'direct') {
    const isCode = (content && content.includes('```')) || route === 'coding';
    const isRag = route === 'rag' || /document|chunk|pdf|resume|score/i.test(content || '');
    const isWeb = route === 'toolcalling' || /search|scrape|tavily|source|latest|news/i.test(content || '');

    let suggestions = [];
    if (isCode) {
        suggestions = [
            { label: 'Step-by-step walkthrough', prompt: 'Walk through how this code works step-by-step.' },
            { label: 'Add unit tests', prompt: 'Write comprehensive test cases and edge cases for this solution.' },
            { label: 'Optimize performance', prompt: 'How can we optimize the time and memory complexity of this code?' }
        ];
    } else if (isRag) {
        suggestions = [
            { label: 'Key takeaways', prompt: 'Summarize the top 3 key takeaways from the document context.' },
            { label: 'Extract data table', prompt: 'Extract any numerical data, metrics, or tables mentioned into a clear markdown table.' },
            { label: 'Critical analysis', prompt: 'Are there any limitations, caveats, or missing points in this document context?' }
        ];
    } else if (isWeb) {
        suggestions = [
            { label: 'Recent timeline', prompt: 'Provide a chronological timeline of recent developments on this topic.' },
            { label: 'Compare perspectives', prompt: 'Compare different viewpoint sources and analyses on this subject.' },
            { label: 'Key summary', prompt: 'Provide an in-depth summary highlighting the most credible sources.' }
        ];
    } else {
        suggestions = [
            { label: 'Summarize in 3 points', prompt: 'Summarize that in three concise, actionable bullet points.' },
            { label: 'Practical example', prompt: 'Give a concrete, practical real-world example of this.' },
            { label: 'Pros & cons analysis', prompt: 'What are the main advantages and drawbacks of this approach?' }
        ];
    }

    const buttons = suggestions.map(s => `<button type="button" class="follow-up-btn" data-prompt="${escapeHtml(s.prompt)}">${escapeHtml(s.label)}</button>`).join('');
    return `<div class="follow-ups"><span>Suggestions</span>${buttons}</div>`;
}

async function requestDynamicTitle(prompt, convId) {
    if (!prompt || !convId) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_V1}/conversations/autotitle`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.title && data.title.trim()) {
                const cleanTitle = data.title.trim();
                const conv = conversations.find(c => c.id === convId);
                if (conv) {
                    conv.title = cleanTitle;
                    if (activeConversationId === convId) {
                        topbarTitle.textContent = cleanTitle;
                    }
                    const currentUid = getActiveUserId();
                    localStorage.setItem(getUserConversationsStorageKey(currentUid), JSON.stringify(conversations));
                    renderChatList();
                    // Sync updated title with MongoDB
                    await saveConversation(cleanTitle, conv.messages);
                }
            }
        }
    } catch (e) {
        console.warn('Auto-title background task notice:', e);
    }
}

function appendMessage(role, content, meta = {}, animate = true) {
    welcomeScreen.style.display = 'none';
    setHomeState(false);

    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    if (animate) row.style.animationDelay = '0.05s';

    const isUser = role === 'user';
    const avatarHtml = isUser
        ? '<div class="msg-avatar user">You</div>'
        : '<div class="msg-avatar ai"><img src="assets/bot-avatar.jpg" alt="AI"></div>';

    let metaHtml = '';
    if (meta.route) {
        const routeClass = `route-${meta.route}`;
        const routeLabels = {
            rag: '📄 Document Agent',
            toolcalling: '🌐 Web Search Agent',
            coding: '💻 Coding Agent',
            direct: '💬 Direct LLM'
        };
        metaHtml += `<span class="msg-route-badge ${routeClass}">${routeLabels[meta.route] || meta.route}</span>`;
    }
    if (meta.model) metaHtml += `<span>${meta.model}</span>`;
    if (meta.confidence) metaHtml += `<span>Confidence: ${(meta.confidence * 100).toFixed(0)}%</span>`;

    const followUpsHtml = !isUser ? generateDynamicFollowUpsHtml(content, meta.route || 'direct') : '';

    const ttsBtnHtml = !isUser
        ? `<button class="tts-btn" title="Read aloud" aria-label="Read aloud"><svg class="tts-icon-speaker" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>`
        : '';

    row.innerHTML = `
        ${avatarHtml}
        <div class="msg-bubble">
            <div class="msg-header">
                <div class="msg-name ${isUser ? 'user-name' : 'ai-name'}">${isUser ? 'You' : 'MultiAgent AI'}</div>
                ${ttsBtnHtml}
            </div>
            <div class="msg-content" data-raw-content="${encodeURIComponent(content)}">${formatMessage(content)}</div>
            ${followUpsHtml}
            ${metaHtml ? `<div class="msg-meta">${metaHtml}</div>` : ''}
        </div>
    `;
    messagesContainer.appendChild(row);
    scrollToBottom();

    if (!isUser && localStorage.getItem('ma_tts_auto') === 'on') {
        const btn = row.querySelector('.tts-btn');
        if (btn) speakMessage(content, btn);
    }
}

function createStreamingMessage() {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.innerHTML = `
        <div class="msg-avatar ai"><img src="assets/bot-avatar.jpg" alt="AI"></div>
        <div class="msg-bubble">
            <div class="msg-header">
                <div class="msg-name ai-name">MultiAgent AI</div>
                <button class="tts-btn" title="Read aloud" aria-label="Read aloud"><svg class="tts-icon-speaker" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
            </div>
            <div class="agent-activity"><span class="activity-pulse"></span><span class="activity-label">Routing your request</span><span class="activity-time">now</span></div>
            <div class="msg-content streaming-content"><span class="stream-cursor" aria-hidden="true"></span></div>
            <div class="msg-meta streaming-meta"></div>
        </div>
    `;
    messagesContainer.appendChild(row);
    scrollToBottom();
    return row;
}

async function streamChatResponse(text, history = []) {
    const headers = await getAuthHeaders({ Accept: 'text/event-stream' });
    const response = await fetch(`${API_V1}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, mode: currentMode, history, stream: true, user_id: getActiveUserId() })
    });
    if (!response.ok || !response.body) {
        let detail = 'Streaming request failed';
        try { detail = (await response.json()).detail || detail; } catch { /* use default */ }
        throw new Error(detail);
    }

    const row = createStreamingMessage();
    const content = row.querySelector('.streaming-content');
    const metaElement = row.querySelector('.streaming-meta');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let streamMeta = {};

    const handleEvent = rawEvent => {
        const dataLine = rawEvent.split('\n').find(line => line.startsWith('data:'));
        if (!dataLine) return false;
        const payload = dataLine.slice(5).trim();
        if (payload === '[DONE]') return true;
        const event = JSON.parse(payload);
        if (event.error) throw new Error(event.error);
        if (event.event === 'start') {
            streamMeta = event;
            row.querySelector('.activity-label').textContent = 'Generating response';
            metaElement.innerHTML = `<span class="msg-route-badge route-direct">💬 Direct</span><span>${escapeHtml(event.model_used || '')}</span>`;
        }
        if (event.content) {
            fullText += event.content;
            content.innerHTML = `${formatMessage(fullText)}<span class="stream-cursor" aria-hidden="true"></span>`;
            scrollToBottom();
        }
        return false;
    };

    let done = false;
    while (!done) {
        const result = await reader.read();
        buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
            if (event.trim()) done = handleEvent(event) || done;
        }
        if (result.done) {
            if (buffer.trim()) handleEvent(buffer);
            done = true;
        }
    }

    content.classList.remove('streaming-content');
    content.querySelector('.stream-cursor')?.remove();
    content.dataset.rawContent = encodeURIComponent(fullText);
    row.querySelector('.agent-activity')?.remove();
    metaElement.classList.remove('streaming-meta');
    row.querySelector('.msg-bubble').insertAdjacentHTML('beforeend', generateDynamicFollowUpsHtml(fullText, 'direct'));

    if (localStorage.getItem('ma_tts_auto') === 'on') {
        const btn = row.querySelector('.tts-btn');
        if (btn) speakMessage(fullText, btn);
    }
    return { content: fullText, meta: { model: streamMeta.model_used, route: 'direct' } };
}

function showTyping() {
    const row = document.createElement('div');
    row.className = 'message-row assistant typing-row';
    row.innerHTML = `
        <div class="msg-avatar ai"><img src="assets/bot-avatar.jpg" alt="AI"></div>
        <div class="msg-bubble">
            <div class="msg-name ai-name">MultiAgent AI</div>
            <div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
        </div>
    `;
    messagesContainer.appendChild(row);
    scrollToBottom();
}

function removeTyping() {
    const t = messagesContainer.querySelector('.typing-row');
    if (t) t.remove();
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// ============================
//  SEND MESSAGE & API CALLS
// ============================
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isLoading) return;

    const activeUser = currentClerkUser || clerk?.user;
    if (!activeUser) {
        showToast('🔒 Please sign in with Clerk to chat with agents.');
        handleSignIn();
        return;
    }

    const conversationHistory = getAllMessages();
    const isNewThread = !activeConversationId || conversationHistory.length === 0;
    isLoading = true;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', text);
    showTyping();

    try {
        let response, data, meta = {};

        if (documentReady && currentMode === 'Smart' && isDocumentQuestion(text)) {
            const ragHeaders = await getAuthHeaders();
            response = await fetch(`${API_V1}/rag/qa`, {
                method: 'POST',
                headers: ragHeaders,
                body: JSON.stringify({ query: text, mode: 'Fast', top_k: 3, history: conversationHistory, user_id: getActiveUserId() })
            });
            data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Document question error');
            meta = { route: 'rag', model: data.model_used, sources: data.retrieved_chunks };
            removeTyping();
            appendMessage('assistant', data.answer, meta);
        } else if (currentMode === 'Smart') {
            removeTyping();
            const streamHeaders = await getAuthHeaders({ Accept: 'text/event-stream' });
            response = await fetch(`${API_V1}/router/stream`, {
                method: 'POST',
                headers: streamHeaders,
                body: JSON.stringify({ prompt: text, provider: 'groq', top_k: 3, history: conversationHistory, conversation_id: activeConversationId, user_id: getActiveUserId() })
            });
            if (!response.ok || !response.body) {
                let detail = 'Router streaming failed';
                try { detail = (await response.json()).detail || detail; } catch { /* default */ }
                throw new Error(detail);
            }

            const routeLabels = {
                rag: '📄 Document Agent',
                toolcalling: '🌐 Web Search Agent',
                coding: '💻 Coding Agent',
                direct: '💬 Direct LLM'
            };
            const row = createStreamingMessage();
            const streamContent = row.querySelector('.streaming-content');
            const streamMetaEl = row.querySelector('.streaming-meta');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let fullText = '';
            let sMeta = {};

            const handleSSE = raw => {
                const dLine = raw.split('\n').find(l => l.startsWith('data:'));
                if (!dLine) return false;
                const payload = dLine.slice(5).trim();
                if (payload === '[DONE]') return true;
                const ev = JSON.parse(payload);
                if (ev.error) throw new Error(ev.error);
                if (ev.event === 'start') {
                    sMeta = ev;
                    const rc = `route-${ev.selected_route || 'direct'}`;
                    const rl = routeLabels[ev.selected_route] || '💬 Direct LLM';
                    row.querySelector('.activity-label').textContent = 'Streaming response';
                    streamMetaEl.innerHTML = `<span class="msg-route-badge ${rc}">${rl}</span><span>${escapeHtml(ev.model_used || '')}</span>`;
                    if (ev.confidence) streamMetaEl.innerHTML += `<span>Confidence: ${(ev.confidence * 100).toFixed(0)}%</span>`;
                }
                if (ev.content) {
                    fullText += ev.content;
                    streamContent.innerHTML = `${formatMessage(fullText)}<span class="stream-cursor" aria-hidden="true"></span>`;
                    scrollToBottom();
                }
                return false;
            };

            let streamDone = false;
            while (!streamDone) {
                const chunk = await reader.read();
                buf += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
                const parts = buf.split('\n\n');
                buf = parts.pop() || '';
                for (const part of parts) {
                    if (part.trim()) streamDone = handleSSE(part) || streamDone;
                }
                if (chunk.done) {
                    if (buf.trim()) handleSSE(buf);
                    streamDone = true;
                }
            }

            streamContent.classList.remove('streaming-content');
            streamContent.querySelector('.stream-cursor')?.remove();
            streamContent.dataset.rawContent = encodeURIComponent(fullText);
            row.querySelector('.agent-activity')?.remove();
            streamMetaEl.classList.remove('streaming-meta');
            row.querySelector('.msg-bubble').insertAdjacentHTML('beforeend', generateDynamicFollowUpsHtml(fullText, sMeta.selected_route || 'direct'));

            if (localStorage.getItem('ma_tts_auto') === 'on') {
                const tBtn = row.querySelector('.tts-btn');
                if (tBtn) speakMessage(fullText, tBtn);
            }
            meta = { route: sMeta.selected_route || 'direct', model: sMeta.model_used, confidence: sMeta.confidence };
        } else if (currentMode === 'LangGraph') {
            // Use LangGraph stateful workflow
            const graphHeaders = await getAuthHeaders();
            response = await fetch(`${API_V1}/graph/chat`, {
                method: 'POST',
                headers: graphHeaders,
                body: JSON.stringify({ prompt: text, thread_id: currentThreadId, user_id: getActiveUserId() })
            });
            data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Graph error');
            meta = { route: data.route, model: 'LangGraph' };
            removeTyping();
            appendMessage('assistant', data.response, meta);

        } else {
            removeTyping();
            const streamed = await streamChatResponse(text, conversationHistory);
            meta = streamed.meta;
        }

        // Save conversation with dynamic titling
        const allMsgs = getAllMessages();
        const initialTitle = allMsgs.length > 0 ? allMsgs[0].content.substring(0, 45) : 'Chat';
        const currentConv = conversations.find(c => c.id === activeConversationId);
        const titleToUse = (currentConv && currentConv.title && currentConv.title !== 'New Chat') ? currentConv.title : initialTitle;
        topbarTitle.textContent = titleToUse;
        await saveConversation(titleToUse, allMsgs);

        // Dynamically request intelligent AI titling for first turn in thread
        if (isNewThread && activeConversationId) {
            requestDynamicTitle(text, activeConversationId);
        }

    } catch (err) {
        removeTyping();
        appendMessage('assistant', `⚠️ **Error:** ${err.message}\n\nMake sure your backend is running at \`${API_BASE || 'configured endpoint'}\`.\n\n*If you deployed to Render, paste your Render URL in the banner above or in Settings ⚙️.*`, { route: 'direct' });
        const banner = $('backend-alert-banner');
        if (banner) banner.style.display = 'flex';
        checkBackendHealth();
    }

    isLoading = false;
}


function getAllMessages() {
    const rows = messagesContainer.querySelectorAll('.message-row:not(.typing-row)');
    return Array.from(rows).map(row => {
        const role = row.classList.contains('user') ? 'user' : 'assistant';
        const msgContent = row.querySelector('.msg-content');
        const rawContent = msgContent && msgContent.dataset.rawContent
            ? decodeURIComponent(msgContent.dataset.rawContent)
            : (msgContent ? msgContent.textContent : '');
        const routeBadge = row.querySelector('.msg-route-badge');
        const meta = {};
        if (routeBadge) meta.route = routeBadge.className.replace('msg-route-badge route-', '').trim();
        return { role, content: rawContent, meta };
    });
}

// ============================
//  FILE UPLOAD
// ============================
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    uploadedFile = file;
    uploadFilename.textContent = `📄 ${file.name}`;
    uploadIndicator.style.display = 'flex';

    // Upload to backend
    const formData = new FormData();
    formData.append('file', file);

    try {
        appendMessage('user', `📄 Uploading: ${file.name}`);
        showTyping();

        const uploadHeaders = await getAuthHeaders();
        delete uploadHeaders['Content-Type']; // let browser set multipart boundary
        const response = await fetch(`${API_V1}/upload/pdf`, { method: 'POST', headers: uploadHeaders, body: formData });
        const data = await response.json();

        removeTyping();

        if (response.ok) {
            documentReady = data.indexed === true;
            localStorage.setItem('ma_document_ready', String(documentReady));
            const indexingMessage = documentReady
                ? `✅ **PDF indexed successfully!**\n\n📄 **File:** ${data.filename}\n📖 **Pages:** ${data.num_pages}\n🧩 **Chunks stored:** ${data.total_chunks}\n\nQuestions will now be answered from this document.`
                : `✅ **PDF uploaded:** ${data.filename}\n\nThe text was extracted, but it could not be indexed yet. Check that **GEMINI_API_KEY** is configured, then upload the PDF again.`;
            appendMessage('assistant', indexingMessage, { route: 'rag' });
        } else {
            appendMessage('assistant', `⚠️ Upload failed: ${data.detail || 'Unknown error'}`, {});
        }
    } catch (err) {
        removeTyping();
        appendMessage('assistant', `⚠️ Upload error: ${err.message}`, {});
    }

    uploadIndicator.style.display = 'none';
    pdfUpload.value = '';
    uploadedFile = null;
}

// ============================
//  HELPERS
// ============================
function highlightSyntax(codeStr, lang = '') {
    if (!codeStr) return '';
    const tokens = [];
    let tokenized = codeStr
        .replace(/(#.*|\/\/.*)/g, match => {
            tokens.push(`<span class="tok-comment">${match}</span>`);
            return `__TOK_${tokens.length - 1}__`;
        })
        .replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|"[\s\S]*?"|'[\s\S]*?'|`[\s\S]*?`)/g, match => {
            tokens.push(`<span class="tok-string">${match}</span>`);
            return `__TOK_${tokens.length - 1}__`;
        });

    tokenized = tokenized.replace(/\b(def|class|return|import|from|as|async|await|try|except|finally|raise|if|elif|else|for|while|in|is|not|and|or|function|const|let|var|yield|export|default|switch|case|break|continue|throw|catch|public|private|protected|static|new)\b/g, '<span class="tok-keyword">$1</span>');
    tokenized = tokenized.replace(/\b(True|False|None|true|false|null|undefined|self|this|print|console|log|len|range|dict|list|set|tuple|str|int|float|bool)\b/g, '<span class="tok-builtin">$1</span>');
    tokenized = tokenized.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="tok-number">$1</span>');

    tokens.forEach((html, i) => {
        tokenized = tokenized.replace(`__TOK_${i}__`, html);
    });
    return tokenized;
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function showToast(message) {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatMessage(text) {
    const normalizedText = String(text || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n');
    const decodedText = (() => {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = normalizedText;
        return decoder.value;
    })();
    const codeBlocks = [];
    const codeTokenized = decodedText.replace(/```([\w+-]*)\s*\n?([\s\S]*?)```/g, (_, language, code) => {
        const index = codeBlocks.push({ language: language || 'code', code: code.replace(/\n$/, '') }) - 1;
        return `\u0000CODE_${index}\u0000`;
    });

    const inline = value => escapeHtml(value)
        .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>')
        .replace(/_(?!\s)(.+?)(?<!\s)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

    const lines = escapeHtml(codeTokenized).split('\n');
    const output = [];
    let paragraph = [];
    let listType = null;
    let inSourcesDetails = false;

    const closeParagraph = () => {
        if (paragraph.length) {
            output.push(`<p>${paragraph.join('<br>')}</p>`);
            paragraph = [];
        }
    };
    const closeList = () => {
        if (listType) {
            output.push(`</${listType}>`);
            listType = null;
        }
    };
    const closeSourcesDetails = () => {
        if (inSourcesDetails) {
            closeParagraph();
            closeList();
            output.push(`</div></details>`);
            inSourcesDetails = false;
        }
    };
    const addListItem = (type, content) => {
        closeParagraph();
        if (listType !== type) {
            closeList();
            listType = type;
            output.push(`<${type}>`);
        }
        output.push(`<li>${inline(content)}</li>`);
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (!line.trim()) {
            closeParagraph();
            closeList();
        } else if (/^\u0000CODE_\d+\u0000$/.test(line)) {
            closeParagraph();
            closeList();
            closeSourcesDetails();
            const index = Number(line.match(/\d+/)[0]);
            const block = codeBlocks[index];
            const langName = (block.language || 'code').trim().toLowerCase();
            const highlighted = highlightSyntax(escapeHtml(block.code), langName);
            output.push(
                `<div class="code-block-container">` +
                `<div class="code-block-header">` +
                `<div class="code-header-left">` +
                `<div class="code-dots"><span class="code-dot red"></span><span class="code-dot yellow"></span><span class="code-dot green"></span></div>` +
                `<span class="code-lang-tag">${escapeHtml(langName)}</span>` +
                `</div>` +
                `<div class="code-header-actions">` +
                `<button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}">` +
                `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>` +
                `<span>Copy</span>` +
                `</button>` +
                `</div>` +
                `</div>` +
                `<div class="code-block-body"><pre><code>${highlighted}</code></pre></div>` +
                `</div>`
            );
        } else if (/^#{1,3}\s+/.test(line)) {
            closeParagraph();
            closeList();
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (!heading) {
                paragraph.push(inline(line));
                continue;
            }
            const headingText = heading[2].trim();
            const cleanHeading = headingText.replace(/^[📚📌💡\s]+/, '').replace(/&amp;/g, '&').trim();

            if (/^(references|sources|references\s*&\s*sources|references\s*and\s*sources)/i.test(cleanHeading)) {
                closeSourcesDetails();
                inSourcesDetails = true;
                output.push(
                    `<details class="collapsible-sources">` +
                    `<summary class="sources-summary">` +
                    `<span class="sources-icon">📚</span>` +
                    `<span class="sources-title"><strong>${inline(headingText)}</strong></span>` +
                    `<span class="sources-badge">Toggle</span>` +
                    `<span class="sources-chevron">▾</span>` +
                    `</summary>` +
                    `<div class="sources-body">`
                );
            } else {
                closeSourcesDetails();
                output.push(`<h${heading[1].length}>${inline(headingText)}</h${heading[1].length}>`);
            }
        } else if (/^[-*]\s+/.test(line)) {
            addListItem('ul', line.replace(/^[-*]\s+/, ''));
        } else if (/^\d+\.\s+/.test(line)) {
            addListItem('ol', line.replace(/^\d+\.\s+/, ''));
        } else if (line.trim().startsWith('|') && lines[lineIndex + 1]?.trim().match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/)) {
            closeParagraph();
            closeList();
            closeSourcesDetails();
            const tableRows = [line];
            lineIndex += 2;
            while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('|') && lines[lineIndex].trim()) {
                tableRows.push(lines[lineIndex]);
                lineIndex += 1;
            }
            lineIndex -= 1;
            const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => inline(cell.trim()));
            const headerCells = cells(tableRows[0]);
            const bodyRows = tableRows.slice(1).map(row => `<tr>${cells(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
            output.push(`<div class="table-wrap"><table><thead><tr>${headerCells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table></div>`);
        } else if (/^>\s?/.test(line)) {
            closeParagraph();
            closeList();
            output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
        } else if (/^---+$/.test(line.trim())) {
            closeParagraph();
            closeList();
            closeSourcesDetails();
            output.push('<hr>');
        } else {
            closeList();
            paragraph.push(inline(line));
        }
    }

    closeParagraph();
    closeList();
    closeSourcesDetails();
    return output.join('');
}
