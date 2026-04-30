/**
 * divisions-page.js
 *
 * Standalone MPA page for tournament divisions.
 * Always fetches fresh data from the server on load — no localStorage for division state.
 * Page URL: /director/tournaments/:id/divisions
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────────

const state = {
    tournamentId: null,
    tournament: null,
    eventTypes: [],     // non-default events with a division tree
    divisions: {},      // { [eventId]: { templates, generated, manual, updatedAt } }
    competitors: [],    // all competitors for this tournament
    activeEventId: null,
    editMode: false,
    weightUnit: 'kg',
};

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Extract tournament ID from URL: /director/tournaments/:id/divisions
        const match = location.pathname.match(/\/director\/tournaments\/([^/]+)\/divisions/);
        if (!match) { location.replace('/director/tournaments'); return; }
        state.tournamentId = match[1];

        // Auth check
        let authOk = false;
        try {
            const r = await fetch('/api/auth/me', { credentials: 'include' });
            authOk = r.ok;
        } catch { /* network error — show page anyway, API calls will fail gracefully */ }

        if (!authOk) {
            // No standalone login page — manage has an inline auth gate
            location.replace(`/director/tournaments/${state.tournamentId}/manage`);
            return;
        }

        // Wire sidebar navigation links
        _buildNav();

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Fetch everything fresh — each function handles its own errors
        await Promise.all([
            _fetchTournament(),
            _fetchDivisions(),
            _fetchCompetitors(),
        ]);

        // Render
        renderEventCards();
    } catch (err) {
        console.error('[divisions] boot error:', err);
    } finally {
        // Always reveal the body — prevents the permanent dark screen
        document.body.style.visibility = 'visible';
    }
});

// ── Navigation ──────────────────────────────────────────────────────────────

function _buildNav() {
    const id = state.tournamentId;
    const m = `/director/tournaments/${id}/manage`;
    const links = {
        'nav-dashboard':   m,
        'nav-competitors': `${m}#competitors`,
        'nav-clubs':       `${m}#clubs`,
        'nav-coaches':     `${m}#coaches`,
        'nav-officials':   `${m}#officials`,
        'nav-staff':       `${m}#staff`,
        'nav-teams':       `${m}#teams`,
        'nav-divisions':   `/director/tournaments/${id}/divisions`,
        'nav-brackets':    `${m}#brackets`,
        'nav-schedule':    `${m}#schedule`,
        'nav-staging':     `${m}#staging`,
        'nav-checkin':     `${m}#checkin`,
        'nav-results':     `${m}#results`,
        'nav-medical':     `${m}#medical-incidents`,
        'nav-analytics':   `${m}#judge-analytics`,
        'nav-settings':    `${m}#settings`,
    };
    for (const [elId, href] of Object.entries(links)) {
        const el = document.getElementById(elId);
        if (el) el.href = href;
    }

    // Load user info for sidebar footer
    fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
            const user = data.user || data;
            const name = document.getElementById('user-name');
            const avatar = document.getElementById('user-avatar');
            if (name && user.first_name) name.textContent = `${user.first_name} ${user.last_name || ''}`.trim();
            if (avatar && user.first_name) avatar.textContent = user.first_name[0].toUpperCase();
        })
        .catch(() => {});
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function _fetchTournament() {
    try {
        const res = await fetch(`/api/tournaments/${state.tournamentId}`, { credentials: 'include' });
        if (!res.ok) return;
        const { tournament } = await res.json();
        if (!tournament) return;
        state.tournament = tournament;
        state.weightUnit = tournament.weight_unit || 'kg';

        document.title = `Divisions – ${tournament.name} – TAIKAI`;
        const badge = document.getElementById('tournament-name-badge');
        if (badge) badge.textContent = tournament.name;

        state.eventTypes = (tournament.events || []).filter(e => !e.is_default);
    } catch (err) {
        console.warn('[divisions] fetchTournament failed:', err.message);
    }
}

