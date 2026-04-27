/* ═══════════════════════════════════════════════════════════════════
   TEMPLATES — PlanPilot
   Task templates for quick creation with pre-filled fields.
   ═══════════════════════════════════════════════════════════════════ */

const Templates = (() => {
  'use strict';

  const STORAGE_KEY = 'reclaim_templates';

  /* ── Pre-built templates (seeded on first load) ── */

  const DEFAULTS = [
    {
      id: 'tpl_revision_exam',
      name: 'Revision exam',
      duration: 240,
      priority: 'P1',
      splitUp: true,
      minSession: 30,
      maxSession: 120,
      schedulingHours: { type: 'working', startHour: 9, endHour: 17 },
      energyLevel: 'high'
    },
    {
      id: 'tpl_lecture_article',
      name: 'Lecture article',
      duration: 60,
      priority: 'P3',
      splitUp: false,
      minSession: 15,
      maxSession: 60,
      schedulingHours: { type: 'working', startHour: 9, endHour: 17 },
      energyLevel: 'low'
    },
    {
      id: 'tpl_projet_groupe',
      name: 'Projet de groupe',
      duration: 120,
      priority: 'P2',
      splitUp: true,
      minSession: 30,
      maxSession: 120,
      schedulingHours: { type: 'working', startHour: 9, endHour: 17 },
      energyLevel: 'any'
    }
  ];

  /* ── CRUD ── */

  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _saveAll(templates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  function save(template) {
    if (!template || !template.name) return null;
    const all = getAll();
    if (!template.id) {
      template.id = 'tpl_' + Utils.uid();
    }
    const idx = all.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...template };
    } else {
      all.push(template);
    }
    _saveAll(all);
    return template;
  }

  function remove(id) {
    const all = getAll().filter(t => t.id !== id);
    _saveAll(all);
  }

  function getById(id) {
    return getAll().find(t => t.id === id) || null;
  }

  /* ── Apply template to form data ── */

  function applyTemplate(templateId) {
    const tpl = getById(templateId);
    if (!tpl) return null;
    return {
      totalDuration: tpl.duration,
      priority: tpl.priority,
      splitUp: tpl.splitUp,
      minSessionDuration: tpl.minSession,
      maxSessionDuration: tpl.maxSession,
      schedulingHours: tpl.schedulingHours || { type: 'working', startHour: 9, endHour: 17 },
      energyLevel: tpl.energyLevel || 'any'
    };
  }

  /* ── Seed defaults on first load ── */

  function init() {
    const existing = getAll();
    if (existing.length === 0) {
      _saveAll(DEFAULTS);
    }
  }

  return { getAll, save, delete: remove, getById, applyTemplate, init };
})();
