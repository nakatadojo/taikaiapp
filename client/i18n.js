/**
 * client/i18n.js
 *
 * Lightweight EN/ES internationalization for Taikai.
 * - Auto-detects browser language on first visit
 * - Stores preference in localStorage under 'taikai_lang'
 * - Applies data-i18n / data-i18n-placeholder / data-i18n-title attributes
 * - Injects a floating EN | ES toggle pill on every page
 * - window.t('key') available globally for dynamic strings in JS
 */

(function () {
    const SUPPORTED  = ['en', 'es'];
    const STORAGE_KEY = 'taikai_lang';

    function _detectLang() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.includes(stored)) return stored;
        const browser = (navigator.language || 'en').toLowerCase();
        return browser.startsWith('es') ? 'es' : 'en';
    }

    let _lang    = _detectLang();
    let _strings = {};

    function t(key, vars) {
        let str = _strings[key];
        if (str === undefined) return key; // fallback — key visible, easy to spot missing entries
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                str = str.replace(`{${k}}`, v);
            }
        }
        return str;
    }

    function setLanguage(lang) {
        if (!SUPPORTED.includes(lang)) return;
        localStorage.setItem(STORAGE_KEY, lang);
        location.reload();
    }

    function getLang() { return _lang; }

    function _applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const translated = t(el.dataset.i18n);
            if (translated !== el.dataset.i18n) el.textContent = translated;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const translated = t(el.dataset.i18nPlaceholder);
            if (translated !== el.dataset.i18nPlaceholder) el.placeholder = translated;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const translated = t(el.dataset.i18nTitle);
            if (translated !== el.dataset.i18nTitle) el.title = translated;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const translated = t(el.dataset.i18nHtml);
            if (translated !== el.dataset.i18nHtml) el.innerHTML = translated;
        });
    }

    function _injectToggle() {
        if (document.getElementById('lang-toggle')) return;
        const pill = document.createElement('div');
        pill.id = 'lang-toggle';
        pill.setAttribute('aria-label', 'Language selector');
        pill.style.cssText = [
            'position:fixed',
            'bottom:20px',
            'right:20px',
            'z-index:9999',
            'display:flex',
            'background:var(--bg-secondary,#1e1e2e)',
            'border:1px solid var(--glass-border,rgba(255,255,255,0.15))',
            'border-radius:20px',
            'overflow:hidden',
            'box-shadow:0 2px 12px rgba(0,0,0,0.4)',
            'font-family:inherit',
        ].join(';');

        SUPPORTED.forEach(lang => {
            const btn = document.createElement('button');
            btn.textContent  = lang.toUpperCase();
            btn.title        = lang === 'en' ? 'Switch to English' : 'Cambiar a Español';
            const active     = lang === _lang;
            btn.style.cssText = [
                'padding:7px 16px',
                'border:none',
                'cursor:pointer',
                'font-size:13px',
                'font-weight:700',
                'letter-spacing:0.5px',
                'transition:background 0.15s,color 0.15s',
                `background:${active ? 'var(--accent,#6366f1)' : 'transparent'}`,
                `color:${active ? '#fff' : 'var(--text-secondary,#888)'}`,
            ].join(';');
            btn.addEventListener('mouseenter', () => { if (!active) btn.style.color = 'var(--text-primary,#fff)'; });
            btn.addEventListener('mouseleave', () => { if (!active) btn.style.color = 'var(--text-secondary,#888)'; });
            btn.onclick = () => setLanguage(lang);
            pill.appendChild(btn);
        });

        document.body.appendChild(pill);
    }

    async function _load() {
        try {
            const res = await fetch(`/locales/${_lang}.json?v=1`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _strings = await res.json();
        } catch (e) {
            console.warn('[i18n] Failed to load locale:', _lang, e.message);
            _strings = {};
        }
    }

    // Expose globally
    window.t          = t;
    window.setLanguage = setLanguage;
    window.getLang    = getLang;
    window.i18n       = { t, setLanguage, getLang, lang: _lang };

    _load().then(() => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                _applyTranslations();
                _injectToggle();
            });
        } else {
            _applyTranslations();
            _injectToggle();
        }
    });
})();
