/**
 * admin.js — Taikai Super Admin Portal
 *
 * Admin dashboard for managing users, dojos, tournaments, payments,
 * credit packages, discount codes, and templates.
 */

// ── State ───────────────────────────────────────────────────────────────────
let allUsers = [];
let allDojos = [];
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
  // Guard: "YYYY-MM-DD" strings → local noon to avoid timezone shift
  const safe = (typeof d === 'string' && d.length === 10) ? d + 'T12:00:00' : d;
  return new Date(safe).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const safe = (typeof d === 'string' && d.length === 10) ? d + 'T12:00:00' : d;
  return new Date(safe).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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
    case 'users': loadUsers(); break;
    case 'dojos': loadDojos(); break;
    case 'tournaments': loadTournaments(); break;
    case 'payments': loadPayments(); break;
    case 'discounts': loadDiscounts(); break;
    case 'templates': break; // static content
    case 'judge-analytics': loadAdminJudgeAnalytics(); break;
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

    document.getElementById('stat-users').textContent = s.total_users || 0;
    document.getElementById('stat-dojos').textContent = s.total_dojos || 0;
    document.getElementById('stat-active-tournaments').textContent = s.active_tournaments || 0;
    document.getElementById('stat-registrations').textContent = s.total_registrations || 0;

    // Recent users
    const userList = document.getElementById('recent-users-list');
    if (data.recentUsers?.length) {
      userList.innerHTML = data.recentUsers.map(u => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${u.first_name || ''} ${u.last_name || ''}</strong>
            <span class="hint">${u.email}</span>
          </div>
          <span class="hint">${formatDate(u.created_at)}</span>
        </div>
      `).join('');
    } else {
      userList.innerHTML = '<p class="hint">No users yet.</p>';
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

// ── Users ───────────────────────────────────────────────────────────────────

async function loadUsers() {
  try {
    const data = await apiFetch('/api/super-admin/users');
    allUsers = data.users || [];
    renderUsers(allUsers);
  } catch (err) {
    console.error('Users load error:', err);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');
  const empty = document.getElementById('users-empty');

  if (!users.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.first_name || ''} ${u.last_name || ''}</strong></td>
      <td>${u.email}</td>
      <td>${u.dojo_name || '—'}</td>
      <td>${u.tournament_count}</td>
      <td>${formatDate(u.created_at)}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" onclick="viewUserDetail('${u.id}')" title="View Details">
          <i data-lucide="eye"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="showGrantCreditsForUser('${u.id}')" title="Grant Credits">
          <i data-lucide="coins"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="impersonateUser('${u.id}')" title="Login as User">
          <i data-lucide="log-in"></i>
        </button>
        <button class="btn btn-ghost btn-xs" onclick="showResetPasswordModal('${u.id}', '${esc(u.email)}')" title="Reset Password">
          <i data-lucide="key-round"></i>
        </button>
        <button class="btn btn-ghost btn-xs btn-danger" onclick="deleteUser('${u.id}', '${esc(u.email)}')" title="Delete User">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function filterUsers() {
  const q = document.getElementById('users-search').value.toLowerCase();
  const filtered = allUsers.filter(u =>
    `${u.first_name || ''} ${u.last_name || ''} ${u.email} ${u.dojo_name || ''}`.toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

async function viewUserDetail(userId) {
  const panel = document.getElementById('user-detail-panel');
  const content = document.getElementById('user-detail-content');
  const nameEl = document.getElementById('user-detail-name');

  panel.classList.remove('hidden');
  content.innerHTML = '<p class="hint">Loading...</p>';

  try {
    const data = await apiFetch(`/api/super-admin/users/${userId}`);
    const u = data.user;
    nameEl.textContent = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User Detail';

    let html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><span class="hint">Email:</span> ${u.email}</div>
        <div><span class="hint">Verified:</span> ${u.emailVerified ? '✓ Yes' : '✗ No'}</div>
        <div><span class="hint">Credits:</span> ${u.creditBalance || 0}</div>
        <div><span class="hint">Joined:</span> ${formatDate(u.createdAt)}</div>
      </div>
    `;

    // Tournaments owned
    if (data.tournaments?.length) {
      html += `<h4 style="margin:16px 0 8px;">Tournaments Owned (${data.tournaments.length})</h4>`;
      html += '<div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Competitors</th><th>Created</th></tr></thead><tbody>';
      data.tournaments.forEach(t => {
        html += `<tr><td>${t.name}</td><td>${statusBadge(t.status)}</td><td>${t.competitor_count || 0}</td><td>${formatDate(t.created_at)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    // Dojos owned
    if (data.dojos?.length) {
      html += `<h4 style="margin:16px 0 8px;">Dojos Owned (${data.dojos.length})</h4>`;
      html += '<div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Location</th><th>Members</th></tr></thead><tbody>';
      data.dojos.forEach(d => {
        html += `<tr><td>${d.name}</td><td>${[d.city, d.state].filter(Boolean).join(', ') || '—'}</td><td>${d.member_count}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    // Tournament memberships
    if (data.memberships?.length) {
      html += `<h4 style="margin:16px 0 8px;">Tournament Memberships (${data.memberships.length})</h4>`;
      html += '<div class="table-container"><table class="data-table"><thead><tr><th>Tournament</th><th>Role</th><th>Status</th><th>Applied</th></tr></thead><tbody>';
      data.memberships.forEach(m => {
        const role = m.staff_role ? `${m.role} (${m.staff_role})` : m.role;
        html += `<tr><td>${m.tournament_name}</td><td>${role}</td><td>${statusBadge(m.status)}</td><td>${formatDate(m.applied_at)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    if (!data.tournaments?.length && !data.dojos?.length && !data.memberships?.length) {
      html += '<p class="hint" style="margin-top:12px;">No tournaments, dojos, or memberships found for this user.</p>';
    }

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<p class="hint">Failed to load user details: ${esc(err.error || err.message || 'Unknown error')}</p>`;
  }
}

async function impersonateUser(userId) {
  if (!confirm('This will log you in as this user. Continue?')) return;
  try {
    const data = await apiFetch(`/api/super-admin/impersonate/${userId}`, { method: 'POST' });
    window.location.href = data.redirectUrl || '/';
  } catch (err) {
    alert('Failed to impersonate: ' + (err.error || err.message));
  }
}

// ── Reset User Password ─────────────────────────────────────────────────────

function showResetPasswordModal(userId, email) {
  document.getElementById('reset-password-user-id').value = userId;
  document.getElementById('reset-password-user-email').textContent = `User: ${email}`;
  document.getElementById('reset-password-new').value = '';
  document.getElementById('reset-password-confirm').value = '';
  document.getElementById('reset-password-status').textContent = '';
  document.getElementById('reset-password-status').className = 'form-status';
  showEl('reset-password-modal');
}

async function handleResetUserPassword(e) {
  e.preventDefault();
  const userId = document.getElementById('reset-password-user-id').value;
  const newPassword = document.getElementById('reset-password-new').value;
  const confirm = document.getElementById('reset-password-confirm').value;
  const btn = document.getElementById('reset-password-submit-btn');

  if (newPassword !== confirm) {
    showFormStatus('reset-password-status', 'Passwords do not match', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Resetting...';
  try {
    const data = await apiFetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
    showFormStatus('reset-password-status', '✓ ' + data.message, 'success');
    setTimeout(() => closeModal('reset-password-modal'), 1500);
  } catch (err) {
    showFormStatus('reset-password-status', err.error || 'Failed to reset password', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}

// ── Dojos ───────────────────────────────────────────────────────────────────

async function loadDojos() {
  try {
    const data = await apiFetch('/api/super-admin/dojos');
    allDojos = data.dojos || [];
    renderDojos(allDojos);
  } catch (err) {
    console.error('Dojos load error:', err);
  }
}

function renderDojos(dojos) {
  const tbody = document.getElementById('dojos-tbody');
  const empty = document.getElementById('dojos-empty');

  if (!dojos.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = dojos.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.owner_first_name || ''} ${d.owner_last_name || ''} ${d.owner_email ? `<span class="hint">(${d.owner_email})</span>` : ''}</td>
      <td>${[d.city, d.state].filter(Boolean).join(', ') || '—'}</td>
      <td>${d.member_count}</td>
      <td>${formatDate(d.created_at)}</td>
    </tr>
  `).join('');
}

function filterDojos() {
  const q = document.getElementById('dojos-search').value.toLowerCase();
  const filtered = allDojos.filter(d =>
    `${d.name} ${d.owner_first_name || ''} ${d.owner_last_name || ''} ${d.owner_email || ''} ${d.city || ''} ${d.state || ''}`.toLowerCase().includes(q)
  );
  renderDojos(filtered);
}

// ── Grant Credits ───────────────────────────────────────────────────────────

function showGrantCreditsModal() {
  document.getElementById('grant-user-select').innerHTML =
    '<option value="">Select a user...</option>' +
    allUsers.map(u => `<option value="${u.id}">${u.first_name || ''} ${u.last_name || ''} (${u.email})</option>`).join('');
  document.getElementById('grant-amount').value = '';
  document.getElementById('grant-description').value = '';
  document.getElementById('grant-status').textContent = '';
  showEl('grant-credits-modal');
}

function showGrantCreditsForUser(id) {
  showGrantCreditsModal();
  document.getElementById('grant-user-select').value = id;
}

async function handleGrantCredits(e) {
  e.preventDefault();
  const userId = document.getElementById('grant-user-select').value;
  const amount = parseInt(document.getElementById('grant-amount').value);
  const description = document.getElementById('grant-description').value;

  if (!userId) { showFormStatus('grant-status', 'Please select a user', 'error'); return; }

  try {
    const data = await apiFetch('/api/super-admin/credits/grant', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, description }),
    });
    showFormStatus('grant-status', `✓ ${data.message}. New balance: ${data.newBalance}`, 'success');
    setTimeout(() => { closeModal('grant-credits-modal'); loadUsers(); loadPayments(); }, 1500);
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
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs btn-danger" onclick="deleteTournament('${t.id}', '${esc(t.name)}')" title="Delete Tournament">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
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

async function deleteTournament(id, name) {
  if (!confirm(`Permanently delete "${name}"?\n\nThis will remove all registrations, brackets, and events. This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/tournaments/${id}`, { method: 'DELETE' });
    loadTournaments();
  } catch (err) {
    alert('Failed to delete tournament: ' + (err.error || err.message));
  }
}

async function deleteUser(id, email) {
  if (!confirm(`Permanently delete user "${email}"?\n\nThis will remove their account, registrations, and all associated data. This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    hideEl('user-detail-panel');
    loadUsers();
  } catch (err) {
    alert('Failed to delete user: ' + (err.error || err.message));
  }
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

// ── Judge Performance Analytics (Cross-Tournament) ─────────────────────────

async function loadAdminJudgeAnalytics() {
  const loading = document.getElementById('admin-ja-loading');
  const empty = document.getElementById('admin-ja-empty');
  const content = document.getElementById('admin-ja-content');

  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  if (content) content.classList.add('hidden');

  try {
    const data = await apiFetch('/api/admin/judge-analytics');

    if (loading) loading.classList.add('hidden');

    if (!data.judges || data.judges.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (content) content.classList.remove('hidden');

    // Summary
    document.getElementById('admin-ja-total-judges').textContent = data.summary.totalJudges || 0;
    document.getElementById('admin-ja-total-votes').textContent = data.summary.totalVotes || 0;

    const overallEl = document.getElementById('admin-ja-overall-consistency');
    const overallVal = data.summary.overallConsistency || 0;
    overallEl.textContent = overallVal + '%';
    overallEl.style.color = jaConsistencyColor(overallVal);

    // Per-judge table
    const tbody = document.getElementById('admin-ja-tbody');
    tbody.innerHTML = data.judges.map(j => {
      const consistency = parseFloat(j.consistency_rate) || 0;
      const consistencyColor = jaConsistencyColor(consistency);
      const avgTime = j.avg_vote_duration != null ? parseFloat(j.avg_vote_duration).toFixed(1) + 's' : '--';

      let biasHtml = '<span style="color:var(--text-muted);">None</span>';
      if (j.biasFlags && j.biasFlags.length > 0) {
        biasHtml = j.biasFlags.map(b =>
          `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.15);color:#ef4444;margin:2px;" title="Voted for ${esc(b.dojo)} ${b.rate}% of the time (${b.votesForDojo}/${b.matchesWithDojo} matches)">${esc(b.dojo)} (${b.rate}%)</span>`
        ).join(' ');
      }

      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);font-weight:600;">${esc(j.judge_name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);">${j.tournaments_judged || 0}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);">${j.total_votes}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);">
          <span style="font-weight:700;color:${consistencyColor};">${consistency}%</span>
          <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">(${j.votes_with_majority}/${j.total_votes})</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);">${avgTime}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--glass-border);">${biasHtml}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (empty) {
      empty.classList.remove('hidden');
      empty.innerHTML = `<h3>Failed to load analytics</h3><p>${esc(err.message || 'Unknown error')}</p>`;
    }
    console.error('[Admin Judge Analytics]', err);
  }
}

function jaConsistencyColor(pct) {
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#eab308';
  return '#ef4444';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
