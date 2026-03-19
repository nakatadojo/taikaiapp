/**
 * client/division-tree.js
 *
 * DivisionTreeBuilder - visual horizontal-grid tree builder for Taikai.
 * Creates a self-contained class that renders a left-to-right grid where
 * each column = one split criteria level and each row = one leaf division.
 * Parents span vertically via HTML <table> rowspan.
 *
 * Usage:
 *   const builder = new DivisionTreeBuilder(containerEl, {
 *     eventId: 'uuid',
 *     eventName: 'Kata',
 *     onTreeChange: (tree) => { ... }
 *   });
 *   builder.loadTree(treeJSON); // or null for empty tree
 */
(function () {
  'use strict';

  // Shared clipboard — persists across all tree builder instances so the
  // user can copy subdivisions from one event and paste into another.
  let _sharedClipboard = null;

  const RANK_ORDER = [
    '10th kyu', '9th kyu', '8th kyu', '7th kyu', '6th kyu', '5th kyu',
    '4th kyu', '3rd kyu', '2nd kyu', '1st kyu',
    '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
  ];

  const CRITERIA_LABELS = {
    gender: 'Gender',
    age: 'Age Range',
    rank: 'Rank / Belt',
    weight: 'Weight Class',
    experience: 'Experience',
    custom: 'Custom',
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // -----------------------------------------------------------------
  class DivisionTreeBuilder {
    constructor(container, options = {}) {
      this.container = container;
      this.eventId = options.eventId || null;
      this.eventName = options.eventName || 'Event';
      this.onTreeChange = options.onTreeChange || null;
      this.tree = null;
      this._activeMenu = null;
      this._currentSplitType = 'gender';
      this._boundClose = this._closeMenu.bind(this);
    }

    /** Load (or replace) the tree. Pass null to start empty. */
    loadTree(tree) {
      this.tree = tree ? JSON.parse(JSON.stringify(tree)) : this._emptyTree();
      // Back-compat: trees saved before weight-unit support default to kg
      if (!this.tree._weightUnit) this.tree._weightUnit = 'kg';
      this.render();
    }

    getTree() { return this.tree; }

    _emptyTree() {
      return { id: _uuid(), label: this.eventName, codePrefix: '', criteriaType: null, criteriaValue: null, children: [], _weightUnit: 'kg' };
    }

    // -- Weight unit helpers ---------------------------------------
    _getWeightUnit() { return this.tree._weightUnit || 'kg'; }

    _toggleWeightUnit() {
      const from = this._getWeightUnit();
      const to   = from === 'kg' ? 'lbs' : 'kg';
      if (!confirm(`Convert all weight values from ${from.toUpperCase()} to ${to.toUpperCase()}? This will recalculate all weight ranges.`)) return;
      this._convertAllWeights(this.tree, from, to);
      this.tree._weightUnit = to;
      this._changed(true);
      this._toast(`Weight unit changed to ${to.toUpperCase()}`);
    }

    _convertAllWeights(node, from, to) {
      if (node.criteriaType === 'weight' && node.criteriaValue) {
        const cv = node.criteriaValue;
        const factor = from === 'kg' ? 2.20462 : 0.453592;
        // Min: always convert. Max: if it's the sentinel (>=990), keep as 999.
        cv.min = Math.round((cv.min || 0) * factor);
        cv.max = cv.max >= 990 ? 999 : Math.round(cv.max * factor);
      }
      (node.children || []).forEach(c => this._convertAllWeights(c, from, to));
    }

    // -- Tree traversal helpers ------------------------------------
    _leafCount(node) {
      if (!node.children || node.children.length === 0) return 1;
      return node.children.reduce((s, c) => s + this._leafCount(c), 0);
    }

    _maxDepth(node, d = 0) {
      if (!node.children || node.children.length === 0) return d;
      return Math.max(...node.children.map(c => this._maxDepth(c, d + 1)));
    }

    _allLeaves(node) {
      if (!node.children || node.children.length === 0) return [node];
      return node.children.flatMap(c => this._allLeaves(c));
    }

    _treeHasCriteria(node, type) {
      if (node.criteriaType === type) return true;
      return (node.children || []).some(c => this._treeHasCriteria(c, type));
    }

    _findNode(id, node) {
      node = node || this.tree;
      if (node.id === id) return node;
      for (const c of (node.children || [])) {
        const f = this._findNode(id, c);
        if (f) return f;
      }
      return null;
    }

    _findParent(id, node, parent) {
      node = node || this.tree;
      if (node.id === id) return parent || null;
      for (const c of (node.children || [])) {
        const f = this._findParent(id, c, node);
        if (f !== undefined) return f;
      }
      return undefined;
    }

    _pathToLeaf(leafId, node, path) {
      node = node || this.tree;
      path = path || [];
      const p = [...path, node];
      if (node.id === leafId) return p;
      for (const c of (node.children || [])) {
        const f = this._pathToLeaf(leafId, c, p);
        if (f) return f;
      }
      return null;
    }

    _cloneSubtree(node) {
      return { ...node, id: _uuid(), children: (node.children || []).map(c => this._cloneSubtree(c)) };
    }

    // -- Render ----------------------------------------------------
    render() {
      this._closeMenu();
      document.removeEventListener('click', this._boundClose);

      // ── Scroll preservation ──────────────────────────────────────
      // Root problem: when innerHTML is cleared any focused element
      // inside the container loses focus. The browser then moves focus
      // to document.body and scrolls the window to position 0 — this
      // happens synchronously, before we can restore scrollTop.
      //
      // Fix in two layers:
      //  1. Move focus to a safe element OUTSIDE the container using
      //     { preventScroll: true } so the browser never triggers a
      //     scroll-to-focus during the DOM wipe.
      //  2. Keep the container's minHeight while it is empty so
      //     fsBody.scrollHeight stays above the saved scrollTop (the
      //     browser would otherwise clamp scrollTop to 0 automatically).
      const fsBody = this.container.closest('.dtb-fs-body');
      const savedTop  = fsBody ? fsBody.scrollTop  : 0;
      const savedLeft = fsBody ? fsBody.scrollLeft : 0;

      // Step 1 — steal focus before the wipe
      if (document.activeElement && this.container.contains(document.activeElement)) {
        const safeEl = this.container.closest('.dtb-fs-modal')?.querySelector('.dtb-fs-hdr button');
        if (safeEl) safeEl.focus({ preventScroll: true });
        else document.activeElement.blur();
      }

      // Step 2 — hold content height so scrollHeight doesn't collapse.
      // IMPORTANT: this.container has height:100% (= fsBody.clientHeight),
      // so offsetHeight is the viewport height, NOT the scroll content height.
      // We must guarantee fsBody.scrollHeight >= savedTop + fsBody.clientHeight
      // so the browser never clamps scrollTop below savedTop.
      const neededH = fsBody
        ? Math.max(savedTop + fsBody.clientHeight + 20, fsBody.scrollHeight)
        : this.container.offsetHeight;
      this.container.style.minHeight = neededH + 'px';

      this.container.innerHTML = '';
      this.container.className = 'dtb-wrapper';
      this.container.appendChild(this._buildToolbar());
      const scroll = document.createElement('div');
      scroll.className = 'dtb-scroll';
      scroll.appendChild(this._buildGrid());
      this.container.appendChild(scroll);
      document.addEventListener('click', this._boundClose);

      // Restore scroll, then release the height pin
      if (fsBody) {
        fsBody.scrollTop  = savedTop;
        fsBody.scrollLeft = savedLeft;
      }
      this.container.style.minHeight = '';
    }

    // Returns a short human-readable description of a node's criteria value
    _criteriaDetail(node) {
      const cv = node.criteriaValue;
      if (!cv) return '';
      switch (node.criteriaType) {
        case 'age':
          if (cv.min == null && cv.max == null) return '';
          return cv.max >= 99 ? `${cv.min}+ yrs` : `${cv.min}-${cv.max} yrs`;
        case 'weight': {
          if (cv.min == null && cv.max == null) return '';
          const wu = this._getWeightUnit();
          return cv.max >= 999 ? `${cv.min}+ ${wu}` : `${cv.min}-${cv.max} ${wu}`;
        }
        case 'experience':
          if (cv.min == null && cv.max == null) return '';
          return cv.max >= 99 ? `${cv.min}+ yrs exp` : `${cv.min}-${cv.max} yrs exp`;
        case 'rank':
          if (!cv.rankMin && !cv.rankMax) return '';
          if (cv.rankMin === cv.rankMax) return cv.rankMin || '';
          return `${cv.rankMin || '?'} \u2192 ${cv.rankMax || '?'}`;
        case 'gender':
        case 'custom':
        default:
          return ''; // label already is the value
      }
    }

    _buildToolbar() {
      const bar = document.createElement('div');
      bar.className = 'dtb-toolbar';

      const leaves = this.tree.children.length > 0 ? this._allLeaves(this.tree) : [];
      const info = document.createElement('span');
      info.className = 'dtb-leaf-count';
      info.textContent = leaves.length > 0
        ? `${leaves.length} division${leaves.length !== 1 ? 's' : ''} will be generated`
        : 'No splits yet \u2014 click + Split to begin';
      bar.appendChild(info);

      const btns = document.createElement('div');
      btns.className = 'dtb-toolbar-btns';

      // Weight unit toggle — only shown if tree has any weight splits
      const hasWeight = this._treeHasCriteria(this.tree, 'weight');
      if (hasWeight) {
        const unit = this._getWeightUnit();
        const unitBtn = document.createElement('button');
        unitBtn.className = 'btn btn-secondary btn-small';
        unitBtn.title = `Currently in ${unit.toUpperCase()}. Click to convert all weight values.`;
        unitBtn.innerHTML = `&#x2696; ${unit.toUpperCase()} &rarr; ${unit === 'kg' ? 'LBS' : 'KG'}`;
        unitBtn.onclick = () => this._toggleWeightUnit();
        btns.appendChild(unitBtn);
      }

      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-secondary btn-small';
      prevBtn.textContent = 'Preview';
      prevBtn.onclick = () => this._showPreview();
      btns.appendChild(prevBtn);

      // "Generate Divisions" removed from toolbar — divisions are compiled
      // automatically when the modal is closed via "Save & Close".

      bar.appendChild(btns);
      return bar;
    }

    _buildGrid() {
      const leaves = this.tree.children.length > 0 ? this._allLeaves(this.tree) : [];

      if (leaves.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dtb-empty';
        const eid = _esc(this.eventId || '');
        empty.innerHTML = `
          <div class="dtb-empty-icon">&#x1F333;</div>
          <p>No division splits yet for <strong>${_esc(this.eventName)}</strong>.</p>
          <p class="hint">Click the button below to define your first split criteria (Gender, Age, Rank, etc.).</p>
          <button class="btn btn-primary" onclick="(window._dtbRegistry&&window._dtbRegistry['${eid}']||{showSplitDialog:function(){}}).showSplitDialog('${_esc(this.tree.id)}')">+ Add First Split</button>
        `;
        return empty;
      }

      const maxDepth = this._maxDepth(this.tree);
      const rendered = new Set();

      // Build column header labels (criteria type per depth)
      const colLabels = new Array(maxDepth).fill('');
      const labelWalk = (node, d) => {
        if (d > 0 && node.criteriaType && !colLabels[d - 1]) {
          colLabels[d - 1] = CRITERIA_LABELS[node.criteriaType] || node.criteriaType;
        }
        for (const c of (node.children || [])) labelWalk(c, d + 1);
      };
      labelWalk(this.tree, 0);

      const table = document.createElement('table');
      table.className = 'dtb-table';

      // Header
      const thead = document.createElement('thead');
      const hrow = document.createElement('tr');
      for (let d = 0; d < maxDepth; d++) {
        const th = document.createElement('th');
        th.className = 'dtb-col-header';
        th.textContent = colLabels[d] || '';
        hrow.appendChild(th);
      }
      const thAct = document.createElement('th');
      thAct.className = 'dtb-col-header';
      hrow.appendChild(thAct);
      thead.appendChild(hrow);
      table.appendChild(thead);

      // Body
      const tbody = document.createElement('tbody');
      for (const leaf of leaves) {
        const tr = document.createElement('tr');
        const path = this._pathToLeaf(leaf.id); // [root, n1, n2 ..., leaf]

        for (let d = 0; d < maxDepth; d++) {
          const node = path[d + 1]; // skip root at [0]
          if (!node) {
            const td = document.createElement('td');
            td.className = 'dtb-cell dtb-cell-empty';
            tr.appendChild(td);
            continue;
          }
          if (rendered.has(node.id)) continue;
          rendered.add(node.id);

          const rowspan = this._leafCount(node);
          const td = document.createElement('td');
          td.rowSpan = rowspan;
          td.className = 'dtb-cell';
          td.dataset.nodeId = node.id;

          const detail = this._criteriaDetail(node);
          td.innerHTML = `
            <div class="dtb-cell-inner">
              <input class="dtb-code-input" type="text"
                value="${_esc(node.codePrefix || '')}"
                maxlength="5" placeholder="..."
                title="Code prefix (max 5 chars, contributes to division code)"
                data-node-id="${node.id}">
              <div class="dtb-label-wrap">
                <span class="dtb-label">${_esc(node.label)}</span>
                ${detail ? `<span class="dtb-criteria-detail">${_esc(detail)}</span>` : ''}
              </div>
              <button class="dtb-menu-btn" data-node-id="${node.id}" title="Options">&#x25BC;</button>
            </div>
          `;
          tr.appendChild(td);
        }

        // Actions column - split button
        const tdAct = document.createElement('td');
        tdAct.className = 'dtb-actions-cell';
        tdAct.innerHTML = `<button class="btn btn-small dtb-split-leaf-btn" data-node-id="${_esc(leaf.id)}">+ Split...</button>`;
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);

      // Event delegation
      table.addEventListener('change', e => {
        if (e.target.classList.contains('dtb-code-input')) {
          const n = this._findNode(e.target.dataset.nodeId);
          if (n) {
            n.codePrefix = e.target.value.toUpperCase().slice(0, 5);
            e.target.value = n.codePrefix;
            this._changed(false);
          }
        }
      });

      table.addEventListener('click', e => {
        const menuBtn = e.target.closest('.dtb-menu-btn');
        if (menuBtn) { e.stopPropagation(); this._showContextMenu(menuBtn.dataset.nodeId, menuBtn); return; }
        const splitBtn = e.target.closest('.dtb-split-leaf-btn');
        if (splitBtn) this.showSplitDialog(splitBtn.dataset.nodeId);
      });

      return table;
    }

    // -- Context Menu ----------------------------------------------
    _showContextMenu(nodeId, anchor) {
      this._closeMenu();
      const node = this._findNode(nodeId);
      const parent = this._findParent(nodeId);
      if (!node) return;

      const isRoot = nodeId === this.tree.id;
      const isLeaf = !node.children || node.children.length === 0;
      const siblings = parent ? (parent.children || []) : [];
      const idx = siblings.indexOf(node);

      const menu = document.createElement('div');
      menu.className = 'dtb-ctx-menu';

      const items = [
        { label: '+ Split by...', fn: () => this.showSplitDialog(nodeId) },
        { label: 'Edit...', disabled: isRoot, fn: () => this._editNode(nodeId) },
        { sep: true },
        { label: 'Copy Subdivisions', disabled: isLeaf, fn: () => this.copySubtree(nodeId) },
        { label: 'Paste Subdivisions', disabled: !_sharedClipboard, fn: () => this.pasteSubtree(nodeId) },
        { sep: true },
        { label: '\u2191 Move Up', disabled: isRoot || idx === 0, fn: () => this.moveUp(nodeId) },
        { label: '\u2193 Move Down', disabled: isRoot || idx >= siblings.length - 1, fn: () => this.moveDown(nodeId) },
        { sep: true },
        { label: '+ Insert Above...', disabled: isRoot, fn: () => this._promptInsert(nodeId, 'above') },
        { label: '+ Insert Below...', disabled: isRoot, fn: () => this._promptInsert(nodeId, 'below') },
        { sep: true },
        { label: 'x Clear Subdivisions', disabled: isLeaf, fn: () => this.clearSubdivisions(nodeId) },
        { label: 'Delete', disabled: isRoot, fn: () => this.deleteNode(nodeId) },
      ];

      for (const item of items) {
        if (item.sep) {
          const hr = document.createElement('hr');
          hr.className = 'dtb-menu-sep';
          menu.appendChild(hr);
          continue;
        }
        const btn = document.createElement('button');
        btn.className = 'dtb-menu-item';
        btn.textContent = item.label;
        if (item.disabled) btn.disabled = true;
        btn.onclick = e => { e.stopPropagation(); this._closeMenu(); item.fn(); };
        menu.appendChild(btn);
      }

      // Position — measure first (off-screen), then place so it stays in viewport
      menu.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:10200;visibility:hidden;';
      document.body.appendChild(menu);
      this._activeMenu = menu;

      const rect   = anchor.getBoundingClientRect();
      const menuH  = menu.offsetHeight;
      const menuW  = menu.offsetWidth;
      const gap    = 4;

      // Flip above the button if not enough room below
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const top = spaceBelow >= menuH
        ? rect.bottom + gap
        : Math.max(gap, rect.top - menuH - gap);

      // Clamp left so menu never overflows the right edge
      const left = Math.min(rect.left, window.innerWidth - menuW - gap);

      menu.style.cssText = `position:fixed;top:${top}px;left:${Math.max(gap, left)}px;z-index:10200;`;
    }

    _closeMenu() {
      if (this._activeMenu) { this._activeMenu.remove(); this._activeMenu = null; }
    }

    // -- Split Dialog ----------------------------------------------
    showSplitDialog(nodeId) {
      this._closeMenu();
      const node = this._findNode(nodeId);
      if (!node) return;
      const eid = _esc(this.eventId || '');

      const overlay = document.createElement('div');
      overlay.id = 'dtb-split-overlay';
      overlay.className = 'dtb-overlay';
      overlay.innerHTML = `
        <div class="dtb-modal-box">
          <div class="dtb-modal-hdr">
            <h3>Split "<em>${_esc(node.label)}</em>"</h3>
            <button class="btn btn-secondary btn-small" onclick="document.getElementById('dtb-split-overlay').remove()">&#x2715;</button>
          </div>
          <div class="dtb-tab-row" id="dtb-tabs">
            ${Object.entries(CRITERIA_LABELS).map(([t, l]) =>
              `<button class="dtb-tab${t === 'gender' ? ' active' : ''}" data-type="${t}"
                onclick="window._dtbRegistry&&window._dtbRegistry['${eid}']&&window._dtbRegistry['${eid}']._switchTab('${t}')">${l}</button>`
            ).join('')}
          </div>
          <div id="dtb-split-body" class="dtb-split-body"></div>
          <div class="dtb-modal-ftr">
            <button class="btn btn-primary" onclick="window._dtbRegistry&&window._dtbRegistry['${eid}']&&window._dtbRegistry['${eid}']._confirmSplit('${_esc(nodeId)}')">Apply Split</button>
            <button class="btn btn-secondary" onclick="document.getElementById('dtb-split-overlay').remove()">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      this._currentSplitType = 'gender';
      this._renderSplitBody('gender');
    }

    _switchTab(type) {
      this._currentSplitType = type;
      document.querySelectorAll('#dtb-tabs .dtb-tab').forEach(b => b.classList.toggle('active', b.dataset.type === type));
      this._renderSplitBody(type);
    }

    _renderSplitBody(type) {
      const body = document.getElementById('dtb-split-body');
      if (!body) return;
      const eid = _esc(this.eventId || '');

      const addBtn = (containerId, fn) =>
        `<button class="btn btn-secondary btn-small dtb-add-row" style="margin-top:8px"
          onclick="window._dtbRegistry&&window._dtbRegistry['${eid}']&&window._dtbRegistry['${eid}'].${fn}()">+ Add</button>`;

      switch (type) {
        case 'gender':
          body.innerHTML = `
            <p class="hint">Each value becomes a separate division branch.</p>
            <div id="dtb-rows">
              ${this._gRow('', 'Male', 'M')}
              ${this._gRow('', 'Female', 'F')}
            </div>
            ${addBtn('dtb-rows', '_addGRow')}`;
          break;

        case 'age':
          body.innerHTML = `
            <p class="hint">Ages are calculated relative to tournament date. Use 99 for "open upper limit".</p>
            <div id="dtb-rows">
              ${this._ageRow('01', '0-5 yrs', 0, 5)}
              ${this._ageRow('02', '6-7 yrs', 6, 7)}
              ${this._ageRow('03', '8-9 yrs', 8, 9)}
              ${this._ageRow('04', '10-11 yrs', 10, 11)}
              ${this._ageRow('05', '12-13 yrs', 12, 13)}
            </div>
            ${addBtn('dtb-rows', '_addAgeRow')}`;
          break;

        case 'rank': {
          const opts = RANK_ORDER.map(r => `<option value="${r}">${r}</option>`).join('');
          body.innerHTML = `
            <p class="hint">Group multiple belt ranks into a single bracket. Use the selectors to set the range.</p>
            <div id="dtb-rows">
              ${this._rankRow('N', 'Novice', '10th kyu', '7th kyu', RANK_ORDER)}
              ${this._rankRow('I', 'Intermediate', '6th kyu', '3rd kyu', RANK_ORDER)}
              ${this._rankRow('A', 'Advanced', '2nd kyu', '1st kyu', RANK_ORDER)}
              ${this._rankRow('B', 'Black Belt', '1st dan', '10th dan', RANK_ORDER)}
            </div>
            ${addBtn('dtb-rows', '_addRankRow')}`;
          break;
        }

        case 'weight': {
          const unit = this._getWeightUnit();
          body.innerHTML = `
            <p class="hint">Weight classes in ${unit.toUpperCase()}. Use 999 for "open upper limit".</p>
            <div id="dtb-rows">
              ${this._rangeRow('W1', '-30', 0, 30)}
              ${this._rangeRow('W2', '-40', 31, 40)}
              ${this._rangeRow('W3', '-50', 41, 50)}
              ${this._rangeRow('W4', '+50', 51, 999)}
            </div>
            ${addBtn('dtb-rows', '_addRangeRow')}`;
          break;
        }

        case 'experience':
          body.innerHTML = `
            <p class="hint">Years of practice. Use 99 for "open upper limit".</p>
            <div id="dtb-rows">
              ${this._rangeRow('E1', 'Beginner (0-2 yrs)', 0, 2)}
              ${this._rangeRow('E2', 'Intermediate (3-5 yrs)', 3, 5)}
              ${this._rangeRow('E3', 'Advanced (6+ yrs)', 6, 99)}
            </div>
            ${addBtn('dtb-rows', '_addRangeRow')}`;
          break;

        case 'custom':
          body.innerHTML = `
            <p class="hint">Freeform categories. Auto-assignment is <strong>not</strong> possible - competitors must be placed manually.</p>
            <div id="dtb-rows">
              ${this._custRow('A1', 'Category A')}
              ${this._custRow('B1', 'Category B')}
            </div>
            ${addBtn('dtb-rows', '_addCustRow')}`;
          break;

        default: body.innerHTML = '';
      }
    }

    // Row builder helpers
    _gRow(code, label, defaultCode) {
      const c = code || defaultCode || '';
      return `<div class="dtb-split-row" data-rtype="gender">
        <input class="dsr-code" type="text" value="${_esc(c)}" maxlength="5" placeholder="Code" title="Code prefix">
        <input class="dsr-label" type="text" value="${_esc(label)}" placeholder="e.g. Male" required>
        <button class="btn btn-small btn-danger" onclick="this.closest('.dtb-split-row').remove()">&#x2715;</button>
      </div>`;
    }

    _ageRow(code, label, min, max) {
      return `<div class="dtb-split-row" data-rtype="age">
        <input class="dsr-code" type="text" value="${_esc(code)}" maxlength="5" placeholder="Code">
        <input class="dsr-label" type="text" value="${_esc(label)}" placeholder="Label" required>
        <span class="dsr-sep">Age</span>
        <input class="dsr-min" type="number" value="${min}" min="0" max="120" style="width:58px" title="Min age">
        <span class="dsr-sep">-</span>
        <input class="dsr-max" type="number" value="${max}" min="0" max="120" style="width:58px" title="Max age">
        <button class="btn btn-small btn-danger" onclick="this.closest('.dtb-split-row').remove()">&#x2715;</button>
      </div>`;
    }

    _rankRow(code, label, rankMin, rankMax, rankOrder) {
      const opts = rankOrder.map(r => `<option value="${r}">${r}</option>`).join('');
      const selMin = rankOrder.map(r => `<option value="${r}"${r === rankMin ? ' selected' : ''}>${r}</option>`).join('');
      const selMax = rankOrder.map(r => `<option value="${r}"${r === rankMax ? ' selected' : ''}>${r}</option>`).join('');
      return `<div class="dtb-split-row dtb-rank-row" data-rtype="rank">
        <input class="dsr-code" type="text" value="${_esc(code)}" maxlength="5" placeholder="Code">
        <input class="dsr-label" type="text" value="${_esc(label)}" placeholder="Label" required>
        <select class="dsr-rankmin" title="Min rank">${selMin}</select>
        <span class="dsr-sep">&#x2192;</span>
        <select class="dsr-rankmax" title="Max rank">${selMax}</select>
        <button class="btn btn-small btn-danger" onclick="this.closest('.dtb-split-row').remove()">&#x2715;</button>
      </div>`;
    }

    _rangeRow(code, label, min, max) {
      return `<div class="dtb-split-row" data-rtype="range">
        <input class="dsr-code" type="text" value="${_esc(code)}" maxlength="5" placeholder="Code">
        <input class="dsr-label" type="text" value="${_esc(label)}" placeholder="Label" required>
        <input class="dsr-min" type="number" value="${min}" min="0" style="width:70px" title="Min">
        <span class="dsr-sep">-</span>
        <input class="dsr-max" type="number" value="${max}" min="0" style="width:70px" title="Max">
        <button class="btn btn-small btn-danger" onclick="this.closest('.dtb-split-row').remove()">&#x2715;</button>
      </div>`;
    }

    _custRow(code, label) {
      return `<div class="dtb-split-row" data-rtype="custom">
        <input class="dsr-code" type="text" value="${_esc(code)}" maxlength="5" placeholder="Code">
        <input class="dsr-label" type="text" value="${_esc(label)}" placeholder="Label" required>
        <button class="btn btn-small btn-danger" onclick="this.closest('.dtb-split-row').remove()">&#x2715;</button>
      </div>`;
    }

    // Add row methods (called from onclick in split dialog)
    _addGRow()    { document.getElementById('dtb-rows').insertAdjacentHTML('beforeend', this._gRow('', '', '')); }
    _addAgeRow()  { document.getElementById('dtb-rows').insertAdjacentHTML('beforeend', this._ageRow('', '', 0, 0)); }
    _addRankRow() { document.getElementById('dtb-rows').insertAdjacentHTML('beforeend', this._rankRow('', '', '10th kyu', '10th dan', RANK_ORDER)); }
    _addRangeRow(){ document.getElementById('dtb-rows').insertAdjacentHTML('beforeend', this._rangeRow('', '', 0, 0)); }
    _addCustRow() { document.getElementById('dtb-rows').insertAdjacentHTML('beforeend', this._custRow('', '')); }

    _confirmSplit(nodeId) {
      const type = this._currentSplitType;
      const node = this._findNode(nodeId);
      if (!node) return;

      const rows = document.querySelectorAll('#dtb-split-body .dtb-split-row');
      const children = [];

      for (const row of rows) {
        const label = (row.querySelector('.dsr-label')?.value || '').trim();
        const code  = (row.querySelector('.dsr-code')?.value  || '').trim().toUpperCase().slice(0, 5);
        if (!label) continue;

        let criteriaValue = {};
        switch (type) {
          case 'gender':     criteriaValue = { value: label }; break;
          case 'age':        criteriaValue = { min: +row.querySelector('.dsr-min').value, max: +row.querySelector('.dsr-max').value, label }; break;
          case 'rank':       criteriaValue = { rankMin: row.querySelector('.dsr-rankmin').value, rankMax: row.querySelector('.dsr-rankmax').value, label }; break;
          case 'weight':
          case 'experience': criteriaValue = { min: +row.querySelector('.dsr-min').value, max: +row.querySelector('.dsr-max').value, label }; break;
          case 'custom':     criteriaValue = { value: label }; break;
        }

        children.push({ id: _uuid(), label, codePrefix: code, criteriaType: type, criteriaValue, children: [] });
      }

      if (children.length === 0) { alert('Please define at least one value.'); return; }

      if (node.children && node.children.length > 0) {
        if (!confirm(`"${node.label}" already has subdivisions. This will replace them. Continue?`)) return;
      }

      node.children = children;
      document.getElementById('dtb-split-overlay')?.remove();
      this._changed(true);
    }

    // -- Tree mutations --------------------------------------------
    deleteNode(nodeId) {
      const node = this._findNode(nodeId);
      const parent = this._findParent(nodeId);
      if (!node || !parent) return;
      if (node.children && node.children.length > 0) {
        if (!confirm(`Delete "${node.label}" and all its subdivisions?`)) return;
      }
      parent.children = parent.children.filter(c => c.id !== nodeId);
      this._changed(true);
    }

    moveUp(nodeId) {
      const parent = this._findParent(nodeId);
      if (!parent) return;
      const i = parent.children.findIndex(c => c.id === nodeId);
      if (i <= 0) return;
      [parent.children[i - 1], parent.children[i]] = [parent.children[i], parent.children[i - 1]];
      this._changed(true);
    }

    moveDown(nodeId) {
      const parent = this._findParent(nodeId);
      if (!parent) return;
      const i = parent.children.findIndex(c => c.id === nodeId);
      if (i < 0 || i >= parent.children.length - 1) return;
      [parent.children[i], parent.children[i + 1]] = [parent.children[i + 1], parent.children[i]];
      this._changed(true);
    }

    copySubtree(nodeId) {
      const node = this._findNode(nodeId);
      if (!node) return;
      _sharedClipboard = {
        children: (node.children || []).map(c => this._cloneSubtree(c)),
        _from: node.label,
        _fromEvent: this.eventName,
      };
      this._toast(`Copied subdivisions of "${node.label}"`);
    }

    pasteSubtree(nodeId) {
      if (!_sharedClipboard) return;
      const node = this._findNode(nodeId);
      if (!node) return;
      const fromLabel = _sharedClipboard._fromEvent && _sharedClipboard._fromEvent !== this.eventName
        ? ` (from ${_sharedClipboard._fromEvent})`
        : '';
      const fromNode = _sharedClipboard._from ? ` of "${_sharedClipboard._from}${fromLabel}"` : '';
      if (node.children && node.children.length > 0) {
        if (!confirm(`Replace subdivisions of "${node.label}" with copied subdivisions${fromNode}?`)) return;
      }
      node.children = _sharedClipboard.children.map(c => this._cloneSubtree(c));
      this._changed(true);
    }

    clearSubdivisions(nodeId) {
      const node = this._findNode(nodeId);
      if (!node || !node.children || node.children.length === 0) return;
      if (!confirm(`Remove all subdivisions of "${node.label}"?`)) return;
      node.children = [];
      this._changed(true);
    }

    _promptInsert(nodeId, dir) {
      const node = this._findNode(nodeId);
      const parent = this._findParent(nodeId);
      if (!node || !parent) return;
      const label = prompt('Label for new node:');
      if (!label) return;
      const code = (prompt('Code prefix (optional, max 5 chars):') || '').toUpperCase().slice(0, 5);
      const newNode = { id: _uuid(), label: label.trim(), codePrefix: code, criteriaType: node.criteriaType, criteriaValue: {}, children: [] };
      const i = parent.children.findIndex(c => c.id === nodeId);
      parent.children.splice(dir === 'above' ? i : i + 1, 0, newNode);
      this._changed(true);
    }

    // -- Edit node -------------------------------------------------
    _editNode(nodeId) {
      const node = this._findNode(nodeId);
      if (!node) return;
      const eid = _esc(this.eventId || '');
      const cv  = node.criteriaValue || {};

      // Build criteria-specific fields pre-filled with the node's current values
      let criteriaFields = '';
      switch (node.criteriaType) {
        case 'age':
          criteriaFields = `
            <div class="dtb-edit-field">
              <label>Age range</label>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <input id="dtb-edit-min" type="number" value="${cv.min ?? 0}" min="0" max="120" style="width:70px">
                <span>-</span>
                <input id="dtb-edit-max" type="number" value="${cv.max ?? 99}"  min="0" max="120" style="width:70px">
              </div>
            </div>`;
          break;
        case 'weight':
        case 'experience': {
          const unit = node.criteriaType === 'weight' ? this._getWeightUnit() : 'yrs';
          criteriaFields = `
            <div class="dtb-edit-field">
              <label>${node.criteriaType === 'weight' ? 'Weight' : 'Experience'} range (${unit})</label>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <input id="dtb-edit-min" type="number" value="${cv.min ?? 0}"   min="0" style="width:70px">
                <span>-</span>
                <input id="dtb-edit-max" type="number" value="${cv.max ?? 999}" min="0" style="width:70px">
              </div>
            </div>`;
          break;
        }
        case 'rank': {
          const selMin = RANK_ORDER.map(r =>
            `<option value="${r}"${r === cv.rankMin ? ' selected' : ''}>${r}</option>`).join('');
          const selMax = RANK_ORDER.map(r =>
            `<option value="${r}"${r === cv.rankMax ? ' selected' : ''}>${r}</option>`).join('');
          criteriaFields = `
            <div class="dtb-edit-field">
              <label>Rank range</label>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <select id="dtb-edit-rankmin">${selMin}</select>
                <span>&#x2192;</span>
                <select id="dtb-edit-rankmax">${selMax}</select>
              </div>
            </div>`;
          break;
        }
        default: break; // gender / custom: label is the value
      }

      const overlay = document.createElement('div');
      overlay.id = 'dtb-edit-overlay';
      overlay.className = 'dtb-overlay';
      overlay.innerHTML = `
        <div class="dtb-modal-box" style="max-width:420px">
          <div class="dtb-modal-hdr">
            <h3>Edit "${_esc(node.label)}"</h3>
            <button class="btn btn-secondary btn-small"
              onclick="document.getElementById('dtb-edit-overlay').remove()">&#x2715;</button>
          </div>
          <div class="dtb-split-body" style="display:flex;flex-direction:column;gap:14px;padding:16px 0">
            <div class="dtb-edit-field">
              <label>Label</label>
              <input id="dtb-edit-label" type="text" value="${_esc(node.label)}"
                placeholder="Label" style="width:100%">
            </div>
            <div class="dtb-edit-field">
              <label>Code prefix <span style="color:var(--text-muted);font-size:11px">(max 5 chars)</span></label>
              <input id="dtb-edit-code" type="text" value="${_esc(node.codePrefix || '')}"
                maxlength="5" placeholder="..." style="width:90px;text-transform:uppercase">
            </div>
            ${criteriaFields}
          </div>
          <div class="dtb-modal-ftr">
            <button class="btn btn-primary"
              onclick="window._dtbRegistry&&window._dtbRegistry['${eid}']&&window._dtbRegistry['${eid}']._saveEdit('${_esc(nodeId)}')">Save</button>
            <button class="btn btn-secondary"
              onclick="document.getElementById('dtb-edit-overlay').remove()">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      // Focus the label field immediately
      setTimeout(() => document.getElementById('dtb-edit-label')?.focus(), 50);
    }

    _saveEdit(nodeId) {
      const node    = this._findNode(nodeId);
      const labelEl = document.getElementById('dtb-edit-label');
      const codeEl  = document.getElementById('dtb-edit-code');
      if (!node || !labelEl) return;

      const label = labelEl.value.trim();
      if (!label) { alert('Label cannot be empty.'); return; }

      node.label      = label;
      node.codePrefix = (codeEl?.value || '').toUpperCase().slice(0, 5);

      // Update the criteria value with any changed range / rank inputs
      const cv = node.criteriaValue || {};
      switch (node.criteriaType) {
        case 'age':
        case 'weight':
        case 'experience': {
          const minEl = document.getElementById('dtb-edit-min');
          const maxEl = document.getElementById('dtb-edit-max');
          if (minEl) cv.min = +minEl.value;
          if (maxEl) cv.max = +maxEl.value;
          cv.label = label;
          node.criteriaValue = cv;
          break;
        }
        case 'rank': {
          const rMin = document.getElementById('dtb-edit-rankmin');
          const rMax = document.getElementById('dtb-edit-rankmax');
          if (rMin) cv.rankMin = rMin.value;
          if (rMax) cv.rankMax = rMax.value;
          cv.label = label;
          node.criteriaValue = cv;
          break;
        }
        case 'gender':
        case 'custom':
          node.criteriaValue = { ...cv, value: label, label };
          break;
        default: break;
      }

      document.getElementById('dtb-edit-overlay')?.remove();
      this._changed(true);
    }

    // -- Compilation -----------------------------------------------
    toCriteriaTemplates() {
      if (!this.tree.children || this.tree.children.length === 0) return [];
      return this._allLeaves(this.tree).map(leaf => {
        const path = this._pathToLeaf(leaf.id).slice(1); // skip root
        const criteria = path
          .filter(n => n.criteriaType && n.criteriaType !== 'custom')
          .map(n => ({ type: n.criteriaType, ranges: [{ label: n.label, ...n.criteriaValue }] }));
        return { id: leaf.id, name: this._leafName(leaf), criteria };
      });
    }

    _leafCode(leaf) {
      const path = this._pathToLeaf(leaf.id);
      return path.map(n => n.codePrefix || '').join('');
    }

    _leafName(leaf) {
      const path = this._pathToLeaf(leaf.id).slice(1); // skip root
      const label = path.map(n => n.label).join(' ');
      const code = this._leafCode(leaf);
      return code ? `${code} - ${label}` : label;
    }

    getLeafDivisions() {
      if (!this.tree.children || this.tree.children.length === 0) return [];
      return this._allLeaves(this.tree).map(leaf => ({
        id: leaf.id,
        name: this._leafName(leaf),
        code: this._leafCode(leaf),
        hasAutoAssign: this._pathToLeaf(leaf.id).slice(1).some(n => n.criteriaType && n.criteriaType !== 'custom'),
      }));
    }

    // -- Preview ---------------------------------------------------
    _showPreview() {
      const divs = this.getLeafDivisions();
      if (divs.length === 0) { alert('No divisions defined yet. Add splits first.'); return; }
      const overlay = document.createElement('div');
      overlay.className = 'dtb-overlay';
      overlay.id = 'dtb-preview-overlay';
      overlay.innerHTML = `
        <div class="dtb-modal-box" style="max-width:560px">
          <div class="dtb-modal-hdr">
            <h3>${divs.length} Division Preview</h3>
            <button class="btn btn-secondary btn-small" onclick="document.getElementById('dtb-preview-overlay').remove()">&#x2715;</button>
          </div>
          <ol style="margin:0;padding:0 0 0 20px;max-height:55vh;overflow-y:auto">
            ${divs.map(d => `<li style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">
              <strong>${_esc(d.name)}</strong>
              ${!d.hasAutoAssign ? '<span style="color:#f59e0b;font-size:11px;margin-left:6px">&#x26A0; manual placement</span>' : ''}
            </li>`).join('')}
          </ol>
          <div class="dtb-modal-ftr" style="justify-content:flex-end">
            <button class="btn btn-secondary" onclick="document.getElementById('dtb-preview-overlay').remove()">Close</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    // -- Generate Divisions ----------------------------------------
    _generateDivisions() {
      const divs = this.getLeafDivisions();
      if (divs.length === 0) {
        if (typeof showMessage === 'function') showMessage('No divisions defined. Add splits first.', 'error');
        return;
      }
      const eid = _esc(this.eventId || '');
      const overlay = document.createElement('div');
      overlay.className = 'dtb-overlay';
      overlay.id = 'dtb-gen-overlay';
      overlay.innerHTML = `
        <div class="dtb-modal-box" style="max-width:500px">
          <div class="dtb-modal-hdr">
            <h3>Generate ${divs.length} Division${divs.length !== 1 ? 's' : ''}?</h3>
          </div>
          <p style="color:var(--text-secondary);margin-bottom:12px">
            This will compile the tree into division templates and run auto-assignment for all approved competitors.
          </p>
          <details style="margin-bottom:12px">
            <summary style="cursor:pointer;color:var(--text-secondary);font-size:13px">Show all ${divs.length} divisions</summary>
            <ol style="margin:8px 0;padding-left:20px;font-size:13px;max-height:200px;overflow-y:auto">
              ${divs.map(d => `<li>${_esc(d.name)}</li>`).join('')}
            </ol>
          </details>
          <div class="dtb-modal-ftr">
            <button class="btn btn-primary" onclick="window._dtbRegistry&&window._dtbRegistry['${eid}']&&window._dtbRegistry['${eid}']._doGenerate()">&#x2713; Generate</button>
            <button class="btn btn-secondary" onclick="document.getElementById('dtb-gen-overlay').remove()">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    async _doGenerate() {
      document.getElementById('dtb-gen-overlay')?.remove();
      const templates = this.toCriteriaTemplates();

      // 1. Save templates to server
      try {
        await fetch(`/api/tournaments/${currentTournamentId}/events/${this.eventId}/templates/sync`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteriaTemplates: templates }),
        });
      } catch (e) { console.warn('[dtb] template sync failed:', e); }

      // 2. Update local divisions storage so generateDivisions() can find templates
      if (typeof _msGet === 'function' && typeof _msSet === 'function' && typeof _scopedKey === 'function') {
        const allDiv = JSON.parse(_msGet(_scopedKey('divisions')) || '{}');
        if (!allDiv[this.eventId]) allDiv[this.eventId] = { generated: {} };
        allDiv[this.eventId].templates = templates;
        _msSet(_scopedKey('divisions'), JSON.stringify(allDiv));
      }

      // 3. Update eventTypes cache
      if (typeof db !== 'undefined') {
        const evts = db.load('eventTypes');
        const i = evts.findIndex(e => String(e.id) === String(this.eventId));
        if (i !== -1) { evts[i].criteria_templates = templates; db.save('eventTypes', evts); }
      }

      // 4. Run generate
      if (typeof generateDivisions === 'function') generateDivisions();
    }

    // -- Helpers ---------------------------------------------------
    _toast(msg) {
      const t = document.createElement('div');
      t.className = 'dtb-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2800);
    }

    _changed(rerender) {
      if (rerender) this.render();
      if (typeof this.onTreeChange === 'function') this.onTreeChange(JSON.parse(JSON.stringify(this.tree)));
    }
  }

  window.DivisionTreeBuilder = DivisionTreeBuilder;
})();
