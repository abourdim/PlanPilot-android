/* ═══════════════════════════════════════════════════════════════════
   TOUCH GESTURES — PlanPilot
   Mobile-friendly swipe & long-press gestures for sidebar task items.
   - Swipe right → mark as done
   - Swipe left  → open edit modal
   - Long-press  → show context menu popover
   ═══════════════════════════════════════════════════════════════════ */

const TouchGestures = (() => {
  'use strict';

  const SWIPE_THRESHOLD = 60;     // px to trigger swipe
  const LONG_PRESS_MS   = 500;    // ms for long-press

  let _touchState = null;

  /* ═══════ HELPERS ═══════ */

  function _t(key, fallback) {
    if (typeof I18n !== 'undefined' && I18n.t) {
      const val = I18n.t(key);
      return val !== key ? val : (fallback || key);
    }
    return fallback || key;
  }

  /* ═══════ INIT ═══════ */

  function init() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    // Use event delegation on the task list
    taskList.addEventListener('touchstart', _onTouchStart, { passive: false });
    taskList.addEventListener('touchmove', _onTouchMove, { passive: false });
    taskList.addEventListener('touchend', _onTouchEnd, { passive: false });
  }

  /* ═══════ TOUCH HANDLERS ═══════ */

  function _onTouchStart(e) {
    const item = e.target.closest('.task-item');
    if (!item) return;

    const touch = e.touches[0];
    _touchState = {
      item: item,
      taskId: item.dataset.taskId,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      swiping: false,
      longPressTimer: null,
      longPressFired: false,
      overlay: null
    };

    // Start long-press timer
    _touchState.longPressTimer = setTimeout(() => {
      if (_touchState && !_touchState.swiping) {
        _touchState.longPressFired = true;
        _showContextMenu(_touchState.item, _touchState.taskId);
      }
    }, LONG_PRESS_MS);
  }

  function _onTouchMove(e) {
    if (!_touchState) return;

    const touch = e.touches[0];
    _touchState.deltaX = touch.clientX - _touchState.startX;
    _touchState.deltaY = touch.clientY - _touchState.startY;

    // If vertical scroll dominates, cancel gesture
    if (Math.abs(_touchState.deltaY) > Math.abs(_touchState.deltaX) && !_touchState.swiping) {
      _cancelTouch();
      return;
    }

    // If horizontal movement exceeds a small threshold, start swiping
    if (Math.abs(_touchState.deltaX) > 15) {
      _touchState.swiping = true;
      // Cancel long-press
      if (_touchState.longPressTimer) {
        clearTimeout(_touchState.longPressTimer);
        _touchState.longPressTimer = null;
      }
      e.preventDefault(); // prevent scroll while swiping

      // Apply swipe transform
      const dx = _touchState.deltaX;
      const clampedDx = Math.max(-120, Math.min(120, dx));
      _touchState.item.style.transform = `translateX(${clampedDx}px)`;
      _touchState.item.style.transition = 'none';

      // Show/update overlay
      _updateSwipeOverlay(_touchState.item, dx);
    }
  }

  function _onTouchEnd(e) {
    if (!_touchState) return;

    // Clear long-press timer
    if (_touchState.longPressTimer) {
      clearTimeout(_touchState.longPressTimer);
    }

    // If long-press already fired, just clean up
    if (_touchState.longPressFired) {
      _touchState = null;
      return;
    }

    const dx = _touchState.deltaX;
    const item = _touchState.item;
    const taskId = _touchState.taskId;

    // Remove overlay
    _removeSwipeOverlay(item);

    if (_touchState.swiping && Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx > 0) {
        // Swipe right → mark done
        _animateSwipeComplete(item, 'right', () => {
          if (taskId && typeof TaskActions !== 'undefined' && TaskActions.markDone) {
            TaskActions.markDone(taskId);
          }
          _showConfirmationOverlay(item, 'done');
        });
      } else {
        // Swipe left → open edit modal
        _animateSwipeComplete(item, 'left', () => {
          if (taskId) {
            const task = Store.getTask(taskId);
            if (task && typeof ModalView !== 'undefined' && ModalView.open) {
              ModalView.open(task);
            }
          }
        });
      }
    } else {
      // Snap back
      item.style.transition = 'transform 0.2s ease-out';
      item.style.transform = '';
      setTimeout(() => {
        item.style.transition = '';
      }, 200);
    }

    _touchState = null;
  }

  function _cancelTouch() {
    if (!_touchState) return;
    if (_touchState.longPressTimer) {
      clearTimeout(_touchState.longPressTimer);
    }
    _removeSwipeOverlay(_touchState.item);
    _touchState.item.style.transform = '';
    _touchState.item.style.transition = '';
    _touchState = null;
  }

  /* ═══════ SWIPE OVERLAY ═══════ */

  function _updateSwipeOverlay(item, dx) {
    let overlay = item.querySelector('.swipe-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'swipe-overlay';
      item.style.position = 'relative';
      item.appendChild(overlay);
    }

    if (dx > 0) {
      // Right swipe → green (done)
      overlay.classList.add('swipe-done');
      overlay.classList.remove('swipe-edit');
      overlay.textContent = _t('actions.done', 'Termine');
      overlay.style.opacity = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD * 0.8);
    } else {
      // Left swipe → blue (edit)
      overlay.classList.remove('swipe-done');
      overlay.classList.add('swipe-edit');
      overlay.textContent = _t('actions.edit', 'Modifier');
      overlay.style.opacity = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD * 0.8);
    }
  }

  function _removeSwipeOverlay(item) {
    if (!item) return;
    const overlay = item.querySelector('.swipe-overlay');
    if (overlay) overlay.remove();
  }

  /* ═══════ SWIPE ANIMATION ═══════ */

  function _animateSwipeComplete(item, direction, callback) {
    const target = direction === 'right' ? '100%' : '-100%';
    item.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
    item.style.transform = `translateX(${target})`;
    item.style.opacity = '0';
    setTimeout(() => {
      item.style.transition = '';
      item.style.transform = '';
      item.style.opacity = '';
      if (callback) callback();
    }, 300);
  }

  /* ═══════ CONFIRMATION OVERLAY (green flash) ═══════ */

  function _showConfirmationOverlay(item, type) {
    // Show a brief green confirmation flash on the task list
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    const flash = document.createElement('div');
    flash.className = 'swipe-confirmation';
    flash.textContent = _t('actions.done', 'Termine');
    taskList.appendChild(flash);

    // Trigger animation
    requestAnimationFrame(() => {
      flash.classList.add('visible');
      setTimeout(() => {
        flash.classList.remove('visible');
        setTimeout(() => flash.remove(), 300);
      }, 800);
    });
  }

  /* ═══════ LONG-PRESS CONTEXT MENU ═══════ */

  function _showContextMenu(item, taskId) {
    if (!taskId) return;
    const task = Store.getTask(taskId);
    if (!task) return;

    // Cancel any ongoing swipe
    item.style.transform = '';
    item.style.transition = '';

    // Vibrate for haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(50);

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'touch-context-menu';

    const actions = [
      { label: _t('actions.start', 'Demarrer'),  icon: 'play',  action: 'start'  },
      { label: _t('actions.edit', 'Modifier'),    icon: 'edit',  action: 'edit'   },
      { label: _t('actions.delete', 'Supprimer'), icon: 'trash', action: 'delete' }
    ];

    const icons = {
      play:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
      edit:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    };

    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'touch-context-btn';
      if (a.action === 'delete') btn.classList.add('danger');
      btn.innerHTML = `${icons[a.icon]}<span>${a.label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _dismissContextMenu();
        switch (a.action) {
          case 'start':
            if (typeof TaskActions !== 'undefined' && TaskActions.start) TaskActions.start(taskId);
            break;
          case 'edit':
            if (typeof ModalView !== 'undefined' && ModalView.open) ModalView.open(task);
            break;
          case 'delete':
            if (typeof TaskActions !== 'undefined' && TaskActions.deleteTask) TaskActions.deleteTask(taskId);
            break;
        }
      });
      menu.appendChild(btn);
    });

    // Position menu near the item
    const rect = item.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = (rect.left + 16) + 'px';

    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'touch-context-backdrop';
    backdrop.addEventListener('click', _dismissContextMenu);
    backdrop.addEventListener('touchstart', _dismissContextMenu);

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);

    // Animate in
    requestAnimationFrame(() => menu.classList.add('visible'));
  }

  function _dismissContextMenu() {
    const menu = document.querySelector('.touch-context-menu');
    const backdrop = document.querySelector('.touch-context-backdrop');
    if (menu) {
      menu.classList.remove('visible');
      setTimeout(() => menu.remove(), 200);
    }
    if (backdrop) backdrop.remove();
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init };
})();
