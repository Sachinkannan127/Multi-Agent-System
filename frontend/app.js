/* ============================================
   MULTI-AGENT SYSTEM — App Chat Logic
   ============================================ */

const API_BASE = 'http://localhost:8990';
const API_V1 = `${API_BASE}/api/v1`;

// --- State ---
let currentMode = 'Smart';       // Smart | Fast | Slow | LangGraph
let currentThreadId = `thread_${Date.now()}`;
let conversations = JSON.parse(localStorage.getItem('ma_conversations') || '[]');
let activeConversationId = null;
let isLoading = false;
let uploadedFile = null;
let documentReady = localStorage.getItem('ma_document_ready') === 'true';
let speechRecognition = null;
let isListening = false;
let speechBaseText = '';

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
const voiceBtn = $('voice-btn');

// ============================
//  INITIALIZATION
// ============================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadConversationsFromBackend();
    setHomeState(true);
    setupEventListeners();
    autoResizeTextarea();
});

function initTheme() {
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ma_theme') || (systemPrefersDark ? 'dark' : 'light');
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (themeSelect) themeSelect.value = isDark ? 'dark' : 'light';
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('ma_theme', newTheme);
    if (themeSelect) themeSelect.value = newTheme;
}

function setupEventListeners() {
    // Theme toggle
    const themeToggleBtn = $('theme-toggle');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    const settingsBtn = $('settings-btn');
    const settingsClose = $('settings-close');
    const clearHistoryBtn = $('clear-history-btn');
    const sidebarSettingsLink = $('sidebar-settings-link');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        settingsBackdrop.hidden = false;
    });
    if (sidebarSettingsLink) sidebarSettingsLink.addEventListener('click', () => {
        settingsBackdrop.hidden = false;
    });
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', event => {
        if (event.target === settingsBackdrop) closeSettings();
    });
    if (themeSelect) themeSelect.addEventListener('change', event => {
        const isDark = event.target.value === 'dark';
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem('ma_theme', isDark ? 'dark' : 'light');
    });
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => {
        conversations = [];
        activeConversationId = null;
        localStorage.removeItem('ma_conversations');
        renderChatList();
        closeSettings();
    });
    messagesContainer.addEventListener('click', async event => {
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
        if (event.key === 'Escape' && settingsBackdrop && !settingsBackdrop.hidden) closeSettings();
    });

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

    // Sidebar toggle button (topbar)
    $('sidebar-toggle').addEventListener('click', () => {
        const sidebar = $('sidebar');
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    // Sidebar collapse button (sidebar header)
    const collapseBtn = $('sidebar-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            const sidebar = $('sidebar');
            if (document.body.classList.contains('home-state')) {
                sidebar.classList.toggle('rail-expanded');
                collapseBtn.title = sidebar.classList.contains('rail-expanded') ? 'Collapse Sidebar' : 'Expand Sidebar';
                return;
            }
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('open');
        });
    }

    // Search conversations
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
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
//  CONVERSATIONS
// ============================
function startNewChat() {
    activeConversationId = null;
    currentThreadId = `thread_${Date.now()}`;
    clearMessages();
    setHomeState(true);
    topbarTitle.textContent = 'New Chat';
    welcomeScreen.style.display = '';
    $('sidebar').classList.remove('open');
    renderChatList();
}

async function loadConversationsFromBackend() {
    try {
        const response = await fetch(`${API_V1}/conversations`);
        if (response.ok) {
            const dbConvs = await response.json();
            if (Array.isArray(dbConvs) && dbConvs.length > 0) {
                conversations = dbConvs;
                localStorage.setItem('ma_conversations', JSON.stringify(conversations));
                renderChatList();
                restoreLatestConversation();
                return;
            }
        }
    } catch {
        /* Fallback to local storage */
    }
    renderChatList();
    restoreLatestConversation();
}

function restoreLatestConversation() {
    if (conversations.length > 0) loadConversation(conversations[0].id);
}

