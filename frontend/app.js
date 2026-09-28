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
        binary_search: {
            lang: 'python',
            code: `def binary_search(arr, target):
    left = 0
    right = len(arr) - 1

    while left <= right:
        mid = (left + right) // 2
        mid_val = arr[mid]

        if mid_val == target:
            return mid  # Found target at index mid
        elif mid_val < target:
            left = mid + 1  # Search right half
        else:
            right = mid - 1  # Search left half

    return -1  # Target not found

# Test Example
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target_value = 23
result_idx = binary_search(numbers, target_value)
print(f"Target {target_value} found at index: {result_idx}")`
        },
        fibonacci: {
            lang: 'python',
            code: `def fib_memo(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    
    # Recursive calculation with memoization
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]

# Compute 7th Fibonacci number
n = 7
result = fib_memo(n)
print(f"Fibonacci({n}) = {result}")`
        },
        bubble_sort: {
            lang: 'python',
            code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                # Swap adjacent elements
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr

# Test array
data = [64, 34, 25, 12, 22, 11, 90]
sorted_data = bubble_sort(data)
print("Sorted Array:", sorted_data)`
        },
        two_sum: {
            lang: 'javascript',
            code: `function twoSum(nums, target) {
    const seen = new Map();

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        
        if (seen.has(complement)) {
            return [seen.get(complement), i];
        }
        seen.set(nums[i], i);
    }
    return [];
}

