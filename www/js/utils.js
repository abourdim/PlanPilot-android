/* ═══════════════════════════════════════════════════════════════════
   UTILS — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const Utils = (() => {

  /** Generate unique ID */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /** Shorthand getElementById */
  function $(id) {
    return document.getElementById(id);
  }

  /** Create element with optional class and attributes */
  function el(tag, className, attrs) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v);
      }
    }
    return e;
  }

  /* ── Date Helpers ── */

  /** Get start of day (00:00:00) */
  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Get end of day (23:59:59) */
  function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /** Get start of week (Monday) */
  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return startOfDay(d);
  }

  /** Add days to a date */
  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  /** Add minutes to a date */
  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  /** Difference in minutes between two dates */
  function diffMinutes(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 60000);
  }

  /** Is same day? */
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  /** Is today? */
  function isToday(date) {
    return isSameDay(date, new Date());
  }

  /** Format time (HH:MM) */
  function formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /** Format date (short) — e.g. "Mar 18" */
  function formatDateShort(date) {
    const months = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  /** Format date (full) — e.g. "Lun. 18 Mars 2026" */
  function formatDateFull(date) {
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['Janvier','Fevrier','Mars','Avril','Mai','Juin',
                    'Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    return `${days[date.getDay()]}. ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  /** Format date for input[type=date] */
  function toDateInputValue(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Format date for input[type=datetime-local] */
  function toDateTimeInputValue(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  /** Format duration (minutes) -> human readable */
  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  }

  /** Snap minutes to nearest increment (default 15) */
  function snapMinutes(minutes, increment = 15) {
    return Math.round(minutes / increment) * increment;
  }

  /** Day name abbreviation */
  function dayAbbr(date) {
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    return days[date.getDay()];
  }

  /** Parse date from input[type=date] or input[type=datetime-local] value */
  function parseDateInput(str) {
    if (!str) return null;
    if (str.includes('T')) {
      const [datePart, timePart] = str.split('T');
      const [y, m, d] = datePart.split('-').map(Number);
      const [hh, mm] = timePart.split(':').map(Number);
      return new Date(y, m - 1, d, hh || 0, mm || 0);
    }
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Clamp number between min and max */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /** Debounce function */
  function debounce(fn, ms) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /** Deep clone (JSON safe) */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Hijri date string */
  function calcHijriDate() {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(new Date());
    } catch { return ''; }
  }

  /** Priority bars HTML (signal-strength style icon) */
  function priorityBarsHTML(priority, white) {
    const config = {
      P1: { filled: 4, color: 'var(--p1)' },
      P2: { filled: 3, color: 'var(--p2)' },
      P3: { filled: 2, color: 'var(--p3)' },
      P4: { filled: 1, color: 'var(--p4)' }
    };
    const { filled, color } = config[priority] || config.P4;
    const barColor = white ? '#fff' : color;
    const heights = [6, 9, 12, 15];
    let bars = '<span class="priority-bars" aria-label="' + priority + '">';
    for (let i = 0; i < 4; i++) {
      const active = i < filled;
      const opacity = active ? '1' : '0.3';
      bars += '<span class="priority-bar" style="height:' + heights[i] + 'px;background:' + barColor + ';opacity:' + opacity + '"></span>';
    }
    bars += '</span>';
    return bars;
  }

  /** Show a toast notification */
  function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toastEl = el('div', 'toast toast-' + type, { text: message });
    container.appendChild(toastEl);
    // Trigger entrance animation
    requestAnimationFrame(() => toastEl.classList.add('toast-visible'));
    setTimeout(() => {
      toastEl.classList.remove('toast-visible');
      toastEl.addEventListener('transitionend', () => toastEl.remove());
      // Fallback removal
      setTimeout(() => { if (toastEl.parentNode) toastEl.remove(); }, 500);
    }, duration);
  }

  return {
    uid, $, el,
    startOfDay, endOfDay, startOfWeek,
    addDays, addMinutes, diffMinutes,
    isSameDay, isToday,
    formatTime, formatDateShort, formatDateFull, formatDuration,
    toDateInputValue, toDateTimeInputValue, parseDateInput,
    snapMinutes, dayAbbr, clamp, debounce, clone,
    calcHijriDate, toast, priorityBarsHTML
  };
})();
