// Public Site JavaScript
// Load tournament data from localStorage and sync with admin

// Database helper
const db = {
    load(table) {
        const data = localStorage.getItem(table);
        return data ? JSON.parse(data) : [];
    },
    add(table, item) {
        const items = this.load(table);
        item.id = Date.now() + Math.random();
        items.push(item);
        localStorage.setItem(table, JSON.stringify(items));
        return item;
    }
};

// ── Pricing Helpers (mirrored from app.js) ──────────────────────────────────

function getActiveTournament() {
    const config = JSON.parse(localStorage.getItem('publicSiteConfig') || '{}');
    const tournaments = db.load('tournaments');
    // Use tournamentId from public config, fall back to first tournament
    if (config.tournamentId) {
        return tournaments.find(t => t.id === config.tournamentId) || tournaments[0] || null;
    }
    return tournaments[0] || null;
}

function getEventPrice(event, isAddOn, tournament) {
    const defaults = tournament?.pricing || { basePrice: 75.00, addOnPrice: 25.00 };
    if (isAddOn) {
        return event.addOnPrice != null ? event.addOnPrice : defaults.addOnPrice;
    }
    return event.basePrice != null ? event.basePrice : defaults.basePrice;
}

function calculatePricingBreakdown(selectedEventIds, eventTypes, tournament) {
    const breakdown = [];
    let total = 0;
    selectedEventIds.forEach((eventId, index) => {
        const event = eventTypes.find(e => e.id === eventId);
        if (!event) return;
        const isAddOn = index > 0;
        const price = getEventPrice(event, isAddOn, tournament);
        breakdown.push({ eventId: event.id, eventName: event.name, type: isAddOn ? 'addon' : 'primary', price });
        total += price;
    });
    return { breakdown, total };
}

// ── Public Event Selection ──────────────────────────────────────────────────

let pubSelectedEventOrder = [];