async function saveConversation(title, messages) {
    let convToSave = null;
    if (!activeConversationId) {
        activeConversationId = `conv_${Date.now()}`;
        convToSave = { id: activeConversationId, title, messages, threadId: currentThreadId, created: Date.now() };
        conversations.unshift(convToSave);
    } else {
        const conv = conversations.find(c => c.id === activeConversationId);
        if (conv) { conv.messages = messages; conv.title = title || conv.title; convToSave = conv; }
    }
    localStorage.setItem('ma_conversations', JSON.stringify(conversations.slice(0, 50)));
    renderChatList();

    if (convToSave) {
        try {
            await fetch(`${API_V1}/conversations/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: convToSave.id, title: convToSave.title, thread_id: convToSave.threadId, messages: convToSave.messages })
            });
        } catch { /* Silent fallback */ }
    }
}

function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    activeConversationId = id;
    currentThreadId = conv.threadId || `thread_${Date.now()}`;
    topbarTitle.textContent = conv.title;
    clearMessages();
    setHomeState(false);
    welcomeScreen.style.display = 'none';
    conv.messages.forEach(m => appendMessage(m.role, m.content, m.meta, false));
    scrollToBottom();
    $('sidebar').classList.remove('open');
    renderChatList();
}

async function deleteConversation(id, e) {
    if (e) e.stopPropagation();
    conversations = conversations.filter(c => c.id !== id);
    localStorage.setItem('ma_conversations', JSON.stringify(conversations));
    if (activeConversationId === id) startNewChat();
    renderChatList();

    try {
        await fetch(`${API_V1}/conversations/${id}`, { method: 'DELETE' });
    } catch { /* Silent fallback */ }
}

function renderChatList() {
    chatList.innerHTML = '';
    if (conversations.length === 0) {
        chatList.innerHTML = '<div style="padding:20px 12px;font-size:0.82rem;color:var(--gray-400);text-align:center;">No conversations yet</div>';
        return;
    }
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-list-item${conv.id === activeConversationId ? ' active' : ''}`;
        item.innerHTML = `
            <span class="chat-icon">💬</span>
            <span class="chat-label">${escapeHtml(conv.title)}</span>
            <button class="chat-delete" title="Delete">🗑</button>
        `;
        item.addEventListener('click', () => loadConversation(conv.id));
        item.querySelector('.chat-delete').addEventListener('click', (e) => deleteConversation(conv.id, e));
        chatList.appendChild(item);
    });
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

function isDocumentQuestion(text) {
    return /\b(pdf|resume|uploaded|document|file|vector store|chunk|report|according to the file)\b/i.test(text);
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
        const routeLabels = { rag: '📄 RAG', toolcalling: '🔧 Tools', direct: '💬 Direct' };
        metaHtml += `<span class="msg-route-badge ${routeClass}">${routeLabels[meta.route] || meta.route}</span>`;
    }
    if (meta.model) metaHtml += `<span>${meta.model}</span>`;
    if (meta.confidence) metaHtml += `<span>Confidence: ${(meta.confidence * 100).toFixed(0)}%</span>`;

    const sourcesHtml = meta.sources?.length
        ? `<div class="context-panel"><div class="context-panel-title"><span>Retrieved context</span><span>${meta.sources.length} chunks</span></div>${meta.sources.map((source, index) => `
            <details class="context-card" ${index === 0 ? 'open' : ''}>
                <summary><span class="context-index">${String(index + 1).padStart(2, '0')}</span><span class="context-name">${escapeHtml(source.metadata?.filename || 'Uploaded document')}</span><span class="context-chevron">+</span></summary>
                <p>${escapeHtml(source.text || '')}</p>
            </details>`).join('')}</div>`
        : '';
    const followUpsHtml = !isUser ? `<div class="follow-ups"><span>Continue with</span><button class="follow-up-btn" data-prompt="Summarize that in three concise points">Summarize it</button><button class="follow-up-btn" data-prompt="Explain that in simpler terms">Explain simply</button><button class="follow-up-btn" data-prompt="What should I look at next?">What next?</button></div>` : '';

    row.innerHTML = `
        ${avatarHtml}
        <div class="msg-bubble">
            <div class="msg-name ${isUser ? 'user-name' : 'ai-name'}">${isUser ? 'You' : 'MultiAgent AI'}</div>
            <div class="msg-content" data-raw-content="${encodeURIComponent(content)}">${formatMessage(content)}</div>
            ${sourcesHtml}
            ${followUpsHtml}
            ${metaHtml ? `<div class="msg-meta">${metaHtml}</div>` : ''}
        </div>
    `;
    messagesContainer.appendChild(row);
    scrollToBottom();
}

function createStreamingMessage() {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.innerHTML = `
        <div class="msg-avatar ai"><img src="assets/bot-avatar.jpg" alt="AI"></div>
        <div class="msg-bubble">
            <div class="msg-name ai-name">MultiAgent AI</div>
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
    const response = await fetch(`${API_V1}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: text, mode: currentMode, history, stream: true })
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
    row.querySelector('.msg-bubble').insertAdjacentHTML('beforeend', '<div class="follow-ups"><span>Continue with</span><button class="follow-up-btn" data-prompt="Summarize that in three concise points">Summarize it</button><button class="follow-up-btn" data-prompt="Explain that in simpler terms">Explain simply</button><button class="follow-up-btn" data-prompt="What should I look at next?">What next?</button></div>');
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

    const conversationHistory = getAllMessages();
    isLoading = true;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', text);
    showTyping();

    try {
        let response, data, meta = {};

        if (documentReady && currentMode === 'Smart' && isDocumentQuestion(text)) {
            response = await fetch(`${API_V1}/rag/qa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, mode: 'Fast', top_k: 3, history: conversationHistory })
            });
            data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Document question error');
            meta = { route: 'rag', model: data.model_used, sources: data.retrieved_chunks };
            removeTyping();
            appendMessage('assistant', data.answer, meta);
        } else if (currentMode === 'Smart') {
            response = await fetch(`${API_V1}/router/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, provider: 'groq', top_k: 3, history: conversationHistory, conversation_id: activeConversationId })
            });
            data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Router error');
            meta = { route: data.selected_route, confidence: data.confidence, model: data.metadata?.model_used };
            removeTyping();
            appendMessage('assistant', data.response, meta);
        } else if (currentMode === 'LangGraph') {
            // Use LangGraph stateful workflow
            response = await fetch(`${API_V1}/graph/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, thread_id: currentThreadId })
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

        // Save conversation
        const allMsgs = getAllMessages();
        const title = allMsgs.length > 0 ? allMsgs[0].content.substring(0, 50) : 'Chat';
        topbarTitle.textContent = title;
        saveConversation(title, allMsgs);

    } catch (err) {
        removeTyping();
        appendMessage('assistant', `⚠️ **Error:** ${err.message}\n\nMake sure the backend is running at \`${API_BASE}\``, { route: 'direct' });
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

        const response = await fetch(`${API_V1}/upload/pdf`, { method: 'POST', body: formData });
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
                `<button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}">` +
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>` +
                `<span>Copy Code</span>` +
                `</button>` +
                `</div>` +
                `<div class="code-block-body"><pre><code>${highlighted}</code></pre></div>` +
                `</div>`
            );
        } else if (/^#{1,3}\s+/.test(line)) {
            closeParagraph();
            closeList();
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
        } else if (/^[-*]\s+/.test(line)) {
            addListItem('ul', line.replace(/^[-*]\s+/, ''));
        } else if (/^\d+\.\s+/.test(line)) {
            addListItem('ol', line.replace(/^\d+\.\s+/, ''));
        } else if (line.trim().startsWith('|') && lines[lineIndex + 1]?.trim().match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/)) {
            closeParagraph();
            closeList();
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
            output.push('<hr>');
        } else {
            closeList();
            paragraph.push(inline(line));
        }
    }

    closeParagraph();
    closeList();
    return output.join('');
}
