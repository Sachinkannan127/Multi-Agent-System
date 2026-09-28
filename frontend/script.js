/* ============================================
   MULTI-AGENT SYSTEM — Landing Page Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // Theme Toggle Initialization
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
    // 1. Floating Particles
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
    // 2. Animated Counter
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
    // 3. Mobile Menu Toggle
    // ----------------------------
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');
    const navActions = document.getElementById('nav-actions');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('active');
            if (navActions) navActions.classList.toggle('active');
            mobileToggle.classList.toggle('open');
            const spans = mobileToggle.querySelectorAll('span');
            if (isOpen) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                spans[0].style.transform = '';
                spans[1].style.opacity = '';
                spans[2].style.transform = '';
            }
        });
    }

    // ----------------------------
    // 4. Smooth Scroll
    // ----------------------------
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (id === '#') return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Close mobile menu
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    if (navActions) navActions.classList.remove('active');
                    mobileToggle.classList.remove('open');
                    const spans = mobileToggle.querySelectorAll('span');
                    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
                }
            }
        });
    });

    // ----------------------------
    // 5. Navbar Scroll Shadow
    // ----------------------------
    const navbar = document.getElementById('navbar');
    const mainCard = document.getElementById('main-card');
    if (mainCard && navbar) {
        mainCard.addEventListener('scroll', () => {
            navbar.style.boxShadow = mainCard.scrollTop > 20 ? '0 2px 20px rgba(0,0,0,0.06)' : '';
        });
    }

    // ----------------------------
    // 6. Scroll Reveal Animations
    // ----------------------------
    const revealElements = document.querySelectorAll(
        '.feature-card, .step, .tool-card, .tech-item, .api-card, .workflow-image-wrap, .cta-card, .section-header'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
            if (entry.isIntersecting) {
                // Stagger siblings
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

    // ----------------------------
    // 7. Parallax on Hero Image
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
    // 8. CTA Ripple Effect
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
    // 9. Active Nav Link Highlight
    // ----------------------------
    const sections = document.querySelectorAll('section[id]');
    const navLinkElements = document.querySelectorAll('.nav-link');

    if (sections.length && navLinkElements.length) {
        const navObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinkElements.forEach(link => {
                        link.style.color = link.getAttribute('href') === `#${id}` ? 'var(--orange-500)' : '';
                    });
                }
            });
        }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

        sections.forEach(s => navObserver.observe(s));
    }

    // ----------------------------
    // 11. Clerk Auth & Workspace Gateway
    // ----------------------------
    let clerkLanding = null;

    async function initClerkLanding() {
        const API_BASE = 'http://localhost:8990/api/v1';
        let publishableKey = 'pk_test_c2hpbmluZy1saXphcmQtNTc4MC5jbGVyay5hY2NvdW50cy5kZXYk';

        try {
            const res = await fetch(`${API_BASE}/auth/config`);
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

        // Ensure Clerk UI bundle is loaded
        if (!window.__internal_ClerkUICtor) {
            await new Promise((resolve) => {
                const existing = document.querySelector('script[src*="@clerk/ui"]');
                if (existing) {
                    existing.addEventListener('load', resolve, { once: true });
                    setTimeout(resolve, 2000);
                    return;
                }
                const script = document.createElement('script');
                script.src = `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`;
                script.async = true;
                script.crossOrigin = 'anonymous';
                script.onload = resolve;
                script.onerror = resolve;
                document.head.appendChild(script);
                setTimeout(resolve, 3000);
            });
        }

        // Wait for Clerk SDK
        let attempts = 0;
        while (!window.Clerk && attempts < 40) {
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

                const loadOptions = {};
                if (window.__internal_ClerkUICtor) {
                    loadOptions.ui = { ClerkUI: window.__internal_ClerkUICtor };
                }

                await clerkLanding.load(loadOptions);

                // Initial dynamic UI update
                updateLandingAuthUI(clerkLanding.user);

                // Real-time listener for live auth transitions (Sign In, Sign Out, Token Refresh)
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

        setupAuthGateway();
    }

    function updateLandingAuthUI(user) {
        const navCta = document.getElementById('nav-cta');
        const heroCta = document.getElementById('hero-cta');
        const navLoginBtn = document.getElementById('nav-login-btn');
        const navLoginLegacy = document.getElementById('nav-login');
        const navUserBtn = document.getElementById('nav-clerk-user-button');

        if (user) {
            const firstName = user.firstName || user.fullName || user.username || 'User';
            if (navLoginBtn) navLoginBtn.style.display = 'none';
            if (navLoginLegacy) navLoginLegacy.style.display = 'none';

            if (navCta) {
                navCta.textContent = 'Go to Workspace →';
                navCta.href = 'app.html';
            }

            if (heroCta) {
                const span = heroCta.querySelector('span');
                if (span) span.textContent = `Open Workspace (${firstName}) →`;
                heroCta.href = 'app.html';
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
                navCta.href = 'app.html';
            }

            if (heroCta) {
                const span = heroCta.querySelector('span');
                if (span) span.textContent = 'Open the workspace';
                heroCta.href = 'app.html';
            }
        }
    }

    function setupAuthGateway() {
        const modalBackdrop = document.getElementById('clerk-modal-backdrop');
        const modalClose = document.getElementById('clerk-modal-close');
        const signInTarget = document.getElementById('clerk-sign-in-target');

        const requireAuthForWorkspace = (e) => {
            if (clerkLanding && clerkLanding.user) {
                // User is authenticated, allow natural navigation to app.html
                window.location.href = 'app.html';
                return;
            }

            e.preventDefault();
            if (clerkLanding) {
                if (modalBackdrop && signInTarget) {
                    modalBackdrop.hidden = false;
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
                } else if (typeof clerkLanding.openSignIn === 'function') {
                    clerkLanding.openSignIn({
                        redirectUrl: window.location.origin + '/app.html',
                        afterSignInUrl: window.location.origin + '/app.html',
                        afterSignUpUrl: window.location.origin + '/app.html'
                    });
                }
            } else {
                window.location.href = 'app.html';
            }
        };

        const heroCtaBtn = document.getElementById('hero-cta');
        const navCtaBtn = document.getElementById('nav-cta');
        const navLoginBtn = document.getElementById('nav-login-btn');
        const navLoginLegacy = document.getElementById('nav-login');

        if (heroCtaBtn) heroCtaBtn.addEventListener('click', requireAuthForWorkspace);
        if (navCtaBtn) navCtaBtn.addEventListener('click', requireAuthForWorkspace);
        if (navLoginBtn) navLoginBtn.addEventListener('click', requireAuthForWorkspace);
        if (navLoginLegacy) navLoginLegacy.addEventListener('click', requireAuthForWorkspace);

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
    }

    initClerkLanding();

});