function loadPublicEventCheckboxes() {
    const container = document.getElementById('pub-event-checkboxes');
    if (!container) return;

    const eventTypes = db.load('eventTypes');
    const tournament = getActiveTournament();

    if (eventTypes.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary, #999);font-size:14px;">No events available for registration at this time.</p>';
        document.getElementById('pub-price-summary').style.display = 'none';
        return;
    }

    pubSelectedEventOrder = [];
    container.innerHTML = '';

    eventTypes.forEach((event, idx) => {
        const isDefault = event.isDefault;

        // Pre-select default events
        if (isDefault) {
            pubSelectedEventOrder.push(event.id);
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `pub-event-${event.id}`;
        checkbox.checked = isDefault;
        checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;flex-shrink:0;accent-color:#0071e3;';
        checkbox.addEventListener('change', () => updatePublicEventOrder(event.id));

        const label = document.createElement('label');
        label.htmlFor = `pub-event-${event.id}`;
        label.style.cssText = 'flex:1;cursor:pointer;font-size:14px;';
        label.textContent = event.name;

        const badge = document.createElement('span');
        badge.id = `pub-badge-${event.id}`;
        badge.style.cssText = 'padding:2px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;white-space:nowrap;';

        row.appendChild(checkbox);
        row.appendChild(label);
        row.appendChild(badge);
        container.appendChild(row);
    });

    updatePublicEventBadges();
    updatePublicPriceSummary();
}

function updatePublicEventOrder(eventId) {
    const checkbox = document.getElementById(`pub-event-${eventId}`);
    if (checkbox.checked) {
        if (!pubSelectedEventOrder.includes(eventId)) pubSelectedEventOrder.push(eventId);
    } else {
        pubSelectedEventOrder = pubSelectedEventOrder.filter(id => id !== eventId);
    }
    updatePublicEventBadges();
    updatePublicPriceSummary();
}

function updatePublicEventBadges() {
    const eventTypes = db.load('eventTypes');
    const tournament = getActiveTournament();

    eventTypes.forEach(event => {
        const badge = document.getElementById(`pub-badge-${event.id}`);
        if (!badge) return;

        const orderIndex = pubSelectedEventOrder.indexOf(event.id);
        if (orderIndex === -1) {
            badge.textContent = '';
            badge.style.background = 'transparent';
            badge.style.color = 'transparent';
        } else if (orderIndex === 0) {
            const price = getEventPrice(event, false, tournament);
            badge.textContent = `PRIMARY — $${price.toFixed(2)}`;
            badge.style.background = 'rgba(0,113,227,0.15)';
            badge.style.color = '#0071e3';
        } else {
            const price = getEventPrice(event, true, tournament);
            badge.textContent = `ADD-ON — $${price.toFixed(2)}`;
            badge.style.background = 'rgba(39,174,96,0.15)';
            badge.style.color = '#27ae60';
        }
    });
}

function updatePublicPriceSummary() {
    const breakdownEl = document.getElementById('pub-price-breakdown');
    const totalEl = document.getElementById('pub-price-total');
    const summaryContainer = document.getElementById('pub-price-summary');
    if (!breakdownEl || !totalEl) return;

    if (pubSelectedEventOrder.length === 0) {
        breakdownEl.innerHTML = '<p style="color:var(--text-secondary, #999);font-size:13px;margin:0;">No events selected</p>';
        totalEl.textContent = '';
        summaryContainer.style.display = 'block';
        return;
    }

    const eventTypes = db.load('eventTypes');
    const tournament = getActiveTournament();
    const { breakdown, total } = calculatePricingBreakdown(pubSelectedEventOrder, eventTypes, tournament);

    let html = '<div style="font-weight:600;margin-bottom:8px;font-size:13px;color:var(--text-secondary, #999);text-transform:uppercase;letter-spacing:0.5px;">Selected Events</div>';
    breakdown.forEach(item => {
        const isPrimary = item.type === 'primary';
        const typeLabel = isPrimary ? 'Primary' : 'Add-on';
        const typeColor = isPrimary ? '#0071e3' : '#27ae60';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px;">
            <span>${isPrimary ? '<span style="color:#0071e3;">&#9670;</span>' : '&nbsp;&nbsp;'} ${item.eventName} <span style="color:${typeColor};font-size:12px;">(${typeLabel})</span></span>
            <span style="font-weight:600;">$${item.price.toFixed(2)}</span>
        </div>`;
    });

    breakdownEl.innerHTML = html;
    totalEl.innerHTML = `Total: <span style="color:#0071e3;">$${total.toFixed(2)}</span>`;
    summaryContainer.style.display = 'block';
}

// Load tournament configuration
function loadTournamentConfig() {
    const config = JSON.parse(localStorage.getItem('publicSiteConfig') || '{}');

    // Update page title
    if (config.tournamentName) {
        document.getElementById('tournament-title').textContent = config.tournamentName;
        document.getElementById('hero-title').textContent = config.tournamentName;
    }

    // Update subtitle (date + location)
    if (config.tournamentDate && config.location) {
        const safeTD = typeof config.tournamentDate === 'string' && config.tournamentDate.length === 10 ? config.tournamentDate + 'T12:00:00' : config.tournamentDate;
        const date = new Date(safeTD).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('hero-subtitle').textContent = `${date} • ${config.location}`;
    }

    // Update logo
    if (config.logo) {
        const logoImg = document.getElementById('tournament-logo');
        logoImg.src = config.logo;
        logoImg.classList.remove('hidden');
    }

    // Update hero background
    if (config.coverImage) {
        document.getElementById('hero-section').style.backgroundImage = `url(${config.coverImage})`;
    }

    // Update about section
    if (config.description) {
        document.getElementById('about-content').innerHTML = `<p>${config.description}</p>`;
    }

    // Update footer
    if (config.footerText) {
        document.getElementById('footer-text').textContent = config.footerText;
    }

    // Handle schedule visibility
    if (config.showSchedule) {
        document.getElementById('schedule-availability').classList.add('hidden');
        document.getElementById('public-schedule-container').classList.remove('hidden');
        loadPublicSchedule();
    } else {
        document.getElementById('schedule-availability').classList.remove('hidden');
        document.getElementById('public-schedule-container').classList.add('hidden');
    }

    // Handle results visibility
    if (config.showResults) {
        document.getElementById('results-availability').classList.add('hidden');
        document.getElementById('public-results-container').classList.remove('hidden');
        loadPublicResults();
    } else {
        document.getElementById('results-availability').classList.remove('hidden');
        document.getElementById('public-results-container').classList.add('hidden');
    }

    // Apply custom colors if provided
    if (config.primaryColor) {
        document.documentElement.style.setProperty('--accent-blue', config.primaryColor);
    }
}

// Load public schedule
function loadPublicSchedule() {
    const matches = db.load('matches');
    const competitors = db.load('competitors');
    const mats = db.load('mats');
    const container = document.getElementById('public-schedule-container');

    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Schedule coming soon.</p>';
        return;
    }

    container.innerHTML = '';

    matches.sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.matId - b.matId;
    }).forEach(match => {
        const red = competitors.find(c => c.id === match.redId);
        const blue = competitors.find(c => c.id === match.blueId);
        const mat = mats.find(m => m.id === match.matId);

        if (!red || !blue || !mat) return;

        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.innerHTML = `
            <div class="schedule-time">${match.time || 'TBD'}</div>
            <div class="schedule-mat">${mat.name}</div>
            <div class="schedule-competitors">
                <div>${red.firstName} ${red.lastName}</div>
                <div style="font-size: 1.2em; color: var(--text-secondary);">vs</div>
                <div>${blue.firstName} ${blue.lastName}</div>
            </div>
            <div class="schedule-division">${match.division}</div>
        `;
        container.appendChild(row);
    });
}

// Load public results
function loadPublicResults() {
    const results = JSON.parse(localStorage.getItem('publicResults') || '[]');
    const container = document.getElementById('public-results-container');

    if (results.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Results will be posted after the tournament.</p>';
        return;
    }

    container.innerHTML = '<div class="results-grid"></div>';
    const grid = container.querySelector('.results-grid');

    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${result.division}</h3>
            <div class="result-places">
                ${result.first ? `<div class="result-place"><span class="medal">🥇</span> ${result.first}</div>` : ''}
                ${result.second ? `<div class="result-place"><span class="medal">🥈</span> ${result.second}</div>` : ''}
                ${result.third ? `<div class="result-place"><span class="medal">🥉</span> ${result.third}</div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// Registration form handling
let currentRegistrationType = null;
let currentPhotoData = null;
let currentClubLogoData = null;

function showRegistrationForm(type) {
    currentRegistrationType = type;

    // Hide all forms
    document.querySelectorAll('.registration-form').forEach(form => {
        form.classList.add('hidden');
    });

    // Show selected form
    document.getElementById(`${type}-registration`).classList.remove('hidden');
    document.getElementById('registration-modal').classList.remove('hidden');

    // Load event checkboxes when competitor form is shown
    if (type === 'competitor') {
        loadPublicEventCheckboxes();
    }
}

function closeRegistrationForm() {
    document.getElementById('registration-modal').classList.add('hidden');
    currentRegistrationType = null;
    currentPhotoData = null;
    currentClubLogoData = null;
    pubSelectedEventOrder = [];
}

// Photo upload handlers
document.getElementById('pub-photo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentPhotoData = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('pub-club-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentClubLogoData = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Competitor registration (API-backed)
document.getElementById('public-competitor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate event selection
    if (pubSelectedEventOrder.length === 0) {
        alert('Please select at least one event to register for.');
        const container = document.getElementById('pub-event-checkboxes');
        if (container) {
            container.style.border = '2px solid #e74c3c';
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { container.style.border = '1px solid rgba(255,255,255,0.1)'; }, 3000);
        }
        return;
    }

    // Validate date of birth
    const dobValue = document.getElementById('pub-dateOfBirth').value;
    if (!dobValue) {
        alert('Please enter a date of birth.');
        return;
    }

    const dob = new Date(dobValue);
    const today = new Date();
    const hundredYearsAgo = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());

    if (dob > today) {
        alert('Date of birth cannot be in the future.');
        return;
    }
    if (dob < hundredYearsAgo) {
        alert('Please enter a valid date of birth.');
        return;
    }

    const eventTypes = db.load('eventTypes');
    const tournament = getActiveTournament();
    const pricingData = calculatePricingBreakdown(pubSelectedEventOrder, eventTypes, tournament);

    // Guardian email check for minors
    const guardianEmail = document.getElementById('pub-guardianEmail')?.value || null;
    const academyId = document.getElementById('pub-academyId')?.value || null;

    // Validate guardian email for minors
    if (dobValue) {
        const birth = new Date(dobValue);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        if (age < 18 && !guardianEmail) {
            alert('Competitors under 18 must provide a guardian email address.');
            return;
        }
    }

    const competitor = {
        firstName: document.getElementById('pub-firstName').value,
        lastName: document.getElementById('pub-lastName').value,
        dateOfBirth: new Date(dobValue).toISOString(),
        weight: parseFloat(document.getElementById('pub-weight').value),
        rank: document.getElementById('pub-rank').value,
        experience: parseFloat(document.getElementById('pub-experience').value),
        gender: document.getElementById('pub-gender').value,
        club: document.getElementById('pub-club').value,
        email: document.getElementById('pub-email').value,
        phone: document.getElementById('pub-phone').value,
        photo: currentPhotoData || null,
        clubLogo: currentClubLogoData || null,
        tournamentId: tournament?.id || null,
        events: [...pubSelectedEventOrder],
        primaryEventId: pubSelectedEventOrder[0] || null,
        pricing: pricingData,
        paymentStatus: 'unpaid',
        academyId: academyId || undefined,
        guardianEmail: guardianEmail || undefined,
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const res = await fetch('/api/registrations/competitor', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(competitor),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        const totalMsg = pricingData.total > 0 ? ` Total registration fee: $${pricingData.total.toFixed(2)}.` : '';
        showSuccessMessage(`Registration submitted successfully!${totalMsg} We will contact you via email with confirmation.`);
        closeRegistrationForm();
        pubSelectedEventOrder = [];
        e.target.reset();
    } catch (err) {
        alert(err.message || 'Registration failed. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Registration';
    }
});

// Instructor registration (API-backed)
document.getElementById('public-instructor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const instructor = {
        firstName: document.getElementById('pub-inst-firstName').value,
        lastName: document.getElementById('pub-inst-lastName').value,
        rank: document.getElementById('pub-inst-rank').value,
        club: document.getElementById('pub-inst-club').value,
        email: document.getElementById('pub-inst-email').value,
        phone: document.getElementById('pub-inst-phone').value,
        tournamentId: getActiveTournament()?.id || null,
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const res = await fetch('/api/registrations/instructor', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(instructor),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        showSuccessMessage('Instructor registration submitted successfully!');
        closeRegistrationForm();
        e.target.reset();
    } catch (err) {
        alert(err.message || 'Registration failed. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Registration';
    }
});

// Club registration (API-backed)
document.getElementById('public-club-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const club = {
        name: document.getElementById('pub-club-name').value,
        country: document.getElementById('pub-club-country').value,
        city: document.getElementById('pub-club-city').value,
        email: document.getElementById('pub-club-email').value,
        tournamentId: getActiveTournament()?.id || null,
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const res = await fetch('/api/registrations/club', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(club),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        showSuccessMessage('Dojo registration submitted successfully!');
        closeRegistrationForm();
        e.target.reset();
    } catch (err) {
        alert(err.message || 'Registration failed. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Registration';
    }
});

// Success message
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.textContent = message;

    const section = document.getElementById('register');
    const container = section.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);

    setTimeout(() => {
        messageDiv.remove();
    }, 5000);

    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Scroll animations
function setupScrollAnimations() {
    const elements = document.querySelectorAll('.registration-card, .schedule-row, .about-content');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in', 'visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

// Smooth scroll with offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80; // navbar height
            const targetPosition = target.offsetTop - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC AUTH — Login/Signup handlers
// ═══════════════════════════════════════════════════════════════════════════

function togglePublicAuth(e) {
    e.preventDefault();
    if (Auth.isLoggedIn()) {
        Auth.logout();
        return;
    }
    document.getElementById('public-auth-modal').classList.remove('hidden');
}

function closePublicAuth() {
    document.getElementById('public-auth-modal').classList.add('hidden');
}

function pubAuthSwitchTab(tab) {
    document.getElementById('pub-auth-login-form').classList.add('hidden');
    document.getElementById('pub-auth-signup-form').classList.add('hidden');
    document.getElementById('pub-auth-forgot-form').classList.add('hidden');
    document.querySelectorAll('.pub-auth-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
        document.getElementById('pub-auth-login-form').classList.remove('hidden');
        document.querySelector('.pub-auth-tab[data-tab="login"]').classList.add('active');
    } else if (tab === 'signup') {
        document.getElementById('pub-auth-signup-form').classList.remove('hidden');
        document.querySelector('.pub-auth-tab[data-tab="signup"]').classList.add('active');
    } else if (tab === 'forgot') {
        document.getElementById('pub-auth-forgot-form').classList.remove('hidden');
    }
    document.querySelectorAll('.pub-auth-error, .pub-auth-success').forEach(el => {
        el.classList.add('hidden');
        el.textContent = '';
    });
}

function showPubAuthError(formId, msg) {
    const el = document.getElementById(`pub-auth-${formId}-error`);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function showPubAuthSuccess(formId, msg) {
    const el = document.getElementById(`pub-auth-${formId}-success`);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

async function handlePublicLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('pub-login-btn');
    const loginEmail = document.getElementById('pub-auth-email').value;
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
        await Auth.login(loginEmail, document.getElementById('pub-auth-password').value);
        closePublicAuth();
    } catch (err) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
            const errEl = document.getElementById('pub-auth-login-error');
            if (errEl) {
                errEl.innerHTML = (err.error || 'Please verify your email address before logging in') +
                    '<br><button type="button" onclick="handlePublicResendVerification()" style="margin-top:8px;background:none;border:1px solid var(--accent,#dc2626);color:var(--accent,#dc2626);padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Resend Verification Email</button>';
                errEl.dataset.email = loginEmail;
                errEl.classList.remove('hidden');
            }
        } else {
            showPubAuthError('login', err.error || 'Login failed.');
        }
    } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
    }
}

async function handlePublicResendVerification() {
    const errEl = document.getElementById('pub-auth-login-error');
    const email = errEl?.dataset?.email;
    if (!email) return;
    try {
        await Auth.resendVerification(email);
        const succEl = document.getElementById('pub-auth-login-error');
        if (succEl) {
            succEl.className = 'pub-auth-success';
            succEl.textContent = 'A new verification link has been sent to your email. Please check your inbox.';
            succEl.classList.remove('hidden');
        }
    } catch (err) {
        showPubAuthError('login', err.error || 'Failed to resend verification email.');
    }
}

async function handlePublicSignup(e) {
    e.preventDefault();
    const pw = document.getElementById('pub-auth-signup-pw').value;
    const confirm = document.getElementById('pub-auth-signup-confirm').value;
    if (pw !== confirm) { showPubAuthError('signup', 'Passwords do not match.'); return; }
    const btn = document.getElementById('pub-signup-btn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
        const roles = [];
        document.querySelectorAll('.pub-role-pills input[type="checkbox"]:checked').forEach(cb => roles.push(cb.value));
        await Auth.signup({
            email: document.getElementById('pub-auth-signup-email').value,
            password: pw,
            firstName: document.getElementById('pub-auth-first').value,
            lastName: document.getElementById('pub-auth-last').value,
            roles,
        });
        showPubAuthSuccess('signup', 'Account created! Check your email to verify, then log in.');
    } catch (err) {
        const msg = err.errors ? err.errors.map(e => e.msg).join('. ') : (err.error || 'Signup failed.');
        showPubAuthError('signup', msg);
    } finally {
        btn.disabled = false; btn.textContent = 'Create Account';
    }
}

async function handlePublicForgot(e) {
    e.preventDefault();
    const btn = document.getElementById('pub-forgot-btn');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
        await Auth.forgotPassword(document.getElementById('pub-auth-forgot-email').value);
        showPubAuthSuccess('forgot', 'If an account with that email exists, a reset link has been sent.');
    } catch (err) {
        showPubAuthError('forgot', err.error || 'Something went wrong.');
    } finally {
        btn.disabled = false; btn.textContent = 'Send Reset Link';
    }
}