async function _fetchDivisions() {
    try {
        const res = await fetch(`/api/tournaments/${state.tournamentId}/divisions`, { credentials: 'include' });
        if (!res.ok) return;
        const { generatedDivisions } = await res.json();
        state.divisions = _normalizeDivisions(generatedDivisions || {});
    } catch (err) {
        console.warn('[divisions] fetchDivisions failed:', err.message);
    }
}

async function _fetchCompetitors() {
    try {
        const res = await fetch(`/api/tournaments/${state.tournamentId}/competitors`, { credentials: 'include' });
        if (!res.ok) return;
        const { competitors } = await res.json();
        state.competitors = competitors || [];
    } catch (err) {
        console.warn('[divisions] fetchCompetitors failed:', err.message);
    }
}

// Normalize server format: each division value may be {name, competitors, createdAt} or plain array
function _normalizeDivisions(raw) {
    const out = {};
    for (const [evId, evData] of Object.entries(raw)) {
        const rawGen = evData?.generated || evData || {};
        const normGen = {};
        for (const [divName, divData] of Object.entries(rawGen)) {
            normGen[divName] = Array.isArray(divData) ? divData : (divData?.competitors || []);
        }
        out[evId] = {
            templates: evData?.templates || [],
            generated: normGen,
            manual:    evData?.manual    || {},
            updatedAt: evData?.updatedAt || null,
        };
    }
    return out;
}

// ── Event cards ────────────────────────────────────────────────────────────

