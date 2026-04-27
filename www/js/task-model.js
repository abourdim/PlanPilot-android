/* ═══════════════════════════════════════════════════════════════════
   TASK MODEL — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const TaskModel = (() => {

  /**
   * Create a new task with defaults from settings.
   * @param {Object} overrides - user-provided fields
   * @returns {Object} complete task object
   */
  function createTask(overrides = {}) {
    const s = Store.getSettings();
    const now = Date.now();

    const dueDate = overrides.dueDate ||
      Utils.toDateInputValue(Utils.addDays(new Date(), s.defaultDueDateOffset));

    const startDate = overrides.startDate ||
      (s.defaultStartDelay > 0
        ? Utils.toDateInputValue(Utils.addMinutes(new Date(), s.defaultStartDelay))
        : Utils.toDateInputValue(new Date()));

    const task = {
      id: overrides.id || Utils.uid(),
      name: overrides.name || '',
      priority: overrides.priority || s.defaultPriority,
      totalDuration: overrides.totalDuration ?? s.defaultDuration,
      remainingDuration: overrides.remainingDuration ?? (overrides.totalDuration ?? s.defaultDuration),
      splitUp: overrides.splitUp ?? s.defaultSplitUp,
      dueDate,
      startDate,
      minSessionDuration: overrides.minSessionDuration ?? s.defaultMinSession,
      maxSessionDuration: overrides.maxSessionDuration ?? s.defaultMaxSession,
      schedulingHours: overrides.schedulingHours || { ...s.defaultSchedulingHours },
      notes: overrides.notes || '',
      visibility: overrides.visibility || s.defaultVisibility,
      upNext: overrides.upNext || false,
      startMode: overrides.startMode || s.startMode,
      energyLevel: overrides.energyLevel || 'any',
      dependsOn: overrides.dependsOn || [],
      isHabit: overrides.isHabit || false,
      habitFrequency: overrides.habitFrequency || null,
      status: overrides.status || 'scheduled',
      pinnedTime: overrides.pinnedTime || null,
      lockedEvents: overrides.lockedEvents || [],
      groupId: overrides.groupId || null,
      loggedWork: overrides.loggedWork || 0,
      createdAt: overrides.createdAt || now,
      updatedAt: now
    };

    return task;
  }

  /**
   * Validate a task. Returns { valid: bool, errors: string[] }
   */
  function validate(task) {
    const errors = [];

    if (!task.name || !task.name.trim()) {
      errors.push('name_required');
    }

    if (typeof task.totalDuration !== 'number' || task.totalDuration <= 0) {
      errors.push('duration_invalid');
    }

    if (task.minSessionDuration > task.maxSessionDuration) {
      errors.push('min_gt_max_session');
    }

    if (task.totalDuration < task.minSessionDuration) {
      errors.push('duration_lt_min_session');
    }

    // Warning (not blocking): due date in the past
    const warnings = [];
    if (task.dueDate) {
      const due = Utils.parseDateInput(task.dueDate);
      if (due && due < Utils.startOfDay(new Date())) {
        warnings.push('due_in_past');
      }
    }

    // Check for circular dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      if (task.dependsOn.includes(task.id)) {
        errors.push('self_dependency');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /** Priority sort value (lower = higher priority) */
  function priorityValue(priority) {
    const map = { P1: 1, P2: 2, P3: 3, P4: 4 };
    return map[priority] || 99;
  }

  /** Compare tasks for scheduling order */
  function compareForScheduling(a, b) {
    // Up Next first
    if (a.upNext && !b.upNext) return -1;
    if (!a.upNext && b.upNext) return 1;
    // Priority
    const pa = priorityValue(a.priority);
    const pb = priorityValue(b.priority);
    if (pa !== pb) return pa - pb;
    // Earlier due date first
    if (a.dueDate && b.dueDate) {
      const da = new Date(a.dueDate).getTime();
      const db = new Date(b.dueDate).getTime();
      if (da !== db) return da - db;
    }
    // Fallback: creation order
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  /** Get priority color CSS variable name */
  function priorityColor(priority) {
    const map = { P1: 'var(--p1)', P2: 'var(--p2)', P3: 'var(--p3)', P4: 'var(--p4)' };
    return map[priority] || 'var(--p4)';
  }

  /** Get priority label key */
  function priorityLabel(priority) {
    const map = { P1: 'priority.p1', P2: 'priority.p2', P3: 'priority.p3', P4: 'priority.p4' };
    return map[priority] || 'priority.p4';
  }

  return {
    createTask, validate,
    priorityValue, compareForScheduling,
    priorityColor, priorityLabel
  };
})();
