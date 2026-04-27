/* ═══════════════════════════════════════════════════════════════════
   DEPENDENCIES — PlanPilot
   Circular dependency detection, dependency chain visualization,
   and blocked-task identification.
   ═══════════════════════════════════════════════════════════════════ */

const Dependencies = (() => {
  'use strict';

  /**
   * Get IDs of tasks that are blocked by unfinished dependencies.
   * @param {Object[]} tasks - all tasks
   * @returns {string[]} array of blocked task IDs
   */
  function getBlockedTasks(tasks) {
    const taskById = {};
    for (const t of tasks) {
      taskById[t.id] = t;
    }

    const blocked = [];
    for (const task of tasks) {
      if (task.status === 'done') continue;
      if (!task.dependsOn || task.dependsOn.length === 0) continue;

      const isBlocked = task.dependsOn.some(depId => {
        const dep = taskById[depId];
        return !dep || dep.status !== 'done';
      });

      if (isBlocked) {
        blocked.push(task.id);
      }
    }

    return blocked;
  }

  /**
   * Check if adding a dependency would create a circular dependency.
   * Uses DFS to detect cycles.
   * @param {string} taskId - the task being edited
   * @param {string[]} dependsOn - proposed dependency IDs
   * @param {Object[]} tasks - all tasks
   * @returns {boolean} true if circular dependency detected
   */
  function hasCircularDependency(taskId, dependsOn, tasks) {
    if (!dependsOn || dependsOn.length === 0) return false;

    // Build adjacency map: task -> [tasks it depends on]
    const adjMap = {};
    for (const t of tasks) {
      if (t.id === taskId) {
        // Use proposed dependsOn for the task being edited
        adjMap[t.id] = dependsOn.slice();
      } else {
        adjMap[t.id] = (t.dependsOn || []).slice();
      }
    }

    // If taskId is new (not yet in tasks), add it
    if (!adjMap[taskId]) {
      adjMap[taskId] = dependsOn.slice();
    }

    // DFS from taskId following dependency edges
    // If we can reach taskId again, there's a cycle
    const visited = new Set();
    const stack = new Set();

    function hasCycleDFS(nodeId) {
      if (stack.has(nodeId)) return true; // back-edge → cycle
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      stack.add(nodeId);

      const deps = adjMap[nodeId] || [];
      for (const depId of deps) {
        if (hasCycleDFS(depId)) return true;
      }

      stack.delete(nodeId);
      return false;
    }

    return hasCycleDFS(taskId);
  }

  /**
   * Get the dependency chain for a task (ordered list of dependency names).
   * @param {string} taskId - the task to get chain for
   * @param {Object[]} tasks - all tasks
   * @returns {string[]} ordered list of dependent task names
   */
  function getDependencyChain(taskId, tasks) {
    const taskById = {};
    for (const t of tasks) {
      taskById[t.id] = t;
    }

    const chain = [];
    const visited = new Set();

    function walk(id) {
      if (visited.has(id)) return;
      visited.add(id);

      const task = taskById[id];
      if (!task) return;

      const deps = task.dependsOn || [];
      for (const depId of deps) {
        walk(depId);
      }

      // Add after all dependencies (topological sort)
      if (id !== taskId) {
        chain.push(task.name || task.id);
      }
    }

    walk(taskId);
    return chain;
  }

  return { getBlockedTasks, hasCircularDependency, getDependencyChain };
})();