function renderEventCards() {
    const grid = document.getElementById('division-event-cards');
    if (!grid) return;

    if (state.eventTypes.length === 0) {
        grid.innerHTML = '<p class="div-evt-empty">No event types yet. Create event types in Settings first.</p>';
        return;
    }

    grid.innerHTML = '';
    state.eventTypes.forEach(evt => {
        const evtData   = state.divisions[evt.id] || {};
        const generated = evtData.generated || {};
        const templates = evtData.templates || [];
        const isTreeTpl = templates.length > 0 && typeof templates[0]?.name === 'string';
        const divCount  = isTreeTpl ? templates.length : Object.keys(generated).length;
        const compCount = Object.values(generated).reduce((s, arr) => s + arr.length, 0);

        const card = document.createElement('div');
        card.className = 'glass-panel stat-card div-evt-card' +
            (String(evt.id) === String(state.activeEventId) ? ' active' : '');
        card.dataset.eventId = evt.id;
        const manageBase = `/director/tournaments/${state.tournamentId}/manage`;
        card.innerHTML = `
            <h3>${_esc(evt.name)}</h3>
            <div class="stat-number">${divCount}</div>
            <div class="div-evt-card-sub">${compCount} competitor${compCount !== 1 ? 's' : ''}</div>
            <div class="div-evt-card-actions">
                <button class="btn btn-secondary btn-small" onclick="viewEventDivisions('${_esc(String(evt.id))}')">View</button>
                <a class="btn btn-primary btn-small" href="${manageBase}#divisions-tree-${_esc(String(evt.id))}">Edit Tree</a>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── Division view ──────────────────────────────────────────────────────────

function viewEventDivisions(eventId) {
    state.activeEventId = eventId;

    const container = document.getElementById('division-template-container');
    const label     = document.getElementById('div-viewing-label');
    const selector  = document.getElementById('division-event-selector');

    if (selector)  selector.value = eventId;
    if (container) container.classList.remove('hidden');

    document.querySelectorAll('.div-evt-card').forEach(c => {
        c.classList.toggle('active', String(c.dataset.eventId) === String(eventId));
    });

    if (label) {
        const evt = state.eventTypes.find(e => String(e.id) === String(eventId));
        label.textContent = 'Viewing: ' + (evt?.name || eventId);
    }

    renderDivisions();
}

function closeDivisionsView() {
    state.activeEventId = null;
    document.getElementById('division-template-container')?.classList.add('hidden');
    document.getElementById('division-event-selector').value = '';
    document.querySelectorAll('.div-evt-card').forEach(c => c.classList.remove('active'));
}

function renderDivisions() { loadDivisions(); }

function loadDivisions() {
    const container = document.getElementById('divisions-container');
    if (!container) return;
    container.innerHTML = '';

    const eventId = state.activeEventId;
    if (!eventId) {
        container.innerHTML = '<p style="color:var(--text-secondary);">Select an event type to view divisions.</p>';
        return;
    }

    const hideEmpty = document.getElementById('hide-empty-divisions')?.checked || false;
    const evtData   = state.divisions[eventId];

    if (!evtData || !evtData.generated || Object.keys(evtData.generated).length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No divisions yet. Use <strong>Recalculate</strong> to assign competitors, or build a division tree in the manage page.</p>';
        return;
    }

    const generated = { ...evtData.generated };

    // Fill in empty template slots when "show all" is checked
    const isTreeTpl = evtData.templates.length > 0 && typeof evtData.templates[0]?.name === 'string';
    if (!hideEmpty && isTreeTpl) {
        evtData.templates.forEach(t => { if (!(t.name in generated)) generated[t.name] = []; });
    }

    const divisionKeys = [
        ...('__unassigned__' in generated ? ['__unassigned__'] : []),
        ...Object.keys(generated).filter(k => k !== '__unassigned__').sort(),
    ];

    if (divisionKeys.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No divisions with competitors yet.</p>';
        return;
    }

    const manualOverrides = evtData.manual || {};

    divisionKeys.forEach(divisionName => {
        const divCompetitors = generated[divisionName] || [];
        if (hideEmpty && divCompetitors.length === 0) return;

        const sheet = document.createElement('div');
        sheet.className = 'division-sheet';

        const displayName = divisionName === '__unassigned__' ? 'Unassigned' : divisionName;
        const tableRows = divCompetitors.map(comp => {
            const cid = _compId(comp);
            const isPending = comp.approved === false;
            const note = manualOverrides[cid]?.note || null;
            const pendingBadge = isPending ? ' <span style="background:#f59e0b;color:#fff;font-size:10px;padding:1px 5px;border-radius:8px;vertical-align:middle;">Pending</span>' : '';
            const noteBadge = note ? ` <span title="${_esc(note)}" style="cursor:help;font-size:11px;color:var(--accent);margin-left:4px;">&#x24D8;</span>` : '';
            const actionCell = state.editMode
                ? `<button class="btn btn-small" onclick="showMoveCompetitorModal('${_esc(divisionName)}','${_esc(cid)}')">Move</button>
                   <button class="btn btn-small btn-secondary" onclick="showCopyCompetitorModal('${_esc(divisionName)}','${_esc(cid)}')" style="margin-left:4px;">Copy</button>
                   <button class="btn btn-small btn-danger" onclick="removeCompetitorFromDivision('${_esc(divisionName)}','${_esc(cid)}')" style="margin-left:4px;">Remove</button>`
                : '';

            return `<tr style="${isPending ? 'opacity:0.7;' : ''}">
                <td>${_esc(comp.firstName || '?')} ${_esc(comp.lastName || '?')}${pendingBadge}${noteBadge}</td>
                <td>${_displayAge(comp)}</td>
                <td>${_esc(comp.gender || '-')}</td>
                <td>${comp.weight != null ? comp.weight + ' ' + state.weightUnit : '-'}</td>
                <td>${_esc(comp.rank || comp.belt_rank || '-')}</td>
                <td>${_esc(comp.club || comp.academy_name || '-')}</td>
                <td>${_esc(_getCountry(comp))}</td>
                <td style="white-space:nowrap;">${actionCell}</td>
            </tr>`;
        }).join('');

        sheet.innerHTML = `
            <div class="division-header">
                ${_esc(displayName)}
                <span style="font-weight:400;font-size:13px;color:var(--text-secondary);">${divCompetitors.length} competitor${divCompetitors.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="division-content">
                <table class="division-table">
                    <colgroup>
                        <col style="width:22%"><col style="width:6%"><col style="width:8%">
                        <col style="width:9%"><col style="width:10%"><col style="width:20%">
                        <col style="width:10%"><col style="width:15%">
                    </colgroup>
                    <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Weight</th><th>Rank</th><th>Dojo</th><th>Country</th><th></th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`;
        container.appendChild(sheet);
    });
}

