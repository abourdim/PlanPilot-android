/* ═══════════════════════════════════════════════════════════════════
   POPOVER VIEW — PlanPilot
   Event popover anchored to calendar event blocks.
   Shows task info + context-aware action buttons.
   ═══════════════════════════════════════════════════════════════════ */

const PopoverView = (() => {
  'use strict';

  const $ = Utils.$;
  let _currentEvent = null;
  let _currentElement = null;
  let _confirmingDelete = false;
  let _confirmTimer = null;

  /* ═══════ INIT ═══════ */

  function init() {
    // Close on outside click
    document.addEventListener('click', (e) => {
      const popover = $('popover');
      if (!popover || popover.style.display === 'none') return;
      if (popover.contains(e.target)) return;
      // Don't close if clicking on the event block that opened it
      if (_currentElement && _currentElement.contains(e.target)) return;
      close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* ═══════ OPEN ═══════ */

  function open(ev, anchorEl) {
    _currentEvent = ev;
    _currentElement = anchorEl;
    _confirmingDelete = false;
    if (_confirmTimer) { clearTimeout(_confirmTimer); _confirmTimer = null; }

    const popover = $('popover');
    if (!popover) return;

    _render(popover, ev);
    popover.style.display = '';
    _position(popover, anchorEl);
  }

  /* ═══════ CLOSE ═══════ */

  function close() {
    const popover = $('popover');
    if (popover) popover.style.display = 'none';
    _currentEvent = null;
    _currentElement = null;
    _confirmingDelete = false;
    if (_confirmTimer) { clearTimeout(_confirmTimer); _confirmTimer = null; }
  }

  /* ═══════ RENDER ═══════ */

  function _render(popover, ev) {
    const task = Store.getTask(ev.taskId);
    if (!task) { popover.style.display = 'none'; return; }

    const uiMode = document.documentElement.getAttribute('data-ui-mode') || 'advanced';
    const isLocked = ev.locked;
    const isPinned = !!task.pinnedTime;
    const isRunning = TaskActions.isRunning && TaskActions.isRunning(ev.taskId);
    const isDone = task.status === 'done';

    const timeStr = `${Utils.formatTime(ev.start)} - ${Utils.formatTime(ev.end)}`;
    const remainStr = Utils.formatDuration(task.remainingDuration || 0) + ' ' + I18n.t('popover.remaining');
    const visLabel = task.visibility === 'free' ? I18n.t('modal.visibilityOptions.free') : I18n.t('modal.visibilityOptions.busy');

    let html = '';

    // ── Header ──
    html += `<div class="popover-header">`;
    html += `<span class="popover-title">${_esc(task.name)}</span>`;
    html += `<button class="popover-close" id="popoverClose" type="button" aria-label="${I18n.t('settings.close')}">&times;</button>`;
    html += `</div>`;

    // ── Info ──
    html += `<div class="popover-info">`;
    html += `<span class="popover-badge" style="background:${TaskModel.priorityColor(task.priority)}">${Utils.priorityBarsHTML(task.priority, true)} ${I18n.t(TaskModel.priorityLabel(task.priority))}</span>`;
    if (isLocked) {
      html += `<span class="popover-tag popover-tag-locked">${I18n.t('popover.locked')}</span>`;
    }
    if (isPinned) {
      html += `<span class="popover-tag popover-tag-locked">${I18n.t('calendar.pinned')}</span>`;
    }
    if (isRunning) {
      html += `<span class="popover-tag popover-tag-active">${I18n.t('popover.active')}</span>`;
    }
    html += `</div>`;

    html += `<div class="popover-meta">`;
    html += `<div class="popover-meta-row"><span class="popover-meta-icon">&#128340;</span> ${timeStr}</div>`;
    html += `<div class="popover-meta-row"><span class="popover-meta-icon">&#9202;</span> ${remainStr}</div>`;
    html += `<div class="popover-meta-row"><span class="popover-meta-icon">${task.visibility === 'busy' ? '&#128308;' : '&#9898;'}</span> ${visLabel}</div>`;
    html += `</div>`;

    // ── Actions ──
    if (uiMode === 'simple') {
      html += _renderClassicActions(ev, task, isLocked, isRunning, isDone, isPinned);
    } else {
      html += _renderEnhancedActions(ev, task, isLocked, isRunning, isDone, isPinned);
    }

    popover.innerHTML = html;

    // Bind close button
    const closeBtn = popover.querySelector('#popoverClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Bind action buttons
    _bindActions(popover, ev, task);
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /* ── Classic mode actions (icon-only gray buttons) ── */

  function _renderClassicActions(ev, task, isLocked, isRunning, isDone, isPinned) {
    let html = '<div class="popover-actions popover-actions-classic">';

    if (!isRunning) {
      html += `<button class="popover-btn-icon" data-action="start" title="${I18n.t('actions.start')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>`;
    }
    if (isRunning) {
      html += `<button class="popover-btn-icon" data-action="stop" title="${I18n.t('actions.stop')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      </button>`;
    }
    if (!isLocked) {
      html += `<button class="popover-btn-icon" data-action="lock" title="${I18n.t('actions.lock')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>`;
    } else {
      html += `<button class="popover-btn-icon" data-action="unlock" title="${I18n.t('actions.unlock')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
      </button>`;
    }
    if (isPinned) {
      html += `<button class="popover-btn-icon" data-action="unpin" title="${I18n.t('calendar.unpin')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    }
    html += `<button class="popover-btn-icon" data-action="done" title="${I18n.t('actions.done')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
    </button>`;
    html += `<button class="popover-btn-icon" data-action="addTime" title="${I18n.t('actions.addTime')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>`;
    html += `<button class="popover-btn-icon" data-action="logWork" title="${I18n.t('actions.logWork')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </button>`;
    html += `<button class="popover-btn-icon" data-action="edit" title="${I18n.t('actions.edit')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>`;
    html += `<button class="popover-btn-icon" data-action="duplicate" title="${I18n.t('taskDetail.duplicate')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    </button>`;
    html += `<button class="popover-btn-icon popover-btn-danger-icon" data-action="delete" title="${I18n.t('actions.delete')}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
    </button>`;

    html += '</div>';
    return html;
  }

  /* ── Enhanced mode actions (chip buttons with labels) ── */

  function _renderEnhancedActions(ev, task, isLocked, isRunning, isDone, isPinned) {
    let html = '<div class="popover-actions popover-actions-enhanced">';

    if (!isRunning) {
      html += `<button class="popover-chip popover-chip-green" data-action="start">${I18n.t('actions.start')}</button>`;
    }
    if (isRunning) {
      html += `<button class="popover-chip popover-chip-orange" data-action="stop">${I18n.t('actions.stop')}</button>`;
    }
    html += `<button class="popover-chip popover-chip-green" data-action="done">${I18n.t('actions.done')}</button>`;
    if (isDone) {
      html += `<button class="popover-chip popover-chip-blue" data-action="restart">${I18n.t('actions.restart')}</button>`;
    }
    if (!isLocked) {
      html += `<button class="popover-chip popover-chip-blue" data-action="lock">${I18n.t('actions.lock')}</button>`;
    } else {
      html += `<button class="popover-chip popover-chip-blue" data-action="unlock">${I18n.t('actions.unlock')}</button>`;
    }
    if (isPinned) {
      html += `<button class="popover-chip popover-chip-orange" data-action="unpin">${I18n.t('calendar.unpin')}</button>`;
    }
    html += `<button class="popover-chip popover-chip-default" data-action="addTime">${I18n.t('actions.addTime')}</button>`;
    html += `<button class="popover-chip popover-chip-default" data-action="logWork">${I18n.t('actions.logWork')}</button>`;
    html += `<button class="popover-chip popover-chip-blue" data-action="edit">${I18n.t('actions.edit')}</button>`;
    html += `<button class="popover-chip popover-chip-default" data-action="duplicate">${I18n.t('taskDetail.duplicate')}</button>`;
    html += `<button class="popover-chip popover-chip-red" data-action="delete">${I18n.t('actions.delete')}</button>`;

    html += '</div>';
    return html;
  }

  /* ═══════ BIND ACTIONS ═══════ */

  function _bindActions(popover, ev, task) {
    const buttons = popover.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        _handleAction(action, ev, task, btn);
      });
    });
  }

  function _handleAction(action, ev, task, btn) {
    switch (action) {
      case 'start':
        TaskActions.start(ev.taskId);
        close();
        break;
      case 'stop':
        TaskActions.stop(ev.taskId);
        close();
        break;
      case 'restart':
        TaskActions.restart(ev.taskId);
        close();
        break;
      case 'lock':
        TaskActions.lock(ev.taskId, ev.start, ev.end);
        close();
        break;
      case 'unlock':
        TaskActions.unlock(ev.taskId, ev.start);
        // Also clear pinnedTime if set
        Store.updateTask(ev.taskId, { pinnedTime: null });
        close();
        break;
      case 'unpin':
        Store.updateTask(ev.taskId, { pinnedTime: null });
        close();
        break;
      case 'addTime':
        TaskActions.addTime(ev.taskId, 30);
        close();
        break;
      case 'logWork': {
        const minutes = prompt(I18n.t('actions.logWork') + ' (min)', '30');
        const val = parseInt(minutes, 10);
        if (val > 0) {
          TaskActions.logWork(ev.taskId, val);
        }
        close();
        break;
      }
      case 'done':
        TaskActions.markDone(ev.taskId);
        close();
        break;
      case 'edit':
        close();
        // Re-fetch latest task data
        const latestTask = Store.getTask(ev.taskId);
        if (latestTask && typeof ModalView !== 'undefined') {
          ModalView.open(latestTask);
        }
        break;
      case 'duplicate':
        TaskActions.duplicateTask(ev.taskId);
        close();
        break;
      case 'delete':
        _handleDelete(ev, btn);
        break;
    }
  }

  function _handleDelete(ev, btn) {
    const uiMode = document.documentElement.getAttribute('data-ui-mode') || 'advanced';

    if (uiMode === 'advanced') {
      if (!_confirmingDelete) {
        _confirmingDelete = true;
        btn.textContent = I18n.t('actions.confirm');
        btn.classList.add('popover-chip-confirming');
        _confirmTimer = setTimeout(() => {
          _confirmingDelete = false;
          btn.textContent = I18n.t('actions.delete');
          btn.classList.remove('popover-chip-confirming');
        }, 3000);
        return;
      }
      _confirmingDelete = false;
      if (_confirmTimer) { clearTimeout(_confirmTimer); _confirmTimer = null; }
    } else {
      if (!confirm(I18n.t('actions.confirm'))) return;
    }

    TaskActions.deleteTask(ev.taskId);
    close();
  }

  /* ═══════ POSITIONING ═══════ */

  function _position(popover, anchorEl) {
    if (!anchorEl) return;

    const anchorRect = anchorEl.getBoundingClientRect();
    const popW = popover.offsetWidth || 280;
    const popH = popover.offsetHeight || 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;

    let left, top;

    // Try right of anchor
    left = anchorRect.right + gap;
    if (left + popW > vw - gap) {
      // Try left of anchor
      left = anchorRect.left - popW - gap;
      if (left < gap) {
        left = gap;
      }
    }

    // Vertical: align top of popover with top of anchor
    top = anchorRect.top;
    if (top + popH > vh - gap) {
      top = vh - popH - gap;
    }
    if (top < gap) {
      top = gap;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init, open, close };
})();
