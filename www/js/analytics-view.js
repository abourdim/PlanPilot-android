/* ═══════════════════════════════════════════════════════════════════
   ANALYTICS VIEW — PlanPilot
   Dashboard with focus time, time-by-priority, completion rate,
   daily breakdown, and focus score.
   ═══════════════════════════════════════════════════════════════════ */

const AnalyticsView = (() => {
  'use strict';

  const $ = Utils.$;

  /* ═══════ INIT ═══════ */

  function init() {
    // Analytics button binding is done in app.js
  }

  /* ═══════ SHOW / HIDE / TOGGLE ═══════ */

  function show() {
    const panel = $('analyticsPanel');
    const calendar = $('calendarContainer');
    const settings = $('settingsPanel');
    const priorities = $('prioritiesPanel');
    const weeklyReview = $('weeklyReviewPanel');
    const groupsPanel = $('groupsPanel');

    _render();

    if (panel) panel.style.display = '';
    if (calendar) calendar.style.display = 'none';
    if (settings) settings.style.display = 'none';
    if (priorities) priorities.style.display = 'none';
    if (weeklyReview) weeklyReview.style.display = 'none';
    if (groupsPanel) groupsPanel.style.display = 'none';
  }

  function hide() {
    const panel = $('analyticsPanel');
    const calendar = $('calendarContainer');

    if (panel) panel.style.display = 'none';
    if (calendar) calendar.style.display = '';

    // Notify app to update active view state
    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: 'calendar' } }));
  }

  function toggle() {
    const panel = $('analyticsPanel');
    if (panel && panel.style.display !== 'none') {
      hide();
    } else {
      show();
    }
  }

  function isVisible() {
    const panel = $('analyticsPanel');
    return panel && panel.style.display !== 'none';
  }

  /* ═══════ DATA HELPERS ═══════ */

  /** Get start of the current week (Monday) */
  function _currentWeekStart() {
    return Utils.startOfWeek(new Date());
  }

  /** Get completion log entries for the current week */
  function _weekCompletionLog() {
    const log = Store.getCompletionLog();
    const weekStart = _currentWeekStart();
    const weekEnd = Utils.addDays(weekStart, 7);
    return log.filter(entry => {
      const ts = entry.timestamp || 0;
      return ts >= weekStart.getTime() && ts < weekEnd.getTime();
    });
  }

  /** Get all tasks */
  function _allTasks() {
    return Store.getAllTasks();
  }

  /** Get scheduled events for the current week */
  function _weekEvents() {
    const tasks = _allTasks();
    const weekStart = _currentWeekStart();
    return Scheduler.schedule(tasks, weekStart, 7);
  }

  /* ═══════ COMPUTE STATS ═══════ */

  function _computeStats() {
    const weekLog = _weekCompletionLog();
    const tasks = _allTasks();
    const events = _weekEvents();
    const weekStart = _currentWeekStart();

    // 1. Focus Time This Week: total hours from completion log
    let focusMinutes = 0;
    for (const entry of weekLog) {
      focusMinutes += entry.duration || 0;
    }
    const focusHours = focusMinutes / 60;

    // 2. Time by Priority: hours per P1/P2/P3/P4 from events
    const priorityMinutes = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const ev of events) {
      const p = ev.priority || 'P4';
      priorityMinutes[p] = (priorityMinutes[p] || 0) + ev.duration;
    }
    const maxPriorityMinutes = Math.max(1, ...Object.values(priorityMinutes));

    // 3. Completion Rate: tasks done this week / total scheduled tasks
    const doneTasks = tasks.filter(t => t.status === 'done');
    const weekDoneTasks = doneTasks.filter(t => {
      const ts = t.updatedAt || 0;
      return ts >= weekStart.getTime() && ts < Utils.addDays(weekStart, 7).getTime();
    });
    const scheduledThisWeek = tasks.filter(t => t.status !== 'done' || weekDoneTasks.some(d => d.id === t.id));
    const totalScheduled = Math.max(1, scheduledThisWeek.length);
    const completionRate = Math.round((weekDoneTasks.length / totalScheduled) * 100);

    // 4. Daily Breakdown: events per day with priority distribution
    const dayNames = [
      I18n.t('analytics.days.mon'),
      I18n.t('analytics.days.tue'),
      I18n.t('analytics.days.wed'),
      I18n.t('analytics.days.thu'),
      I18n.t('analytics.days.fri'),
      I18n.t('analytics.days.sat'),
      I18n.t('analytics.days.sun')
    ];

    const dailyData = [];
    const settings = Store.getSettings();
    const schedHours = settings.defaultSchedulingHours || { startHour: 9, endHour: 17 };
    const totalDayMinutes = ((schedHours.endHour || 17) - (schedHours.startHour || 9)) * 60;

    for (let d = 0; d < 7; d++) {
      const day = Utils.addDays(weekStart, d);
      const dayEvents = events.filter(ev => Utils.isSameDay(ev.start, day));
      const dayPriority = { P1: 0, P2: 0, P3: 0, P4: 0 };
      let taskMinutes = 0;

      for (const ev of dayEvents) {
        const p = ev.priority || 'P4';
        dayPriority[p] += ev.duration;
        taskMinutes += ev.duration;
      }

      dailyData.push({
        name: dayNames[d],
        taskMinutes,
        freeMinutes: Math.max(0, totalDayMinutes - taskMinutes),
        totalMinutes: totalDayMinutes,
        priority: dayPriority
      });
    }

    const maxDayMinutes = Math.max(1, ...dailyData.map(d => d.totalMinutes));

    // 5. Time by Group: hours per group from events
    const groups = Store.getGroups();
    const groupMinutes = {};
    let noGroupMinutes = 0;
    for (const ev of events) {
      const t = Store.getTask(ev.taskId);
      if (t && t.groupId) {
        groupMinutes[t.groupId] = (groupMinutes[t.groupId] || 0) + ev.duration;
      } else {
        noGroupMinutes += ev.duration;
      }
    }
    const allGroupValues = [...Object.values(groupMinutes), noGroupMinutes];
    const maxGroupMinutes = Math.max(1, ...allGroupValues);

    return {
      focusHours,
      focusMinutes,
      priorityMinutes,
      maxPriorityMinutes,
      completionRate,
      weekDoneCount: weekDoneTasks.length,
      totalScheduled,
      dailyData,
      maxDayMinutes,
      groups,
      groupMinutes,
      noGroupMinutes,
      maxGroupMinutes
    };
  }

  /* ═══════ RENDER ═══════ */

  function _render() {
    const panel = $('analyticsPanel');
    if (!panel) return;

    const stats = _computeStats();

    panel.innerHTML = `
      <div class="analytics-container">
        <div class="analytics-header">
          <h2 class="analytics-title">${I18n.t('analytics.title')}</h2>
          <button class="modal-close" id="analyticsClose" type="button" aria-label="${I18n.t('analytics.close')}">&times;</button>
        </div>

        <div class="analytics-grid">

          <!-- Focus Time This Week -->
          <div class="analytics-card">
            <h3 class="analytics-card-title">${I18n.t('analytics.focusTimeThisWeek')}</h3>
            <div class="analytics-big-number">
              ${stats.focusHours.toFixed(1)}<span class="analytics-unit">${I18n.t('analytics.hours')}</span>
            </div>
            <div class="analytics-subtitle">
              ${stats.focusMinutes} min ${I18n.t('analytics.focusTime').toLowerCase()}
            </div>
          </div>

          <!-- Completion Rate -->
          <div class="analytics-card">
            <h3 class="analytics-card-title">${I18n.t('analytics.completionRate')}</h3>
            <div class="analytics-circular-wrap">
              <div class="analytics-circular" style="--progress: ${stats.completionRate};">
                <span class="analytics-circular-value">${stats.completionRate}%</span>
              </div>
            </div>
            <div class="analytics-subtitle">
              ${stats.weekDoneCount} ${I18n.t('analytics.completed')} / ${stats.totalScheduled} ${I18n.t('analytics.scheduled')}
            </div>
          </div>

          <!-- Time by Priority -->
          <div class="analytics-card analytics-card-wide">
            <h3 class="analytics-card-title">${I18n.t('analytics.timeByPriority')}</h3>
            <div class="analytics-bars">
              ${_renderPriorityBar('P1', I18n.t('priority.p1'), stats.priorityMinutes.P1, stats.maxPriorityMinutes)}
              ${_renderPriorityBar('P2', I18n.t('priority.p2'), stats.priorityMinutes.P2, stats.maxPriorityMinutes)}
              ${_renderPriorityBar('P3', I18n.t('priority.p3'), stats.priorityMinutes.P3, stats.maxPriorityMinutes)}
              ${_renderPriorityBar('P4', I18n.t('priority.p4'), stats.priorityMinutes.P4, stats.maxPriorityMinutes)}
            </div>
          </div>

          <!-- Daily Breakdown -->
          <div class="analytics-card analytics-card-wide">
            <h3 class="analytics-card-title">${I18n.t('analytics.dailyBreakdown')}</h3>
            <div class="analytics-daily">
              ${stats.dailyData.map(d => _renderDailyBar(d, stats.maxDayMinutes)).join('')}
            </div>
            <div class="analytics-daily-legend">
              <span class="analytics-legend-item"><span class="analytics-legend-dot" style="background:var(--accent)"></span> ${I18n.t('analytics.taskTime')}</span>
              <span class="analytics-legend-item"><span class="analytics-legend-dot" style="background:var(--surface-border)"></span> ${I18n.t('analytics.freeTime')}</span>
            </div>
          </div>

          <!-- Time by Group -->
          <div class="analytics-card analytics-card-wide">
            <h3 class="analytics-card-title">${I18n.t('groups.timeByGroup')}</h3>
            <div class="analytics-bars">
              ${stats.groups.map(g => {
                const mins = stats.groupMinutes[g.id] || 0;
                return _renderGroupBar(g.name, g.color, mins, stats.maxGroupMinutes);
              }).join('')}
              ${_renderGroupBar(I18n.t('groups.noGroup'), '#666', stats.noGroupMinutes, stats.maxGroupMinutes)}
            </div>
          </div>

          <!-- Focus Score -->
          <div class="analytics-card">
            <h3 class="analytics-card-title">${I18n.t('analytics.focusScore')}</h3>
            <div class="analytics-big-number analytics-big-number-muted">
              --
            </div>
            <div class="analytics-subtitle">
              ${I18n.t('analytics.weeklyTrend')}
            </div>
          </div>

        </div>
      </div>
    `;

    // Bind close button
    const btnClose = $('analyticsClose');
    if (btnClose) btnClose.addEventListener('click', hide);
  }

  /* ═══════ RENDER HELPERS ═══════ */

  function _renderPriorityBar(priority, label, minutes, maxMinutes) {
    const hours = (minutes / 60).toFixed(1);
    const pct = maxMinutes > 0 ? Math.round((minutes / maxMinutes) * 100) : 0;
    const colorVar = `var(--${priority.toLowerCase()})`;

    return `
      <div class="analytics-bar-row">
        <span class="analytics-bar-label">${label}</span>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${pct}%;background:${colorVar}"></div>
        </div>
        <span class="analytics-bar-value">${hours}${I18n.t('analytics.hours')}</span>
      </div>
    `;
  }

  function _renderGroupBar(label, color, minutes, maxMinutes) {
    const hours = (minutes / 60).toFixed(1);
    const pct = maxMinutes > 0 ? Math.round((minutes / maxMinutes) * 100) : 0;

    return `
      <div class="analytics-bar-row">
        <span class="analytics-bar-label"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>${label}</span>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="analytics-bar-value">${hours}${I18n.t('analytics.hours')}</span>
      </div>
    `;
  }

  function _renderDailyBar(day, maxMinutes) {
    const taskPct = maxMinutes > 0 ? Math.round((day.taskMinutes / maxMinutes) * 100) : 0;
    const freePct = maxMinutes > 0 ? Math.round((day.freeMinutes / maxMinutes) * 100) : 0;

    // Build stacked segments by priority
    const segments = [];
    const priorities = ['P1', 'P2', 'P3', 'P4'];
    for (const p of priorities) {
      const mins = day.priority[p] || 0;
      if (mins > 0) {
        const segPct = maxMinutes > 0 ? Math.round((mins / maxMinutes) * 100) : 0;
        segments.push(`<div class="analytics-daily-segment" style="height:${segPct}%;background:var(--${p.toLowerCase()})"></div>`);
      }
    }

    // Free segment
    if (day.freeMinutes > 0) {
      segments.push(`<div class="analytics-daily-segment analytics-daily-free" style="height:${freePct}%"></div>`);
    }

    return `
      <div class="analytics-daily-col">
        <div class="analytics-daily-bar">
          ${segments.join('')}
        </div>
        <span class="analytics-daily-label">${day.name}</span>
      </div>
    `;
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init, show, hide, toggle, isVisible };
})();