// ── Edit mode ──────────────────────────────────────────────────────────────

function enterDivisionEditMode() {
    state.editMode = true;
    document.getElementById('div-view-actions').style.display = 'none';
    document.getElementById('div-edit-actions').style.display = '';
    document.getElementById('div-edit-btn').style.display = 'none';
    loadDivisions();
}

function cancelDivisionEdit() {
    state.editMode = false;
    document.getElementById('div-view-actions').style.display = '';
    document.getElementById('div-edit-actions').style.display = 'none';
    document.getElementById('div-edit-btn').style.display = '';
    _fetchDivisions().then(() => loadDivisions());
}

async function saveDivisionChanges() {
    const saveBtn = document.querySelector('#div-edit-actions .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
        // Denormalize back to server format {name, competitors, createdAt}
        const payload = {};
        for (const [evId, evData] of Object.entries(state.divisions)) {
            const serverGen = {};
            for (const [divName, comps] of Object.entries(evData.generated)) {
                serverGen[divName] = { name: divName, competitors: comps, createdAt: new Date().toISOString() };
            }
            payload[evId] = { ...evData, generated: serverGen };
        }

        const res = await fetch(`/api/tournaments/${state.tournamentId}/divisions/sync`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generatedDivisions: payload }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        state.editMode = false;
        document.getElementById('div-view-actions').style.display = '';
        document.getElementById('div-edit-actions').style.display = 'none';
        document.getElementById('div-edit-btn').style.display = '';
        await _fetchDivisions();
        loadDivisions();
        renderEventCards();
        showToast('Division changes saved.', 'success');
    } catch (e) {
        showToast('Save failed — please try again.', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
}

// ── Move / Copy / Remove ───────────────────────────────────────────────────

function showMoveCompetitorModal(fromDiv, compId) {
    _showDivisionPickerModal('Move', fromDiv, compId, (toDiv) => {
        const gen = state.divisions[state.activeEventId]?.generated;
        if (!gen) return;
        const comps = gen[fromDiv] || [];
        const idx   = comps.findIndex(c => _compId(c) === compId);
        if (idx === -1) return;
        const [comp] = comps.splice(idx, 1);
        if (!gen[toDiv]) gen[toDiv] = [];
        gen[toDiv].push(comp);
        // Record manual override
        if (!state.divisions[state.activeEventId].manual) state.divisions[state.activeEventId].manual = {};
        state.divisions[state.activeEventId].manual[compId] = { target: toDiv };
        // Remove empty non-unassigned divisions
        if (comps.length === 0 && fromDiv !== '__unassigned__') delete gen[fromDiv];
        loadDivisions();
    });
}

function showCopyCompetitorModal(fromDiv, compId) {
    _showDivisionPickerModal('Copy', fromDiv, compId, (toDiv) => {
        const gen = state.divisions[state.activeEventId]?.generated;
        if (!gen) return;
        const comp = (gen[fromDiv] || []).find(c => _compId(c) === compId);
        if (!comp) return;
        if (!gen[toDiv]) gen[toDiv] = [];
        if (!gen[toDiv].find(c => _compId(c) === compId)) gen[toDiv].push({ ...comp });
        loadDivisions();
    });
}

function removeCompetitorFromDivision(divName, compId) {
    const gen = state.divisions[state.activeEventId]?.generated;
    if (!gen) return;
    gen[divName] = (gen[divName] || []).filter(c => _compId(c) !== compId);
    // Record removal
    if (!state.divisions[state.activeEventId].manual) state.divisions[state.activeEventId].manual = {};
    state.divisions[state.activeEventId].manual[compId] = { target: '__removed__' };
    if (gen[divName].length === 0 && divName !== '__unassigned__') delete gen[divName];
    loadDivisions();
}

function _showDivisionPickerModal(action, fromDiv, compId, onConfirm) {
    const gen = state.divisions[state.activeEventId]?.generated || {};
    const otherDivs = Object.keys(gen).filter(d => d !== fromDiv);

    let overlay = document.getElementById('_div-picker-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = '_div-picker-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const options = otherDivs.map(d =>
        `<option value="${_esc(d)}">${_esc(d === '__unassigned__' ? 'Unassigned' : d)}</option>`
    ).join('');

    overlay.innerHTML = `
        <div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:24px;max-width:400px;width:90%;color:var(--text-primary);">
            <h3 style="margin:0 0 16px;">${action} Competitor</h3>
            <div style="margin-bottom:16px;">
                <label style="display:block;margin-bottom:6px;font-size:13px;">Destination Division</label>
                <select id="_div-picker-select" style="width:100%;padding:10px;border-radius:8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--glass-border);">
                    ${options}
                    <option value="__new__">+ New division…</option>
                </select>
                <input id="_div-picker-new" type="text" placeholder="New division name" style="display:none;width:100%;margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--glass-border);">
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('_div-picker-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" id="_div-picker-ok">${action}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const sel = overlay.querySelector('#_div-picker-select');
    const newInput = overlay.querySelector('#_div-picker-new');
    sel.addEventListener('change', () => {
        newInput.style.display = sel.value === '__new__' ? '' : 'none';
    });

    overlay.querySelector('#_div-picker-ok').onclick = () => {
        let toDiv = sel.value;
        if (toDiv === '__new__') {
            toDiv = newInput.value.trim();
            if (!toDiv) { showToast('Enter a division name', 'error'); return; }
        }
        overlay.remove();
        onConfirm(toDiv);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Add custom division ────────────────────────────────────────────────────

function addCustomDivision() {
    const eventId = state.activeEventId;
    if (!eventId) { showToast('Select an event first', 'error'); return; }

    let overlay = document.getElementById('add-division-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'add-division-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:24px;max-width:400px;width:90%;color:var(--text-primary);">
            <h3 style="margin:0 0 8px;">Add Division</h3>
            <p style="margin:0 0 16px;font-size:13px;color:var(--text-secondary);">Creates an empty group for walk-ins, exhibitions, or any group outside the criteria tree.</p>
            <div style="margin-bottom:16px;">
                <label style="display:block;margin-bottom:6px;font-size:13px;">Division Name</label>
                <input id="add-division-name" class="form-input" type="text" placeholder="e.g. Open Division, Exhibition" style="width:100%;" autofocus>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('add-division-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmAddCustomDivision()">Add</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    setTimeout(() => document.getElementById('add-division-name')?.focus(), 50);
    document.getElementById('add-division-name')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmAddCustomDivision();
    });
}

function confirmAddCustomDivision() {
    const name = document.getElementById('add-division-name')?.value.trim();
    if (!name) { showToast('Please enter a division name', 'error'); return; }

    const eventId = state.activeEventId;
    if (!state.divisions[eventId]) state.divisions[eventId] = { templates: [], generated: {}, manual: {} };
    if (!state.divisions[eventId].generated) state.divisions[eventId].generated = {};
    if (state.divisions[eventId].generated[name] !== undefined) {
        showToast(`A division named "${name}" already exists`, 'error');
        return;
    }
    state.divisions[eventId].generated[name] = [];
    document.getElementById('add-division-overlay')?.remove();
    loadDivisions();
}

// ── Delete divisions ───────────────────────────────────────────────────────

async function deleteDivisions() {
    const eventId = state.activeEventId;
    if (!eventId) return;
    const confirmed = await showConfirm(
        'Delete all divisions for this event? This cannot be undone.',
        { confirmText: 'Delete', danger: true }
    );
    if (!confirmed) return;
    if (state.divisions[eventId]) state.divisions[eventId].generated = {};
    await saveDivisionChanges();
    closeDivisionsView();
    renderEventCards();
}

// ── Recalculate ────────────────────────────────────────────────────────────

async function resyncDivisions() {
    const confirmed = await showConfirm(
        `<strong>Recalculate Divisions</strong><br><br>` +
        `Reruns division assignment logic against current criteria. ` +
        `Any competitors you manually moved will be returned to their criteria-assigned position.<br><br>` +
        `Do you want to continue?`,
        { confirmText: 'Recalculate', danger: false }
    );
    if (!confirmed) return;

    const btn = document.getElementById('resync-divisions-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Recalculating…'; }
    try {
        const res = await fetch(`/api/tournaments/${state.tournamentId}/divisions/auto-assign`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { generatedDivisions } = await res.json();
        state.divisions = _normalizeDivisions(generatedDivisions || {});
        loadDivisions();
        renderEventCards();
        showToast('Divisions recalculated.', 'success');
    } catch (e) {
        showToast('Recalculate failed — please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '↺ Recalculate'; }
    }
}

// ── Bracket generator ──────────────────────────────────────────────────────

function showBracketGenerator() {
    const modal = document.getElementById('bracket-generator-modal');
    if (!modal) return;

    // Populate division checklist for the active event
    _populateBracketChecklist();
    updateBracketTypeOptions();
    _updateBracketSelectedCount();
    modal.classList.remove('hidden');
}

function hideBracketGenerator() {
    document.getElementById('bracket-generator-modal')?.classList.add('hidden');
}

function _populateBracketChecklist() {
    const list = document.getElementById('bracket-division-checklist');
    if (!list) return;
    const evtData = state.divisions[state.activeEventId] || {};
    const generated = evtData.generated || {};
    const divNames = [
        ...('__unassigned__' in generated ? ['__unassigned__'] : []),
        ...Object.keys(generated).filter(k => k !== '__unassigned__').sort(),
    ];
    list.innerHTML = divNames.map(name => {
        const comps = generated[name] || [];
        const label = name === '__unassigned__' ? 'Unassigned' : name;
        return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;" data-div="${_esc(name)}" data-count="${comps.length}">
            <input type="checkbox" name="bracket-division" value="${_esc(name)}" checked>
            <span>${_esc(label)}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-secondary);">${comps.length} competitor${comps.length !== 1 ? 's' : ''}</span>
        </label>`;
    }).join('');
    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', _updateBracketSelectedCount);
    });
    _updateBracketSelectedCount();
}

