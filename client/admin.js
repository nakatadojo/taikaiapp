/**
 * admin.js — Taikai Super Admin Portal
 *
 * Lean admin dashboard for managing event directors, payments, credit packages,
 * discount codes, tournaments overview, and templates.
 */

// ── State ───────────────────────────────────────────────────────────────────
let allDirectors = [];
let allTournaments = [];
let allDiscounts = [];
let allPackages = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatCents(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function statusBadge(status) {
  const classes = {
    draft: 'badge-draft', published: 'badge-active', completed: 'badge-completed',
    cancelled: 'badge-cancelled', archived: 'badge-draft',
  };
  return `<span class="badge ${classes[status] || 'badge-draft'}">${status}</span>`;
}

function showEl(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hideEl(id) { document.getElementById(id)?.classList.add('hidden'); }

function closeModal(id) { hideEl(id); }

function showFormStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'form-status ' + (type === 'error' ? 'error' : 'success');
}

// ── Auth Gate ───────────────────────────────────────────────────────────────

function authSwitchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  hideEl('auth-login-form');
  hideEl('auth-signup-form');
  hideEl('auth-forgot-form');

  if (tab === 'forgot') showEl('auth-forgot-form');
  else if (tab === 'signup') showEl('auth-signup-form');
  else showEl('auth-login-form');
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('auth-login-btn');
  const errEl = document.getElementById('auth-login-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  const loginEmail = document.getElementById('auth-login-email').value;

  try {
    const password = document.getElementById('auth-login-password').value;
    await Auth.login(loginEmail, password);

    // Check for super_admin role
    if (!Auth.hasRole('super_admin') && !Auth.hasRole('admin')) {
      errEl.textContent = 'Access denied. Super admin role required.';
      errEl.classList.remove('hidden');
      await Auth.logout();
      return;
    }

    hideEl('auth-gate');
    initDashboard();
  } catch (err) {
    if (err.code === 'EMAIL_NOT_VERIFIED') {
      errEl.innerHTML = (err.error || 'Please verify your email address before logging in') +
        '<br><button type="button" onclick="handleResendVerificationAdmin()" style="margin-top:8px;background:none;border:1px solid var(--accent,#dc2626);color:var(--accent,#dc2626);padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Resend Verification Email</button>';
      errEl.dataset.email = loginEmail;
    } else {
      errEl.textContent = err.error || 'Login failed';
    }
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleResendVerificationAdmin() {
  const errEl = document.getElementById('auth-login-error');
  const email = errEl.dataset.email;
  if (!email) return;
  try {
    await Auth.resendVerification(email);
    errEl.innerHTML = '';
    errEl.textContent = 'A new verification link has been sent to your email. Please check your inbox.';
    errEl.className = 'auth-success';
    errEl.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.error || 'Failed to resend verification email.';
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const btn = document.getElementById('auth-forgot-btn');
  const errEl = document.getElementById('auth-forgot-error');
  const succEl = document.getElementById('auth-forgot-success');
  errEl.classList.add('hidden');
  succEl.classList.add('hidden');
  btn.disabled = true;

  try {
    const email = document.getElementById('auth-forgot-email').value;
    await Auth.forgotPassword(email);
    succEl.textContent = 'If an account with that email exists, a reset link has been sent.';
    succEl.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.error || 'Request failed';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

async function handleLogout() {
  await Auth.logout();
  showEl('auth-gate');
}

// ── Init ────────────────────────────────────────────────────────────────────

Auth.onAuthChange = (user) => {
  if (user && (user.roles?.includes('super_admin') || user.roles?.includes('admin'))) {
    hideEl('auth-gate');
    document.getElementById('sidebar-name').textContent =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin';
    document.getElementById('sidebar-avatar').textContent =
      (user.firstName?.[0] || 'A').toUpperCase();
    initDashboard();
  } else {
    showEl('auth-gate');
  }
};

Auth.init();

// ── Navigation ──────────────────────────────────────────────────────────────

function switchView(view) {
  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (btn) btn.classList.add('active');

  // Show/hide views
  document.querySelectorAll('.admin-view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(view + '-view');
  if (target) target.classList.remove('hidden');

  // Load data for the view
  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'directors': loadDirectors(); break;
    case 'tournaments': loadTournaments(); break;
    case 'payments': loadPayments(); break;
    case 'discounts': loadDiscounts(); break;
    case 'templates': break; // static content
  }

  lucide.createIcons();
}

function switchTemplateTab(tab) {
  document.querySelectorAll('.template-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.template-tab[data-ttab="${tab}"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.template-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('template-' + tab);
  if (panel) panel.classList.remove('hidden');
}

// ── Dashboard ───────────────────────────────────────────────────────────────

async function initDashboard() {
  loadDashboard();
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/api/super-admin/stats');
    const s = data.stats;

    document.getElementById('stat-directors').textContent = s.total_directors || 0;
    document.getElementById('stat-active-tournaments').textContent = s.active_tournaments || 0;
    document.getElementById('stat-total-tournaments').textContent = s.total_tournaments || 0;
    document.getElementById('stat-registrations').textContent = s.total_registrations || 0;

    // Recent directors
    const dirList = document.getElementById('recent-directors-list');
    if (data.recentDirectors?.length) {
      dirList.innerHTML = data.recentDirectors.map(d => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${d.first_name} ${d.last_name}</strong>
            ${d.organization_name ? `<span class="hint">${d.organization_name}</span>` : ''}
          </div>
          <span class="hint">${formatDate(d.created_at)}</span>
        </div>
      `).join('');
    } else {
      dirList.innerHTML = '<p class="hint">No directors yet.</p>';
    }

    // Recent tournaments
    const tList = document.getElementById('recent-tournaments-list');
    if (data.recentTournaments?.length) {
      tList.innerHTML = data.recentTournaments.map(t => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${t.name}</strong>
            <span class="hint">${t.director_first_name || ''} ${t.director_last_name || ''}</span>
          </div>
          ${statusBadge(t.status)}
        </div>
      `).join('');
    } else {
      tList.innerHTML = '<p class="hint">No tournaments yet.</p>';
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ── Directors ───────────────────────────────────────────────────────────────

async function loadDirectors() {
  try {
    const data = await apiFetch('/api/super-admin/directors');
    allDirectors = data.directors || [];
    renderDirectors(allDirectors);
  } catch (err) {
    console.error('Directors load error:', err);
  }
}

function renderDirectors(directors) {
  const tbody = document.getElementById('directors-tbody');
  const empty = document.getElementById('directors-empty');

  if (!directors.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = directors.map(d => `
    <tr>
      <td><strong>${d.first_name} ${d.last_name}</strong></td>
      <td>${d.organization_name || '—'}</td>
      <td>${d.email}</td>
      <td>${d.credit_balance || 0}</td>
      <td>${d.tournament_count}</td>
      <td>${formatDate(d.created_at)}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" onclick="showGrantCreditsForDirector('${d.id}', '${d.first_name} ${d.last_name}')" title="Grant Credits">
          <i data-lucide="coins"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="impersonateDirector('${d.id}')" title="Login as Director">
          <i data-lucide="log-in"></i>
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function filterDirectors() {
  const q = document.getElementById('directors-search').value.toLowerCase();
  const filtered = allDirectors.filter(d =>
    `${d.first_name} ${d.last_name} ${d.email} ${d.organization_name || ''}`.toLowerCase().includes(q)
  );
  renderDirectors(filtered);
}

async function impersonateDirector(userId) {
  if (!confirm('This will log you in as this director. Continue?')) return;
  try {
    const data = await apiFetch(`/api/super-admin/impersonate/${userId}`, { method: 'POST' });
    window.location.href = data.redirectUrl || '/director.html';
  } catch (err) {
    alert('Failed to impersonate: ' + (err.error || err.message));
  }
}

// ── Grant Credits ───────────────────────────────────────────────────────────

function showGrantCreditsModal() {
  document.getElementById('grant-director-select').innerHTML =
    '<option value="">Select a director...</option>' +
    allDirectors.map(d => `<option value="${d.id}">${d.first_name} ${d.last_name} (${d.email})</option>`).join('');
  document.getElementById('grant-amount').value = '';
  document.getElementById('grant-description').value = '';
  document.getElementById('grant-status').textContent = '';
  showEl('grant-credits-modal');
}

function showGrantCreditsForDirector(id, name) {
  showGrantCreditsModal();
  document.getElementById('grant-director-select').value = id;
}

async function handleGrantCredits(e) {
  e.preventDefault();
  const userId = document.getElementById('grant-director-select').value;
  const amount = parseInt(document.getElementById('grant-amount').value);
  const description = document.getElementById('grant-description').value;

  if (!userId) { showFormStatus('grant-status', 'Please select a director', 'error'); return; }

  try {
    const data = await apiFetch('/api/super-admin/credits/grant', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, description }),
    });
    showFormStatus('grant-status', `✓ ${data.message}. New balance: ${data.newBalance}`, 'success');
    setTimeout(() => { closeModal('grant-credits-modal'); loadDirectors(); loadPayments(); }, 1500);
  } catch (err) {
    showFormStatus('grant-status', err.error || 'Failed to grant credits', 'error');
  }
}

// ── Tournaments ─────────────────────────────────────────────────────────────

async function loadTournaments() {
  try {
    const data = await apiFetch('/api/super-admin/tournaments');
    allTournaments = data.tournaments || [];
    renderTournaments(allTournaments);
  } catch (err) {
    console.error('Tournaments load error:', err);
  }
}

function renderTournaments(tournaments) {
  const tbody = document.getElementById('tournaments-tbody');
  const empty = document.getElementById('tournaments-empty');

  if (!tournaments.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = tournaments.map(t => `
    <tr>
      <td><strong>${t.name}</strong></td>
      <td>${t.director_first_name || ''} ${t.director_last_name || ''}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${t.competitor_count}</td>
      <td>${formatDate(t.created_at)}</td>
    </tr>
  `).join('');
}

function filterTournaments() {
  const q = document.getElementById('tournaments-search').value.toLowerCase();
  const filtered = allTournaments.filter(t =>
    `${t.name} ${t.director_first_name || ''} ${t.director_last_name || ''} ${t.status}`.toLowerCase().includes(q)
  );
  renderTournaments(filtered);
}

// ── Payments & Revenue ──────────────────────────────────────────────────────

async function loadPayments() {
  try {
    const [revData, pkgData] = await Promise.all([
      apiFetch('/api/super-admin/revenue'),
      apiFetch('/api/super-admin/credit-packages'),
    ]);

    // Revenue stats from monthly breakdown
    const monthly = revData.monthlyRevenue || [];
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalPurchased = 0, totalUsed = 0, totalGranted = 0, purchasesThisMonth = 0;
    monthly.forEach(m => {
      totalPurchased += m.credits_purchased || 0;
      totalUsed += m.credits_used || 0;
      totalGranted += m.credits_granted || 0;
      if (m.month === thisMonth) purchasesThisMonth = m.purchase_count || 0;
    });

    document.getElementById('stat-credits-purchased').textContent = totalPurchased;
    document.getElementById('stat-credits-used').textContent = totalUsed;
    document.getElementById('stat-credits-granted').textContent = totalGranted;
    document.getElementById('stat-purchases-month').textContent = purchasesThisMonth;

    // Transaction history
    renderTransactions(revData.transactions || []);

    // Credit packages
    allPackages = pkgData.packages || [];
    renderPackages(allPackages);

  } catch (err) {
    console.error('Payments load error:', err);
  }
}

function renderTransactions(transactions) {
  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = transactions.map(t => {
    const typeClass = t.type === 'purchase' ? 'badge-active' : t.type === 'grant' ? 'badge-info' : t.type === 'usage' ? 'badge-draft' : 'badge-draft';
    return `
      <tr>
        <td>${formatDateTime(t.created_at)}</td>
        <td>${t.first_name || ''} ${t.last_name || ''}</td>
        <td><span class="badge ${typeClass}">${t.type}</span></td>
        <td class="${t.amount >= 0 ? 'text-green' : 'text-red'}">${t.amount >= 0 ? '+' : ''}${t.amount}</td>
        <td>${t.balance_after}</td>
        <td>${t.description || '—'}</td>
      </tr>
    `;
  }).join('');
}

// ── Credit Packages ─────────────────────────────────────────────────────────

function renderPackages(packages) {
  const tbody = document.getElementById('packages-tbody');
  tbody.innerHTML = packages.map(p => `
    <tr>
      <td><strong>${p.label}</strong></td>
      <td><code>${p.slug}</code></td>
      <td>${p.credits}</td>
      <td>${formatCents(p.price_in_cents)}</td>
      <td>${formatCents(Math.round(p.price_in_cents / p.credits))}</td>
      <td>${p.active ? '<span class="badge badge-active">Yes</span>' : '<span class="badge badge-draft">No</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" onclick="editPackage('${p.id}')" title="Edit">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="deletePackage('${p.id}', '${p.label}')" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function showPackageModal(pkg = null) {
  document.getElementById('package-modal-title').textContent = pkg ? 'Edit Credit Package' : 'Add Credit Package';
  document.getElementById('package-edit-id').value = pkg?.id || '';
  document.getElementById('package-slug').value = pkg?.slug || '';
  document.getElementById('package-label').value = pkg?.label || '';
  document.getElementById('package-credits').value = pkg?.credits || '';
  document.getElementById('package-price').value = pkg?.price_in_cents || '';
  document.getElementById('package-sort').value = pkg?.sort_order || 0;
  document.getElementById('package-active').checked = pkg ? pkg.active : true;
  document.getElementById('package-status').textContent = '';
  showEl('package-modal');
}

function editPackage(id) {
  const pkg = allPackages.find(p => p.id === id);
  if (pkg) showPackageModal(pkg);
}

async function handleSavePackage(e) {
  e.preventDefault();
  const id = document.getElementById('package-edit-id').value;
  const body = {
    slug: document.getElementById('package-slug').value,
    label: document.getElementById('package-label').value,
    credits: parseInt(document.getElementById('package-credits').value),
    priceInCents: parseInt(document.getElementById('package-price').value),
    sortOrder: parseInt(document.getElementById('package-sort').value) || 0,
    active: document.getElementById('package-active').checked,
  };

  try {
    if (id) {
      await apiFetch(`/api/super-admin/credit-packages/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/super-admin/credit-packages', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal('package-modal');
    loadPayments();
  } catch (err) {
    showFormStatus('package-status', err.error || 'Failed to save package', 'error');
  }
}

async function deletePackage(id, label) {
  if (!confirm(`Delete package "${label}"?`)) return;
  try {
    await apiFetch(`/api/super-admin/credit-packages/${id}`, { method: 'DELETE' });
    loadPayments();
  } catch (err) {
    alert('Failed to delete package: ' + (err.error || err.message));
  }
}

// ── Discount Codes ──────────────────────────────────────────────────────────

async function loadDiscounts() {
  try {
    const data = await apiFetch('/api/admin/discount-codes');
    allDiscounts = data.discounts || data || [];
    renderDiscounts(allDiscounts);
  } catch (err) {
    console.error('Discounts load error:', err);
  }
}

function renderDiscounts(discounts) {
  const tbody = document.getElementById('discounts-tbody');
  const empty = document.getElementById('discounts-empty');

  if (!discounts.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = discounts.map(d => `
    <tr>
      <td><code>${d.code}</code></td>
      <td>${d.type}</td>
      <td>${d.type === 'percentage' ? d.value + '%' : '$' + d.value}</td>
      <td>${d.current_uses || 0} / ${d.max_uses || '∞'}</td>
      <td>${d.expires_at ? formatDate(d.expires_at) : 'Never'}</td>
      <td>${d.active ? '<span class="badge badge-active">Yes</span>' : '<span class="badge badge-draft">No</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" onclick='editDiscount(${JSON.stringify(d).replace(/'/g, "&#39;")})' title="Edit">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="deleteDiscount('${d.id}')" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function showDiscountModal(d = null) {
  document.getElementById('discount-modal-title').textContent = d ? 'Edit Discount Code' : 'Create Discount Code';
  document.getElementById('discount-edit-id').value = d?.id || '';
  document.getElementById('discount-code').value = d?.code || '';
  document.getElementById('discount-type').value = d?.type || 'percentage';
  document.getElementById('discount-value').value = d?.value || '';
  document.getElementById('discount-max-uses').value = d?.max_uses || '';
  document.getElementById('discount-expires').value = d?.expires_at ? d.expires_at.split('T')[0] : '';
  document.getElementById('discount-active').checked = d ? d.active : true;
  document.getElementById('discount-status').textContent = '';
  showEl('discount-modal');
}

function editDiscount(d) {
  showDiscountModal(d);
}

async function handleSaveDiscount(e) {
  e.preventDefault();
  const id = document.getElementById('discount-edit-id').value;
  const body = {
    code: document.getElementById('discount-code').value,
    type: document.getElementById('discount-type').value,
    value: parseFloat(document.getElementById('discount-value').value),
    maxUses: document.getElementById('discount-max-uses').value ? parseInt(document.getElementById('discount-max-uses').value) : null,
    expiresAt: document.getElementById('discount-expires').value || null,
    active: document.getElementById('discount-active').checked,
  };

  try {
    if (id) {
      await apiFetch(`/api/admin/discount-codes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/admin/discount-codes', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal('discount-modal');
    loadDiscounts();
  } catch (err) {
    showFormStatus('discount-status', err.error || 'Failed to save discount code', 'error');
  }
}

async function deleteDiscount(id) {
  if (!confirm('Delete this discount code?')) return;
  try {
    await apiFetch(`/api/admin/discount-codes/${id}`, { method: 'DELETE' });
    loadDiscounts();
  } catch (err) {
    alert('Failed to delete: ' + (err.error || err.message));
  }
}

// ── Password Strength (reused from auth gate) ───────────────────────────────

function updatePasswordStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[a-z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const bar = document.getElementById('password-strength-bar');
  const text = document.getElementById('password-strength-text');
  if (!bar) return;

  const levels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  bar.style.width = (score * 20) + '%';
  bar.style.background = colors[score] || '';
  if (text) text.textContent = levels[score] || '';
}
