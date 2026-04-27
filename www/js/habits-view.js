/* ═══════════════════════════════════════════════════════════════════
   HABITS VIEW — PlanPilot
   Provides habit progress tracking and rendering support.
   ═══════════════════════════════════════════════════════════════════ */

const HabitsView = (() => {
  'use strict';

  /**
   * Get habit progress for a given task this week.
   * Counts completed habit events from the completion log.
   * @param {string} taskId - the habit task ID
   * @returns {{ completed: number, target: number }}
   */
  function getHabitProgress(taskId) {
    const task = Store.getTask(taskId);
    if (!task || !task.isHabit) {
      return { completed: 0, target: 0 };
    }

    const target = task.habitFrequency || 3;
    const weekStart = Utils.startOfWeek(new Date());
    const weekEnd = Utils.addDays(weekStart, 7);

    const log = Store.getCompletionLog();
    let completed = 0;

    for (const entry of log) {
      if (entry.taskId !== taskId) continue;
      const ts = new Date(entry.timestamp);
      if (ts >= weekStart && ts < weekEnd) {
        completed++;
      }
    }

    return { completed, target };
  }

  /**
   * Create a progress bar element for a habit task.
   * @param {string} taskId
   * @returns {HTMLElement|null}
   */
  function createProgressBar(taskId) {
    const progress = getHabitProgress(taskId);
    if (progress.target <= 0) return null;

    const wrapper = Utils.el('div', 'habit-progress');

    // Progress bar
    const bar = Utils.el('div', 'habit-progress-bar');
    const fill = Utils.el('div', 'habit-progress-fill');
    const pct = Math.min(100, Math.round((progress.completed / progress.target) * 100));
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    wrapper.appendChild(bar);

    // Label
    const label = Utils.el('span', 'habit-progress-label', {
      text: `${progress.completed}/${progress.target} ${I18n.t('habits.thisWeek')}`
    });
    wrapper.appendChild(label);

    return wrapper;
  }

  return { getHabitProgress, createProgressBar };
})();