function _filterBracketChecklist() {
    const search  = (document.getElementById('division-filter-search')?.value || '').toLowerCase();
    const onlyHas = document.getElementById('division-filter-has-comps')?.checked || false;
    document.querySelectorAll('#bracket-division-checklist label').forEach(label => {
        const name  = (label.dataset.div || '').toLowerCase();
        const count = parseInt(label.dataset.count || '0', 10);
        const matchText = !search || name.includes(search);
        const matchComp = !onlyHas || count > 0;
        label.style.display = matchText && matchComp ? '' : 'none';
    });
}

function setBracketDivisionChecks(val) {
    document.querySelectorAll('#bracket-division-checklist input[type=checkbox]').forEach(cb => { cb.checked = val; });
    _updateBracketSelectedCount();
}

function _updateBracketSelectedCount() {
    const n = document.querySelectorAll('#bracket-division-checklist input[type=checkbox]:checked').length;
    const countEl = document.getElementById('brk-selected-count');
    const pluralEl = document.getElementById('brk-selected-plural');
    if (countEl) countEl.textContent = n;
    if (pluralEl) pluralEl.textContent = n === 1 ? '' : 's';
    const prog = document.getElementById('bracket-division-progress');
    const total = document.querySelectorAll('#bracket-division-checklist input[type=checkbox]').length;
    if (prog) prog.textContent = `${n} / ${total} selected`;
}

