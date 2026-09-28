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
const ttsAutoSelect = $('tts-auto-select');
const voiceBtn = $('voice-btn');

// --- TTS State ---
let currentSpeakingBtn = null;

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

    const CODE_PRESETS = {
        dashboard: {
            lang: 'html',
            code: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
  body { background: radial-gradient(circle at 10% 20%, #181926 0%, #0d0e15 100%); color: #f8fafc; min-height: 100vh; padding: 24px; display: flex; align-items: center; justify-content: center; }
  .dashboard { width: 100%; max-width: 680px; background: rgba(26, 27, 38, 0.75); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .header h2 { font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #FF6B35, #FFB347); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .badge { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .pulse { width: 7px; height: 7px; border-radius: 50%; background: #10B981; box-shadow: 0 0 10px #10B981; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
  .card { background: rgba(18, 19, 28, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 16px; transition: all 0.2s ease; }
  .card:hover { transform: translateY(-3px); border-color: rgba(255, 107, 53, 0.4); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
  .card .label { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
  .card .value { font-size: 24px; font-weight: 800; color: #fff; }
  .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 20px; }
  .btn { background: linear-gradient(135deg, #FF6B35, #EA580C); color: #fff; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; box-shadow: 0 4px 14px rgba(255, 107, 53, 0.35); }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255, 107, 53, 0.5); }
</style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h2>🚀 Multi-Agent Node Hub</h2>
      <span class="badge"><span class="pulse"></span> 4 Agents Active</span>
    </div>
    <div class="grid">
      <div class="card"><div class="label">RAG Retrieval</div><div class="value">99.4%</div></div>
      <div class="card"><div class="label">Tavily Web Search</div><div class="value">&lt; 320ms</div></div>
      <div class="card"><div class="label">Synthesized Chunks</div><div class="value" id="chunks-val">1,482</div></div>
    </div>
    <div class="footer">
      <span style="font-size: 12px; color: #64748b;">State: Synchronized with MongoDB Atlas</span>
      <button class="btn" onclick="document.getElementById('chunks-val').textContent = (parseInt(document.getElementById('chunks-val').textContent.replace(',', '')) + 15).toLocaleString(); console.log('⚡ Agent state updated!');">⚡ Simulate Load</button>
    </div>
  </div>
</body>
</html>`
        },
        chart: {
            lang: 'html',
            code: `<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
  .chart-box { background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 20px 30px rgba(0,0,0,0.5); width: 100%; max-width: 580px; text-align: center; }
  canvas { width: 100%; height: 260px; }
  h3 { margin-bottom: 16px; color: #FF6B35; font-size: 18px; }
  button { background: #FF6B35; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 16px; }
</style>
</head>
<body>
  <div class="chart-box">
    <h3>📊 Agent Query Distribution (Real-Time)</h3>
    <canvas id="barCanvas"></canvas>
    <button onclick="drawChart()">🔄 Randomize Stream Data</button>
  </div>
  <script>
    const canvas = document.getElementById('barCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 540; canvas.height = 260;

    function drawChart() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const labels = ['Hybrid RAG', 'Web Search', 'Coding Agent', 'Direct LLM', 'Vision OCR'];
      const colors = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];
      const data = labels.map(() => Math.floor(Math.random() * 80) + 20);
      const barWidth = 60;
      const gap = 40;
      const startX = 35;

      labels.forEach((l, i) => {
        const x = startX + i * (barWidth + gap);
        const h = (data[i] / 100) * 180;
        const y = 220 - h;

        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, 8);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data[i] + '%', x + barWidth/2, y - 8);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText(l, x + barWidth/2, 245);
      });
      console.log('Chart refreshed with values:', data);
    }
    drawChart();
  </script>
</body>
</html>`
        },
        mermaid: {
            lang: 'mermaid',
            code: `graph TD
    User([👤 User Request]) --> Router{🎯 Intent Router}
    
    Router -->|Document QA| RAG[📄 Hybrid RAG Agent]
    Router -->|Weather / Live Facts| Web[🌐 Tavily Search REST]
    Router -->|Code / Software| Dev[💻 Coding Agent]
    Router -->|Chat / Fast QA| Direct[💬 Direct LLM Agent]

    RAG --> Embedder[Gemini Text Embedder]
    Embedder --> Atlas[(MongoDB Vector Store)]
    Atlas --> RRF[🔀 Reciprocal Rank Fusion]

    Web --> TavilyAPI[⚡ Tavily Search API < 350ms]
    
    RRF --> Synthesizer[✨ ChatGPT-Style Structured Synthesizer]
    TavilyAPI --> Synthesizer
    Dev --> Synthesizer
    Direct --> Synthesizer

    Synthesizer --> Output[📋 Markdown with Summary + Content + Citations]
    Output --> Client([🖥️ Glassmorphism UI])`
        },
        calculator: {
            lang: 'html',
            code: `<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #0b0c10; color: #fff; font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .calc { background: rgba(31, 40, 51, 0.85); backdrop-filter: blur(16px); padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: 300px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
  .screen { background: rgba(11, 12, 16, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; font-size: 28px; text-align: right; margin-bottom: 20px; color: #66fcf1; font-family: monospace; overflow-x: auto; min-height: 70px; }
  .keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  button { padding: 16px; border: none; border-radius: 10px; background: rgba(255,255,255,0.06); color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.15s; }
  button:hover { background: rgba(255,255,255,0.15); transform: scale(1.04); }
  button.op { background: #FF6B35; color: #fff; }
  button.op:hover { background: #ea580c; }
  button.clear { background: #ef4444; }
</style>
</head>
<body>
  <div class="calc">
    <div class="screen" id="disp">0</div>
    <div class="keys">
      <button class="clear" onclick="clearD()">C</button>
      <button onclick="press('(')">(</button>
      <button onclick="press(')')">)</button>
      <button class="op" onclick="press('/')">÷</button>
      <button onclick="press('7')">7</button>
      <button onclick="press('8')">8</button>
      <button onclick="press('9')">9</button>
      <button class="op" onclick="press('*')">×</button>
      <button onclick="press('4')">4</button>
      <button onclick="press('5')">5</button>
      <button onclick="press('6')">6</button>
      <button class="op" onclick="press('-')">−</button>
      <button onclick="press('1')">1</button>
      <button onclick="press('2')">2</button>
      <button onclick="press('3')">3</button>
      <button class="op" onclick="press('+')">+</button>
      <button onclick="press('0')">0</button>
      <button onclick="press('.')">.</button>
      <button class="op" style="grid-column: span 2;" onclick="calc()">=</button>
    </div>
  </div>
  <script>
    const d = document.getElementById('disp');
    let expr = '';
    function press(v) { if (expr === '0') expr = ''; expr += v; d.textContent = expr; }
    function clearD() { expr = '0'; d.textContent = '0'; }
    function calc() {
      try {
        const res = eval(expr);
        d.textContent = res;
        console.log(\`Calculation result: \${expr} = \${res}\`);
        expr = String(res);
      } catch(e) { d.textContent = 'Error'; }
    }
  </script>
</body>
</html>`
        },
        particles: {
            lang: 'html',
            code: `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; overflow: hidden; background: #060709; }
  canvas { display: block; }
</style>
</head>
<body>
  <canvas id="c"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
    const particles = Array.from({length: 70}, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
      r: Math.random() * 3 + 1.5
    }));

    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.fillStyle = '#FF6B35';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            ctx.strokeStyle = \`rgba(255, 107, 53, \${1 - dist / 110})\`;
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          }
        }
      });
      requestAnimationFrame(animate);
    }
    animate();
    window.onresize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
  </script>
</body>
</html>`
        },
        python_trace: {
            lang: 'python',
            code: `# Multi-Agent Vector Search Algorithm Simulation
class RRFHybridSearch:
    def __init__(self, k: int = 60):
        self.k = k

    def compute_rrf(self, dense_ranks: dict, sparse_ranks: dict) -> list:
        scores = {}
        all_docs = set(dense_ranks.keys()).union(set(sparse_ranks.keys()))
        for doc_id in all_docs:
            r_dense = dense_ranks.get(doc_id, 999)
            r_sparse = sparse_ranks.get(doc_id, 999)
            score = (1 / (self.k + r_dense)) + (1 / (self.k + r_sparse))
            scores[doc_id] = round(score, 6)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# Run Example
engine = RRFHybridSearch(k=60)
dense = {"doc_101": 1, "doc_204": 2, "doc_309": 3}
sparse = {"doc_204": 1, "doc_408": 2, "doc_101": 3}
ranked = engine.compute_rrf(dense, sparse)

print("🏆 Final Re-Ranked Document Chunks:")
for rank, (doc, score) in enumerate(ranked, start=1):
    print(f"{rank}. {doc} -> RRF Score: {score}")`
        }
    };

    // Code Visualizer Setup (called by setupEventListeners)
    function setupCodeVisualizer() {
        const sidebarCodevisLink = $('sidebar-codevis-link');
        const codevisBackdrop = $('codevis-backdrop');
        const codevisClose = $('codevis-close');
        const editorTextarea = $('codevis-editor-textarea');
        const editorLabel = $('codevis-editor-label');
        const lineNumbers = $('codevis-line-numbers');
        const lineCount = $('codevis-line-count');
        const charCount = $('codevis-char-count');
        const presetSelect = $('codevis-preset-select');
        const runBtn = $('codevis-run-btn');
        const copyBtn = $('codevis-copy-btn');
        const insertChatBtn = $('codevis-insert-chat-btn');
        const clearBtn = $('codevis-clear-btn');
        const reloadBtn = $('codevis-reload-btn');
        const popoutBtn = $('codevis-popout-btn');
        const langTabs = $('codevis-lang-tabs');
        const previewTabs = $('codevis-preview-tabs');
        const iframe = $('codevis-iframe');
        const frameWrapper = $('codevis-frame-wrapper');
        const mermaidContainer = $('codevis-mermaid-container');
        const mermaidOutput = $('codevis-mermaid-output');
        const mermaidTabBtn = $('codevis-mermaid-tab-btn');
        const consoleContainer = $('codevis-console-container');
        const consoleList = $('codevis-console-list');
        const consoleCount = $('codevis-console-count');
        let currentLang = 'html';
        let consoleLogs = [];

        window.openCodeVisualizer = function(initialCode = '', initialLang = 'html') {
            if (codevisBackdrop) codevisBackdrop.hidden = false;
            if (initialCode) {
                if (editorTextarea) editorTextarea.value = initialCode;
                currentLang = (initialLang || 'html').toLowerCase();
                syncLangTab(currentLang);
                if (presetSelect) presetSelect.value = 'custom';
            } else if (!editorTextarea?.value.trim()) {
                // Load default dashboard preset
                loadPreset('dashboard');
            }
            updateEditorStats();
            renderVisualizerCode();
        };

        window.closeCodeVisualizer = function() {
            if (codevisBackdrop) codevisBackdrop.hidden = true;
        };

        if (sidebarCodevisLink) sidebarCodevisLink.addEventListener('click', () => window.openCodeVisualizer());
        if (codevisClose) codevisClose.addEventListener('click', window.closeCodeVisualizer);
        if (codevisBackdrop) codevisBackdrop.addEventListener('click', e => {
            if (e.target === codevisBackdrop) window.closeCodeVisualizer();
        });

        function syncLangTab(lang) {
            currentLang = lang;
            if (langTabs) {
                langTabs.querySelectorAll('.codevis-tab-btn').forEach(btn => {
                    const match = btn.dataset.lang === lang || (lang === 'js' && btn.dataset.lang === 'html') || (lang === 'css' && btn.dataset.lang === 'html');
                    btn.classList.toggle('active', match);
                });
            }
            if (editorLabel) {
                const labels = {
                    html: 'Source Code (HTML / CSS / JS)',
                    mermaid: 'Mermaid Flowchart / Sequence Definition',
                    svg: 'SVG Vector Code',
                    python: 'Python Script & Data Structure Trace'
                };
                editorLabel.textContent = labels[lang] || `Source Code (${lang.toUpperCase()})`;
            }
            if (mermaidTabBtn) {
                mermaidTabBtn.style.display = lang === 'mermaid' ? 'inline-flex' : 'none';
                if (lang === 'mermaid') switchPreviewTab('mermaid');
                else if (mermaidContainer?.style.display !== 'none') switchPreviewTab('visual');
            }
        }

        function loadPreset(presetKey) {
            const preset = CODE_PRESETS[presetKey];
            if (!preset || !editorTextarea) return;
            editorTextarea.value = preset.code;
            syncLangTab(preset.lang);
            updateEditorStats();
            renderVisualizerCode();
        }

        if (presetSelect) {
            presetSelect.addEventListener('change', () => {
                const val = presetSelect.value;
                if (val !== 'custom') loadPreset(val);
            });
        }

        if (langTabs) {
            langTabs.addEventListener('click', e => {
                const btn = e.target.closest('.codevis-tab-btn');
                if (!btn) return;
                syncLangTab(btn.dataset.lang);
                renderVisualizerCode();
            });
        }

        function updateEditorStats() {
            if (!editorTextarea) return;
            const text = editorTextarea.value;
            const lines = text.split('\n').length;
            if (lineNumbers) {
                lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
            }
            if (lineCount) lineCount.textContent = `${lines} ${lines === 1 ? 'line' : 'lines'}`;
            if (charCount) charCount.textContent = `${text.length} chars`;
        }

        if (editorTextarea) {
            editorTextarea.addEventListener('input', () => {
                updateEditorStats();
                if (presetSelect && presetSelect.value !== 'custom') presetSelect.value = 'custom';
            });
            editorTextarea.addEventListener('scroll', () => {
                if (lineNumbers) lineNumbers.scrollTop = editorTextarea.scrollTop;
            });
            editorTextarea.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    renderVisualizerCode();
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = editorTextarea.selectionStart;
                    const end = editorTextarea.selectionEnd;
                    editorTextarea.value = editorTextarea.value.substring(0, start) + '  ' + editorTextarea.value.substring(end);
                    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
                    updateEditorStats();
                }
            });
        }

        function switchPreviewTab(tabKey) {
            if (previewTabs) {
                previewTabs.querySelectorAll('.preview-tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.previewTab === tabKey);
                });
            }
            if (frameWrapper) frameWrapper.style.display = tabKey === 'visual' ? 'flex' : 'none';
            if (mermaidContainer) mermaidContainer.style.display = tabKey === 'mermaid' ? 'flex' : 'none';
            if (consoleContainer) consoleContainer.style.display = tabKey === 'console' ? 'flex' : 'none';
        }

        if (previewTabs) {
            previewTabs.addEventListener('click', e => {
                const btn = e.target.closest('.preview-tab-btn');
                if (!btn) return;
                switchPreviewTab(btn.dataset.previewTab);
            });
        }

        // Device Switcher
        document.querySelectorAll('.codevis-device-group .device-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.codevis-device-group .device-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const device = btn.dataset.device;
                if (!frameWrapper) return;
                frameWrapper.className = `codevis-frame-wrapper device-${device}`;
            });
        });

        if (runBtn) runBtn.addEventListener('click', renderVisualizerCode);
        if (reloadBtn) reloadBtn.addEventListener('click', renderVisualizerCode);

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                if (!editorTextarea?.value) return;
                await navigator.clipboard.writeText(editorTextarea.value);
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>`;
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span>Copy</span>`;
                }, 1800);
            });
        }

        if (insertChatBtn) {
            insertChatBtn.addEventListener('click', () => {
                const code = editorTextarea?.value || '';
                if (!code.trim()) return;
                if (chatInput) {
                    chatInput.value = (chatInput.value ? chatInput.value + '\n\n' : '') + `\`\`\`${currentLang}\n${code}\n\`\`\``;
                    sendBtn.disabled = false;
                    autoResizeTextarea();
                    chatInput.focus();
                }
                window.closeCodeVisualizer();
                showToast('💬 Code inserted into active chat prompt!');
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (editorTextarea) editorTextarea.value = '';
                if (presetSelect) presetSelect.value = 'custom';
                updateEditorStats();
                renderVisualizerCode();
            });
        }

        if (popoutBtn) {
            popoutBtn.addEventListener('click', () => {
                const code = editorTextarea?.value || '';
                const newWin = window.open('', '_blank');
                if (newWin) {
                    newWin.document.open();
                    newWin.document.write(code);
                    newWin.document.close();
                }
            });
        }

        // Console Log Listener from iframe
        window.addEventListener('message', event => {
            if (event.data && event.data.type === 'CODEVIS_LOG') {
                addConsoleLog(event.data.level, event.data.message);
            }
        });

        function addConsoleLog(level, message) {
            consoleLogs.push({ level, message, time: new Date().toLocaleTimeString() });
            if (consoleCount) consoleCount.textContent = consoleLogs.length;
            if (!consoleList) return;
            if (consoleLogs.length === 1) consoleList.innerHTML = '';
            const item = document.createElement('div');
            item.className = `console-log-item log-${level}`;
            item.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span> <span class="log-badge">${level.toUpperCase()}</span> <span class="log-msg">${escapeHtml(message)}</span>`;
            consoleList.appendChild(item);
            consoleList.scrollTop = consoleList.scrollHeight;
        }

        function clearConsoleLogs() {
            consoleLogs = [];
            if (consoleCount) consoleCount.textContent = '0';
            if (consoleList) consoleList.innerHTML = '<div class="console-empty">Console is ready. Logs and outputs will appear here when your code runs.</div>';
        }

        function renderVisualizerCode() {
            const rawCode = editorTextarea ? editorTextarea.value : '';
            clearConsoleLogs();

            if (currentLang === 'mermaid' || rawCode.trim().startsWith('graph ') || rawCode.trim().startsWith('sequenceDiagram') || rawCode.trim().startsWith('flowchart ') || rawCode.trim().startsWith('classDiagram')) {
                syncLangTab('mermaid');
                switchPreviewTab('mermaid');
                renderMermaidDiagram(rawCode);
                return;
            }

            if (currentLang === 'svg' || (rawCode.trim().startsWith('<svg') && rawCode.trim().endsWith('</svg>'))) {
                switchPreviewTab('visual');
                const fullSvgHtml = `<!DOCTYPE html><html><head><style>body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; }</style></head><body>${rawCode}</body></html>`;
                injectIframeContent(fullSvgHtml);
                return;
            }

            if (currentLang === 'python') {
                switchPreviewTab('console');
                addConsoleLog('info', 'Executing Python simulation in sandbox...');
                setTimeout(() => {
                    const lines = rawCode.split('\n');
                    lines.forEach(l => {
                        if (l.trim().startsWith('print(')) {
                            const pMatch = l.match(/print\((.*)\)/);
                            if (pMatch) addConsoleLog('log', pMatch[1].replace(/["']/g, ''));
                        }
                    });
                    addConsoleLog('info', '✨ Python execution finished (Code simulated successfully).');
                }, 300);
                return;
            }

            // HTML / CSS / JS
            switchPreviewTab('visual');
            let fullHtml = rawCode;
            if (!/<html[\s>]/i.test(rawCode)) {
                fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 16px; color: #f8fafc; background: #0b0c10; }
</style>
</head>
<body>
${rawCode}
<script>
  (function() {
    const origLog = console.log, origWarn = console.warn, origErr = console.error;
    console.log = function(...args) {
      window.parent.postMessage({ type: 'CODEVIS_LOG', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      origLog.apply(console, args);
    };
    console.warn = function(...args) {
      window.parent.postMessage({ type: 'CODEVIS_LOG', level: 'warn', message: args.join(' ') }, '*');
      origWarn.apply(console, args);
    };
    console.error = function(...args) {
      window.parent.postMessage({ type: 'CODEVIS_LOG', level: 'error', message: args.join(' ') }, '*');
      origErr.apply(console, args);
    };
    window.onerror = function(msg, url, line) {
      window.parent.postMessage({ type: 'CODEVIS_LOG', level: 'error', message: msg + ' (Line ' + line + ')' }, '*');
    };
  })();
<\/script>
</body>
</html>`;
            } else {
                fullHtml = fullHtml.replace('</body>', `<script>
  (function() {
    const origLog = console.log;
    console.log = function(...args) {
      window.parent.postMessage({ type: 'CODEVIS_LOG', level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      origLog.apply(console, args);
    };
  })();
<\/script></body>`);
            }
            injectIframeContent(fullHtml);
        }

        function injectIframeContent(htmlContent) {
            if (!iframe) return;
            const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
            iframe.src = URL.createObjectURL(blob);
        }

        async function renderMermaidDiagram(code) {
            if (!mermaidOutput) return;
            mermaidOutput.innerHTML = '<div class="mermaid-rendering">Rendering Architecture Diagram...</div>';
            try {
                if (window.mermaid) {
                    window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                    const id = `mermaid_${Date.now()}`;
                    const { svg } = await window.mermaid.render(id, code.trim());
                    mermaidOutput.innerHTML = svg;
                    addConsoleLog('info', 'Mermaid diagram rendered successfully.');
                } else {
                    mermaidOutput.innerHTML = `<pre class="mermaid-raw">${escapeHtml(code)}</pre>`;
                }
            } catch (err) {
                mermaidOutput.innerHTML = `<div class="mermaid-error">⚠️ Mermaid Syntax Error: ${escapeHtml(err.message || String(err))}</div>`;
                addConsoleLog('error', `Mermaid render error: ${err.message || err}`);
            }
        }
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

    if (themeSelect) themeSelect.addEventListener('change', event => {
        const isDark = event.target.value === 'dark';
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem('ma_theme', isDark ? 'dark' : 'light');
    });
    if (ttsAutoSelect) ttsAutoSelect.addEventListener('change', event => {
        localStorage.setItem('ma_tts_auto', event.target.value);
    });
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to clear all conversation history?')) return;
        conversations = [];
        activeConversationId = null;
        localStorage.removeItem('ma_conversations');
        renderChatList();
        setHomeState(true);
        closeSettings();
        showToast('🗑️ All conversation history cleared.');
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
        const visualizeButton = event.target.closest('.visualize-code-btn');
        if (visualizeButton) {
            const rawCode = decodeURIComponent(visualizeButton.dataset.code || '');
            const lang = (visualizeButton.dataset.lang || 'html').toLowerCase();
            openCodeVisualizer(rawCode, lang);
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
            if (codevisBackdrop && !codevisBackdrop.hidden) closeCodeVisualizer();
        }
    });

    // Initialize Code Visualizer Module
    setupCodeVisualizer();

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

    const followUpsHtml = !isUser ? `<div class="follow-ups"><span>Continue with</span><button class="follow-up-btn" data-prompt="Summarize that in three concise points">Summarize it</button><button class="follow-up-btn" data-prompt="Explain that in simpler terms">Explain simply</button><button class="follow-up-btn" data-prompt="What should I look at next?">What next?</button></div>` : '';

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
            removeTyping();
            response = await fetch(`${API_V1}/router/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
                body: JSON.stringify({ prompt: text, provider: 'groq', top_k: 3, history: conversationHistory, conversation_id: activeConversationId })
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
            row.querySelector('.msg-bubble').insertAdjacentHTML('beforeend', '<div class="follow-ups"><span>Continue with</span><button class="follow-up-btn" data-prompt="Summarize that in three concise points">Summarize it</button><button class="follow-up-btn" data-prompt="Explain that in simpler terms">Explain simply</button><button class="follow-up-btn" data-prompt="What should I look at next?">What next?</button></div>');

            if (localStorage.getItem('ma_tts_auto') === 'on') {
                const tBtn = row.querySelector('.tts-btn');
                if (tBtn) speakMessage(fullText, tBtn);
            }
            meta = { route: sMeta.selected_route || 'direct', model: sMeta.model_used, confidence: sMeta.confidence };
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
                `<button class="visualize-code-btn" data-code="${encodeURIComponent(block.code)}" data-lang="${escapeHtml(langName)}" title="Visualize in Code Studio">` +
                `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>` +
                `<span>Visualize</span>` +
                `</button>` +
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
