/* ═══════════════════════════════════════════════════════════════════
   QUICK ADD — PlanPilot
   Press N (when no input focused) → quick-add bar for rapid task
   creation with natural-language parsing.
   ═══════════════════════════════════════════════════════════════════ */

const QuickAdd = (() => {
  'use strict';

  let _bar = null;
  let _input = null;
  let _visible = false;

  /* ── Init ── */

  function init() {
    // Create the quick-add bar element (hidden by default)
    _bar = document.createElement('div');
    _bar.className = 'quick-add-bar';
    _bar.style.display = 'none';
    _bar.innerHTML = `
      <div class="quick-add-inner">
        <span class="quick-add-icon">⚡</span>
        <input type="text" class="quick-add-input" id="quickAddInput"
               placeholder="${I18n.t('quickAdd.placeholder')}"
               autocomplete="off">
        <kbd class="quick-add-hint">Enter</kbd>
      </div>
    `;

    // Insert at top of main-content
    const main = document.getElementById('mainContent');
    if (main) {
      main.insertBefore(_bar, main.firstChild);
    }

    _input = _bar.querySelector('#quickAddInput');

    // Bind events
    _input.addEventListener('keydown', _onKeyDown);
    _input.addEventListener('blur', () => {
      // Delay hide so click events on bar elements can fire
      setTimeout(() => { if (_visible) hide(); }, 200);
    });
  }

  /* ── Show / Hide ── */

  function show() {
    if (_visible) return;
    _visible = true;
    _bar.style.display = '';
    // Trigger slide-down animation
    requestAnimationFrame(() => {
      _bar.classList.add('quick-add-visible');
      _input.value = '';
      _input.focus();
    });
  }

  function hide() {
    if (!_visible) return;
    _visible = false;
    _bar.classList.remove('quick-add-visible');
    // Wait for animation to finish
    setTimeout(() => {
      _bar.style.display = 'none';
    }, 200);
  }

  function isVisible() {
    return _visible;
  }

  /* ── Key handling ── */

  function _onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = _input.value.trim();
      if (text) {
        _createTask(text);
        hide();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
      return;
    }
  }

  /* ── Parse and create task ── */

  function _createTask(text) {
    const parsed = _parse(text);

    const overrides = {
      name: parsed.name,
      totalDuration: parsed.duration,
      remainingDuration: parsed.duration
    };

    if (parsed.dueDate) {
      overrides.dueDate = parsed.dueDate;
    }

    const task = TaskModel.createTask(overrides);
    Store.saveTask(task);

    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(I18n.t('quickAdd.created') + ': ' + task.name, 'success', 3000);
    }
  }

  /* ── Natural language parser ── */

  function _parse(text) {
    let name = text;
    let duration = Store.getSettings().defaultDuration || 60; // minutes
    let dueDate = null;

    // Extract duration: Xh or Xmin
    const durHourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*h(?:eure(?:s)?)?/i);
    const durMinMatch = text.match(/(\d+)\s*min/i);

    if (durHourMatch) {
      duration = Math.round(parseFloat(durHourMatch[1].replace(',', '.')) * 60);
      name = name.replace(durHourMatch[0], '').trim();
    } else if (durMinMatch) {
      duration = parseInt(durMinMatch[1], 10);
      name = name.replace(durMinMatch[0], '').trim();
    }

    // Extract due date keywords
    const dayMap = {
      'demain': 1,
      'lundi': _nextDayOfWeek(1),
      'mardi': _nextDayOfWeek(2),
      'mercredi': _nextDayOfWeek(3),
      'jeudi': _nextDayOfWeek(4),
      'vendredi': _nextDayOfWeek(5),
      'samedi': _nextDayOfWeek(6),
      'dimanche': _nextDayOfWeek(0)
    };

    // Check for "due" keyword patterns: "due vendredi", "pour mardi", etc.
    const duePatternFr = /(?:due|pour|avant)\s+(demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i;
    const dueMatch = text.match(duePatternFr);

    if (dueMatch) {
      const dayKey = dueMatch[1].toLowerCase();
      const daysToAdd = dayMap[dayKey];
      if (daysToAdd !== undefined) {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        dueDate = Utils.toDateInputValue(d);
      }
      name = name.replace(dueMatch[0], '').trim();
    } else {
      // Check for standalone day names at the end
      for (const [key, daysOffset] of Object.entries(dayMap)) {
        const re = new RegExp('\\b' + key + '\\b', 'i');
        if (re.test(name)) {
          const d = new Date();
          d.setDate(d.getDate() + daysOffset);
          dueDate = Utils.toDateInputValue(d);
          name = name.replace(re, '').trim();
          break;
        }
      }
    }

    // Check for DD/MM date pattern
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch && !dueDate) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const year = new Date().getFullYear();
      const d = new Date(year, month, day);
      // If date is in the past, use next year
      if (d < new Date()) d.setFullYear(year + 1);
      dueDate = Utils.toDateInputValue(d);
      name = name.replace(dateMatch[0], '').trim();
    }

    // Clean up name: remove trailing/leading punctuation and extra spaces
    name = name.replace(/\s+/g, ' ').replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim();

    return { name, duration, dueDate };
  }

  /* ── Helper: days until next occurrence of a weekday ── */

  function _nextDayOfWeek(targetDay) {
    const today = new Date().getDay();
    let diff = targetDay - today;
    if (diff <= 0) diff += 7;
    return diff;
  }

  return { init, show, hide, isVisible };
})();
