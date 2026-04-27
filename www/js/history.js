/* ═══════════════════════════════════════════════════════════════════
   HISTORY — PlanPilot (undo/redo)
   ═══════════════════════════════════════════════════════════════════ */

const History = (() => {
  'use strict';

  const MAX_STACK = 50;
  let _undoStack = [];
  let _redoStack = [];
  let _skipHistory = false;

  /**
   * Push an action onto the undo stack.
   * @param {Object} action - { type: string, before: any, after: any }
   *   before/after are full task snapshots (JSON-cloned)
   */
  function push(action) {
    if (_skipHistory) return;
    _undoStack.push(action);
    if (_undoStack.length > MAX_STACK) {
      _undoStack.shift();
    }
    // New action clears redo stack
    _redoStack = [];
    _updateButtons();
  }

  /**
   * Undo the last action: restore "before" state.
   */
  function undo() {
    if (_undoStack.length === 0) return;
    const action = _undoStack.pop();
    _redoStack.push(action);

    // Restore before state without triggering history push
    _skipHistory = true;
    _restoreState(action.before);
    _skipHistory = false;
    _updateButtons();
  }

  /**
   * Redo the last undone action: restore "after" state.
   */
  function redo() {
    if (_redoStack.length === 0) return;
    const action = _redoStack.pop();
    _undoStack.push(action);

    // Restore after state without triggering history push
    _skipHistory = true;
    _restoreState(action.after);
    _skipHistory = false;
    _updateButtons();
  }

  function canUndo() { return _undoStack.length > 0; }
  function canRedo() { return _redoStack.length > 0; }
  function isSkipping() { return _skipHistory; }

  function clear() {
    _undoStack = [];
    _redoStack = [];
    _updateButtons();
  }

  /**
   * Restore tasks from a snapshot.
   * @param {Object} state - { tasks: [...] }
   */
  function _restoreState(state) {
    if (!state || !Array.isArray(state.tasks)) return;
    Store.replaceAllTasks(state.tasks);
  }

  /** Update undo/redo button disabled state */
  function _updateButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.disabled = !canUndo();
    if (btnRedo) btnRedo.disabled = !canRedo();
  }

  // Wire undo/redo buttons
  document.addEventListener('DOMContentLoaded', () => {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);
    _updateButtons();
  });

  return { push, undo, redo, canUndo, canRedo, clear, isSkipping };
})();

/* ── Wire History into Store mutations ── */
(() => {
  const _origSaveTask = Store.saveTask.bind(Store);
  const _origUpdateTask = Store.updateTask.bind(Store);
  const _origDeleteTask = Store.deleteTask.bind(Store);

  Store.saveTask = function(task) {
    if (!History.isSkipping()) {
      const before = { tasks: Utils.clone(Store.getAllTasks()) };
      const result = _origSaveTask(task);
      const after = { tasks: Utils.clone(Store.getAllTasks()) };
      History.push({ type: 'saveTask', before, after });
      return result;
    }
    return _origSaveTask(task);
  };

  Store.updateTask = function(id, changes) {
    if (!History.isSkipping()) {
      const before = { tasks: Utils.clone(Store.getAllTasks()) };
      const result = _origUpdateTask(id, changes);
      const after = { tasks: Utils.clone(Store.getAllTasks()) };
      History.push({ type: 'updateTask', before, after });
      return result;
    }
    return _origUpdateTask(id, changes);
  };

  Store.deleteTask = function(id) {
    if (!History.isSkipping()) {
      const before = { tasks: Utils.clone(Store.getAllTasks()) };
      _origDeleteTask(id);
      const after = { tasks: Utils.clone(Store.getAllTasks()) };
      History.push({ type: 'deleteTask', before, after });
      return;
    }
    _origDeleteTask(id);
  };
})();