function updatePublicAuthNav(user) {
    const link = document.getElementById('nav-auth-link');
    if (!link) return;
    if (user) {
        link.innerHTML = `<span class="nav-auth-user"><span class="nav-auth-avatar">${(user.firstName||'?')[0].toUpperCase()}</span>${user.firstName}</span>`;
        link.title = 'Click to log out';
    } else {
        link.textContent = 'Login / Sign Up';
        link.title = '';
    }
}

// Public role pill toggle
document.addEventListener('click', (e) => {
    const pill = e.target.closest('.pub-role-pill');
    if (!pill) return;
    const cb = pill.querySelector('input[type="checkbox"]');
    if (e.target !== cb) cb.checked = !cb.checked;
    pill.classList.toggle('selected', cb.checked);
});

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMY AUTOCOMPLETE + MINOR GUARDIAN CHECK
// ═══════════════════════════════════════════════════════════════════════════

function checkPublicMinorStatus() {
    const dob = document.getElementById('pub-dateOfBirth')?.value;
    const guardianGroup = document.getElementById('pub-guardian-email-group');
    if (!dob || !guardianGroup) return;

    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age < 18) {
        guardianGroup.style.display = '';
        document.getElementById('pub-guardianEmail').required = true;
    } else {
        guardianGroup.style.display = 'none';
        document.getElementById('pub-guardianEmail').required = false;
        document.getElementById('pub-guardianEmail').value = '';
    }
}