const numbers = [2, 7, 11, 15];
const target = 9;
const indices = twoSum(numbers, target);
console.log("Two sum indices:", indices);`
        },
        linked_list: {
            lang: 'python',
            code: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    prev = None
    curr = head
    
    while curr is not None:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
        
    return prev

# Create linked list 1 -> 2 -> 3 -> None
head = ListNode(1, ListNode(2, ListNode(3)))
reversed_head = reverse_list(head)`
        },
        tree_dfs: {
            lang: 'python',
            code: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder_traversal(root):
    res = []
    def dfs(node):
        if not node:
            return
        dfs(node.left)
        res.append(node.val)
        dfs(node.right)
    dfs(root)
    return res

# Binary Tree: [4, 2, 5, 1, 3]
root = TreeNode(4, TreeNode(2, TreeNode(1), TreeNode(3)), TreeNode(5))
traversed = inorder_traversal(root)
print("Inorder DFS:", traversed)`
        },
        custom: {
            lang: 'python',
            code: `# Paste or type any program here
def calculate_factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

num = 5
print(f"Factorial of {num} is {calculate_factorial(num)}")`
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
        const langSelect = $('codevis-lang-select');
        const presetSelect = $('codevis-preset-select');
        const analyzeBtn = $('codevis-analyze-btn');
        const copyBtn = $('codevis-copy-btn');
        const insertChatBtn = $('codevis-insert-chat-btn');
        const clearBtn = $('codevis-clear-btn');
        
        // Stepper DOM Elements
        const stepperFirstBtn = $('stepper-first-btn');
        const stepperPrevBtn = $('stepper-prev-btn');
        const stepperPlayBtn = $('stepper-play-btn');
        const stepperPlayIcon = $('stepper-play-icon');
        const stepperPlayText = $('stepper-play-text');
        const stepperNextBtn = $('stepper-next-btn');
        const stepperLastBtn = $('stepper-last-btn');
        const stepperResetBtn = $('stepper-reset-btn');
        const speedSelect = $('codevis-speed-select');
        const viewTabs = $('codevis-view-tabs');
        
        // Mode & Trace View Elements
        const modeEditBtn = $('codevis-mode-edit-btn');
        const modeTraceBtn = $('codevis-mode-trace-btn');
        const rawEditorWrap = $('codevis-raw-editor-wrap');
        const traceWrap = $('codevis-trace-wrap');
        const traceLinesList = $('codevis-trace-lines-list');
        
        // Explanation & Variable DOM Elements
        const stepperBadgeText = $('stepper-badge-text');
        const stepperLineBadge = $('stepper-line-badge');
        const stepperProgressFill = $('stepper-progress-fill');
        const algoTimeComp = $('algo-time-complexity');
        const algoSpaceComp = $('algo-space-complexity');
        const spotlightLineNo = $('spotlight-line-no');
        const spotlightSnippet = $('spotlight-code-snippet');
        const stepExplanationText = $('step-explanation-text');
        const stepMechanicsText = $('step-mechanics-text');
        const stepVariablesGrid = $('step-variables-grid');
        const memoryCountBadge = $('memory-count-badge');
        const stepCallStackList = $('step-call-stack-list');
        const stepEdgeCasesText = $('step-edge-cases-text');
        
        // Views
        const stepperView = $('codevis-stepper-view');
        const fullBreakdownView = $('codevis-full-breakdown-view');
        const fullOverviewText = $('full-overview-text');
        const fullLinesAccordion = $('full-lines-accordion');

        // State variables
        let currentLang = 'python';
        let currentSteps = [];
        let currentStepIndex = 0;
        let playInterval = null;
        let autoPlaySpeed = 1800;
        let lineExplanationsMap = {};
        let activeViewMode = 'stepper';
        let isAnalyzing = false;

        window.openCodeVisualizer = function(initialCode = '', initialLang = 'python') {
            if (codevisBackdrop) codevisBackdrop.hidden = false;
            if (initialCode) {
                if (editorTextarea) editorTextarea.value = initialCode;
                currentLang = (initialLang || 'python').toLowerCase();
                if (langSelect) langSelect.value = currentLang;
                if (presetSelect) presetSelect.value = 'custom';
            } else if (!editorTextarea?.value.trim()) {
                loadPreset('binary_search');
            }
            updateEditorStats();
            // Automatically analyze and visualize
            analyzeAndVisualize();
        };

        window.closeCodeVisualizer = function() {
            stopAutoPlay();
            if (codevisBackdrop) codevisBackdrop.hidden = true;
        };

        if (sidebarCodevisLink) sidebarCodevisLink.addEventListener('click', () => window.openCodeVisualizer());
        if (codevisClose) codevisClose.addEventListener('click', window.closeCodeVisualizer);
        if (codevisBackdrop) codevisBackdrop.addEventListener('click', e => {
            if (e.target === codevisBackdrop) window.closeCodeVisualizer();
        });

        function loadPreset(presetKey) {
            const preset = CODE_PRESETS[presetKey];
            if (!preset || !editorTextarea) return;
            editorTextarea.value = preset.code;
            currentLang = preset.lang || 'python';
            if (langSelect) langSelect.value = currentLang;
            if (editorLabel) editorLabel.textContent = `Program Source (${currentLang.toUpperCase()})`;
            updateEditorStats();
            switchToEditorMode('edit');
        }

        if (presetSelect) {
            presetSelect.addEventListener('change', () => {
                const val = presetSelect.value;
                if (val !== 'custom') {
                    loadPreset(val);
                    analyzeAndVisualize();
                }
            });
        }

        if (langSelect) {
            langSelect.addEventListener('change', () => {
                currentLang = langSelect.value;
                if (editorLabel) editorLabel.textContent = `Program Source (${currentLang.toUpperCase()})`;
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
                    analyzeAndVisualize();
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = editorTextarea.selectionStart;
                    const end = editorTextarea.selectionEnd;
                    editorTextarea.value = editorTextarea.value.substring(0, start) + '    ' + editorTextarea.value.substring(end);
                    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 4;
                    updateEditorStats();
                }
            });
        }

        // Mode Toggles (Edit vs Trace)
        function switchToEditorMode(mode) {
            if (mode === 'trace') {
                if (modeEditBtn) modeEditBtn.classList.remove('active');
                if (modeTraceBtn) modeTraceBtn.classList.add('active');
                if (rawEditorWrap) rawEditorWrap.style.display = 'none';
                if (traceWrap) traceWrap.style.display = 'block';
            } else {
                if (modeEditBtn) modeEditBtn.classList.add('active');
                if (modeTraceBtn) modeTraceBtn.classList.remove('active');
                if (rawEditorWrap) rawEditorWrap.style.display = 'flex';
                if (traceWrap) traceWrap.style.display = 'none';
            }
        }

        if (modeEditBtn) modeEditBtn.addEventListener('click', () => switchToEditorMode('edit'));
        if (modeTraceBtn) modeTraceBtn.addEventListener('click', () => switchToEditorMode('trace'));

        // View Tabs (Stepper vs Full Breakdown)
        if (viewTabs) {
            viewTabs.addEventListener('click', e => {
                const btn = e.target.closest('.view-tab-btn');
                if (!btn) return;
                viewTabs.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeViewMode = btn.dataset.view;
                if (stepperView) stepperView.style.display = activeViewMode === 'stepper' ? 'block' : 'none';
                if (fullBreakdownView) fullBreakdownView.style.display = activeViewMode === 'full-breakdown' ? 'block' : 'none';
            });
        }

        // Client-side simulation fallback generator for instant zero-latency feedback
        function generateLocalTrace(code, lang) {
            const lines = code.split('\n');
            const steps = [];
            const explanations = {};
            const simulatedVars = {};
            let callFrame = ['<global scope>'];

            lines.forEach((rawLine, idx) => {
                const lineNo = idx + 1;
                const trimmed = rawLine.trim();
                let explanation = '';
                let mechanics = '';
                let modified = [];
                let edgeCase = 'Check for null or boundary constraints.';

                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
                    explanation = 'Comment or empty line (skipped by runtime compiler).';
                    mechanics = 'No CPU instructions executed.';
                } else if (trimmed.startsWith('def ') || trimmed.startsWith('function ')) {
                    const name = trimmed.split('(')[0].replace(/def |function /, '').trim();
                    explanation = `Defines function <code>${escapeHtml(name)}()</code> in current namespace.`;
                    mechanics = `Allocates function closure in symbol table with lexical scope.`;
                    simulatedVars[name] = '[Function]';
                    modified = [name];
                } else if (trimmed.startsWith('return ')) {
                    const retVal = trimmed.replace('return ', '').replace(';', '').trim();
                    explanation = `Returns result value <code>${escapeHtml(retVal)}</code> to calling scope.`;
                    mechanics = `Pops call frame and stores return operand in return register.`;
                    edgeCase = 'Ensure return type matches expected signature.';
                } else if (trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('else:')) {
                    explanation = `Evaluates boolean conditional branch: <code>${escapeHtml(trimmed)}</code>`;
                    mechanics = `Branches execution path based on CPU condition flag evaluation.`;
                    edgeCase = 'Guard against truthiness coercion and off-by-one comparisons.';
                } else if (trimmed.startsWith('while ') || trimmed.startsWith('for ')) {
                    explanation = `Loop header: evaluates iteration condition and advances pointer.`;
                    mechanics = `Tests loop termination boundary; initializes loop iterator.`;
                    edgeCase = 'Verify loop termination invariant to prevent infinite execution.';
                } else if (trimmed.includes('=') && !trimmed.startsWith('if') && !trimmed.startsWith('while')) {
                    const parts = trimmed.split('=');
                    const varName = parts[0].replace(/let |const |var /, '').trim();
                    const varVal = parts[1].replace(';', '').trim();
                    simulatedVars[varName] = varVal;
                    modified = [varName];
                    explanation = `Initializes/Updates variable <code>${escapeHtml(varName)}</code> = <code>${escapeHtml(varVal)}</code>.`;
                    mechanics = `Allocates memory address on stack/heap and assigns evaluated value.`;
                } else if (trimmed.startsWith('print(') || trimmed.startsWith('console.log(')) {
                    explanation = `Outputs formatted result to standard output terminal.`;
                    mechanics = `Invokes standard I/O write syscall buffer.`;
                } else {
                    explanation = `Executes statement: <code>${escapeHtml(trimmed)}</code>`;
                    mechanics = `Evaluates expression sequentially in current thread frame.`;
                }

                explanations[lineNo] = explanation.replace(/<[^>]+>/g, '');
                steps.push({
                    step_number: idx + 1,
                    line_number: lineNo,
                    code: rawLine,
                    explanation: explanation,
                    mechanics: mechanics,
                    variables: { ...simulatedVars },
                    modified_vars: modified,
                    call_stack: [...callFrame],
                    edge_cases: edgeCase,
                    time_complexity: 'O(1)'
                });
            });

            return {
                title: `${lang.toUpperCase()} Program Step-Through`,
                total_lines: lines.length,
                total_steps: steps.length,
                overview: `Sequential line-by-line interactive execution breakdown of ${lines.length} lines of ${lang} code.`,
                time_complexity_overall: 'O(N)',
                space_complexity_overall: 'O(1)',
                steps: steps,
                line_explanations: explanations
            };
        }

        // Render Trace Lines in Left Pane
        function renderTraceLines(code, activeLineNum) {
            if (!traceLinesList) return;
            const lines = code.split('\n');
            traceLinesList.innerHTML = lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isActive = lineNum === activeLineNum;
                return `
                    <div class="trace-line-row ${isActive ? 'active-step' : ''}" data-line="${lineNum}" id="trace-line-${lineNum}">
                        <div class="trace-line-pointer">▶</div>
                        <div class="trace-line-num">${lineNum}</div>
                        <div class="trace-line-code">${escapeHtml(lineText || ' ')}</div>
                    </div>
                `;
            }).join('');

            // Add click listeners to jump directly to any clicked line's step
            traceLinesList.querySelectorAll('.trace-line-row').forEach(row => {
                row.addEventListener('click', () => {
                    const lineNo = parseInt(row.dataset.line, 10);
                    jumpToLine(lineNo);
                });
            });

            // Scroll active line into view smoothly
            const activeElem = document.getElementById(`trace-line-${activeLineNum}`);
            if (activeElem && traceWrap) {
                activeElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function jumpToLine(lineNo) {
            const stepIdx = currentSteps.findIndex(s => s.line_number === lineNo);
            if (stepIdx !== -1) {
                goToStep(stepIdx);
            }
        }

        // Render Current Step in Right Pane
        function renderCurrentStep() {
            if (!currentSteps || currentSteps.length === 0) return;
            const step = currentSteps[currentStepIndex];
            if (!step) return;

            // 1. Update Progress Header
            if (stepperBadgeText) stepperBadgeText.textContent = `Step ${step.step_number} of ${currentSteps.length}`;
            if (stepperLineBadge) stepperLineBadge.textContent = `Line ${step.line_number}`;
            if (stepperProgressFill) {
                const pct = ((currentStepIndex + 1) / currentSteps.length) * 100;
                stepperProgressFill.style.width = `${pct}%`;
            }

            // 2. Update Spotlight
            if (spotlightLineNo) spotlightLineNo.textContent = `Line ${step.line_number}`;
            if (spotlightSnippet) {
                spotlightSnippet.innerHTML = `<code>${escapeHtml(step.code.trim() || '// empty line')}</code>`;
            }

            // 3. Update Explanations
            if (stepExplanationText) stepExplanationText.innerHTML = step.explanation;
            if (stepMechanicsText) stepMechanicsText.innerHTML = step.mechanics;
            if (stepEdgeCasesText) stepEdgeCasesText.textContent = step.edge_cases || 'Standard execution behavior. Handle boundary limits.';

            // 4. Update Variables Grid
            if (stepVariablesGrid) {
                const varEntries = Object.entries(step.variables || {});
                if (memoryCountBadge) memoryCountBadge.textContent = `${varEntries.length} ${varEntries.length === 1 ? 'var' : 'vars'}`;
                
                if (varEntries.length === 0) {
                    stepVariablesGrid.innerHTML = '<div class="var-empty-state">No variables currently allocated in this scope.</div>';
                } else {
                    stepVariablesGrid.innerHTML = varEntries.map(([name, val]) => {
                        const isModified = (step.modified_vars || []).includes(name);
                        const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        const typeName = Array.isArray(val) ? 'array' : typeof val;
                        return `
                            <div class="var-chip ${isModified ? 'modified' : ''}">
                                <div class="var-chip-header">
                                    <span class="var-name">${escapeHtml(name)}</span>
                                    <span class="var-type-badge">${typeName}</span>
                                </div>
                                <div class="var-val">${escapeHtml(valStr)}</div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 5. Update Call Stack List
            if (stepCallStackList) {
                const stackFrames = step.call_stack || ['<global scope>'];
                stepCallStackList.innerHTML = stackFrames.map((frame, idx) => `
                    <span class="stack-frame-pill ${idx === stackFrames.length - 1 ? 'active' : ''}">${escapeHtml(frame)}</span>
                `).join('');
            }

            // 6. Highlight active line in left trace view
            const rawCode = editorTextarea ? editorTextarea.value : '';
            renderTraceLines(rawCode, step.line_number);

            // 7. Update button states
            if (stepperFirstBtn) stepperFirstBtn.disabled = currentStepIndex === 0;
            if (stepperPrevBtn) stepperPrevBtn.disabled = currentStepIndex === 0;
            if (stepperNextBtn) stepperNextBtn.disabled = currentStepIndex === currentSteps.length - 1;
            if (stepperLastBtn) stepperLastBtn.disabled = currentStepIndex === currentSteps.length - 1;
        }

        // Render Full Line-by-Line Breakdown Tab
        function renderFullBreakdown(data) {
            if (fullOverviewText) fullOverviewText.textContent = data.overview || 'Program line-by-line breakdown generated.';
            if (!fullLinesAccordion) return;

            const lines = (editorTextarea?.value || '').split('\n');
            fullLinesAccordion.innerHTML = lines.map((lineText, idx) => {
                const lineNo = idx + 1;
                const exp = (data.line_explanations && data.line_explanations[lineNo]) || 
                            (data.steps.find(s => s.line_number === lineNo)?.explanation) || 
                            'Sequential instruction execution.';
                const cleanExp = exp.replace(/<[^>]+>/g, '');
                return `
                    <div class="line-breakdown-card" onclick="window.codevisJumpToLine(${lineNo})">
                        <div class="line-breakdown-header">
                            <span class="line-badge-pill">Line ${lineNo}</span>
                            <code class="line-code-snippet">${escapeHtml(lineText || ' ')}</code>
                        </div>
                        <div class="line-exp-text">🎯 ${escapeHtml(cleanExp)}</div>
                    </div>
                `;
            }).join('');
        }

        window.codevisJumpToLine = function(lineNo) {
            // Switch tab to stepper and jump to line
            if (viewTabs) {
                viewTabs.querySelectorAll('.view-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'stepper'));
            }
            if (stepperView) stepperView.style.display = 'block';
            if (fullBreakdownView) fullBreakdownView.style.display = 'none';
            activeViewMode = 'stepper';
            jumpToLine(lineNo);
        };

        // Navigation actions
        function goToStep(idx) {
            if (idx < 0) idx = 0;
            if (idx >= currentSteps.length) idx = currentSteps.length - 1;
            currentStepIndex = idx;
            renderCurrentStep();
        }

        function nextStep() {
            if (currentStepIndex < currentSteps.length - 1) {
                goToStep(currentStepIndex + 1);
            } else {
                stopAutoPlay();
            }
        }

        function prevStep() {
            if (currentStepIndex > 0) {
                goToStep(currentStepIndex - 1);
            }
        }

        function firstStep() {
            goToStep(0);
        }

        function lastStep() {
            goToStep(currentSteps.length - 1);
        }

        function resetSteps() {
            stopAutoPlay();
            goToStep(0);
        }

        function toggleAutoPlay() {
            if (playInterval) {
                stopAutoPlay();
            } else {
                startAutoPlay();
            }
        }

        function startAutoPlay() {
            if (currentStepIndex >= currentSteps.length - 1) {
                goToStep(0);
            }
            if (stepperPlayBtn) stepperPlayBtn.classList.add('playing');
            if (stepperPlayIcon) stepperPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            if (stepperPlayText) stepperPlayText.textContent = 'Pause';
            
            playInterval = setInterval(() => {
                if (currentStepIndex < currentSteps.length - 1) {
                    nextStep();
                } else {
                    stopAutoPlay();
                }
            }, autoPlaySpeed);
        }

        function stopAutoPlay() {
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
            if (stepperPlayBtn) stepperPlayBtn.classList.remove('playing');
            if (stepperPlayIcon) stepperPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
            if (stepperPlayText) stepperPlayText.textContent = 'Auto Play';
        }

        if (stepperFirstBtn) stepperFirstBtn.addEventListener('click', firstStep);
        if (stepperPrevBtn) stepperPrevBtn.addEventListener('click', prevStep);
        if (stepperNextBtn) stepperNextBtn.addEventListener('click', nextStep);
        if (stepperLastBtn) stepperLastBtn.addEventListener('click', lastStep);
        if (stepperResetBtn) stepperResetBtn.addEventListener('click', resetSteps);
        if (stepperPlayBtn) stepperPlayBtn.addEventListener('click', toggleAutoPlay);

        if (speedSelect) {
            speedSelect.addEventListener('change', () => {
                autoPlaySpeed = parseInt(speedSelect.value, 10) || 1800;
                if (playInterval) {
                    stopAutoPlay();
                    startAutoPlay();
                }
            });
        }

        // Main Analysis Trigger (Calls Backend LLM API with Client-Side Fallback)
        async function analyzeAndVisualize() {
            const rawCode = editorTextarea?.value || '';
            if (!rawCode.trim()) {
                showToast('⚠️ Please write or paste code first.');
                return;
            }

            stopAutoPlay();
            isAnalyzing = true;
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.innerHTML = `
                    <svg class="chat-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span>Analyzing Steps...</span>
                `;
            }

            // 1. Generate Instant Local Simulation so user never waits
            const localData = generateLocalTrace(rawCode, currentLang);
            currentSteps = localData.steps;
            lineExplanationsMap = localData.line_explanations;
            currentStepIndex = 0;
            switchToEditorMode('trace');
            renderCurrentStep();
            renderFullBreakdown(localData);

            // 2. Fetch Deep AI Analysis from backend endpoint
            try {
                const response = await fetch(`${API_BASE_URL}/code/analyze-steps`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: rawCode,
                        language: currentLang,
                        mode: 'step_by_step'
                    })
                });

                if (response.ok) {
                    const aiData = await response.json();
                    if (aiData.steps && aiData.steps.length > 0) {
                        currentSteps = aiData.steps;
                        lineExplanationsMap = aiData.line_explanations || {};
                        if (algoTimeComp) algoTimeComp.textContent = `⏱ Time: ${aiData.time_complexity_overall || 'O(N)'}`;
                        if (algoSpaceComp) algoSpaceComp.textContent = `💾 Space: ${aiData.space_complexity_overall || 'O(1)'}`;
                        renderCurrentStep();
                        renderFullBreakdown(aiData);
                        showToast(`✨ Deep line-by-line analysis ready (${aiData.total_steps} execution steps)!`);
                    }
                }
            } catch (err) {
                console.warn('Backend code analysis fallback active:', err);
            } finally {
                isAnalyzing = false;
                if (analyzeBtn) {
                    analyzeBtn.disabled = false;
                    analyzeBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>Visualize Line-by-Line</span>
                    `;
                }
            }
        }

        if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeAndVisualize);

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
                const currentStep = currentSteps[currentStepIndex];
                const expSummary = currentStep ? `\n\n**Line ${currentStep.line_number} Explanation:**\n${currentStep.explanation.replace(/<[^>]+>/g, '')}` : '';
                if (chatInput) {
                    chatInput.value = (chatInput.value ? chatInput.value + '\n\n' : '') + `\`\`\`${currentLang}\n${code}\n\`\`\`${expSummary}`;
                    sendBtn.disabled = false;
                    autoResizeTextarea();
                    chatInput.focus();
                }
                window.closeCodeVisualizer();
                showToast('💬 Code & line explanation inserted into chat prompt!');
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                stopAutoPlay();
                if (editorTextarea) editorTextarea.value = '';
                if (presetSelect) presetSelect.value = 'custom';
                updateEditorStats();
                switchToEditorMode('edit');
                currentSteps = [];
                if (traceLinesList) traceLinesList.innerHTML = '';
                if (stepExplanationText) stepExplanationText.textContent = 'Paste your code and click "Visualize Line-by-Line".';
                if (stepVariablesGrid) stepVariablesGrid.innerHTML = '<div class="var-empty-state">No variables.</div>';
            });
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
