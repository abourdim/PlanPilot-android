/* ═══════════════════════════════════════════════════════════════════
   SEARCH — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const Search = (() => {
  'use strict';

  /**
   * Filter tasks by search query.
   * Matches against name, notes, priority code, and translated priority label.
   */
  function filter(tasks, query) {
    if (!query || !query.trim()) return tasks;
    const q = query.toLowerCase().trim();
    return tasks.filter(t =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      (t.priority && t.priority.toLowerCase().includes(q)) ||
      (I18n.t(TaskModel.priorityLabel(t.priority)).toLowerCase().includes(q))
    );
  }

  /**
   * Highlight matching text by wrapping matches in <mark> tags.
   * Escapes regex special chars in the query.
   */
  function highlight(text, query) {
    if (!query || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  return { filter, highlight };
})();
