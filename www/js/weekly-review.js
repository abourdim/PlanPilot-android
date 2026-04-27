/* ═══════════════════════════════════════════════════════════════════
   WEEKLY REVIEW — PlanPilot
   Generate and display a weekly summary: completed tasks, slipped
   tasks, total focus time, next week's load, and pomodoro count.
   ═══════════════════════════════════════════════════════════════════ */

const WeeklyReview = (() => {
  'use strict';

  const $ = Utils.$;

  /* ═══════ DATA GENERATION ═══════ */

  /**
   * Generate weekly review data for a given week start (Monday).
   * @param {Date} weekStart - Monday of the week to review
   * @returns {Object} review data
   */
  function generate(weekStart) {
    const ws = Utils.startOfDay(weekStart || Utils.startOfWeek(new Date()));
    const we = Utils.addDays(ws, 7);
    const now = new Date();

    const tasks = Store.getAllTasks();
    const events = Scheduler.schedule(tasks, ws, 7);
    const completionLog = Store.getCompletionLog();

    // ── Completed this week ──
    const completedThisWeek = [];
    for (const task of tasks) {
      if (task.status === 'done') {
        // Check if completed within this week (via updatedAt or completionLog)
        const completedAt = task.updatedAt || task.createdAt;
        if (completedAt >= ws.getTime() && completedAt < we.getTime()) {
          completedThisWeek.push({
            name: task.name,
            duration: task.totalDuration || 0
          });
        }
      }
    }

    // Also check completion log entries for this week
    for (const entry of completionLog) {
      if (entry.timestamp >= ws.getTime() && entry.timestamp < we.getTime()) {
        // Avoid duplicates
        if (!completedThisWeek.find(c => c.name === entry.taskName)) {
          completedThisWeek.push({
            name: entry.taskName || entry.name || 'Tache',
            duration: entry.duration || 0
          });
        }
      }
    }

    // ── Slipped tasks (had events but not completed, past due) ──
    const slippedTasks = [];
    for (const task of tasks) {
      if (task.status === 'done') continue;
      // Has events scheduled in this week range
      const hasEvents = events.some(ev => ev.taskId === task.id);
      if (!hasEvents) continue;

      // Past due date
      const dueDate = task.dueDate ? Utils.parseDateInput(task.dueDate) : null;
      if (dueDate && dueDate < now) {
        slippedTasks.push({
          name: task.name,
          dueDate: task.dueDate,
          remaining: task.remainingDuration || 0
        });
      }
    }

    // ── Total focus time this week ──
    let totalFocusMinutes = 0;
    for (const ev of events) {
      totalFocusMinutes += ev.duration || 0;
    }

    // ── Next week's load ──
    const nextWeekStart = Utils.addDays(ws, 7);
    const nextWeekEvents = Scheduler.schedule(tasks, nextWeekStart, 7);
    const nextWeekTasks = [];
    const seenTaskIds = new Set();
    for (const ev of nextWeekEvents) {
      if (seenTaskIds.has(ev.taskId)) continue;
      seenTaskIds.add(ev.taskId);
      const task = tasks.find(t => t.id === ev.taskId);
      if (task) {
        nextWeekTasks.push({
          name: task.name,
          remaining: task.remainingDuration || 0
        });
      }
    }

    // ── Pomodoro count (from completion log) ──
    let pomodoroCount = 0;
    for (const entry of completionLog) {
      if (entry.timestamp >= ws.getTime() && entry.timestamp < we.getTime()) {
        if (entry.pomodoros) pomodoroCount += entry.pomodoros;
      }
    }

    return {
      weekStart: ws,
      weekEnd: we,
      completed: completedThisWeek,
      slipped: slippedTasks,
      totalFocusMinutes,
      nextWeekTasks,
      pomodoroCount
    };
  }

  /* ═══════ RENDER ═══════ */

  function _render() {
    const panel = $('weeklyReviewPanel');
    if (!panel) return;

    const data = generate();

    panel.innerHTML = `
      <div class="wr-container">
        <div class="wr-header">
          <h2 class="wr-title">${I18n.t('weeklyReview.title')}</h2>
          <button class="modal-close" id="wrClose" type="button" aria-label="${I18n.t('settings.close')}">&times;</button>
        </div>

        <div class="wr-period">
          ${Utils.formatDateShort(data.weekStart)} - ${Utils.formatDateShort(data.weekEnd)}
        </div>

        <div class="wr-grid">

          <!-- Focus time card -->
          <div class="wr-card">
            <div class="wr-card-header">${I18n.t('weeklyReview.focusTime')}</div>
            <div class="wr-card-value">${Utils.formatDuration(data.totalFocusMinutes)}</div>
            ${data.pomodoroCount > 0 ? `<div class="wr-card-sub">${data.pomodoroCount} pomodoros</div>` : ''}
          </div>

          <!-- Completed card -->
          <div class="wr-card">
            <div class="wr-card-header">${I18n.t('weeklyReview.completed')} (${data.completed.length})</div>
            <div class="wr-card-body">
              ${data.completed.length === 0
                ? `<div class="wr-empty">${I18n.t('weeklyReview.noCompleted')}</div>`
                : `<ul class="wr-list">${data.completed.map(t =>
                    `<li class="wr-list-item">
                      <span class="wr-task-name">${_escHtml(t.name)}</span>
                      <span class="wr-task-duration">${Utils.formatDuration(t.duration)}</span>
                    </li>`
                  ).join('')}</ul>`
              }
            </div>
          </div>

          <!-- Slipped card -->
          <div class="wr-card wr-card-warn">
            <div class="wr-card-header">${I18n.t('weeklyReview.slipped')} (${data.slipped.length})</div>
            <div class="wr-card-body">
              ${data.slipped.length === 0
                ? `<div class="wr-empty">${I18n.t('weeklyReview.noSlipped')}</div>`
                : `<ul class="wr-list">${data.slipped.map(t =>
                    `<li class="wr-list-item">
                      <span class="wr-task-name">${_escHtml(t.name)}</span>
                      <span class="wr-task-due">${t.dueDate}</span>
                    </li>`
                  ).join('')}</ul>`
              }
            </div>
          </div>

          <!-- Next week card -->
          <div class="wr-card">
            <div class="wr-card-header">${I18n.t('weeklyReview.nextWeek')} (${data.nextWeekTasks.length})</div>
            <div class="wr-card-body">
              ${data.nextWeekTasks.length === 0
                ? `<div class="wr-empty">${I18n.t('weeklyReview.noUpcoming')}</div>`
                : `<ul class="wr-list">${data.nextWeekTasks.map(t =>
                    `<li class="wr-list-item">
                      <span class="wr-task-name">${_escHtml(t.name)}</span>
                      <span class="wr-task-duration">${Utils.formatDuration(t.remaining)}</span>
                    </li>`
                  ).join('')}</ul>`
              }
            </div>
          </div>

        </div>

        <!-- Copy button -->
        <div class="wr-actions">
          <button class="btn-secondary" id="wrCopy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            ${I18n.t('weeklyReview.copy')}
          </button>
        </div>
      </div>
    `;

    _bindEvents(panel);
  }

  function _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ═══════ PLAIN TEXT EXPORT ═══════ */

  function _generatePlainText() {
    const data = generate();
    const lines = [];
    lines.push(`=== ${I18n.t('weeklyReview.title')} ===`);
    lines.push(`${Utils.formatDateShort(data.weekStart)} - ${Utils.formatDateShort(data.weekEnd)}`);
    lines.push('');

    lines.push(`-- ${I18n.t('weeklyReview.focusTime')} --`);
    lines.push(Utils.formatDuration(data.totalFocusMinutes));
    if (data.pomodoroCount > 0) lines.push(`${data.pomodoroCount} pomodoros`);
    lines.push('');

    lines.push(`-- ${I18n.t('weeklyReview.completed')} (${data.completed.length}) --`);
    if (data.completed.length === 0) {
      lines.push(I18n.t('weeklyReview.noCompleted'));
    } else {
      for (const t of data.completed) {
        lines.push(`  - ${t.name} (${Utils.formatDuration(t.duration)})`);
      }
    }
    lines.push('');

    lines.push(`-- ${I18n.t('weeklyReview.slipped')} (${data.slipped.length}) --`);
    if (data.slipped.length === 0) {
      lines.push(I18n.t('weeklyReview.noSlipped'));
    } else {
      for (const t of data.slipped) {
        lines.push(`  - ${t.name} (${I18n.t('weeklyReview.due')}: ${t.dueDate})`);
      }
    }
    lines.push('');

    lines.push(`-- ${I18n.t('weeklyReview.nextWeek')} (${data.nextWeekTasks.length}) --`);
    if (data.nextWeekTasks.length === 0) {
      lines.push(I18n.t('weeklyReview.noUpcoming'));
    } else {
      for (const t of data.nextWeekTasks) {
        lines.push(`  - ${t.name} (${Utils.formatDuration(t.remaining)})`);
      }
    }

    return lines.join('\n');
  }

  /* ═══════ EVENTS ═══════ */

  function _bindEvents(panel) {
    const closeBtn = panel.querySelector('#wrClose');
    if (closeBtn) closeBtn.addEventListener('click', hide);

    const copyBtn = panel.querySelector('#wrCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = _generatePlainText();
        navigator.clipboard.writeText(text).then(() => {
          Utils.toast(I18n.t('weeklyReview.copied'), 'success');
        }).catch(() => {
          Utils.toast(I18n.t('weeklyReview.copyError'), 'error');
        });
      });
    }
  }

  /* ═══════ SHOW / HIDE / TOGGLE ═══════ */

  function show() {
    const panel = $('weeklyReviewPanel');
    const calendar = $('calendarContainer');
    const settings = $('settingsPanel');
    const analytics = $('analyticsPanel');
    const priorities = $('prioritiesPanel');
    const groupsPanel = $('groupsPanel');

    _render();

    if (panel) panel.style.display = '';
    if (calendar) calendar.style.display = 'none';
    if (settings) settings.style.display = 'none';
    if (analytics) analytics.style.display = 'none';
    if (priorities) priorities.style.display = 'none';
    if (groupsPanel) groupsPanel.style.display = 'none';
  }

  function hide() {
    const panel = $('weeklyReviewPanel');
    const calendar = $('calendarContainer');

    if (panel) panel.style.display = 'none';
    if (calendar) calendar.style.display = '';

    // Notify app to update active view state
    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: 'calendar' } }));
  }

  function toggle() {
    const panel = $('weeklyReviewPanel');
    if (panel && panel.style.display !== 'none') {
      hide();
    } else {
      show();
    }
  }

  function isVisible() {
    const panel = $('weeklyReviewPanel');
    return panel && panel.style.display !== 'none';
  }

  function init() {
    // Button binding is done in app.js
  }

  return { generate, show, hide, toggle, isVisible, init };
})();
