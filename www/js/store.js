/* ═══════════════════════════════════════════════════════════════════
   STORE — PlanPilot (localStorage CRUD)
   ═══════════════════════════════════════════════════════════════════ */

const Store = (() => {

  const TASKS_KEY = 'planpilot_tasks';
  const SETTINGS_KEY = 'planpilot_settings';
  const LOG_KEY = 'planpilot_completion_log';
  const ONBOARDED_KEY = 'planpilot_onboarded';

  /* ── Tasks ── */

  function getAllTasks() {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _saveTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    _emit('store:changed', { type: 'tasks' });
  }

  function getTask(id) {
    return getAllTasks().find(t => t.id === id) || null;
  }

  function saveTask(task) {
    if (!task || !task.id) throw new Error('Task must have an id');
    const tasks = getAllTasks();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...task, updatedAt: Date.now() };
    } else {
      task.createdAt = task.createdAt || Date.now();
      task.updatedAt = Date.now();
      tasks.push(task);
    }
    _saveTasks(tasks);
    return task;
  }

  function updateTask(id, changes) {
    const tasks = getAllTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) throw new Error(`Task ${id} not found`);
    tasks[idx] = { ...tasks[idx], ...changes, updatedAt: Date.now() };
    _saveTasks(tasks);
    return tasks[idx];
  }

  function deleteTask(id) {
    const tasks = getAllTasks().filter(t => t.id !== id);
    _saveTasks(tasks);
  }

  function clearTasks() {
    localStorage.removeItem(TASKS_KEY);
    _emit('store:changed', { type: 'tasks' });
  }

  function replaceAllTasks(tasks) {
    _saveTasks(tasks);
  }

  /* ── Settings ── */

  const DEFAULT_SETTINGS = {
    defaultPriority: 'P2',
    defaultDuration: 60,
    defaultSplitUp: false,
    defaultMinSession: 15,
    defaultMaxSession: 120,
    defaultSchedulingHours: { type: 'working', startHour: 9, endHour: 17 },
    defaultStartDelay: 0,
    defaultDueDateOffset: 3,
    defaultVisibility: 'busy',
    startMode: 'auto',
    theme: 'dark',
    uiMode: 'advanced',
    language: 'fr',
    notificationsEnabled: false,
    notificationLead: 5,
    peakStartHour: 9,
    peakEndHour: 12,
    autoBackup: false,
    sidebarWidth: 320,
    groups: []
  };

  const DEFAULT_GROUPS = [
    { id: 'grp_anatomie',    name: 'Anatomie',    color: '#9b59b6' },
    { id: 'grp_physiologie', name: 'Physiologie', color: '#2ecc71' },
    { id: 'grp_stage',       name: 'Stage',       color: '#1abc9c' },
    { id: 'grp_examen',      name: 'Examen',      color: '#e91e8c' },
    { id: 'grp_perso',       name: 'Perso',       color: '#8d6e63' }
  ];

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    _emit('store:changed', { type: 'settings' });
  }

  function updateSettings(changes) {
    const settings = getSettings();
    Object.assign(settings, changes);
    saveSettings(settings);
    return settings;
  }

  /* ── Completion Log ── */

  function getCompletionLog() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function logCompletion(entry) {
    const log = getCompletionLog();
    log.push({ ...entry, timestamp: Date.now() });
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    _emit('store:changed', { type: 'log' });
  }

  function clearCompletionLog() {
    localStorage.removeItem(LOG_KEY);
  }

  /* ── Onboarding ── */

  function isOnboarded() {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  }

  function setOnboarded() {
    localStorage.setItem(ONBOARDED_KEY, 'true');
  }

  /* ── Groups ── */

  function getGroups() {
    const s = getSettings();
    let groups = s.groups;
    if (!groups || groups.length === 0) {
      // Seed default groups on first access
      groups = DEFAULT_GROUPS.map(g => ({ ...g }));
      updateSettings({ groups });
    }
    return groups;
  }

  function saveGroup(group) {
    const groups = getGroups();
    if (!group.id) {
      group.id = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    const idx = groups.findIndex(g => g.id === group.id);
    if (idx >= 0) {
      groups[idx] = { ...groups[idx], ...group };
    } else {
      if (groups.length >= 8) return null;
      groups.push(group);
    }
    updateSettings({ groups });
    return group;
  }

  function deleteGroup(id) {
    let groups = getGroups();
    groups = groups.filter(g => g.id !== id);
    updateSettings({ groups });
    // Clear groupId from tasks that reference this group
    const tasks = getAllTasks();
    let changed = false;
    for (const t of tasks) {
      if (t.groupId === id) {
        t.groupId = null;
        changed = true;
      }
    }
    if (changed) _saveTasks(tasks);
  }

  /* ── Events ── */

  function _emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /* ── Export / Import (raw data access) ── */

  function exportAll() {
    return {
      version: 1,
      tasks: getAllTasks(),
      settings: getSettings(),
      completionLog: getCompletionLog(),
      exportedAt: Date.now()
    };
  }

  function importAll(data, mode = 'replace') {
    if (!data || typeof data !== 'object') throw new Error('Invalid import data');
    if (data.version !== 1) throw new Error('Unsupported data version');

    if (mode === 'replace') {
      if (Array.isArray(data.tasks)) _saveTasks(data.tasks);
      if (data.settings) saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (Array.isArray(data.completionLog)) {
        localStorage.setItem(LOG_KEY, JSON.stringify(data.completionLog));
      }
    } else if (mode === 'merge') {
      if (Array.isArray(data.tasks)) {
        const existing = getAllTasks();
        const existingIds = new Set(existing.map(t => t.id));
        for (const task of data.tasks) {
          if (!existingIds.has(task.id)) {
            existing.push(task);
          }
        }
        _saveTasks(existing);
      }
    }
    _emit('store:changed', { type: 'import' });
  }

  return {
    getAllTasks, getTask, saveTask, updateTask, deleteTask,
    clearTasks, replaceAllTasks,
    getSettings, saveSettings, updateSettings, DEFAULT_SETTINGS,
    getGroups, saveGroup, deleteGroup,
    getCompletionLog, logCompletion, clearCompletionLog,
    isOnboarded, setOnboarded,
    exportAll, importAll
  };
})();
