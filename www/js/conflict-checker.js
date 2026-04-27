/* ═══════════════════════════════════════════════════════════════════
   CONFLICT CHECKER — PlanPilot
   Detects tasks that would be pushed past their deadline when a new
   or edited task is added.
   ═══════════════════════════════════════════════════════════════════ */

const ConflictChecker = (() => {
  'use strict';

  /**
   * Check if adding/updating a task creates conflicts.
   * A conflict occurs when a task that previously fit before its deadline
   * can no longer be fully scheduled before its deadline.
   *
   * @param {Object} newTask - the task being added or edited
   * @returns {Array} array of { taskId, taskName, dueDate } that conflict
   */
  function check(newTask) {
    if (!newTask) return [];

    const weekStart = Utils.startOfWeek(new Date());
    const existingTasks = Store.getAllTasks();

    // Schedule without the new task (or with the old version if editing)
    const tasksWithout = existingTasks.filter(t => t.id !== newTask.id);
    const eventsBefore = Scheduler.schedule(tasksWithout, weekStart, 14);

    // Schedule with the new task included
    const tasksWith = tasksWithout.slice();
    tasksWith.push(newTask);
    const eventsAfter = Scheduler.schedule(tasksWith, weekStart, 14);

    // For each existing task (not the new one), check if it was fitting
    // before its deadline but isn't anymore
    const conflicts = [];

    for (const task of tasksWithout) {
      if (task.status === 'done') continue;
      if (!task.dueDate) continue;

      const dueDate = Utils.endOfDay(Utils.parseDateInput(task.dueDate));
      if (!dueDate) continue;

      // Calculate scheduled minutes before deadline in both scenarios
      const minutesBefore = _scheduledMinutesBefore(eventsBefore, task.id, dueDate);
      const minutesAfter = _scheduledMinutesBefore(eventsAfter, task.id, dueDate);

      const remaining = task.remainingDuration || task.totalDuration || 0;
      if (remaining <= 0) continue;

      // Task was fitting before but not after
      const fittingBefore = minutesBefore >= remaining;
      const fittingAfter = minutesAfter >= remaining;

      if (fittingBefore && !fittingAfter) {
        conflicts.push({
          taskId: task.id,
          taskName: task.name,
          dueDate: task.dueDate
        });
      }
    }

    return conflicts;
  }

  /**
   * Sum up scheduled minutes for a given task before a deadline date.
   */
  function _scheduledMinutesBefore(events, taskId, deadline) {
    let total = 0;
    for (const ev of events) {
      if (ev.taskId !== taskId) continue;
      if (ev.end <= deadline) {
        total += ev.duration;
      }
    }
    return total;
  }

  return { check };
})();