const BRACKET_FORMATS = {
    kumite:       ['single-elimination','double-elimination','repechage','round-robin','round-robin-pools'],
    'kata-flags': ['single-elimination','round-robin','ranking-list'],
    'kata-points':['single-elimination','round-robin','ranking-list'],
    kobudo:       ['single-elimination','round-robin','ranking-list'],
};
const FORMAT_LABELS = {
    'single-elimination': 'Single Elimination',
    'double-elimination': 'Double Elimination',
    repechage:            'Repechage',
    'round-robin':        'Round Robin',
    'round-robin-pools':  'Round Robin + Elimination',
    'ranking-list':       'Ranking List',
};

function _setBrkCompType(type) {
    document.getElementById('bracket-scoreboard-type').value = type;
    document.querySelectorAll('#brk-comp-pills .brk-pill').forEach(p => {
        p.classList.toggle('selected', p.dataset.value === type);
    });
    updateBracketTypeOptions();
}

function updateBracketTypeOptions() {
    const type = document.getElementById('bracket-scoreboard-type')?.value || 'kumite';
    const formats = BRACKET_FORMATS[type] || BRACKET_FORMATS.kumite;
    const pillsEl = document.getElementById('brk-format-pills');
    const currentFmt = document.getElementById('bracket-type')?.value || formats[0];
    if (pillsEl) {
        pillsEl.innerHTML = formats.map(f =>
            `<button type="button" class="brk-pill${f === currentFmt ? ' selected' : ''}" data-value="${f}" onclick="_setBrkFormat('${f}')">${FORMAT_LABELS[f]}</button>`
        ).join('');
    }
    if (!formats.includes(currentFmt)) _setBrkFormat(formats[0]);
}

