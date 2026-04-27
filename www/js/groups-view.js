/* ═══════════════════════════════════════════════════════════════════
   GROUPS VIEW — PlanPilot
   Kanban-style layout with one column per group.
   Mirrors the Priorities view pattern.
   ═══════════════════════════════════════════════════════════════════ */

const GroupsView = (() => {
  'use strict';

  const $ = Utils.$;

  /* ── Collapsed state per column ── */
  const _collapsed = {};

  /* ═══════ INIT ═══════ */

  function init() {
    document.addEventListener('store:changed', () => {
      if (isVisible()) render();
    });

    // Bind drag-and-drop via delegation on the stable panel element
    const panel = $('groupsPanel');
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

  function _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ═══════ RENDER ═══════ */

  function render() {
    const panel = $('groupsPanel');
    if (!panel) return;

    const allTasks = Store.getAllTasks();
    const tasks = allTasks.filter(t => t.status !== 'done');
    const groups = Store.getGroups();

    // Bucket tasks by group
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

    // Build columns
    let columnsHTML = '';
    for (const g of groups) {
      columnsHTML += _renderColumn(g, buckets[g.id] || []);
    }
    // "Sans groupe" column
    columnsHTML += _renderColumn(
      { id: '__none', name: _t('groups.noGroup', 'Sans groupe'), color: '#666' },
      noGroup,
      true // isNoGroup flag
    );
    // "+ Add group" column
    columnsHTML += _renderAddColumn();

    panel.innerHTML = `
      <div class="groups-header">
        <h2 class="groups-title">${_t('groups.title', 'Groupes')}</h2>
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          <button class="modal-close" id="groupsClose" type="button" aria-label="${_t('settings.close', 'Fermer')}">&times;</button>
        </div>
      </div>
      <div class="groups-grid">
        ${columnsHTML}
      </div>
    `;

    _bindEvents(panel);
  }

  /* ── Render a single group column ── */

  function _renderColumn(group, tasks, isNoGroup) {
    const count = tasks.length;
    const isCollapsed = _collapsed[group.id];
    const sectionLabel = _t('priorities.tasks', 'Taches');

    // Header management icons (not for "Sans groupe")
    let headerActions = '';
    if (!isNoGroup) {
      const editSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      const deleteSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      headerActions = `
        <span class="group-column-actions">
          <button class="btn-edit-group" data-group-id="${group.id}" title="${_t('groups.editGroup', 'Renommer le groupe')}">${editSvg}</button>
          <button class="btn-delete-group" data-group-id="${group.id}" title="${_t('groups.deleteConfirm', 'Supprimer ce groupe ?')}">${deleteSvg}</button>
        </span>
      `;
    }

    let body;
    if (count === 0) {
      body = `<div class="group-empty">${_t('priorities.noItems', 'Aucun element')}</div>`;
    } else {
      const chevronSvg = '<svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      body = `
        <button class="group-section-toggle ${isCollapsed ? 'collapsed' : ''}" data-group-key="${group.id}">
          ${chevronSvg}
          ${sectionLabel} ${count}
        </button>
        <div class="group-task-list ${isCollapsed ? 'collapsed' : ''}">
          ${tasks.map(t => _renderTaskCard(t)).join('')}
        </div>
      `;
    }

    return `
      <div class="group-column" data-group-id="${group.id}" style="border-top:3px solid ${group.color}">
        <div class="group-column-header">
          <span class="group-column-dot" style="background:${group.color}"></span>
          <span class="group-column-name">${_escHtml(group.name)}</span>
          <span class="group-column-count">${count}</span>
          <button class="group-header-add-btn" data-group-id="${group.id}" title="+ Ajouter">+</button>
          ${headerActions}
        </div>
        ${body}
      </div>
    `;
  }

  /* ── Render task card ── */

  function _renderTaskCard(task) {
    const dueDate = task.dueDate
      ? Utils.formatDateShort(Utils.parseDateInput(task.dueDate))
      : '';

    const duration = Utils.formatDuration(task.remainingDuration || task.totalDuration || 0);

    const priority = task.priority || 'P4';
    const pNum = parseInt(priority.replace('P', ''), 10) || 4;
    let barsHTML = '<span class="group-task-priority-bars" data-priority="' + priority + '">';
    for (let i = 1; i <= 4; i++) {
      barsHTML += `<span class="group-task-priority-bar ${i <= (5 - pNum) ? 'active' : ''}"></span>`;
    }
    barsHTML += '</span>';

    const upNextBadge = task.upNext
      ? `<span class="group-upnext-badge">${_t('modal.upNext', 'A suivre')}</span>`
      : '';

    // SVG icons
    const calendarIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const playIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const editIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';

    return `
      <div class="group-task-card" data-task-id="${task.id}" draggable="true">
        <div class="group-task-card-name">${_escHtml(task.name)}${upNextBadge}</div>
        <div class="group-task-card-meta">
          ${barsHTML}
          ${dueDate ? `<span class="group-task-meta-item">${calendarIcon} ${dueDate}</span>` : ''}
          <span class="group-task-duration-pill">${duration}</span>
        </div>
        <div class="group-task-actions">
          <button class="btn-start" data-task-id="${task.id}" title="${_t('actions.start', 'Demarrer')}">${playIcon}</button>
          <button class="btn-edit" data-task-id="${task.id}" title="${_t('actions.edit', 'Modifier')}">${editIcon}</button>
          <button class="btn-done" data-task-id="${task.id}" title="${_t('actions.done', 'Termine')}">${checkIcon}</button>
        </div>
      </div>
    `;
  }

  /* ── Render "+ Add group" column ── */

  function _renderAddColumn() {
    const plusSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    return `
      <div class="group-add-column" id="groupAddColumn">
        ${plusSvg}
        <span>${_t('groups.addColumn', 'Ajouter un groupe')}</span>
      </div>
    `;
  }

  /* ═══════ DRAG-AND-DROP (delegated, bound once in init) ═══════ */

  function _bindDragDrop(panel) {
    panel.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.group-task-card');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    panel.addEventListener('dragend', (e) => {
      const card = e.target.closest('.group-task-card');
      if (card) card.classList.remove('dragging');
      panel.querySelectorAll('.group-column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    // Clean up drag-over highlights when an external drag (e.g. from sidebar) ends
    document.addEventListener('dragend', () => {
      panel.querySelectorAll('.group-column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    panel.addEventListener('dragover', (e) => {
      const col = e.target.closest('.group-column');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      panel.querySelectorAll('.group-column.drag-over').forEach(c => {
        if (c !== col) c.classList.remove('drag-over');
      });
      col.classList.add('drag-over');
    });

    panel.addEventListener('dragenter', (e) => {
      const col = e.target.closest('.group-column');
      if (!col) return;
      e.preventDefault();
    });

    panel.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.group-column');
      if (!col) return;
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    panel.addEventListener('drop', (e) => {
      const col = e.target.closest('.group-column');
      if (!col) return;
      e.preventDefault();
      e.stopPropagation();
      col.classList.remove('drag-over');
      // Accept drops from both internal cards and sidebar task items
      const taskId = e.dataTransfer.getData('application/x-planpilot-task') || e.dataTransfer.getData('text/plain');
      const groupId = col.getAttribute('data-group-id');
      if (taskId && groupId) {
        const task = Store.getTask(taskId);
        if (!task) return;
        const newGroupId = groupId === '__none' ? null : groupId;
        if (task.groupId !== newGroupId) {
          Store.updateTask(taskId, { groupId: newGroupId });
        }
      }
    });
  }

  /* ═══════ BIND EVENTS ═══════ */

  function _bindEvents(panel) {
    // Close button
    const closeBtn = panel.querySelector('#groupsClose');
    if (closeBtn) closeBtn.addEventListener('click', hide);


    // Section collapse toggles
    panel.querySelectorAll('.group-section-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-group-key');
        if (key) {
          _collapsed[key] = !_collapsed[key];
          btn.classList.toggle('collapsed');
          const list = btn.nextElementSibling;
          if (list) list.classList.toggle('collapsed');
        }
      });
    });

    // Task card click -> open edit modal
    panel.querySelectorAll('.group-task-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.group-task-actions')) return;
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

    // Add task to group (header + button)
    panel.querySelectorAll('.group-header-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.getAttribute('data-group-id');
        if (typeof ModalView !== 'undefined' && ModalView.open) {
          ModalView.open(null, { groupId: groupId });
        }
      });
    });

    // Group header: edit (rename)
    panel.querySelectorAll('.btn-edit-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.getAttribute('data-group-id');
        _startRename(groupId, btn);
      });
    });

    // Group header: delete
    panel.querySelectorAll('.btn-delete-group').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.getAttribute('data-group-id');
        if (groupId && confirm(_t('groups.deleteConfirm', 'Supprimer ce groupe ?'))) {
          Store.deleteGroup(groupId);
        }
      });
    });

    // Add group column
    const addCol = panel.querySelector('#groupAddColumn');
    if (addCol) {
      addCol.addEventListener('click', _addNewGroup);
    }

    // ── Touch drag-and-drop ──
    _bindTouchDrag(panel);
  }

  /* ═══════ GROUP MANAGEMENT ═══════ */

  function _startRename(groupId, anchorEl) {
    const groups = Store.getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Find the column header name span
    const col = anchorEl.closest('.group-column');
    if (!col) return;
    const nameSpan = col.querySelector('.group-column-name');
    if (!nameSpan) return;

    const oldName = group.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'group-rename-input';
    input.value = oldName;
    nameSpan.textContent = '';
    nameSpan.appendChild(input);
    input.focus();
    input.select();

    function finish() {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        Store.saveGroup({ id: groupId, name: newName });
      } else {
        // Revert: re-render will handle it
        render();
      }
    }

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
  }

  function _addNewGroup() {
    const groups = Store.getGroups();
    if (groups.length >= 8) {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(_t('groups.maxReached', 'Maximum 8 groupes'), 'warning');
      }
      return;
    }

    const palette = ['#9b59b6', '#2ecc71', '#1abc9c', '#e74c3c', '#95a5a6', '#3498db', '#e67e22', '#f1c40f'];
    const usedColors = new Set(groups.map(g => g.color));
    const color = palette.find(c => !usedColors.has(c)) || palette[Math.floor(Math.random() * palette.length)];

    const name = prompt(_t('groups.name', 'Nom du groupe'));
    if (!name || !name.trim()) return;

    Store.saveGroup({ name: name.trim(), color });
  }

  /* ═══════ TOUCH DRAG (mobile) ═══════ */

  let _touchDragState = null;

  function _bindTouchDrag(panel) {
    panel.querySelectorAll('.group-task-card').forEach(card => {
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

    if (!_touchDragState.dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      _touchDragState.dragging = true;
      _touchDragState.card.classList.add('dragging');
      const clone = _touchDragState.card.cloneNode(true);
      clone.classList.add('group-touch-drag-clone');
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
      const cols = document.querySelectorAll('.group-column');
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
      const touch = e.changedTouches[0];
      const cols = document.querySelectorAll('.group-column');
      cols.forEach(col => {
        col.classList.remove('drag-over');
        const rect = col.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const groupId = col.getAttribute('data-group-id');
          const taskId = _touchDragState.taskId;
          if (taskId && groupId) {
            const task = Store.getTask(taskId);
            if (!task) return;
            const newGroupId = groupId === '__none' ? null : groupId;
            if (task.groupId !== newGroupId) {
              Store.updateTask(taskId, { groupId: newGroupId });
            }
          }
        }
      });
      if (_touchDragState.clone) {
        _touchDragState.clone.remove();
      }
      _touchDragState.card.classList.remove('dragging');
    }
    _touchDragState = null;
  }

  /* ═══════ SHOW / HIDE / TOGGLE ═══════ */

  function show() {
    const panel = $('groupsPanel');
    const calendar = $('calendarContainer');
    const settings = $('settingsPanel');
    const analytics = $('analyticsPanel');
    const priorities = $('prioritiesPanel');
    const weeklyReview = $('weeklyReviewPanel');

    if (calendar) calendar.style.display = 'none';
    if (settings) settings.style.display = 'none';
    if (analytics) analytics.style.display = 'none';
    if (priorities) priorities.style.display = 'none';
    if (weeklyReview) weeklyReview.style.display = 'none';
    if (panel) { panel.style.display = ''; render(); }
  }

  function hide() {
    const panel = $('groupsPanel');
    const calendar = $('calendarContainer');

    if (panel) panel.style.display = 'none';
    if (calendar) calendar.style.display = '';

    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: 'calendar' } }));
  }

  function toggle() {
    isVisible() ? hide() : show();
  }

  function isVisible() {
    const panel = $('groupsPanel');
    return panel && panel.style.display !== 'none';
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init, render, show, hide, toggle, isVisible };
})();
