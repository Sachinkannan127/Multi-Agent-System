// ============================================
// MULTI-AGENT SYSTEM — DOCUMENTATION SCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('multiagent_theme') || 'dark';

    if (savedTheme === 'light') {
        document.body.classList.add('light');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light');
            const isLight = document.body.classList.contains('light');
            localStorage.setItem('multiagent_theme', isLight ? 'light' : 'dark');
        });
    }

    // --- Copy to Clipboard ---
    document.querySelectorAll('.docs-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const codeBlock = document.getElementById(targetId);
            if (codeBlock) {
                navigator.clipboard.writeText(codeBlock.innerText.trim()).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Copied!
                    `;
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 2000);
                });
            }
        });
    });

    // --- Code Tabs Switching ---
    document.querySelectorAll('.docs-code-tabs').forEach(tabGroup => {
        const tabs = tabGroup.querySelectorAll('.docs-code-tab');
        const card = tabGroup.closest('.docs-code-card');
        const blocks = card.querySelectorAll('.docs-code-block');

        tabs.forEach((tab, idx) => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                blocks.forEach(b => b.style.display = 'none');

                tab.classList.add('active');
                if (blocks[idx]) {
                    blocks[idx].style.display = 'block';
                }
            });
        });
    });

    // --- Interactive API Tester ---
    const apiTesterSelect = document.getElementById('api-tester-endpoint');
    const apiTesterMethod = document.getElementById('api-tester-method');
    const apiTesterUrl = document.getElementById('api-tester-url');
    const apiTesterBody = document.getElementById('api-tester-body');
    const apiSendBtn = document.getElementById('api-send-btn');
    const apiResponse = document.getElementById('api-tester-response');

    const ENDPOINTS = {
        chat: {
            method: 'POST',
            url: 'http://localhost:8990/api/v1/chat',
            body: JSON.stringify({
                message: "How does the Multi-Agent router decide which agent to run?",
                conversation_id: "demo-session-1"
            }, null, 2)
        },
        router: {
            method: 'POST',
            url: 'http://localhost:8990/api/v1/router/execute',
            body: JSON.stringify({
                query: "Analyze this quadratic equation 2x^2 + 5x - 3 = 0"
            }, null, 2)
        },
        langgraph: {
            method: 'POST',
            url: 'http://localhost:8990/api/v1/langgraph/chat',
            body: JSON.stringify({
                message: "Write a high-performance Python function for matrix multiplication",
                thread_id: "graph-thread-1"
            }, null, 2)
        },
        rag_query: {
            method: 'POST',
            url: 'http://localhost:8990/api/v1/rag/query',
            body: JSON.stringify({
                query: "Summarize the key architectural patterns mentioned in the uploaded paper"
            }, null, 2)
        },
        health: {
            method: 'GET',
            url: 'http://localhost:8990/health',
            body: ""
        }
    };

    if (apiTesterSelect) {
        apiTesterSelect.addEventListener('change', (e) => {
            const ep = ENDPOINTS[e.target.value];
            if (ep) {
                apiTesterMethod.value = ep.method;
                apiTesterUrl.value = ep.url;
                apiTesterBody.value = ep.body;
                apiTesterBody.style.display = ep.method === 'GET' ? 'none' : 'block';
            }
        });
    }

    if (apiSendBtn) {
        apiSendBtn.addEventListener('click', async () => {
            const method = apiTesterMethod.value;
            const url = apiTesterUrl.value;
            let body = null;

            if (method !== 'GET' && apiTesterBody.value.trim()) {
                try {
                    body = JSON.stringify(JSON.parse(apiTesterBody.value));
                } catch (err) {
                    apiResponse.textContent = `❌ Error: Invalid JSON in Request Body\n${err.message}`;
                    return;
                }
            }

            apiSendBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Sending...
            `;
            apiSendBtn.disabled = true;
            apiResponse.textContent = "Connecting to " + url + " ...";

            try {
                const startTime = performance.now();
                const headers = method !== 'GET' ? { 'Content-Type': 'application/json' } : {};
                const res = await fetch(url, {
                    method: method,
                    headers: headers,
                    body: body
                });
                const duration = Math.round(performance.now() - startTime);
                const data = await res.json().catch(() => res.text());

                const statusColor = res.ok ? '🟢' : '🔴';
                apiResponse.textContent = `Status: ${statusColor} ${res.status} ${res.statusText} (${duration}ms)\n\n` +
                    (typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
            } catch (error) {
                apiResponse.textContent = `❌ Connection Error: ${error.message}\nMake sure the backend is running at http://localhost:8990`;
            } finally {
                apiSendBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Send Request
                `;
                apiSendBtn.disabled = false;
            }
        });
    }

    // --- Search Filtering ---
    const searchInput = document.getElementById('docs-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const sidebarLinks = document.querySelectorAll('.docs-sidebar-link');
            sidebarLinks.forEach(link => {
                const text = link.textContent.toLowerCase();
                link.style.display = text.includes(query) || !query ? 'flex' : 'none';
            });
        });

        // Ctrl + K Focus
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    // --- Scrollspy for Table of Contents & Sidebar ---
    const sections = document.querySelectorAll('.docs-section');
    const tocLinks = document.querySelectorAll('.docs-toc-link');
    const sidebarLinks = document.querySelectorAll('.docs-sidebar-link');

    function onScroll() {
        let currentSectionId = '';
        const scrollPosition = window.scrollY + 100;

        sections.forEach(sec => {
            const top = sec.offsetTop;
            const height = sec.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
                currentSectionId = sec.getAttribute('id');
            }
        });

        if (currentSectionId) {
            tocLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
            });
            sidebarLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
            });
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
});
