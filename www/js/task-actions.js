/* ═══════════════════════════════════════════════════════════════════
   TASK ACTIONS — PlanPilot
   All task mutations: start, stop, restart, lock, unlock,
   addTime, logWork, markDone, deleteTask.
   ═══════════════════════════════════════════════════════════════════ */

const TaskActions = (() => {
  'use strict';

  /* ── Helpers ── */

  let _activeTimer = null; // { taskId, intervalId, startedAt }

  function _pulseBismillah(type) {
    const bism = Utils.$('bismillah');
    if (!bism) return;
    bism.classList.remove('pulse-success', 'pulse-error');
    // Force reflow to restart animation
    void bism.offsetWidth;
    bism.classList.add(type === 'success' ? 'pulse-success' : 'pulse-error');
    setTimeout(() => bism.classList.remove('pulse-success', 'pulse-error'), 1500);
  }

  /* ── Start ── */

  function start(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;

    // Stop any currently running timer
    if (_activeTimer && _activeTimer.taskId !== taskId) {
      stop(_activeTimer.taskId);
    }

    Store.updateTask(taskId, {
      status: 'scheduled',
      _runningStart: Date.now()
    });

    // Start a per-minute timer that decrements remaining duration
    if (_activeTimer && _activeTimer.taskId === taskId) return; // already running

    _activeTimer = {
      taskId,
      startedAt: Date.now(),
      intervalId: setInterval(() => {
        _tickTimer(taskId);
      }, 60000)
    };

    // Optionally start a pomodoro timer alongside the task
    if (typeof Pomodoro !== 'undefined' && Pomodoro.start) {
      Pomodoro.start(taskId);
    }

    _pulseBismillah('success');
  }

  function _tickTimer(taskId) {
    const task = Store.getTask(taskId);
    if (!task) {
      _clearTimer();
      return;
    }
    const elapsed = 1; // 1 minute per tick
    const newRemaining = Math.max(0, (task.remainingDuration || 0) - elapsed);
    const newLogged = (task.loggedWork || 0) + elapsed;
    Store.updateTask(taskId, {
      remainingDuration: newRemaining,
      loggedWork: newLogged
    });

    // Auto-complete if remaining hits 0
    if (newRemaining <= 0) {
      markDone(taskId);
    }
  }

  function _clearTimer() {
    if (_activeTimer) {
      clearInterval(_activeTimer.intervalId);
      _activeTimer = null;
    }
  }

  /* ── Stop ── */

  function stop(taskId) {
    if (!_activeTimer || _activeTimer.taskId !== taskId) return;

    const task = Store.getTask(taskId);
    if (!task) {
      _clearTimer();
      return;
    }

    // Log fractional minute elapsed since last tick
    const elapsedMs = Date.now() - _activeTimer.startedAt;
    const totalElapsedMin = Math.floor(elapsedMs / 60000);
    // Timer ticks already logged full minutes; just clean up
    _clearTimer();

    // Stop pomodoro timer if running
    if (typeof Pomodoro !== 'undefined' && Pomodoro.stop) {
      Pomodoro.stop();
    }

    // Remove running marker
    Store.updateTask(taskId, { _runningStart: null });
  }

  /* ── Restart ── */

  function restart(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;

    Store.updateTask(taskId, {
      status: 'scheduled',
      remainingDuration: task.totalDuration,
      loggedWork: 0
    });
  }

  /* ── Lock event at position ── */

  function lock(taskId, eventStart, eventEnd) {
    const task = Store.getTask(taskId);
    if (!task) return;

    const lockedEvents = (task.lockedEvents || []).slice();
    // Avoid duplicates
    const already = lockedEvents.some(le =>
      new Date(le.start).getTime() === new Date(eventStart).getTime() &&
      new Date(le.end).getTime() === new Date(eventEnd).getTime()
    );
    if (!already) {
      lockedEvents.push({
        start: new Date(eventStart).toISOString(),
        end: new Date(eventEnd).toISOString()
      });
    }
    Store.updateTask(taskId, { lockedEvents });
  }

  /* ── Unlock event ── */

  function unlock(taskId, eventStart) {
    const task = Store.getTask(taskId);
    if (!task) return;

    const lockedEvents = (task.lockedEvents || []).filter(le =>
      new Date(le.start).getTime() !== new Date(eventStart).getTime()
    );
    Store.updateTask(taskId, { lockedEvents });
  }

  /* ── Add time ── */

  function addTime(taskId, minutes) {
    minutes = minutes || 30;
    const task = Store.getTask(taskId);
    if (!task) return;

    Store.updateTask(taskId, {
      totalDuration: (task.totalDuration || 0) + minutes,
      remainingDuration: (task.remainingDuration || 0) + minutes,
      status: task.status === 'done' ? 'scheduled' : task.status
    });
  }

  /* ── Log work manually ── */

  function logWork(taskId, minutes) {
    if (!minutes || minutes <= 0) return;
    const task = Store.getTask(taskId);
    if (!task) return;

    const newRemaining = Math.max(0, (task.remainingDuration || 0) - minutes);
    const newLogged = (task.loggedWork || 0) + minutes;

    Store.updateTask(taskId, {
      remainingDuration: newRemaining,
      loggedWork: newLogged
    });

    if (newRemaining <= 0) {
      markDone(taskId);
    }
  }

  /* ── Mark done ── */

  function markDone(taskId) {
    // Stop timer if running
    if (_activeTimer && _activeTimer.taskId === taskId) {
      _clearTimer();
    }

    const task = Store.getTask(taskId);
    if (!task) return;

    Store.updateTask(taskId, {
      status: 'done',
      remainingDuration: 0,
      _runningStart: null
    });

    Store.logCompletion({
      taskId: task.id,
      taskName: task.name,
      priority: task.priority,
      duration: task.totalDuration
    });

    _pulseBismillah('success');
  }

  /* ── Delete task ── */

  function deleteTask(taskId) {
    // Stop timer if running
    if (_activeTimer && _activeTimer.taskId === taskId) {
      _clearTimer();
    }
    Store.deleteTask(taskId);
  }

  /* ── Duplicate task ── */

  function duplicateTask(taskId) {
    const original = Store.getTask(taskId);
    if (!original) return null;

    // Compute new due date: original + 1 day
    let newDueDate = '';
    if (original.dueDate) {
      const due = Utils.parseDateInput(original.dueDate);
      if (due) {
        due.setDate(due.getDate() + 1);
        const yyyy = due.getFullYear();
        const mm = String(due.getMonth() + 1).padStart(2, '0');
        const dd = String(due.getDate()).padStart(2, '0');
        newDueDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    // Today as start date
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const copy = TaskModel.createTask({
      name: (original.name || '') + ' (copie)',
      priority: original.priority,
      totalDuration: original.totalDuration,
      remainingDuration: original.totalDuration,
      splitUp: original.splitUp,
      minSessionDuration: original.minSessionDuration,
      maxSessionDuration: original.maxSessionDuration,
      schedulingHours: original.schedulingHours ? { ...original.schedulingHours } : undefined,
      energyLevel: original.energyLevel,
      visibility: original.visibility,
      startMode: original.startMode,
      upNext: original.upNext,
      isHabit: original.isHabit,
      habitFrequency: original.habitFrequency,
      dependsOn: original.dependsOn ? [...original.dependsOn] : [],
      notes: original.notes,
      dueDate: newDueDate,
      startDate: startDate,
      status: 'scheduled',
      lockedEvents: [],
      loggedWork: 0,
      pomodorosCompleted: 0
    });

    Store.saveTask(copy);
    Utils.toast(I18n.t('taskDetail.duplicate'), 'success');
    return copy;
  }

  /* ── Query helper ── */

  function isRunning(taskId) {
    return _activeTimer && _activeTimer.taskId === taskId;
  }

  return {
    start, stop, restart,
    lock, unlock,
    addTime, logWork,
    markDone, deleteTask,
    duplicateTask,
    isRunning
  };
})();
