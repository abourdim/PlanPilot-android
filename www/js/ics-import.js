/* ═══════════════════════════════════════════════════════════════════
   ICS IMPORT — PlanPilot
   Parse .ics calendar files and store events as blocked time slots.
   ═══════════════════════════════════════════════════════════════════ */

const ICSImport = (() => {
  'use strict';

  const STORAGE_KEY = 'reclaim_blocked_events';

  /* ── Get / Set blocked events ── */

  function getBlockedEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _saveBlockedEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    document.dispatchEvent(new CustomEvent('store:changed', { detail: { type: 'blocked' } }));
  }

  function clearBlockedEvents() {
    localStorage.removeItem(STORAGE_KEY);
    document.dispatchEvent(new CustomEvent('store:changed', { detail: { type: 'blocked' } }));
  }

  /* ── Parse ICS date string ── */

  function _parseICSDate(str) {
    if (!str) return null;
    // Format: 20260321T090000Z or 20260321T090000 or 20260321
    str = str.replace(/^.*:/, ''); // strip TZID= prefix if present
    if (str.length === 8) {
      // Date only: YYYYMMDD
      const y = parseInt(str.slice(0, 4), 10);
      const m = parseInt(str.slice(4, 6), 10) - 1;
      const d = parseInt(str.slice(6, 8), 10);
      return new Date(y, m, d);
    }
    // DateTime: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
    const y = parseInt(str.slice(0, 4), 10);
    const m = parseInt(str.slice(4, 6), 10) - 1;
    const d = parseInt(str.slice(6, 8), 10);
    const hh = parseInt(str.slice(9, 11), 10);
    const mm = parseInt(str.slice(11, 13), 10);
    const ss = parseInt(str.slice(13, 15), 10) || 0;

    if (str.endsWith('Z')) {
      return new Date(Date.UTC(y, m, d, hh, mm, ss));
    }
    return new Date(y, m, d, hh, mm, ss);
  }

  /* ── Parse RRULE (basic support) ── */

  function _parseRRule(rruleStr) {
    if (!rruleStr) return null;
    const parts = {};
    const pairs = rruleStr.replace(/^RRULE:/, '').split(';');
    for (const pair of pairs) {
      const [key, val] = pair.split('=');
      parts[key] = val;
    }
    return parts;
  }

  /* ── Expand recurring events for the next 8 weeks ── */

  function _expandRecurrence(event, rrule) {
    const results = [];
    const freq = rrule.FREQ;
    const count = parseInt(rrule.COUNT, 10) || 52;
    const until = rrule.UNTIL ? _parseICSDate(rrule.UNTIL) : null;
    const interval = parseInt(rrule.INTERVAL, 10) || 1;
    const maxWeeks = 8;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxWeeks * 7);
    const limit = until && until < maxDate ? until : maxDate;

    const start = new Date(event.start);
    const durationMs = new Date(event.end).getTime() - start.getTime();
    let current = new Date(start);
    let generated = 0;

    while (current <= limit && generated < count) {
      results.push({
        id: event.id + '_' + generated,
        summary: event.summary,
        start: new Date(current).toISOString(),
        end: new Date(current.getTime() + durationMs).toISOString(),
        rrule: event.rrule
      });
      generated++;

      // Advance
      if (freq === 'DAILY') {
        current.setDate(current.getDate() + interval);
      } else if (freq === 'WEEKLY') {
        current.setDate(current.getDate() + 7 * interval);
      } else if (freq === 'MONTHLY') {
        current.setMonth(current.getMonth() + interval);
      } else if (freq === 'YEARLY') {
        current.setFullYear(current.getFullYear() + interval);
      } else {
        break;
      }
    }

    return results;
  }

  /* ── Parse ICS file content ── */

  function _parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').replace(/\r/g, '\n').split('\n');

    let inEvent = false;
    let current = {};

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        current = {};
        continue;
      }
      if (line === 'END:VEVENT') {
        inEvent = false;
        if (current.summary && current.dtstart) {
          const ev = {
            id: Utils.uid(),
            summary: current.summary,
            start: _parseICSDate(current.dtstart)?.toISOString() || '',
            end: (current.dtend ? _parseICSDate(current.dtend) : _parseICSDate(current.dtstart))?.toISOString() || '',
            rrule: current.rrule || null
          };

          if (ev.start) {
            if (ev.rrule) {
              const rruleParsed = _parseRRule(ev.rrule);
              if (rruleParsed) {
                events.push(..._expandRecurrence(ev, rruleParsed));
              } else {
                events.push(ev);
              }
            } else {
              events.push(ev);
            }
          }
        }
        continue;
      }
      if (!inEvent) continue;

      if (line.startsWith('SUMMARY:')) {
        current.summary = line.slice(8);
      } else if (line.startsWith('DTSTART')) {
        current.dtstart = line.split(':').pop();
      } else if (line.startsWith('DTEND')) {
        current.dtend = line.split(':').pop();
      } else if (line.startsWith('RRULE:')) {
        current.rrule = line;
      }
    }

    return events;
  }

  /* ── Import file ── */

  function importFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('No file')); return; }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsed = _parseICS(text);
          if (parsed.length === 0) {
            Utils.toast(I18n.t('ics.noEvents'), 'warning');
            resolve(0);
            return;
          }

          // Merge with existing blocked events
          const existing = getBlockedEvents();
          const merged = existing.concat(parsed);
          _saveBlockedEvents(merged);

          const msg = I18n.t('ics.successCount').replace('{count}', parsed.length);
          Utils.toast(msg, 'success');
          resolve(parsed.length);
        } catch (err) {
          console.error('[ICSImport] Parse error:', err);
          Utils.toast(I18n.t('ics.error'), 'error');
          reject(err);
        }
      };
      reader.onerror = () => {
        Utils.toast(I18n.t('ics.error'), 'error');
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }

  /* ── Get blocked events as intervals for a date range ── */

  function getBlockedIntervals(rangeStart, rangeEnd) {
    const events = getBlockedEvents();
    const intervals = [];
    for (const ev of events) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      if (end <= rangeStart || start >= rangeEnd) continue;
      intervals.push({ start, end, summary: ev.summary, blocked: true });
    }
    return intervals;
  }

  /* ── Init: bind file input in settings if present ── */

  function init() {
    // Binding is done by settings-view when rendered
  }

  return { importFile, getBlockedEvents, getBlockedIntervals, clearBlockedEvents, init };
})();
