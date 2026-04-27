/* ═══════════════════════════════════════════════════════════════════
   POMODORO — PlanPilot
   25/5 pomodoro timer with Web Audio beep + browser notifications.
   ═══════════════════════════════════════════════════════════════════ */

const Pomodoro = (() => {
  'use strict';

  /* ── State ── */

  let _state = {
    running: false,
    paused: false,
    mode: 'work',       // 'work' | 'break'
    taskId: null,
    remaining: 0,       // seconds
    total: 0,           // seconds (for progress ring)
    pomodorosCompleted: 0,
    intervalId: null
  };

  /* ── Defaults (overridden by settings) ── */

  function _getWorkDuration() {
    const s = Store.getSettings();
    return (s.pomodoroWork || 25) * 60;
  }

  function _getBreakDuration() {
    const s = Store.getSettings();
    return (s.pomodoroBreak || 5) * 60;
  }

  /* ── Audio beep via Web Audio API ── */

  function _beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close(), 600);
    } catch (e) {
      // Web Audio not available — silent fallback
    }
  }

  /* ── Browser notification helper ── */

  function _notify(body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification('PlanPilot', {
          body: body,
          icon: './icons/icon-192.png',
          requireInteraction: false
        });
        setTimeout(() => n.close(), 6000);
      } catch (e) { /* fallback silent */ }
    }
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(body, 'info', 5000);
    }
  }

  /* ── UI rendering ── */

  function _renderUI() {
    let container = document.getElementById('pomodoroTimer');

    if (!_state.running && !_state.paused) {
      if (container) container.remove();
      return;
    }

    if (!container) {
      container = document.createElement('div');
      container.id = 'pomodoroTimer';
      container.className = 'pomodoro-timer';
      // Insert next to focus indicator in toolbar-right
      const statusGroup = document.querySelector('.toolbar-status-group');
      if (statusGroup) {
        statusGroup.insertBefore(container, statusGroup.firstChild);
      }
    }

    const mins = Math.floor(_state.remaining / 60);
    const secs = _state.remaining % 60;
    const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    // Progress fraction (1 = full, 0 = done)
    const progress = _state.total > 0 ? _state.remaining / _state.total : 0;
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const dashoffset = circumference * (1 - progress);

    const modeLabel = _state.mode === 'work' ? I18n.t('pomodoro.work') : I18n.t('pomodoro.break');
    const pauseResumeTitle = _state.paused ? I18n.t('pomodoro.resume') : I18n.t('pomodoro.pause');

    container.innerHTML = `
      <svg class="pomodoro-ring" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="${radius}" fill="none" stroke="var(--surface-border)" stroke-width="2.5"/>
        <circle cx="15" cy="15" r="${radius}" fill="none"
          stroke="${_state.mode === 'work' ? 'var(--accent)' : '#2ecc71'}"
          stroke-width="2.5" stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${dashoffset}"
          transform="rotate(-90 15 15)"/>
      </svg>
      <span class="pomodoro-time" title="${modeLabel}">🍅 ${timeStr}</span>
      <button class="pomodoro-btn pomodoro-pause" title="${pauseResumeTitle}" type="button">
        ${_state.paused ? '▶' : '⏸'}
      </button>
      <button class="pomodoro-btn pomodoro-stop" title="${I18n.t('pomodoro.stop')}" type="button">✕</button>
    `;

    // Bind buttons
    container.querySelector('.pomodoro-pause').addEventListener('click', (e) => {
      e.stopPropagation();
      if (_state.paused) resume(); else pause();
    });
    container.querySelector('.pomodoro-stop').addEventListener('click', (e) => {
      e.stopPropagation();
      stop();
    });
  }

  /* ── Tick ── */

  function _tick() {
    if (_state.paused || !_state.running) return;

    _state.remaining--;

    if (_state.remaining <= 0) {
      _beep();

      if (_state.mode === 'work') {
        // Work session complete
        _state.pomodorosCompleted++;
        _savePomodoroCount(_state.taskId, _state.pomodorosCompleted);

        _notify(I18n.t('pomodoro.breakNotify'));

        // Switch to break
        _state.mode = 'break';
        _state.total = _getBreakDuration();
        _state.remaining = _state.total;
      } else {
        // Break complete
        _notify(I18n.t('pomodoro.workNotify'));

        // Switch to work
        _state.mode = 'work';
        _state.total = _getWorkDuration();
        _state.remaining = _state.total;
      }
    }

    _renderUI();
  }

  /* ── Save pomodoro count to task ── */

  function _savePomodoroCount(taskId, count) {
    if (!taskId) return;
    try {
      Store.updateTask(taskId, { pomodorosCompleted: count });
    } catch (e) { /* task may have been deleted */ }
  }

  /* ── Public API ── */

  function start(taskId) {
    // Stop any existing timer
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
    }

    // Load existing pomodoro count from task
    let existingCount = 0;
    if (taskId) {
      const task = Store.getTask(taskId);
      if (task) existingCount = task.pomodorosCompleted || 0;
    }

    _state = {
      running: true,
      paused: false,
      mode: 'work',
      taskId: taskId || null,
      total: _getWorkDuration(),
      remaining: _getWorkDuration(),
      pomodorosCompleted: existingCount,
      intervalId: setInterval(_tick, 1000)
    };

    _renderUI();
  }

  function stop() {
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
    }
    _state = {
      running: false,
      paused: false,
      mode: 'work',
      taskId: null,
      remaining: 0,
      total: 0,
      pomodorosCompleted: 0,
      intervalId: null
    };
    _renderUI();
  }

  function pause() {
    if (!_state.running) return;
    _state.paused = true;
    _renderUI();
  }

  function resume() {
    if (!_state.running) return;
    _state.paused = false;
    _renderUI();
  }

  function getState() {
    return {
      running: _state.running,
      paused: _state.paused,
      mode: _state.mode,
      taskId: _state.taskId,
      remaining: _state.remaining,
      total: _state.total,
      pomodorosCompleted: _state.pomodorosCompleted
    };
  }

  return { start, stop, pause, resume, getState };
})();
