/* ═══════════════════════════════════════════════════════════════════
   CALENDAR VIEW — PlanPilot
   Week-view calendar grid with event rendering, overlap handling,
   current-time indicator, week navigation, drag-to-create, and
   drag-to-resize interactions.
   ═══════════════════════════════════════════════════════════════════ */

const CalendarView = (() => {
  'use strict';

  /* ── State ── */
  let _weekStart = null;
  let _events = [];
  let _clockTimer = null;
  let _viewMode = 'week'; // 'day', '3day', 'week'

  /* ── Constants ── */
  const CAL_START_HOUR = 7;
  const CAL_END_HOUR = 22;
  const TOTAL_HOURS = CAL_END_HOUR - CAL_START_HOUR;
  const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HOUR_HEIGHT = 60;
  const SNAP_INCREMENT = 15;

  /* ── DOM refs (set on init) ── */
  let _container = null;
  let _dateRangeEl = null;

  /* ── Drag state ── */
  let _dragState = null;
  let _dragCreateBound = false;
  let _dragMoveBound = false;

  /* ── Move-drag state ── */
  let _moveDragging = false;
  let _moveState = null;

  /* ═══════ HELPERS ═══════ */

  function _getNumDays() {
    if (_viewMode === 'day') return 1;
    if (_viewMode === '3day') return 3;
    return 7;
  }

  /* ═══════ INIT ═══════ */

  function init() {
    _container = Utils.$('calendarContainer');
    _dateRangeEl = Utils.$('dateRange');

    if (!_container) return;

    _weekStart = Utils.startOfWeek(new Date());

    _buildGrid();
    _bindNav();
    _bindDragCreate();
    _bindDragMove();
    _bindViewToggle();
    render();

    // Listen for store changes
    document.addEventListener('store:changed', () => render());

    // Start clock (current-time line)
    _updateTimeLine();
    _clockTimer = setInterval(_updateTimeLine, 60000);
  }

  /* ═══════ VIEW TOGGLE ═══════ */

  function _bindViewToggle() {
    const toggleBtns = document.querySelectorAll('.cal-view-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _viewMode = btn.dataset.view;

        // Recalculate view start date based on new mode
        const today = new Date();
        if (_viewMode === 'week') {
          _weekStart = Utils.startOfWeek(today);
        } else {
          _weekStart = Utils.startOfDay(today);
        }

        _buildGrid();
        _bindDragCreate();
        _bindDragMove();
        render();

        // Scroll to current time
        const body = _container.querySelector('.cal-body');
        if (body) _scrollToCurrentTime(body);
      });
    });
  }

  /* ═══════ RENDER ═══════ */

  function render() {
    // Fetch tasks and schedule
    // Always schedule from today (not from displayed weekStart) so tasks
    // get the earliest available slot from now, not from midnight of some future day
    const tasks = Store.getAllTasks();
    const today = Utils.startOfWeek(new Date());
    _events = Scheduler.schedule(tasks, today, 14);

    _updateHeaders();
    _updateDateRange();
    _clearEvents();
    _renderEvents();
    _renderBlockedEvents();
    _updateTimeLine();
    _highlightToday();
    _applyHeatmap();
  }

  /* ═══════ BUILD GRID ═══════ */

  function _buildGrid() {
    _container.innerHTML = '';

    // Wrapper
    const grid = Utils.el('div', 'cal-grid');

    // ── Header row ──
    const headerRow = Utils.el('div', 'cal-header');

    // Time gutter header (empty corner)
    headerRow.appendChild(Utils.el('div', 'cal-header-gutter'));

    // Day column headers
    const numDays = _getNumDays();
    for (let d = 0; d < numDays; d++) {
      const col = Utils.el('div', 'cal-header-day');
      col.dataset.dayIndex = d;
      headerRow.appendChild(col);
    }
    grid.appendChild(headerRow);

    // ── Body (scrollable) ──
    const body = Utils.el('div', 'cal-body');

    // Time gutter + day columns wrapper
    const bodyInner = Utils.el('div', 'cal-body-inner');

    // Time gutter
    const gutter = Utils.el('div', 'cal-time-gutter');
    for (let h = CAL_START_HOUR; h < CAL_END_HOUR; h++) {
      const label = Utils.el('div', 'cal-time-label', {
        text: `${h.toString().padStart(2, '0')}:00`
      });
      gutter.appendChild(label);
    }
    bodyInner.appendChild(gutter);

    // Day columns
    const columnsWrap = Utils.el('div', 'cal-columns');
    for (let d = 0; d < numDays; d++) {
      const col = Utils.el('div', 'cal-day-column');
      col.dataset.dayIndex = d;

      // Hour cells (for grid lines)
      for (let h = CAL_START_HOUR; h < CAL_END_HOUR; h++) {
        const cell = Utils.el('div', 'cal-hour-cell');
        cell.dataset.hour = h;
        col.appendChild(cell);
      }

      columnsWrap.appendChild(col);
    }
    bodyInner.appendChild(columnsWrap);

    // Current time line (inside today's column only)
    const timeLine = Utils.el('div', 'cal-time-line');
    timeLine.id = 'calTimeLine';
    const timeDot = Utils.el('div', 'cal-time-dot');
    timeLine.appendChild(timeDot);
    // Will be placed in today's column during _updateTimeLine()

    body.appendChild(bodyInner);
    grid.appendChild(body);
    _container.appendChild(grid);

    // Scroll to ~current hour on first build
    _scrollToCurrentTime(body);
  }

  /* ═══════ HEADERS ═══════ */

  function _updateHeaders() {
    const headerDays = _container.querySelectorAll('.cal-header-day');
    headerDays.forEach((el, i) => {
      const day = Utils.addDays(_weekStart, i);
      const dayName = DAY_NAMES[day.getDay()];
      const dateNum = day.getDate();
      const monthName = MONTH_NAMES[day.getMonth()];

      el.innerHTML = '';
      const nameSpan = Utils.el('span', 'cal-header-day-name', { text: dayName });
      const dateSpan = Utils.el('span', 'cal-header-day-date', { text: dateNum });
      const monthSpan = Utils.el('span', 'cal-header-day-month', { text: monthName });

      el.appendChild(nameSpan);
      el.appendChild(dateSpan);
      el.appendChild(monthSpan);

      // Today highlight on header
      el.classList.toggle('is-today', Utils.isToday(day));
    });
  }

  function _updateDateRange() {
    if (!_dateRangeEl) return;
    const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
    const dayNamesLong = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const numDays = _getNumDays();

    if (numDays === 1) {
      // Day view: "Samedi 21 Mars 2026"
      const dayName = dayNamesLong[_weekStart.getDay()];
      _dateRangeEl.textContent = `${dayName} ${_weekStart.getDate()} ${monthNames[_weekStart.getMonth()]} ${_weekStart.getFullYear()}`;
    } else {
      const viewEnd = Utils.addDays(_weekStart, numDays - 1);
      const startDay = _weekStart.getDate();
      const endDay = viewEnd.getDate();

      if (_weekStart.getMonth() === viewEnd.getMonth()) {
        _dateRangeEl.textContent = `${startDay} - ${endDay} ${monthNames[viewEnd.getMonth()]} ${viewEnd.getFullYear()}`;
      } else {
        _dateRangeEl.textContent = `${startDay} ${monthNames[_weekStart.getMonth()]} - ${endDay} ${monthNames[viewEnd.getMonth()]} ${viewEnd.getFullYear()}`;
      }
    }
  }

  /* ═══════ DEADLINE HEATMAP ═══════ */

  function _applyHeatmap() {
    const headerDays = _container.querySelectorAll('.cal-header-day');
    const settings = Store.getSettings();

    headerDays.forEach((el, i) => {
      // Remove previous heatmap classes
      el.classList.remove('day-load-low', 'day-load-medium', 'day-load-high');

      const day = Utils.addDays(_weekStart, i);

      // Calculate total scheduled minutes for this day
      let scheduledMinutes = 0;
      for (const ev of _events) {
        if (Utils.isSameDay(ev.start, day)) {
          scheduledMinutes += ev.duration;
        }
      }

      // Calculate total available scheduling hours for this day
      const defaultSched = settings.defaultSchedulingHours || { startHour: 9, endHour: 17 };
      const availableHours = (defaultSched.endHour || 17) - (defaultSched.startHour || 9);
      const availableMinutes = availableHours * 60;

      if (availableMinutes <= 0 || scheduledMinutes <= 0) return;

      const load = scheduledMinutes / availableMinutes;

      if (load > 0.8) {
        el.classList.add('day-load-high');
      } else if (load >= 0.5) {
        el.classList.add('day-load-medium');
      } else {
        el.classList.add('day-load-low');
      }
    });
  }

  /* ═══════ TODAY HIGHLIGHT ═══════ */

  function _highlightToday() {
    const cols = _container.querySelectorAll('.cal-day-column');
    cols.forEach((col, i) => {
      const day = Utils.addDays(_weekStart, i);
      col.classList.toggle('is-today', Utils.isToday(day));
    });
  }

  /* ═══════ CURRENT TIME LINE ═══════ */

  function _updateTimeLine() {
    let line = document.getElementById('calTimeLine');

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Find today's column
    const numDays = _getNumDays();
    let todayColIdx = -1;
    for (let d = 0; d < numDays; d++) {
      const day = Utils.addDays(_weekStart, d);
      if (Utils.isToday(day)) { todayColIdx = d; break; }
    }

    // Remove line if not visible (outside hours or today not in view)
    if (todayColIdx < 0 || hours < CAL_START_HOUR || hours >= CAL_END_HOUR) {
      if (line) line.style.display = 'none';
      return;
    }

    // Create line if it doesn't exist
    if (!line) {
      line = Utils.el('div', 'cal-time-line');
      line.id = 'calTimeLine';
      const dot = Utils.el('div', 'cal-time-dot');
      line.appendChild(dot);
    }

    // Place inside today's column
    const cols = _container.querySelectorAll('.cal-day-column');
    const todayCol = cols[todayColIdx];
    if (!todayCol) return;
    if (line.parentNode !== todayCol) {
      todayCol.appendChild(line);
    }

    const top = (hours - CAL_START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    line.style.display = '';
    line.style.top = `${top}px`;
    line.style.width = '100%';
    line.style.left = '0';
  }

  function _scrollToCurrentTime(body) {
    if (!body) return;
    const now = new Date();
    const hours = now.getHours();
    if (hours >= CAL_START_HOUR && hours < CAL_END_HOUR) {
      const scrollTo = Math.max(0, (hours - CAL_START_HOUR - 1) * HOUR_HEIGHT);
      requestAnimationFrame(() => { body.scrollTop = scrollTo; });
    }
  }

  /* ═══════ NAVIGATION ═══════ */

  function _getNavStep() {
    if (_viewMode === 'day') return 1;
    if (_viewMode === '3day') return 3;
    return 7;
  }

  function _bindNav() {
    const btnPrev = Utils.$('btnPrev');
    const btnNext = Utils.$('btnNext');
    const btnToday = Utils.$('btnToday');

    if (btnPrev) btnPrev.addEventListener('click', () => {
      _weekStart = Utils.addDays(_weekStart, -_getNavStep());
      render();
    });
    if (btnNext) btnNext.addEventListener('click', () => {
      _weekStart = Utils.addDays(_weekStart, _getNavStep());
      render();
    });
    if (btnToday) btnToday.addEventListener('click', () => {
      if (_viewMode === 'week') {
        _weekStart = Utils.startOfWeek(new Date());
      } else {
        _weekStart = Utils.startOfDay(new Date());
      }
      render();
      // Re-scroll to current time
      const body = _container.querySelector('.cal-body');
      if (body) _scrollToCurrentTime(body);
    });
  }

  /* ═══════ DRAG HELPERS ═══════ */

  /** Convert a Y pixel offset within a column to total minutes from midnight */
  function _yToTotalMinutes(y) {
    return CAL_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  }

  /** Convert total minutes from midnight to a top-px offset */
  function _minutesToTop(totalMinutes) {
    return ((totalMinutes - CAL_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  }

  /** Snap total minutes to SNAP_INCREMENT */
  function _snapTotalMinutes(totalMinutes) {
    return Utils.snapMinutes(totalMinutes, SNAP_INCREMENT);
  }

  /** Get the day-column and Y offset from a mouse event.
   *  When the cursor is outside the column area, returns an edge hit
   *  with dayIndex = -1 (left of Monday) or 7 (right of Sunday). */
  function _hitTestColumn(e) {
    const columnsWrap = _container.querySelector('.cal-columns');
    if (!columnsWrap) return null;
    const cols = columnsWrap.querySelectorAll('.cal-day-column');
    for (let d = 0; d < cols.length; d++) {
      const rect = cols[d].getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        const y = e.clientY - rect.top + cols[d].closest('.cal-body').scrollTop;
        return { dayIndex: d, y, column: cols[d], rect };
      }
    }

    // Cursor is outside the columns — determine which edge
    const firstRect = cols[0].getBoundingClientRect();
    const lastRect = cols[cols.length - 1].getBoundingClientRect();
    const scrollTop = cols[0].closest('.cal-body').scrollTop;

    if (e.clientX < firstRect.left) {
      // Left of first column
      const y = e.clientY - firstRect.top + scrollTop;
      return { dayIndex: -1, y, column: cols[0], rect: firstRect, edge: 'left' };
    }
    if (e.clientX >= lastRect.left) {
      // Right of or at last column
      const y = e.clientY - lastRect.top + scrollTop;
      return { dayIndex: cols.length, y, column: cols[cols.length - 1], rect: lastRect, edge: 'right' };
    }

    // Fallback: find closest column by X distance
    let closestD = 0, closestDist = Infinity;
    for (let d = 0; d < cols.length; d++) {
      const r = cols[d].getBoundingClientRect();
      const dist = Math.abs(e.clientX - (r.left + r.right) / 2);
      if (dist < closestDist) { closestDist = dist; closestD = d; }
    }
    const closestRect = cols[closestD].getBoundingClientRect();
    const y = e.clientY - closestRect.top + scrollTop;
    return { dayIndex: closestD, y, column: cols[closestD], rect: closestRect };
  }

  /** Remove the ghost block if it exists */
  function _removeGhost() {
    const ghost = _container.querySelector('.cal-drag-ghost');
    if (ghost) ghost.remove();
  }

  /* ═══════ DRAG-TO-CREATE ═══════ */

  function _bindDragCreate() {
    if (_dragCreateBound) return;
    _dragCreateBound = true;
    _container.addEventListener('mousedown', _onDragCreateStart);
  }

  function _onDragCreateStart(e) {
    // Only left click
    if (e.button !== 0) return;

    // Ignore if clicking on an event block or resize handle
    if (e.target.closest('.cal-event') || e.target.closest('.cal-resize-handle')) return;

    // Only inside day columns (hour cells)
    if (!e.target.closest('.cal-day-column')) return;

    const hit = _hitTestColumn(e);
    if (!hit) return;

    const snappedMinutes = _snapTotalMinutes(_yToTotalMinutes(hit.y));

    _dragState = {
      type: 'create',
      dayIndex: hit.dayIndex,
      startMinutes: snappedMinutes,
      currentMinutes: snappedMinutes,
      column: hit.column
    };

    // Prevent text selection
    e.preventDefault();

    document.addEventListener('mousemove', _onDragCreateMove);
    document.addEventListener('mouseup', _onDragCreateEnd);
  }

  function _onDragCreateMove(e) {
    if (!_dragState || _dragState.type !== 'create') return;

    const hit = _hitTestColumn(e);
    if (!hit || hit.dayIndex !== _dragState.dayIndex) return;

    const snappedMinutes = _snapTotalMinutes(_yToTotalMinutes(hit.y));
    _dragState.currentMinutes = snappedMinutes;

    // Compute ghost position
    const topMin = Math.min(_dragState.startMinutes, snappedMinutes);
    const bottomMin = Math.max(_dragState.startMinutes, snappedMinutes);
    const duration = bottomMin - topMin;

    // Need at least 15 minutes for ghost to show
    if (duration < SNAP_INCREMENT) {
      _removeGhost();
      return;
    }

    const top = _minutesToTop(topMin);
    const height = (duration / 60) * HOUR_HEIGHT;

    // Create or update ghost
    let ghost = _container.querySelector('.cal-drag-ghost');
    if (!ghost) {
      ghost = Utils.el('div', 'cal-drag-ghost');
      _dragState.column.appendChild(ghost);
    }
    ghost.style.top = `${top}px`;
    ghost.style.height = `${height}px`;

    // Time label
    const startH = Math.floor(topMin / 60);
    const startM = topMin % 60;
    const endH = Math.floor(bottomMin / 60);
    const endM = bottomMin % 60;
    ghost.textContent = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  function _onDragCreateEnd(e) {
    document.removeEventListener('mousemove', _onDragCreateMove);
    document.removeEventListener('mouseup', _onDragCreateEnd);

    if (!_dragState || _dragState.type !== 'create') {
      _dragState = null;
      return;
    }

    const topMin = Math.min(_dragState.startMinutes, _dragState.currentMinutes);
    const bottomMin = Math.max(_dragState.startMinutes, _dragState.currentMinutes);
    const duration = bottomMin - topMin;

    _removeGhost();
    const dayIndex = _dragState.dayIndex;
    _dragState = null;

    // Need at least 15 minutes
    if (duration < SNAP_INCREMENT) return;

    // Compute the date for the day column
    const dayDate = Utils.addDays(_weekStart, dayIndex);

    // Open modal with pre-filled data
    ModalView.open(null);
    // After modal opens, prefill duration and start date
    setTimeout(() => {
      const fieldDuration = Utils.$('fieldDuration');
      if (fieldDuration) fieldDuration.value = duration;
      const fieldStartDate = Utils.$('fieldStartDate');
      if (fieldStartDate) fieldStartDate.value = Utils.toDateInputValue(dayDate);
    }, 50);
  }

  /* ═══════ DRAG-TO-RESIZE ═══════ */

  function _onResizeStart(e, ev, block) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const col = block.parentElement;
    if (!col) return;

    _dragState = {
      type: 'resize',
      event: ev,
      block: block,
      column: col,
      startHeight: parseFloat(block.style.height),
      startTop: parseFloat(block.style.top),
      initialY: e.clientY
    };

    document.addEventListener('mousemove', _onResizeMove);
    document.addEventListener('mouseup', _onResizeEnd);
  }

  function _onResizeMove(e) {
    if (!_dragState || _dragState.type !== 'resize') return;

    const deltaY = e.clientY - _dragState.initialY;
    let newHeight = _dragState.startHeight + deltaY;

    // Snap height to 15-min increments
    const minHeight = (SNAP_INCREMENT / 60) * HOUR_HEIGHT;
    const snappedHeight = Math.max(minHeight, Math.round(newHeight / minHeight) * minHeight);

    // Don't exceed calendar bounds
    const maxTop = TOTAL_HOURS * HOUR_HEIGHT;
    const clampedHeight = Math.min(snappedHeight, maxTop - _dragState.startTop);

    _dragState.block.style.height = `${clampedHeight}px`;

    // Update time label
    const ev = _dragState.event;
    const newDuration = Math.round((clampedHeight / HOUR_HEIGHT) * 60);
    const newEnd = Utils.addMinutes(ev.start, newDuration);
    const timeEl = _dragState.block.querySelector('.cal-event-time');
    if (timeEl) {
      timeEl.textContent = `${Utils.formatTime(ev.start)} - ${Utils.formatTime(newEnd)}`;
    }
    const durEl = _dragState.block.querySelector('.cal-event-duration');
    if (durEl) {
      durEl.textContent = Utils.formatDuration(newDuration);
    }
  }

  function _onResizeEnd(e) {
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup', _onResizeEnd);

    if (!_dragState || _dragState.type !== 'resize') {
      _dragState = null;
      return;
    }

    const ev = _dragState.event;
    const newHeight = parseFloat(_dragState.block.style.height);
    const newDuration = Math.max(SNAP_INCREMENT, Math.round((newHeight / HOUR_HEIGHT) * 60));
    const oldDuration = ev.duration;

    _dragState = null;

    // Only update if duration actually changed
    if (newDuration === oldDuration) return;

    // Calculate duration difference and update task
    const task = Store.getTask(ev.taskId);
    if (!task) return;

    const diff = newDuration - oldDuration;
    const newTotalDuration = Math.max(SNAP_INCREMENT, task.totalDuration + diff);
    const newRemaining = Math.max(0, task.remainingDuration + diff);

    Store.updateTask(ev.taskId, {
      totalDuration: newTotalDuration,
      remainingDuration: newRemaining
    });
  }

  /* ═══════ DRAG-TO-MOVE ═══════ */

  function _bindDragMove() {
    if (_dragMoveBound) return;
    _dragMoveBound = true;
    _container.addEventListener('mousedown', _onMoveStart);
  }

  function _onMoveStart(e) {
    if (e.button !== 0) return;

    // Only on .cal-event, NOT on resize handles or blocked events
    const eventEl = e.target.closest('.cal-event');
    if (!eventEl) return;
    if (e.target.closest('.cal-resize-handle')) return;
    if (eventEl.classList.contains('is-blocked')) return;

    const taskId = eventEl.dataset.taskId;
    if (!taskId) return;

    const ev = _events.find(ev => ev.taskId === taskId && eventEl.dataset.eventId === ev.id);
    if (!ev) return;

    e.preventDefault();

    _moveState = {
      taskId: taskId,
      event: ev,
      element: eventEl,
      startX: e.clientX,
      startY: e.clientY,
      active: false,   // becomes true after 5px threshold
      ghost: null,
      duration: ev.duration
    };

    document.addEventListener('mousemove', _onMoveMove);
    document.addEventListener('mouseup', _onMoveEnd);
  }

  function _onMoveMove(e) {
    if (!_moveState) return;

    const dx = e.clientX - _moveState.startX;
    const dy = e.clientY - _moveState.startY;

    // 5px movement threshold
    if (!_moveState.active) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      _moveState.active = true;
      _moveDragging = true;
      _moveState.element.classList.add('move-dragging');

      // Create ghost
      const ghost = Utils.el('div', 'cal-move-ghost');
      ghost.style.width = `${_moveState.element.offsetWidth}px`;
      ghost.style.height = `${_moveState.element.offsetHeight}px`;
      // Copy background color
      ghost.style.backgroundColor = _moveState.element.style.backgroundColor;
      _container.querySelector('.cal-columns').appendChild(ghost);
      _moveState.ghost = ghost;
    }

    // Find which column and Y position the cursor is over
    const hit = _hitTestColumn(e);
    if (!hit || hit.dayIndex < 0 || hit.dayIndex >= _getNumDays()) {
      // Outside valid columns — keep ghost but mark invalid
      if (_moveState.ghost) _moveState.ghost.style.opacity = '0.3';
      _moveState.lastHit = null;
      return;
    }

    if (_moveState.ghost) _moveState.ghost.style.opacity = '';

    // Snap Y to 15-min increments
    const totalMinutes = _yToTotalMinutes(hit.y);
    const snapped = _snapTotalMinutes(totalMinutes);
    const top = _minutesToTop(snapped);

    // Position ghost in the target column
    const col = _container.querySelectorAll('.cal-day-column')[hit.dayIndex];
    if (!col) return;

    const ghost = _moveState.ghost;
    if (!ghost) return;

    // Move ghost into this column if not already there
    if (ghost.parentElement !== col) {
      col.appendChild(ghost);
    }

    ghost.style.top = `${top}px`;
    ghost.style.position = 'absolute';
    ghost.style.left = '2px';
    ghost.style.right = '4px';
    ghost.style.width = '';

    // Time label on ghost
    const startH = Math.floor(snapped / 60);
    const startM = snapped % 60;
    const endMinutes = snapped + _moveState.duration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    ghost.innerHTML = `<div class="cal-move-ghost-title">${Store.getTask(_moveState.taskId)?.name || ''}</div>` +
                       `<div class="cal-move-ghost-time">${pad(startH)}:${pad(startM)} - ${pad(endH)}:${pad(endM)}</div>`;

    // Store last valid hit for drop
    _moveState.lastHit = { dayIndex: hit.dayIndex, snappedMinutes: snapped };
  }

  function _onMoveEnd(e) {
    document.removeEventListener('mousemove', _onMoveMove);
    document.removeEventListener('mouseup', _onMoveEnd);

    if (!_moveState) return;

    const wasActive = _moveState.active;

    // Clean up ghost and styling
    if (_moveState.ghost) _moveState.ghost.remove();
    if (_moveState.element) _moveState.element.classList.remove('move-dragging');

    if (wasActive && _moveState.lastHit) {
      const hit = _moveState.lastHit;
      const dayDate = Utils.addDays(_weekStart, hit.dayIndex);
      const hours = Math.floor(hit.snappedMinutes / 60);
      const minutes = hit.snappedMinutes % 60;

      // Build ISO datetime string
      const y = dayDate.getFullYear();
      const m = (dayDate.getMonth() + 1).toString().padStart(2, '0');
      const d = dayDate.getDate().toString().padStart(2, '0');
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      const pinnedTime = `${y}-${m}-${d}T${hh}:${mm}`;

      Store.updateTask(_moveState.taskId, { pinnedTime: pinnedTime });
    }

    // Suppress the click event that fires after mouseup if we were dragging
    if (wasActive) {
      setTimeout(() => { _moveDragging = false; }, 0);
    } else {
      _moveDragging = false;
    }

    _moveState = null;
  }

  /* ═══════ EVENT RENDERING ═══════ */

  function _clearEvents() {
    const existing = _container.querySelectorAll('.cal-event');
    existing.forEach(el => el.remove());
  }

  function _renderEvents() {
    // Group events by day column
    const numDays = _getNumDays();
    const dayBuckets = Array.from({ length: numDays }, () => []);

    for (const ev of _events) {
      // Find which day column this event belongs to
      for (let d = 0; d < numDays; d++) {
        const dayDate = Utils.addDays(_weekStart, d);
        if (Utils.isSameDay(ev.start, dayDate)) {
          dayBuckets[d].push(ev);
          break;
        }
      }
    }

    const columns = _container.querySelectorAll('.cal-day-column');

    dayBuckets.forEach((bucket, dayIdx) => {
      if (bucket.length === 0) return;
      const col = columns[dayIdx];
      if (!col) return;

      // Sort by start time
      bucket.sort((a, b) => a.start - b.start);

      // Compute overlap groups for column-packing
      const groups = _computeOverlapGroups(bucket);

      for (const group of groups) {
        const numCols = group.length;
        group.forEach((ev, colIdx) => {
          const el = _createEventElement(ev, numCols, colIdx);
          col.appendChild(el);
        });
      }
    });
  }

  /**
   * Compute overlap groups using a greedy column-packing approach.
   * Returns an array of columns, where each column contains non-overlapping events.
   * Each event is assigned a column index and knows the total columns in its group.
   */
  function _computeOverlapGroups(events) {
    if (events.length === 0) return [];

    // Build overlap clusters
    const clusters = [];
    let currentCluster = [events[0]];

    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      // Check if this event overlaps with any event in the current cluster
      const clusterEnd = Math.max(...currentCluster.map(e => e.end.getTime()));
      if (ev.start.getTime() < clusterEnd) {
        currentCluster.push(ev);
      } else {
        clusters.push(currentCluster);
        currentCluster = [ev];
      }
    }
    clusters.push(currentCluster);

    // For each cluster, assign columns
    const result = [];
    for (const cluster of clusters) {
      const columns = [];
      for (const ev of cluster) {
        let placed = false;
        for (let c = 0; c < columns.length; c++) {
          // Check if event fits in this column (no overlap with last event in column)
          const lastInCol = columns[c][columns[c].length - 1];
          if (ev.start.getTime() >= lastInCol.end.getTime()) {
            columns[c].push(ev);
            ev._col = c;
            placed = true;
            break;
          }
        }
        if (!placed) {
          ev._col = columns.length;
          columns.push([ev]);
        }
      }
      // Set total columns for each event in this cluster
      const totalCols = columns.length;
      for (const ev of cluster) {
        ev._totalCols = totalCols;
      }
      // Flatten into result
      for (const col of columns) {
        result.push(...col.map(ev => ev));
      }
    }

    return [result];
  }

  function _createEventElement(ev, numCols, colIdx) {
    // Position calculations
    const startHour = ev.start.getHours();
    const startMin = ev.start.getMinutes();
    const top = (startHour - CAL_START_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT;
    const height = Math.max((ev.duration / 60) * HOUR_HEIGHT, 18); // min height 18px

    // Overlap layout using event's _col and _totalCols
    const totalCols = ev._totalCols || 1;
    const col = ev._col || 0;
    const widthPct = 100 / totalCols;
    const leftPct = col * widthPct;

    // Build element
    const block = Utils.el('div', 'cal-event');
    block.dataset.eventId = ev.id;
    block.dataset.taskId = ev.taskId;

    // Positioning
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.left = `${leftPct}%`;
    block.style.width = `${widthPct}%`;

    // Color
    const color = TaskModel.priorityColor(ev.priority);
    block.style.backgroundColor = color;

    // Group color left border
    const task = Store.getTask(ev.taskId);
    if (task && task.groupId) {
      const group = Store.getGroups().find(g => g.id === task.groupId);
      if (group) {
        block.style.borderLeft = `3px solid ${group.color}`;
        block.dataset.groupColor = group.color;
      }
    }

    // State classes
    if (ev.locked) block.classList.add('is-locked');
    if (ev.isActive) block.classList.add('is-active');
    if (ev.visibility === 'free') block.classList.add('is-free');
    if (ev.habitEvent) block.classList.add('is-habit');

    // Content
    const titleEl = Utils.el('div', 'cal-event-title', { text: ev.taskName });
    block.appendChild(titleEl);

    // Time range
    const timeStr = `${Utils.formatTime(ev.start)} - ${Utils.formatTime(ev.end)}`;
    const timeEl = Utils.el('div', 'cal-event-time', { text: timeStr });
    block.appendChild(timeEl);

    // Priority badge (bars icon)
    const badge = Utils.el('span', 'cal-event-priority');
    badge.innerHTML = Utils.priorityBarsHTML(ev.priority);
    block.appendChild(badge);

    // Duration (show at bottom for taller events)
    if (height >= 50) {
      const durEl = Utils.el('div', 'cal-event-duration', {
        text: Utils.formatDuration(ev.duration)
      });
      block.appendChild(durEl);
    }

    // Resize handle at the bottom
    const resizeHandle = Utils.el('div', 'cal-resize-handle');
    block.appendChild(resizeHandle);

    // Resize handle mousedown
    resizeHandle.addEventListener('mousedown', (e) => {
      _onResizeStart(e, ev, block);
    });

    // Click handler — dispatch custom event
    block.addEventListener('click', (e) => {
      // Don't fire click if interacting with resize handle
      if (e.target.closest('.cal-resize-handle')) return;
      // Don't fire click if a drag-to-move just occurred
      if (_moveDragging) return;
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('event:click', {
        detail: { event: ev, element: block }
      }));
    });

    return block;
  }

  /* ═══════ BLOCKED EVENTS (ICS IMPORTS) ═══════ */

  function _renderBlockedEvents() {
    if (typeof ICSImport === 'undefined' || !ICSImport.getBlockedIntervals) return;

    const numDays = _getNumDays();
    const rangeStart = Utils.startOfDay(_weekStart);
    const rangeEnd = Utils.startOfDay(Utils.addDays(_weekStart, numDays));
    const blocked = ICSImport.getBlockedIntervals(rangeStart, rangeEnd);
    if (blocked.length === 0) return;

    const columns = _container.querySelectorAll('.cal-day-column');

    for (const bi of blocked) {
      const start = bi.start;
      // Find matching day column
      for (let d = 0; d < numDays; d++) {
        const dayDate = Utils.addDays(_weekStart, d);
        if (Utils.isSameDay(start, dayDate)) {
          const col = columns[d];
          if (!col) break;

          const startHour = start.getHours();
          const startMin = start.getMinutes();
          const end = bi.end;
          const durationMin = Utils.diffMinutes(end, start);
          const top = (startHour - CAL_START_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT;
          const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);

          const block = Utils.el('div', 'cal-event is-blocked');
          block.style.top = `${top}px`;
          block.style.height = `${height}px`;
          block.style.left = '0';
          block.style.width = '100%';

          const titleEl = Utils.el('div', 'cal-event-title', { text: bi.summary || '' });
          block.appendChild(titleEl);

          const timeStr = `${Utils.formatTime(start)} - ${Utils.formatTime(end)}`;
          const timeEl = Utils.el('div', 'cal-event-time', { text: timeStr });
          block.appendChild(timeEl);

          col.appendChild(block);
          break;
        }
      }
    }
  }

  /* ═══════ PUBLIC API ═══════ */

  function getWeekStart() { return _weekStart; }
  function getEvents() { return _events; }
  function setWeekStart(date) { _weekStart = date; render(); }

  return { init, render, getWeekStart, setWeekStart, getEvents };
})();
