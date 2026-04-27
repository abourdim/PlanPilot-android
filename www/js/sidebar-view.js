/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR VIEW — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const SidebarView = (() => {
  'use strict';

  const $ = Utils.$;
  let _currentFilter = 'scheduled';
  let _currentGroupFilter = null; // null means "all"
  let _searchQuery = '';
  let _activeTimerIntervalId = null;

  /* ── Filter logic ── */

  function _filterTasks(tasks, filter) {
    switch (filter) {
      case 'scheduled':
        return tasks.filter(t => t.status === 'scheduled');
      case 'doneScheduling':
        return tasks.filter(t => t.status === 'done_scheduling');
      case 'done':
        return tasks.filter(t => t.status === 'done');
      case 'habits':
        return tasks.filter(t => t.isHabit === true);
      default:
        return tasks;
    }
  }

  /* ── Search filter (delegates to Search module) ── */

  function _searchFilter(tasks, query) {
    if (typeof Search !== 'undefined' && Search.filter) {
      return Search.filter(tasks, query);
    }
    if (!query) return tasks;
    const q = query.toLowerCase();
    return tasks.filter(t => (t.name || '').toLowerCase().includes(q));
  }

  /* ── Count badges ── */

  function _updateCounts(tasks) {
    const scheduled = tasks.filter(t => t.status === 'scheduled').length;
    const doneScheduling = tasks.filter(t => t.status === 'done_scheduling').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const habits = tasks.filter(t => t.isHabit === true).length;

    const countScheduled = $('countScheduled');
    const countDoneScheduling = $('countDoneScheduling');
    const countDone = $('countDone');
    const countHabits = $('countHabits');

    if (countScheduled) countScheduled.textContent = scheduled;
    if (countDoneScheduling) countDoneScheduling.textContent = doneScheduling;
    if (countDone) countDone.textContent = done;
    if (countHabits) countHabits.textContent = habits;
  }

  /* ── Render a single task item ── */

  function _createTaskItem(task) {
    const item = Utils.el('div', 'task-item');
    item.dataset.taskId = task.id;
    item.setAttribute('draggable', 'true');

    // Drag-and-drop: set transfer data so Groups/Priorities panels can accept the drop
    item.addEventListener('dragstart', (e) => {
      // Only start drag if mouse has actually moved (browser handles this natively
      // for draggable elements — a simple click does not fire dragstart with movement)
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.setData('application/x-planpilot-task', task.id);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    // Priority bars icon
    const barsWrap = Utils.el('span', 'priority-dot-wrap');
    barsWrap.innerHTML = Utils.priorityBarsHTML(task.priority);
    item.appendChild(barsWrap);

    // Content wrapper
    const content = Utils.el('div', 'task-item-content');

    // Top row: name + up-next badge
    const topRow = Utils.el('div', 'task-item-top');
    const nameEl = Utils.el('span', 'task-item-name');
    if (_searchQuery && typeof Search !== 'undefined' && Search.highlight) {
      nameEl.innerHTML = Search.highlight(task.name || task.id, _searchQuery);
    } else {
      nameEl.textContent = task.name || task.id;
    }
    topRow.appendChild(nameEl);

    if (task.upNext) {
      const badge = Utils.el('span', 'task-item-upnext', { text: I18n.t('modal.upNext') });
      topRow.appendChild(badge);
    }

    // Dependency chain icon
    if (task.dependsOn && task.dependsOn.length > 0 && typeof Dependencies !== 'undefined') {
      const allTasks = Store.getAllTasks();
      const chain = Dependencies.getDependencyChain(task.id, allTasks);
      if (chain.length > 0) {
        const depIcon = Utils.el('span', 'task-item-dep-icon', {
          text: '\u26D3',
          title: I18n.t('dependency.chain') + ': ' + chain.join(' \u2192 ')
        });
        topRow.appendChild(depIcon);
      }
    }

    content.appendChild(topRow);

    // Bottom row: duration + due date
    const bottomRow = Utils.el('div', 'task-item-meta');
    const duration = Utils.el('span', 'task-item-duration', {
      text: Utils.formatDuration(task.remainingDuration || task.totalDuration || 0)
    });
    bottomRow.appendChild(duration);

    // Active task timer: show live countdown when pomodoro is running for this task
    if (typeof Pomodoro !== 'undefined') {
      const pomoState = Pomodoro.getState();
      if (pomoState.taskId === task.id && pomoState.running) {
        const timerSpan = Utils.el('span', 'task-timer');
        timerSpan.dataset.taskTimerId = task.id;
        _updateTimerDisplay(timerSpan, pomoState.remaining);
        bottomRow.appendChild(timerSpan);
      }
    }

    if (task.dueDate) {
      const due = Utils.parseDateInput(task.dueDate);
      if (due) {
        const dueEl = Utils.el('span', 'task-item-due', {
          text: Utils.formatDateShort(due)
        });
        bottomRow.appendChild(dueEl);
      }
    }
    content.appendChild(bottomRow);

    // Habit progress bar
    if (task.isHabit && typeof HabitsView !== 'undefined' && HabitsView.createProgressBar) {
      const progressBar = HabitsView.createProgressBar(task.id);
      if (progressBar) content.appendChild(progressBar);
    }

    item.appendChild(content);

    // Hover action buttons (Start, Done, Edit) — only for non-done tasks
    if (task.status !== 'done') {
      const hoverActions = Utils.el('div', 'task-item-hover-actions');

      const btnStart = Utils.el('button', 'task-hover-btn task-hover-btn-start', { title: I18n.t('taskDetail.start') });
      btnStart.innerHTML = '&#9654;';
      btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        TaskActions.start(task.id);
      });
      hoverActions.appendChild(btnStart);

      const btnDone = Utils.el('button', 'task-hover-btn task-hover-btn-done', { title: I18n.t('taskDetail.done') });
      btnDone.innerHTML = '&#10003;';
      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        TaskActions.markDone(task.id);
      });
      hoverActions.appendChild(btnDone);

      const btnEdit = Utils.el('button', 'task-hover-btn task-hover-btn-edit', { title: I18n.t('taskDetail.edit') });
      btnEdit.innerHTML = '&#9998;';
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = Store.getTask(task.id);
        if (t && typeof ModalView !== 'undefined') ModalView.open(t);
      });
      hoverActions.appendChild(btnEdit);

      const btnDuplicate = Utils.el('button', 'task-hover-btn task-hover-btn-duplicate', { title: I18n.t('taskDetail.duplicate') });
      btnDuplicate.innerHTML = '&#10697;';
      btnDuplicate.addEventListener('click', (e) => {
        e.stopPropagation();
        TaskActions.duplicateTask(task.id);
      });
      hoverActions.appendChild(btnDuplicate);

      const btnView = Utils.el('button', 'task-hover-btn task-hover-btn-view-cal', { title: I18n.t('taskDetail.viewInCalendar') });
      btnView.innerHTML = '&#128197;';
      btnView.addEventListener('click', (e) => {
        e.stopPropagation();
        _highlightCalendarEvents(task.id);
      });
      hoverActions.appendChild(btnView);

      const btnDelete = Utils.el('button', 'task-hover-btn task-hover-btn-delete', { title: I18n.t('taskDetail.delete') });
      btnDelete.innerHTML = '&#128465;';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(I18n.t('taskDetail.confirmDelete'))) {
          Store.deleteTask(task.id);
        }
      });
      hoverActions.appendChild(btnDelete);

      item.appendChild(hoverActions);
    }

    // Single click → switch to calendar + highlight
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('view:requestCalendar'));
      setTimeout(() => _highlightCalendarEvents(task.id), 100);
    });

    // Double click → open edit modal directly
    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (typeof ModalView !== 'undefined' && ModalView.open) {
        ModalView.open(task);
      }
    });

    return item;
  }

  /* ── Task Detail Card ── */

  /* ── Highlight calendar events for a task ── */

  function _highlightCalendarEvents(taskId) {
    // Remove previous highlights
    document.querySelectorAll('.cal-event.cal-event-highlight').forEach(el => {
      el.classList.remove('cal-event-highlight');
    });

    // First, navigate to the week containing this task's scheduled events
    if (typeof CalendarView !== 'undefined' && CalendarView.setWeekStart) {
      // Try to find the task's due date or start date to navigate to the right week
      const task = Store.getTask(taskId);
      if (task) {
        // Use startDate or dueDate to navigate to the correct week
        const targetDate = task.startDate ? new Date(task.startDate) :
                           task.dueDate ? new Date(task.dueDate) : null;
        if (targetDate && !isNaN(targetDate)) {
          const targetWeek = Utils.startOfWeek(targetDate);
          const currentWeek = CalendarView.getWeekStart();
          // Navigate if we're on a different week
          if (targetWeek.getTime() !== currentWeek.getTime()) {
            CalendarView.setWeekStart(targetWeek);
          }
        }
      }
    }

    // Now query for visible events
    let events = document.querySelectorAll('.cal-event[data-task-id="' + taskId + '"]');

    // If still no events, try scheduling from the current week
    if (events.length === 0 && typeof CalendarView !== 'undefined') {
      // Force a re-render
      CalendarView.render();
      events = document.querySelectorAll('.cal-event[data-task-id="' + taskId + '"]');
    }

    if (events.length === 0) return;

    // Scroll within the calendar body (not the page)
    const calBody = document.querySelector('.cal-body');
    if (calBody) {
      const eventRect = events[0].getBoundingClientRect();
      const bodyRect = calBody.getBoundingClientRect();
      const scrollTarget = calBody.scrollTop + (eventRect.top - bodyRect.top) - (bodyRect.height / 2);
      calBody.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    }

    // Add highlight pulse class to all matching events
    events.forEach(el => {
      el.classList.add('cal-event-highlight');
    });

    // Remove highlight after animation
    setTimeout(() => {
      events.forEach(el => el.classList.remove('cal-event-highlight'));
    }, 2000);
  }

  /* ── Group filter bar ── */

  function _renderGroupFilterBar() {
    const taskList = $('taskList');
    if (!taskList) return;

    // Remove ALL existing bars (prevent duplicates)
    taskList.parentElement.querySelectorAll('.group-filter-bar').forEach(el => el.remove());

    const groups = Store.getGroups();
    if (!groups || groups.length === 0) return;

    const bar = document.createElement('div');
    bar.className = 'group-filter-bar';

    // "Tous" pill
    const allPill = document.createElement('button');
    allPill.className = 'group-filter-pill' + (!_currentGroupFilter ? ' active' : '');
    allPill.textContent = I18n.t('groups.all');
    allPill.addEventListener('click', () => {
      _currentGroupFilter = null;
      render();
    });
    bar.appendChild(allPill);

    // Group pills
    groups.forEach(g => {
      const pill = document.createElement('button');
      pill.className = 'group-filter-pill' + (_currentGroupFilter === g.id ? ' active' : '');
      pill.style.setProperty('--pill-color', g.color);
      pill.innerHTML = `<span class="group-filter-dot" style="background:${g.color}"></span>${g.name}`;
      pill.addEventListener('click', () => {
        _currentGroupFilter = g.id;
        render();
      });
      bar.appendChild(pill);
    });

    // Quick "+" button to add a new group
    const addBtn = document.createElement('button');
    addBtn.className = 'group-add-btn';
    addBtn.title = I18n.t('groups.add');
    addBtn.textContent = '+';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentGroups = Store.getGroups();
      if (currentGroups.length >= 8) {
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(I18n.t('groups.maxReached'), 'warning', 3000);
        }
        return;
      }
      const name = prompt(I18n.t('groups.name'));
      if (!name || !name.trim()) return;
      // Pick next available color automatically
      const GROUP_PALETTE = ['#9b59b6', '#2ecc71', '#1abc9c', '#e74c3c', '#95a5a6', '#3498db', '#e67e22', '#f1c40f'];
      const usedColors = new Set(currentGroups.map(g => g.color));
      const color = GROUP_PALETTE.find(c => !usedColors.has(c)) || GROUP_PALETTE[0];
      Store.saveGroup({ name: name.trim(), color });
      render();
    });
    bar.appendChild(addBtn);

    // Insert before the task list
    taskList.parentElement.insertBefore(bar, taskList);
  }

  /* ── Active task timer helpers ── */

  function _updateTimerDisplay(el, remainingSeconds) {
    if (remainingSeconds <= 0) {
      el.textContent = '00:00';
      el.className = 'task-timer task-timer-red';
      return;
    }
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    const s = remainingSeconds % 60;
    if (h > 0) {
      el.textContent = h + 'h' + String(m).padStart(2, '0');
    } else {
      el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    const totalMin = remainingSeconds / 60;
    if (totalMin < 2) {
      el.className = 'task-timer task-timer-red';
    } else if (totalMin < 10) {
      el.className = 'task-timer task-timer-orange';
    } else {
      el.className = 'task-timer task-timer-green';
    }
  }

  function _startActiveTimerInterval() {
    // Clear any existing interval
    if (_activeTimerIntervalId) {
      clearInterval(_activeTimerIntervalId);
      _activeTimerIntervalId = null;
    }
    // Only start if there's an active pomodoro
    if (typeof Pomodoro === 'undefined') return;
    const pomoState = Pomodoro.getState();
    if (!pomoState.running || !pomoState.taskId) return;

    _activeTimerIntervalId = setInterval(() => {
      const state = Pomodoro.getState();
      if (!state.running || !state.taskId) {
        clearInterval(_activeTimerIntervalId);
        _activeTimerIntervalId = null;
        render();
        return;
      }
      const timerEl = document.querySelector('.task-timer[data-task-timer-id="' + state.taskId + '"]');
      if (timerEl) {
        _updateTimerDisplay(timerEl, state.remaining);
      } else {
        // Timer element gone (re-render happened), stop interval
        clearInterval(_activeTimerIntervalId);
        _activeTimerIntervalId = null;
      }
    }, 1000);
  }

  /* ── Render task list ── */

  let _rendering = false;

  function render() {
    // Guard against re-entrant rendering (e.g. Store.getGroups() may
    // seed defaults and fire store:changed synchronously)
    if (_rendering) return;
    _rendering = true;

    const taskList = $('taskList');
    const emptyState = $('emptyState');
    if (!taskList) { _rendering = false; return; }

    // Remove existing task items (keep empty state element)
    const existingItems = taskList.querySelectorAll('.task-item');
    existingItems.forEach(el => el.remove());

    const allTasks = Store.getAllTasks();

    // Update count badges
    _updateCounts(allTasks);

    // Filter
    let filtered = _filterTasks(allTasks, _currentFilter);
    filtered = _searchFilter(filtered, _searchQuery);

    // Group filter
    if (_currentGroupFilter) {
      filtered = filtered.filter(t => t.groupId === _currentGroupFilter);
    }

    // Render group filter bar
    _renderGroupFilterBar();

    // Sort
    filtered.sort(TaskModel.compareForScheduling);

    // Show/hide empty state
    if (emptyState) {
      emptyState.style.display = filtered.length === 0 ? '' : 'none';
    }

    // Render items
    const fragment = document.createDocumentFragment();
    filtered.forEach(task => {
      fragment.appendChild(_createTaskItem(task));
    });

    // Insert before empty state
    if (emptyState) {
      taskList.insertBefore(fragment, emptyState);
    } else {
      taskList.appendChild(fragment);
    }

    // Start live timer interval for active pomodoro task
    _startActiveTimerInterval();

    _rendering = false;
  }

  /* ── Bind events ── */

  function _bindEvents() {
    // Tab clicks
    const tabs = $('sidebarTabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        const filter = btn.dataset.filter;
        if (!filter) return;

        // Update active tab
        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');

        _currentFilter = filter;
        render();
      });
    }

    // New task button
    const btnNew = $('btnNewTask');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        if (typeof ModalView !== 'undefined' && ModalView.open) {
          ModalView.open();
        }
      });
    }

    // Search input
    const searchInput = $('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        _searchQuery = e.target.value.trim();
        render();
      }, 200));
    }

    // Search clear
    const searchClear = $('searchClear');
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        const searchInput = $('searchInput');
        if (searchInput) {
          searchInput.value = '';
          _searchQuery = '';
          render();
        }
      });
    }

    // Listen for store changes
    document.addEventListener('store:changed', () => {
      render();
    });

    // Mobile menu toggle
    const btnMenu = $('btnMenuToggle');
    const sidebar = $('sidebar');
    if (btnMenu && sidebar) {
      btnMenu.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // Close sidebar on clicking outside (mobile)
      const mainContent = $('mainContent');
      if (mainContent) {
        mainContent.addEventListener('click', () => {
          if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        });
      }
    }
  }

  /* ── Public API ── */

  function init() {
    _bindEvents();
    render();
  }

  return { init, render };
})();