function setupAcademyAutocomplete() {
    const input = document.getElementById('pub-academySearch');
    const dropdown = document.getElementById('pub-academy-autocomplete');
    const hiddenId = document.getElementById('pub-academyId');
    if (!input || !dropdown) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();

        if (q.length < 2) {
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
            hiddenId.value = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/academies/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                const academies = data.academies || [];

                if (academies.length === 0) {
                    dropdown.innerHTML = '<div class="autocomplete-item hint">No academies found</div>';
                    dropdown.style.display = 'block';
                    return;
                }

                dropdown.innerHTML = academies.map(a =>
                    `<div class="autocomplete-item" data-id="${a.id}" data-name="${a.name}">${a.name}</div>`
                ).join('');
                dropdown.style.display = 'block';
            } catch (err) {
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
            }
        }, 300);
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (!item || !item.dataset.id) return;
        input.value = item.dataset.name;
        hiddenId.value = item.dataset.id;
        dropdown.style.display = 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#pub-academySearch') && !e.target.closest('#pub-academy-autocomplete')) {
            dropdown.style.display = 'none';
        }
    });
}

// Initialize on page load
window.addEventListener('load', () => {
    loadTournamentConfig();
    setupScrollAnimations();
    setupAcademyAutocomplete();

    // Add loading class removal for smooth entrance
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);

    // Auth initialization
    Auth.onAuthChange = (user) => {
        updatePublicAuthNav(user);
    };
    Auth.init();

    // Check for verified=1 query param (redirect from email verification)
    if (new URLSearchParams(window.location.search).get('verified') === '1') {
        document.getElementById('public-auth-modal').classList.remove('hidden');
        const loginErr = document.getElementById('pub-auth-login-error');
        if (loginErr) {
            loginErr.textContent = 'Email verified! You can now log in.';
            loginErr.style.background = '#f0fdf4';
            loginErr.style.borderColor = '#86efac';
            loginErr.style.color = '#16a34a';
            loginErr.classList.remove('hidden');
        }
        // Clean URL
        history.replaceState(null, '', window.location.pathname);
    }
});

// Listen for config updates from admin
window.addEventListener('storage', (e) => {
    if (e.key === 'publicSiteConfig' || e.key === 'matches' || e.key === 'publicResults') {
        loadTournamentConfig();
    }
});

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!document.getElementById('registration-modal').classList.contains('hidden')) {
            closeRegistrationForm();
        }
        if (!document.getElementById('public-auth-modal').classList.contains('hidden')) {
            closePublicAuth();
        }
    }
});
