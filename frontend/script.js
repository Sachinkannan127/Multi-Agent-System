/* ============================================
   MULTI-AGENT SYSTEM — Landing Page Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------
    // 1. Theme Toggle Initialization
    // ----------------------------
    const themeToggleBtn = document.getElementById('theme-toggle');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ma_theme') || (systemPrefersDark ? 'dark' : 'light');
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    const savedAccent = localStorage.getItem('ma_accent') || 'amber';
    const accents = {
        amber: { primary: '#FF6B35', hover: '#EA580C' },
        emerald: { primary: '#10B981', hover: '#059669' },
        violet: { primary: '#8B5CF6', hover: '#7C3AED' },
        cyan: { primary: '#06B6D4', hover: '#0891B2' },
        indigo: { primary: '#6366F1', hover: '#4F46E5' },
        rose: { primary: '#F43F5E', hover: '#E11D48' },
    };
    const sel = accents[savedAccent] || accents.amber;
    document.documentElement.style.setProperty('--orange-500', sel.primary);
    document.documentElement.style.setProperty('--orange-600', sel.hover);
    document.documentElement.style.setProperty('--accent-color', sel.primary);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const darkNow = document.body.classList.toggle('dark');
            const newTheme = darkNow ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('ma_theme', newTheme);
        });
    }

    // ----------------------------
    // 2. Floating Particles
    // ----------------------------
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer) {
        for (let i = 0; i < 18; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            const size = Math.random() * 6 + 3;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${Math.random() * 100}%`;
            p.style.animationDuration = `${Math.random() * 12 + 8}s`;
            p.style.animationDelay = `${Math.random() * 10}s`;
            particlesContainer.appendChild(p);
        }
    }

    // ----------------------------
    // 3. Animated Counter
    // ----------------------------
    function animateCounter(el, target, duration = 2000) {
        const startTime = performance.now();
        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target.toLocaleString();
        }
        requestAnimationFrame(tick);
    }

    const statUsers = document.getElementById('stat-users');
    if (statUsers) {
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { animateCounter(statUsers, 1500, 2200); obs.unobserve(e.target); }
            });
        }, { threshold: 0.5 });
        obs.observe(statUsers);
    }

    // ----------------------------
    // 4. Brand Click -> Smooth Scroll Top
    // ----------------------------
    const navBrand = document.getElementById('nav-brand');
    if (navBrand) {
        navBrand.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ----------------------------
    // 5. Mobile Menu Toggle
    // ----------------------------
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');
    const navActions = document.getElementById('nav-actions');

    const closeMobileMenu = () => {
        if (navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            if (navActions) navActions.classList.remove('active');
            if (mobileToggle) {
                mobileToggle.classList.remove('open');
                const spans = mobileToggle.querySelectorAll('span');
                spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
            }
        }
    };

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('active');
            if (navActions) navActions.classList.toggle('active');
            mobileToggle.classList.toggle('open', isOpen);
            const spans = mobileToggle.querySelectorAll('span');
            if (isOpen && spans.length >= 3) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else if (spans.length >= 3) {
                spans[0].style.transform = '';
                spans[1].style.opacity = '';
                spans[2].style.transform = '';
            }
        });

        // Close mobile menu on outside click
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !mobileToggle.contains(e.target)) {
                closeMobileMenu();
            }
        });
    }

    // ----------------------------
    // 6. Smooth Scroll on In-Page Anchors
    // ----------------------------
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (!id || id === '#') return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                closeMobileMenu();
            }
        });
    });

    // ----------------------------
    // 7. Navbar Scroll Shadow (Listens to window scroll)
    // ----------------------------
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const updateNavbarShadow = () => {
            navbar.style.boxShadow = window.scrollY > 20 ? '0 4px 20px rgba(0,0,0,0.08)' : '';
        };
        window.addEventListener('scroll', updateNavbarShadow, { passive: true });
        updateNavbarShadow();
    }

    // ----------------------------
    // 8. Scroll Reveal Animations
    // ----------------------------
    const revealElements = document.querySelectorAll(
        '.feature-card, .step, .tool-card, .tech-item, .api-card, .workflow-image-wrap, .cta-card, .section-header'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const parent = entry.target.parentElement;
                    const siblings = parent ? Array.from(parent.querySelectorAll('.reveal')) : [];
                    const siblingIdx = siblings.indexOf(entry.target);
                    const delay = siblingIdx >= 0 ? siblingIdx * 80 : 0;

                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);

                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('visible'));
    }

    // ----------------------------
    // 9. Parallax on Hero Visual
    // ----------------------------
    const heroVisual = document.querySelector('.hero-visual');
    const heroImage = document.getElementById('hero-image');

    if (heroVisual && heroImage && window.innerWidth > 768) {
        heroVisual.addEventListener('mousemove', e => {
            const rect = heroVisual.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            heroVisual.style.setProperty('--mouse-x', `${(x + 0.5) * 100}%`);
            heroVisual.style.setProperty('--mouse-y', `${(y + 0.5) * 100}%`);
            heroImage.style.transform = `scale(1.02) translate(${x * 12}px, ${y * 12}px)`;
            const b1 = document.getElementById('bubble-1');
            const b2 = document.getElementById('bubble-2');
            if (b1) b1.style.transform = `translate(${-x * 8}px, ${-y * 8}px)`;
            if (b2) b2.style.transform = `translate(${-x * 6}px, ${-y * 6}px)`;
        });
        heroVisual.addEventListener('mouseleave', () => {
            heroImage.style.transform = '';
            heroVisual.style.setProperty('--mouse-x', '50%');
            heroVisual.style.setProperty('--mouse-y', '50%');
        });
    }

    // ----------------------------
    // 10. CTA Ripple Effect
    // ----------------------------
    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        const style = document.createElement('style');
        style.textContent = `@keyframes ripple { to { width:200px;height:200px;margin-top:-100px;margin-left:-100px;opacity:0; } }`;
        document.head.appendChild(style);

        heroCta.addEventListener('click', function (e) {
            const r = document.createElement('span');
            r.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.4);width:20px;height:20px;top:${e.offsetY - 10}px;left:${e.offsetX - 10}px;animation:ripple 0.6s ease-out forwards;pointer-events:none;`;
            this.appendChild(r);
            setTimeout(() => r.remove(), 600);
        });
    }

    // ----------------------------
    // 11. Active Nav Link Highlight
    // ----------------------------
    const sections = document.querySelectorAll('section[id]');
    const navLinkElements = document.querySelectorAll('.nav-link');

    if (sections.length && navLinkElements.length && 'IntersectionObserver' in window) {
        const navObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinkElements.forEach(link => {
                        const href = link.getAttribute('href');
                        link.style.color = href === `#${id}` ? 'var(--orange-500)' : '';
                    });
                }
            });
        }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

        sections.forEach(s => navObserver.observe(s));
    }

    // ----------------------------
    // 12. Clerk Auth & Workspace Gateway
    // ----------------------------
    let clerkLanding = null;

    async function initClerkLanding() {
        const PERMANENT_BACKEND = 'https://multi-agent-system-nn5b.onrender.com';
        let rawBase = (typeof window !== 'undefined' && window.__API_BASE__)
            || (typeof window !== 'undefined' && window.__PERMANENT_BACKEND_URL__)
            || localStorage.getItem('ma_api_base')
            || PERMANENT_BACKEND;
        let API_BASE = `${rawBase.replace(/\/+$/, '')}/api/v1`;
        let publishableKey = 'pk_test_c2hpbmluZy1saXphcmQtNTc4MC5jbGVyay5hY2NvdW50cy5kZXYk';


        try {
            let res = await fetch(`${API_BASE}/auth/config`);
            if (!res.ok && API_BASE.includes('127.0.0.1')) {
                res = await fetch(`${API_BASE.replace('127.0.0.1', 'localhost')}/auth/config`);
            }
            if (res.ok) {
                const data = await res.json();
                if (data.publishable_key) publishableKey = data.publishable_key;
            }
        } catch { /* Fallback */ }

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
                    setTimeout(resolve, 1500);
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
                setTimeout(resolve, 2000);
            });
        }

        // Poll briefly for Clerk instance
        let attempts = 0;
        while (!window.Clerk && attempts < 25) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.Clerk) {
            try {
                if (typeof window.Clerk === 'function') {
                    clerkLanding = new window.Clerk(publishableKey);
                } else {
                    clerkLanding = window.Clerk;
                }

                await clerkLanding.load();

                // Initial dynamic UI update
                updateLandingAuthUI(clerkLanding.user);

                // Real-time listener for live auth transitions
                if (typeof clerkLanding.addListener === 'function') {
                    clerkLanding.addListener(({ user }) => {
                        updateLandingAuthUI(user);
                        const modalBackdrop = document.getElementById('clerk-modal-backdrop');
                        if (user && modalBackdrop) modalBackdrop.hidden = true;
                    });
                }
            } catch (err) {
                console.warn('Clerk landing notice:', err);
            }
        }
    }

    function updateLandingAuthUI(user) {
        const navCta = document.getElementById('nav-cta');
        const heroCta = document.getElementById('hero-cta');
        const navLoginBtn = document.getElementById('nav-login-btn');
        const navUserBtn = document.getElementById('nav-clerk-user-button');

        if (user) {
            const firstName = user.firstName || user.fullName || user.username || 'User';
            if (navLoginBtn) navLoginBtn.style.display = 'none';

            if (navCta) {
                navCta.textContent = 'Go to Workspace →';
            }

            if (heroCta) {
                const span = heroCta.querySelector('span');
                if (span) span.textContent = `Open Workspace (${firstName}) →`;
            }

            if (clerkLanding && navUserBtn && !navUserBtn.hasChildNodes()) {
                try {
                    clerkLanding.mountUserButton(navUserBtn, { afterSignOutUrl: '/' });
                } catch (err) {
                    console.warn('mountUserButton notice:', err);
                }
            }
        } else {
            if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
            if (navUserBtn) navUserBtn.innerHTML = '';

            if (navCta) {
                navCta.textContent = 'Get Started';
            }

            if (heroCta) {
                const span = heroCta.querySelector('span');
                if (span) span.textContent = 'Open the workspace';
            }
        }
    }

    function setupAuthGateway() {
        const modalBackdrop = document.getElementById('clerk-modal-backdrop');
        const modalClose = document.getElementById('clerk-modal-close');
        const signInTarget = document.getElementById('clerk-sign-in-target');
        const navLoginBtn = document.getElementById('nav-login-btn');

        const openAuthModal = () => {
            if (modalBackdrop) modalBackdrop.hidden = false;
            if (clerkLanding && signInTarget) {
                if (!signInTarget.hasChildNodes()) {
                    try {
                        clerkLanding.mountSignIn(signInTarget, {
                            afterSignInUrl: window.location.origin + '/app.html',
                            afterSignUpUrl: window.location.origin + '/app.html',
                        });
                    } catch (mountErr) {
                        console.warn('mountSignIn fallback:', mountErr);
                        if (typeof clerkLanding.openSignIn === 'function') {
                            clerkLanding.openSignIn();
                        }
                    }
                }
            } else if (!clerkLanding && signInTarget) {
                signInTarget.innerHTML = `
                    <div style="text-align:center;padding:24px;color:#8E8EA0;">
                        <div style="margin:0 auto 12px;width:24px;height:24px;border:2px solid #FF8C42;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                        <div>Connecting to secure login...</div>
                    </div>
                `;
                const checkInterval = setInterval(() => {
                    if (clerkLanding) {
                        clearInterval(checkInterval);
                        signInTarget.innerHTML = '';
                        try {
                            clerkLanding.mountSignIn(signInTarget, {
                                afterSignInUrl: window.location.origin + '/app.html',
                                afterSignUpUrl: window.location.origin + '/app.html',
                            });
                        } catch (err) {
                            console.warn('Delayed mountSignIn failed:', err);
                        }
                    }
                }, 200);
                setTimeout(() => clearInterval(checkInterval), 4000);
            }
        };

        const heroCtaBtn = document.getElementById('hero-cta');
        const navCtaBtn = document.getElementById('nav-cta');

        const requireAuth = (e) => {
            if (clerkLanding && clerkLanding.user) {
                return;
            }
            if (e) e.preventDefault();
            openAuthModal();
        };

        if (navLoginBtn) navLoginBtn.addEventListener('click', requireAuth);
        if (heroCtaBtn) heroCtaBtn.addEventListener('click', requireAuth);
        if (navCtaBtn) navCtaBtn.addEventListener('click', requireAuth);

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                if (modalBackdrop) modalBackdrop.hidden = true;
            });
        }

        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) modalBackdrop.hidden = true;
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalBackdrop && !modalBackdrop.hidden) {
                modalBackdrop.hidden = true;
            }
        });
    }

    setupAuthGateway();
    initClerkLanding();

});


