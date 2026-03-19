/**
 * Shared toast notification system for Taikai.
 * Include this script and add <div class="toast-container" id="toast-container"></div> to any page.
 */
(function() {
    'use strict';

    // Inject toast container if not present
    function ensureContainer() {
        let c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    /**
     * Show a toast notification.
     * @param {string} message - The message to display
     * @param {'info'|'success'|'error'|'warning'} type - Toast type (default: 'info')
     * @param {number} duration - Duration in ms (default: 3600)
     */
    function showToast(message, type = 'info', duration = 3600) {
        const container = ensureContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
    }

    /**
     * Show a styled confirm dialog (replaces browser confirm()).
     * @param {string} message - The question to ask
     * @param {object} opts - Options: { confirmText, cancelText, danger }
     * @returns {Promise<boolean>} true if confirmed, false if cancelled
     */
    function showConfirm(message, opts = {}) {
        const { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = opts;
        return new Promise(resolve => {
            // Overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button class="confirm-btn confirm-cancel">${cancelText}</button>
                        <button class="confirm-btn confirm-ok ${danger ? 'confirm-danger' : ''}">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const cleanup = (val) => {
                overlay.remove();
                resolve(val);
            };
            overlay.querySelector('.confirm-cancel').onclick = () => cleanup(false);
            overlay.querySelector('.confirm-ok').onclick = () => cleanup(true);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
            // Focus confirm button
            setTimeout(() => overlay.querySelector('.confirm-ok').focus(), 50);
        });
    }

    /**
     * Show a confirm dialog that requires the user to type a specific word
     * before the destructive action can proceed.  Use this for actions that
     * are truly irreversible (e.g. "Clear All Competitors").
     *
     * @param {string} message     - HTML-safe description of what will happen.
     * @param {string} expectedText - The exact word the user must type (shown as a hint).
     * @param {object} opts        - Same options as showConfirm.
     * @returns {Promise<boolean>}
     */
    function showTypingConfirm(message, expectedText = 'DELETE', opts = {}) {
        const { confirmText = 'Confirm', cancelText = 'Cancel' } = opts;
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog" style="max-width:420px;">
                    <p class="confirm-message">${message}</p>
                    <p style="font-size:13px;color:#f59e0b;margin:12px 0 6px;">
                        Type <strong>${expectedText}</strong> to confirm:
                    </p>
                    <input type="text" id="_typing-confirm-input"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #f59e0b;background:var(--bg-secondary,#1a1a2e);color:inherit;font-size:14px;margin-bottom:14px;"
                           autocomplete="off" spellcheck="false" placeholder="${expectedText}">
                    <div class="confirm-actions">
                        <button class="confirm-btn confirm-cancel">${cancelText}</button>
                        <button class="confirm-btn confirm-ok confirm-danger" id="_typing-confirm-ok" disabled>${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input   = overlay.querySelector('#_typing-confirm-input');
            const okBtn   = overlay.querySelector('#_typing-confirm-ok');

            input.addEventListener('input', () => {
                okBtn.disabled = input.value !== expectedText;
            });

            const cleanup = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('.confirm-cancel').onclick = () => cleanup(false);
            okBtn.onclick = () => { if (input.value === expectedText) cleanup(true); };
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
            setTimeout(() => input.focus(), 50);
        });
    }

    window.showToast = showToast;
    window.showConfirm = showConfirm;
    window.showTypingConfirm = showTypingConfirm;
})();
