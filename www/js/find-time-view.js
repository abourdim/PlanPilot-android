/* ═══════════════════════════════════════════════════════════════════
   FIND TIME VIEW — PlanPilot
   Quick-access panel to find the next available free slots in the
   user's schedule for a given duration.
   ═══════════════════════════════════════════════════════════════════ */

const FindTimeView = (() => {
  'use strict';

  const $ = Utils.$;

  /* ── State ── */
  let _visible = false;
  let _selectedDuration = 60; // default 1 hour
  let _customMode = false;

  /* ── Duration presets (minutes) ── */
  const PRESETS = [30, 60, 90, 120];
  const LOOK_AHEAD_DAYS = 14;
  const MAX_RESULTS = 5;

  /* ── Helpers ── */

  function _t(key) {
    return (typeof I18n !== 'undefined' && I18n.t) ? I18n.t(key) : key;
  }

  /* ── Build panel contents ── */

  function _render() {
    const panel = $('findTimePanel');
    if (!panel) return;

    panel.innerHTML = '';

    // Header
    const header = Utils.el('div', 'find-time-header');
    const title = Utils.el('span', 'find-time-title', { text: _t('findTime.title') });
    const closeBtn = Utils.el('button', 'find-time-close', { text: '\u00d7' });
    closeBtn.addEventListener('click', hide);
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Duration label
    const durLabel = Utils.el('div', 'find-time-section-label', { text: _t('findTime.duration') });
    panel.appendChild(durLabel);

    // Duration pills
    const durRow = Utils.el('div', 'find-time-durations');

    for (const mins of PRESETS) {
      const label = _formatDurationLabel(mins);
      const pill = Utils.el('button', 'find-time-duration', { text: label });
      if (!_customMode && _selectedDuration === mins) pill.classList.add('active');
      pill.addEventListener('click', () => {
        _customMode = false;
        _selectedDuration = mins;
        _render();
      });
      durRow.appendChild(pill);
    }

    // "Other" pill
    const otherPill = Utils.el('button', 'find-time-duration', { text: _t('findTime.other') });
    if (_customMode) otherPill.classList.add('active');
    otherPill.addEventListener('click', () => {
      _customMode = true;
      _render();
      // Focus the custom input
      setTimeout(() => {
        const input = panel.querySelector('.find-time-custom input');
        if (input) input.focus();
      }, 50);
    });
    durRow.appendChild(otherPill);
    panel.appendChild(durRow);

    // Custom duration input
    const customRow = Utils.el('div', 'find-time-custom' + (_customMode ? ' visible' : ''));
    const customInput = Utils.el('input', '', { type: 'number', value: String(_selectedDuration) });
    customInput.min = '15';
    customInput.max = '480';
    customInput.step = '15';
    const customUnit = Utils.el('span', '', { text: 'min' });
    customInput.addEventListener('input', () => {
      const val = parseInt(customInput.value, 10);
      if (val >= 15 && val <= 480) {
        _selectedDuration = val;
        _renderResults(panel);
      }
    });
    customRow.appendChild(customInput);
    customRow.appendChild(customUnit);
    panel.appendChild(customRow);

    // Results
    _renderResults(panel);
  }

  function _renderResults(panel) {
    // Remove old results
    const oldResults = panel.querySelector('.find-time-results');
    const oldLabel = panel.querySelector('.find-time-results-label');
    const oldEmpty = panel.querySelector('.find-time-empty');
    if (oldResults) oldResults.remove();
    if (oldLabel) oldLabel.remove();
    if (oldEmpty) oldEmpty.remove();

    // Results label
    const resLabel = Utils.el('div', 'find-time-results-label', { text: _t('findTime.results') });
    panel.appendChild(resLabel);

    // Find slots
    const slots = _findFreeSlots(_selectedDuration);

    if (slots.length === 0) {
      const empty = Utils.el('div', 'find-time-empty', { text: _t('findTime.noResults') });
      panel.appendChild(empty);
      return;
    }

    const resultsList = Utils.el('div', 'find-time-results');

    for (const slot of slots) {
      const btn = Utils.el('button', 'find-time-slot');

      // Icon
      const icon = Utils.el('div', 'find-time-slot-icon');
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

      // Info
      const info = Utils.el('div', 'find-time-slot-info');
      const dateLabel = Utils.el('div', 'find-time-slot-date', { text: _formatSlotDate(slot.start) });
      const timeLabel = Utils.el('div', 'find-time-slot-time', {
        text: Utils.formatTime(slot.start) + ' - ' + Utils.formatTime(slot.end)
      });
      info.appendChild(dateLabel);
      info.appendChild(timeLabel);

      btn.appendChild(icon);
      btn.appendChild(info);

      // Click to create task at that slot
      btn.addEventListener('click', () => {
        hide();
        ModalView.open(null);
        setTimeout(() => {
          const fieldDuration = $('fieldDuration');
          if (fieldDuration) fieldDuration.value = _selectedDuration;
          const fieldStartDate = $('fieldStartDate');
          if (fieldStartDate) fieldStartDate.value = Utils.toDateInputValue(slot.start);
        }, 50);
      });

      resultsList.appendChild(btn);
    }

    panel.appendChild(resultsList);
  }

  /* ── Slot finding logic ── */

  function _findFreeSlots(durationMinutes) {
    const settings = Store.getSettings();
    const schedHours = settings.defaultSchedulingHours || { startHour: 9, endHour: 17 };
    const startHour = schedHours.startHour || 9;
    const endHour = schedHours.endHour || 17;

    // Gather all events across the look-ahead period
    const now = new Date();
    const allEvents = _getAllScheduledEvents();

    const results = [];
    const today = Utils.startOfDay(new Date());

    for (let dayOffset = 0; dayOffset < LOOK_AHEAD_DAYS && results.length < MAX_RESULTS; dayOffset++) {
      const day = Utils.addDays(today, dayOffset);
      const dayStart = new Date(day);
      dayStart.setHours(startHour, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(endHour, 0, 0, 0);

      // For TODAY: if we're past scheduling hours, extend window to 22:00
      // so user can still schedule "right now" slots
      const isToday = Utils.isToday(day);
      if (isToday && now >= dayEnd) {
        dayEnd.setHours(22, 0, 0, 0); // extend to 10pm
      }

      // Skip if the whole scheduling window is in the past
      if (dayEnd <= now) continue;

      // Effective start: max(dayStart, now) rounded up to next 15-min
      let effectiveStart = dayStart;
      if (dayStart < now) {
        effectiveStart = new Date(now);
        // Round up to next 15-min
        const mins = effectiveStart.getMinutes();
        const remainder = mins % 15;
        if (remainder > 0) {
          effectiveStart.setMinutes(mins + (15 - remainder), 0, 0);
        } else {
          effectiveStart.setSeconds(0, 0);
        }
        // Don't clamp to dayStart — allow current time even if past scheduling hours
      }

      // If not enough time left in the day
      if (Utils.diffMinutes(dayEnd, effectiveStart) < durationMinutes) continue;

      // Get events for this day
      const dayEvents = allEvents
        .filter(ev => {
          return ev.start < dayEnd && ev.end > dayStart;
        })
        .sort((a, b) => a.start - b.start);

      // Find gaps
      let cursor = new Date(effectiveStart);

      for (const ev of dayEvents) {
        // If there's a gap before this event
        const gapEnd = new Date(Math.min(ev.start.getTime(), dayEnd.getTime()));
        const gapMinutes = Utils.diffMinutes(gapEnd, cursor);

        if (gapMinutes >= durationMinutes) {
          results.push({
            start: new Date(cursor),
            end: Utils.addMinutes(cursor, durationMinutes)
          });
          if (results.length >= MAX_RESULTS) break;
        }

        // Move cursor past this event
        if (ev.end > cursor) {
          cursor = new Date(ev.end);
        }
      }

      // Check gap after last event
      if (results.length < MAX_RESULTS) {
        const remainingMinutes = Utils.diffMinutes(dayEnd, cursor);
        if (remainingMinutes >= durationMinutes) {
          results.push({
            start: new Date(cursor),
            end: Utils.addMinutes(cursor, durationMinutes)
          });
        }
      }
    }

    return results;
  }

  /**
   * Get all scheduled events spanning the look-ahead period.
   * Uses the Scheduler to generate events for each week in range.
   */
  function _getAllScheduledEvents() {
    const tasks = Store.getAllTasks();
    const now = new Date();
    const today = Utils.startOfDay(now);
    // Use today as the start, not start of week, to catch today's slots
    const totalDays = LOOK_AHEAD_DAYS + 1;
    const events = Scheduler.schedule(tasks, today, totalDays);
    // Also include ICS blocked events
    if (typeof ICSImport !== 'undefined' && ICSImport.getBlockedIntervals) {
      const rangeEnd = Utils.addDays(today, totalDays);
      const blocked = ICSImport.getBlockedIntervals(today, rangeEnd);
      for (const b of blocked) {
        events.push({ start: b.start, end: b.end, duration: Utils.diffMinutes(b.end, b.start) });
      }
    }
    return events;
  }

  /* ── Formatting helpers ── */

  function _formatDurationLabel(mins) {
    if (mins < 60) return mins + ' ' + _t('findTime.mins');
    const h = mins / 60;
    if (h === 1) return '1 ' + _t('findTime.hr');
    if (Number.isInteger(h)) return h + ' ' + _t('findTime.hrs');
    return h + ' ' + _t('findTime.hrs');
  }

  function _formatSlotDate(date) {
    const today = Utils.startOfDay(new Date());
    const tomorrow = Utils.addDays(today, 1);
    const slotDay = Utils.startOfDay(date);

    if (Utils.isSameDay(slotDay, today)) {
      return _t('findTime.today');
    }
    if (Utils.isSameDay(slotDay, tomorrow)) {
      return _t('findTime.tomorrow');
    }
    return Utils.formatDateFull(date);
  }

  /* ── Show / Hide / Toggle ── */

  function show() {
    const panel = $('findTimePanel');
    if (!panel) return;
    _visible = true;
    panel.style.display = '';
    _render();
  }

  function hide() {
    const panel = $('findTimePanel');
    if (!panel) return;
    _visible = false;
    panel.style.display = 'none';
  }

  function toggle() {
    if (_visible) {
      hide();
    } else {
      show();
    }
  }

  function isVisible() {
    return _visible;
  }

  /* ── Close on click outside ── */

  function _onDocClick(e) {
    if (!_visible) return;
    const panel = $('findTimePanel');
    const btn = $('btnFindTime');
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      hide();
    }
  }

  /* ── Init ── */

  function init() {
    document.addEventListener('click', _onDocClick);
  }

  /** Get the next available slot for a given duration (public API) */
  function getNextSlot(durationMin) {
    const slots = _findFreeSlots(durationMin || 60);
    return slots.length ? slots[0] : null;
  }

  return { init, show, hide, toggle, isVisible, getNextSlot };
})();
