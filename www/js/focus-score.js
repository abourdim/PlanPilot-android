/* ═══════════════════════════════════════════════════════════════════
   FOCUS SCORE — PlanPilot
   Calculates a 0-100 score based on block length, priority alignment,
   and completion rate for the given day.
   ═══════════════════════════════════════════════════════════════════ */

const FocusScore = (() => {
  'use strict';

  /**
   * Calculate focus score for a given date.
   * @param {Date} [date=new Date()] - the day to calculate for
   * @returns {{ score: number, breakdown: { blockLength: number, priorityAlignment: number, completionRate: number } }}
   */
  function calculate(date) {
    if (!date) date = new Date();
    const today = Utils.startOfDay(date);
    const todayEnd = Utils.endOfDay(date);
    const settings = Store.getSettings();

    // ── Get scheduled events for today ──
    const tasks = Store.getAllTasks();
    const weekStart = Utils.startOfWeek(date);
    const events = Scheduler.schedule(tasks, weekStart, 7);

    const todayEvents = events.filter(ev => Utils.isSameDay(ev.start, today));

    // ── Get completion log for today ──
    const log = Store.getCompletionLog();
    const todayLog = log.filter(entry => {
      const ts = new Date(entry.timestamp);
      return Utils.isSameDay(ts, today);
    });

    // ── Block Length (30 pts) ──
    // Average session duration of completed events today / maxSessionDuration
    let blockLengthScore = 0;
    if (todayEvents.length > 0) {
      const totalDuration = todayEvents.reduce((sum, ev) => sum + ev.duration, 0);
      const avgDuration = totalDuration / todayEvents.length;
      const maxSession = settings.defaultMaxSession || 120;
      const ratio = Math.min(1.0, avgDuration / maxSession);
      blockLengthScore = Math.round(ratio * 30);
    }

    // ── Priority Alignment (30 pts) ──
    // Check if higher-priority tasks were completed before lower-priority ones
    let priorityScore = 0;
    if (todayLog.length > 0) {
      let correctOrder = 0;
      let totalComparisons = 0;

      for (let i = 0; i < todayLog.length; i++) {
        for (let j = i + 1; j < todayLog.length; j++) {
          const pI = TaskModel.priorityValue(todayLog[i].priority);
          const pJ = TaskModel.priorityValue(todayLog[j].priority);
          totalComparisons++;
          // Earlier completion (i) should have higher or equal priority (lower value)
          if (pI <= pJ) {
            correctOrder++;
          }
        }
      }

      if (totalComparisons > 0) {
        priorityScore = Math.round((correctOrder / totalComparisons) * 30);
      }
    } else if (todayEvents.length === 0) {
      // No events today, give neutral score
      priorityScore = 15;
    }

    // ── Completion Rate (40 pts) ──
    // tasks done today / tasks scheduled today
    let completionScore = 0;
    const scheduledTaskIds = new Set(todayEvents.map(ev => ev.taskId));
    const scheduledCount = scheduledTaskIds.size;

    if (scheduledCount > 0) {
      const completedTaskIds = new Set(todayLog.map(entry => entry.taskId));
      let doneCount = 0;
      for (const tid of scheduledTaskIds) {
        if (completedTaskIds.has(tid)) {
          doneCount++;
        }
      }
      completionScore = Math.round((doneCount / scheduledCount) * 40);
    }

    const score = Utils.clamp(blockLengthScore + priorityScore + completionScore, 0, 100);

    return {
      score,
      breakdown: {
        blockLength: blockLengthScore,
        priorityAlignment: priorityScore,
        completionRate: completionScore
      }
    };
  }

  return { calculate };
})();
