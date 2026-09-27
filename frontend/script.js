/* ============================================
   MULTI-AGENT SYSTEM — Landing Page Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // Theme Toggle Initialization
    const themeToggleBtn = document.getElementById('theme-toggle');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ma_theme') || (systemPrefersDark ? 'dark' : 'light');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark');
            localStorage.setItem('ma_theme', isDark ? 'dark' : 'light');
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

        heroCta.addEventListener('click', function(e) {
            const r = document.createElement('span');
            r.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.4);width:20px;height:20px;top:${e.offsetY-10}px;left:${e.offsetX-10}px;animation:ripple 0.6s ease-out forwards;pointer-events:none;`;
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
    // 10. Typing Effect on Hero Badge
    // ----------------------------
    const badge = document.querySelector('.hero-badge span:last-child');
    if (badge) {
        const text = badge.textContent;
        badge.textContent = '';
        let i = 0;
        function type() {
            if (i < text.length) {
                badge.textContent += text.charAt(i);
                i++;
                setTimeout(type, 30);
            }
        }
        setTimeout(type, 600);
    }

});