function _setBrkFormat(fmt) {
    const sel = document.getElementById('bracket-type');
    if (sel) sel.value = fmt;
    document.querySelectorAll('#brk-format-pills .brk-pill').forEach(p => {
        p.classList.toggle('selected', p.dataset.value === fmt);
    });
    _updateBracketDivisionFlags();
}

function _updateBracketDivisionFlags() { /* bracket conflict detection — stub */ }
function _uncheckFlaggedDivisions() { /* stub */ }
function _onSeedingMethodChange() { /* stub */ }

function generateBrackets(e) {
    e.preventDefault();
    // Bracket generation requires the full bracket engine in manage.
    // Redirect there — divisions data is already saved to DB so it'll be current.
    hideBracketGenerator();
    showToast('Opening bracket generator…', 'info');
    setTimeout(() => {
        location.href = `/director/tournaments/${state.tournamentId}/manage#brackets`;
    }, 600);
}

// ── Mobile sidebar ─────────────────────────────────────────────────────────

function toggleMobileSidebar() {
    document.getElementById('app-sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
}
function closeMobileSidebar() {
    document.getElementById('app-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _compId(comp) {
    return comp.id || comp._id || `${comp.firstName}_${comp.lastName}_${comp.dateOfBirth}`;
}

function _displayAge(comp) {
    if (!comp) return '-';
    if (comp.dateOfBirth || comp.date_of_birth || comp.dob) {
        const dob = comp.dateOfBirth || comp.date_of_birth || comp.dob;
        const ref = state.tournament?.date ? new Date(state.tournament.date + 'T12:00:00') : new Date();
        const d = new Date(dob.length === 10 ? dob + 'T12:00:00' : dob);
        const method = state.tournament?.age_calculation_method || state.tournament?.ageCalculationMethod || 'aau-standard';
        let age;
        if (method === 'wkf-standard') {
            const dec31 = new Date(ref.getFullYear(), 11, 31);
            age = dec31.getFullYear() - d.getFullYear();
            const md = dec31.getMonth() - d.getMonth();
            if (md < 0 || (md === 0 && dec31.getDate() < d.getDate())) age--;
        } else {
            age = ref.getFullYear() - d.getFullYear();
            const md = ref.getMonth() - d.getMonth();
            if (md < 0 || (md === 0 && ref.getDate() < d.getDate())) age--;
        }
        if (isNaN(age) || age <= 0 || age > 120) return '-';
        return age;
    }
    return comp.age != null && comp.age > 0 ? comp.age : '-';
}

function _getCountry(comp) {
    if (comp.country) return comp.country;
    return '-';
}
