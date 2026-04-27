/* ═══════════════════════════════════════════════════════════════════
   PRIORITIES VIEW — PlanPilot
   Kanban-style 4-column layout grouped by priority (P1-P4).
   Mirrors the Reclaim.ai Priorities page.
   ═══════════════════════════════════════════════════════════════════ */

const PrioritiesView = (() => {
  'use strict';

  const $ = Utils.$;

  /* ── Priority definitions ── */

  const PRIORITIES = [
    { key: 'P1', i18n: 'priorities.critical', fallback: 'Critique' },
    { key: 'P2', i18n: 'priorities.high',     fallback: 'Haute priorite' },
    { key: 'P3', i18n: 'priorities.medium',   fallback: 'Priorite moyenne' },
    { key: 'P4', i18n: 'priorities.low',      fallback: 'Priorite basse' }
  ];

  /* ── View mode: 'priority' or 'group' ── */
  let _viewMode = 'priority';

  /* ── Collapsed state per column ── */

  const _collapsed = { P1: false, P2: false, P3: false, P4: false };

  /* ═══════ INIT ═══════ */

  function init() {
    // Re-render on store changes when visible
    document.addEventListener('store:changed', () => {
      if (isVisible()) render();
    });

    // Bind drag-and-drop via delegation on the stable panel element
    const panel = $('prioritiesPanel');
    if (panel) _bindDragDrop(panel);
  }

  /* ═══════ HELPERS ═══════ */

  function _t(key, fallback) {
    if (typeof I18n !== 'undefined' && I18n.t) {
      const val = I18n.t(key);
      return val !== key ? val : (fallback || key);
    }
    return fallback || key;
  }

  /** Get next scheduled event time for a task */
  function _nextScheduledTime(task) {
    try {
      const tasks = Store.getAllTasks();
      const weekStart = Utils.startOfWeek(new Date());
      const events = Scheduler.schedule(tasks, weekStart, 14);
      const now = new Date();
      const taskEvents = events
        .filter(ev => ev.taskId === task.id && ev.start > now)
        .sort((a, b) => a.start - b.start);
      return taskEvents.length > 0 ? taskEvents[0].start : null;
    } catch {
      return null;
    }
  }

  /* ═══════ RENDER ═══════ */

  function render() {
    const panel = $('prioritiesPanel');
    if (!panel) return;

    // Get non-done tasks
    const allTasks = Store.getAllTasks();
    const tasks = allTasks.filter(t => t.status !== 'done');

    let gridHTML;

    if (_viewMode === 'group') {
      gridHTML = _renderByGroup(tasks);
    } else {
      // Group by priority
      const grouped = { P1: [], P2: [], P3: [], P4: [] };
      for (const task of tasks) {
        const p = task.priority || 'P4';
        if (grouped[p]) grouped[p].push(task);
        else grouped.P4.push(task);
      }

      // Sort within each group by due date then creation
      for (const p of Object.keys(grouped)) {
        grouped[p].sort(TaskModel.compareForScheduling);
      }

      gridHTML = PRIORITIES.map(p => _renderColumn(p, grouped[p.key])).join('');
    }

    panel.innerHTML = `
      <div class="priorities-header">
        <h2 class="priorities-title">${_t('priorities.title', 'Priorites')}</h2>
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          <button class="btn-secondary btn-sm" id="prioritiesViewToggle" type="button" style="font-size:var(--font-size-xs);padding:4px 10px;border-radius:14px">
            ${_viewMode === 'priority' ? _t('groups.byGroup', 'Par groupe') : _t('groups.byPriority', 'Par priorite')}
          </button>
          <button class="modal-close" id="prioritiesClose" type="button" aria-label="${_t('settings.close', 'Fermer')}">&times;</button>
        </div>
      </div>
      <div class="priorities-grid">
        ${gridHTML}
      </div>
    `;

    _bindEvents(panel);
  }

  /** Render columns grouped by task group */
  function _renderByGroup(tasks) {
    const groups = Store.getGroups();
    const buckets = {};
    const noGroup = [];

    for (const t of tasks) {
      if (t.groupId) {
        if (!buckets[t.groupId]) buckets[t.groupId] = [];
        buckets[t.groupId].push(t);
      } else {
        noGroup.push(t);
      }
    }

    // Sort within each bucket
    for (const key of Object.keys(buckets)) {
      buckets[key].sort(TaskModel.compareForScheduling);
    }
    noGroup.sort(TaskModel.compareForScheduling);

    let html = '';
    for (const g of groups) {
      const groupTasks = buckets[g.id] || [];
      html += _renderGroupColumn(g, groupTasks);
    }
    // "Sans groupe" column
    html += _renderGroupColumn({ id: '__none', name: _t('groups.noGroup', 'Sans groupe'), color: '#666' }, noGroup);

    return html;
  }

  /** Render a single group column */
  function _renderGroupColumn(group, tasks) {
    const count = tasks.length;
    const isCollapsed = _collapsed[group.id];
    const sectionLabel = _t('priorities.tasks', 'Taches');

    let body;
    if (count === 0) {
      body = `<div class="priority-empty">${_t('priorities.noItems', 'Aucun element')}</div>`;
    } else {
      const chevronSvg = '<svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      body = `
        <button class="priority-section-toggle ${isCollapsed ? 'collapsed' : ''}" data-priority="${group.id}">
          ${chevronSvg}
          ${sectionLabel} ${count}
        </button>
        <div class="priority-task-list ${isCollapsed ? 'collapsed' : ''}">
          ${tasks.map(t => _renderTaskCard(t)).join('')}
        </div>
      `;
    }

    return `
      <div class="priority-column" data-priority="${group.id}">
        <div class="priority-column-header">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${group.color};margin-right:6px"></span>
          ${_escHtml(group.name)}
          <span class="priority-count">${count}</span>
          <button class="priority-header-add-btn" data-group-id="${group.id}" title="+ Ajouter">+</button>
        </div>
        ${body}
      </div>
    `;
  }

  /** Render a single priority column */
  function _renderColumn(pDef, tasks) {
    const label = _t(pDef.i18n, pDef.fallback);
    const count = tasks.length;
    const isCollapsed = _collapsed[pDef.key];
    const sectionLabel = _t('priorities.tasks', 'Taches');

    let body;
    if (count === 0) {
      body = `<div class="priority-empty">${_t('priorities.noItems', 'Aucun element')}</div>`;
    } else {
      const chevronSvg = '<svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      body = `
        <button class="priority-section-toggle ${isCollapsed ? 'collapsed' : ''}" data-priority="${pDef.key}">
          ${chevronSvg}
          ${sectionLabel} ${count}
        </button>
        <div class="priority-task-list ${isCollapsed ? 'collapsed' : ''}">
          ${tasks.map(t => _renderTaskCard(t)).join('')}
        </div>
      `;
    }

    return `
      <div class="priority-column" data-priority="${pDef.key}">
        <div class="priority-column-header">
          ${label}
          <span class="priority-count">${count}</span>
          <button class="priority-header-add-btn" data-priority="${pDef.key}" title="+ Ajouter">+</button>
        </div>
        ${body}
      </div>
    `;
  }

  /** Render a single task card */
  function _renderTaskCard(task) {
    const dueDate = task.dueDate
      ? Utils.formatDateShort(Utils.parseDateInput(task.dueDate))
      : '';

    const duration = Utils.formatDuration(task.remainingDuration || task.totalDuration || 0);

    const nextTime = _nextScheduledTime(task);
    const nextStr = nextTime
      ? Utils.formatDateShort(nextTime) + ' ' + Utils.formatTime(nextTime)
      : '';

    const upNextBadge = task.upNext
      ? `<span class="priority-upnext-badge">${_t('modal.upNext', 'A suivre')}</span>`
      : '';

    // SVG icons
    const calendarIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const clockIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const playIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const editIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';

    return `
      <div class="priority-task-card" data-task-id="${task.id}" draggable="true">
        <div class="priority-task-card-name">${_escHtml(task.name)}${upNextBadge}</div>
        <div class="priority-task-card-meta">
          ${dueDate ? `<span class="priority-task-meta-item">${calendarIcon} ${dueDate}</span>` : ''}
          ${nextStr ? `<span class="priority-task-meta-item">${clockIcon} ${nextStr}</span>` : ''}
          <span class="priority-task-duration-pill">${duration}</span>
        </div>
        <div class="priority-task-actions">
          <button class="btn-start" data-task-id="${task.id}" title="${_t('actions.start', 'Demarrer')}">${playIcon}</button>
          <button class="btn-edit" data-task-id="${task.id}" title="${_t('actions.edit', 'Modifier')}">${editIcon}</button>
          <button class="btn-done" data-task-id="${task.id}" title="${_t('actions.done', 'Termine')}">${checkIcon}</button>
        </div>
      </div>
    `;
  }

  /** Escape HTML */
  function _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ═══════ DRAG-AND-DROP (delegated, bound once in init) ═══════ */

  function _bindDragDrop(panel) {
    panel.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.priority-task-card');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    panel.addEventListener('dragend', (e) => {
      const card = e.target.closest('.priority-task-card');
      if (card) card.classList.remove('dragging');
      panel.querySelectorAll('.priority-column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    // Clean up drag-over highlights when an external drag (e.g. from sidebar) ends
    document.addEventListener('dragend', () => {
      panel.querySelectorAll('.priority-column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    panel.addEventListener('dragover', (e) => {
      const col = e.target.closest('.priority-column');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      panel.querySelectorAll('.priority-column.drag-over').forEach(c => {
        if (c !== col) c.classList.remove('drag-over');
      });
      col.classList.add('drag-over');
    });

    panel.addEventListener('dragenter', (e) => {
      const col = e.target.closest('.priority-column');
      if (!col) return;
      e.preventDefault();
    });

    panel.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.priority-column');
      if (!col) return;
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    panel.addEventListener('drop', (e) => {
      const col = e.target.closest('.priority-column');
      if (!col) return;
      e.preventDefault();
      e.stopPropagation();
      col.classList.remove('drag-over');
      // Accept drops from both internal cards and sidebar task items
      const taskId = e.dataTransfer.getData('application/x-planpilot-task') || e.dataTransfer.getData('text/plain');
      const colKey = col.getAttribute('data-priority');
      if (taskId && colKey) {
        const task = Store.getTask(taskId);
        if (!task) return;
        if (_viewMode === 'group') {
          const newGroupId = colKey === '__none' ? null : colKey;
          if (task.groupId !== newGroupId) {
            Store.updateTask(taskId, { groupId: newGroupId });
          }
        } else {
          if (task.priority !== colKey) {
            Store.updateTask(taskId, { priority: colKey });
          }
        }
      }
    });
  }

  /* ═══════ BIND EVENTS ═══════ */

  function _bindEvents(panel) {
    // Close button
    const closeBtn = panel.querySelector('#prioritiesClose');
    if (closeBtn) closeBtn.addEventListener('click', hide);


    // View mode toggle
    const toggleBtn = panel.querySelector('#prioritiesViewToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        _viewMode = _viewMode === 'priority' ? 'group' : 'priority';
        render();
      });
    }

    // Section collapse toggles
    panel.querySelectorAll('.priority-section-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = btn.getAttribute('data-priority');
        if (p) {
          _collapsed[p] = !_collapsed[p];
          btn.classList.toggle('collapsed');
          const list = btn.nextElementSibling;
          if (list) list.classList.toggle('collapsed');
        }
      });
    });

    // Task card clicks -> open edit modal
    panel.querySelectorAll('.priority-task-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't open modal if action button was clicked
        if (e.target.closest('.priority-task-actions')) return;
        const taskId = card.getAttribute('data-task-id');
        if (taskId) {
          const task = Store.getTask(taskId);
          if (task && typeof ModalView !== 'undefined' && ModalView.open) {
            ModalView.open(task);
          }
        }
      });
    });

    // Action buttons: start
    panel.querySelectorAll('.btn-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        if (taskId && typeof TaskActions !== 'undefined' && TaskActions.start) {
          TaskActions.start(taskId);
        }
      });
    });

    // Action buttons: edit
    panel.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        if (taskId) {
          const task = Store.getTask(taskId);
          if (task && typeof ModalView !== 'undefined' && ModalView.open) {
            ModalView.open(task);
          }
        }
      });
    });

    // Action buttons: done
    panel.querySelectorAll('.btn-done').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        if (taskId && typeof TaskActions !== 'undefined' && TaskActions.markDone) {
          TaskActions.markDone(taskId);
        }
      });
    });

    // Add task buttons in columns
    panel.querySelectorAll('.priority-header-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const priority = btn.getAttribute('data-priority');
        const groupId = btn.getAttribute('data-group-id');
        if (typeof ModalView !== 'undefined' && ModalView.open) {
          const defaults = {};
          if (priority) defaults.priority = priority;
          if (groupId) defaults.groupId = groupId;
          ModalView.open(null, defaults);
        }
      });
    });

    // ── Touch drag-and-drop for mobile (Kanban cards) ──
    _bindTouchDrag(panel);
  }

  /* ═══════ TOUCH DRAG (mobile Kanban) ═══════ */

  let _touchDragState = null;

  function _bindTouchDrag(panel) {
    panel.querySelectorAll('.priority-task-card').forEach(card => {
      card.addEventListener('touchstart', _onTouchDragStart, { passive: false });
    });
  }

  function _onTouchDragStart(e) {
    const card = e.currentTarget;
    const touch = e.touches[0];
    _touchDragState = {
      taskId: card.getAttribute('data-task-id'),
      startX: touch.clientX,
      startY: touch.clientY,
      clone: null,
      dragging: false,
      card: card
    };
    document.addEventListener('touchmove', _onTouchDragMove, { passive: false });
    document.addEventListener('touchend', _onTouchDragEnd, { passive: false });
  }

  function _onTouchDragMove(e) {
    if (!_touchDragState) return;
    const touch = e.touches[0];
    const dx = touch.clientX - _touchDragState.startX;
    const dy = touch.clientY - _touchDragState.startY;

    // Start dragging after 10px movement
    if (!_touchDragState.dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      _touchDragState.dragging = true;
      _touchDragState.card.classList.add('dragging');
      // Create floating clone
      const clone = _touchDragState.card.cloneNode(true);
      clone.classList.add('touch-drag-clone');
      const rect = _touchDragState.card.getBoundingClientRect();
      clone.style.width = rect.width + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      document.body.appendChild(clone);
      _touchDragState.clone = clone;
      _touchDragState.offsetX = touch.clientX - rect.left;
      _touchDragState.offsetY = touch.clientY - rect.top;
    }

    if (_touchDragState.dragging) {
      e.preventDefault();
      const clone = _touchDragState.clone;
      if (clone) {
        clone.style.left = (touch.clientX - _touchDragState.offsetX) + 'px';
        clone.style.top = (touch.clientY - _touchDragState.offsetY) + 'px';
      }
      // Highlight column under touch
      const cols = document.querySelectorAll('.priority-column');
      cols.forEach(col => {
        const rect = col.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          col.classList.add('drag-over');
        } else {
          col.classList.remove('drag-over');
        }
      });
    }
  }

  function _onTouchDragEnd(e) {
    document.removeEventListener('touchmove', _onTouchDragMove);
    document.removeEventListener('touchend', _onTouchDragEnd);
    if (!_touchDragState) return;

    if (_touchDragState.dragging) {
      // Find column under final touch position
      const touch = e.changedTouches[0];
      const cols = document.querySelectorAll('.priority-column');
      cols.forEach(col => {
        col.classList.remove('drag-over');
        const rect = col.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const colKey = col.getAttribute('data-priority');
          const taskId = _touchDragState.taskId;
          if (taskId && colKey) {
            const task = Store.getTask(taskId);
            if (!task) return;
            if (_viewMode === 'group') {
              const newGroupId = colKey === '__none' ? null : colKey;
              if (task.groupId !== newGroupId) {
                Store.updateTask(taskId, { groupId: newGroupId });
              }
            } else {
              if (task.priority !== colKey) {
                Store.updateTask(taskId, { priority: colKey });
              }
            }
          }
        }
      });
      // Clean up clone
      if (_touchDragState.clone) {
        _touchDragState.clone.remove();
      }
      _touchDragState.card.classList.remove('dragging');
    }
    _touchDragState = null;
  }

  /* ═══════ SHOW / HIDE / TOGGLE ═══════ */

  function show() {
    const panel = $('prioritiesPanel');
    const calendar = $('calendarContainer');
    const settings = $('settingsPanel');
    const analytics = $('analyticsPanel');
    const weeklyReview = $('weeklyReviewPanel');
    const groupsPanel = $('groupsPanel');

    if (calendar) calendar.style.display = 'none';
    if (settings) settings.style.display = 'none';
    if (analytics) analytics.style.display = 'none';
    if (weeklyReview) weeklyReview.style.display = 'none';
    if (groupsPanel) groupsPanel.style.display = 'none';
    if (panel) { panel.style.display = ''; render(); }
  }

  function hide() {
    const panel = $('prioritiesPanel');
    const calendar = $('calendarContainer');

    if (panel) panel.style.display = 'none';
    if (calendar) calendar.style.display = '';

    // Notify app to update active view state
    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: 'calendar' } }));
  }

  function toggle() {
    isVisible() ? hide() : show();
  }

  function isVisible() {
    const panel = $('prioritiesPanel');
    return panel && panel.style.display !== 'none';
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init, render, show, hide, toggle, isVisible };
})();
