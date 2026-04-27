/* ═══════════════════════════════════════════════════════════════════
   APP — PlanPilot (main initialisation)
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ── Logo SVG ── */

  const LOGO_SVG = `<svg preserveAspectRatio="xMidYMid meet" role="img" aria-label="Workshop DIY" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="77.139885 78.322945 253.991455 136.254120"> <path style="stroke:none;fill:currentColor;fill-rule:evenodd" d="M187.423706,152.869797C187.478333,152.738831,187.655853,152.631668,187.818207,152.631668C188.090317,152.631668,190.483124,151.543793,191.616806,150.904663C191.883423,150.754349,193.032593,149.992432,194.170502,149.211517C197.431274,146.973755,199.240906,146.236755,202.587189,145.783752C203.799835,145.619583,204.629318,145.619736,205.933762,145.784378C212.620331,146.628281,217.423569,150.723984,219.325882,157.203781C219.72139,158.550934,219.771454,162.692093,219.406631,163.88208C218.187943,167.857361,216.579514,170.301239,213.792847,172.411835C209.455261,175.697083,203.83429,176.563141,198.809494,174.720413C197.244873,174.146637,196.144424,173.544434,194.478638,172.350433C191.905991,170.506454,190.53334,169.740753,188.031555,168.754135L187.293335,168.462997L187.308884,160.785461C187.317429,156.56282,187.36911,153.000763,187.423706,152.869797z"/> </svg>`;

  /* ── Footer pixel-pet icon (placeholder base64) ── */

  const FOOTER_ICON = '';

  /* ── Helpers ── */

  const $ = Utils.$;

  /* ── Active view state ── */
  let _activeView = 'calendar';

  /* ── View navigation system ── */

  /**
   * Switch to the named view. Hides all panels, shows the selected one,
   * and highlights the corresponding footer button.
   * Views: 'calendar', 'priorities', 'settings', 'analytics'
   */
  function _setActiveView(viewName) {
    _activeView = viewName;

    const calendar      = $('calendarContainer');
    const settings      = $('settingsPanel');
    const analytics     = $('analyticsPanel');
    const priorities    = $('prioritiesPanel');
    const weeklyReview  = $('weeklyReviewPanel');
    const groupsPanel   = $('groupsPanel');

    // Hide all panels
    if (calendar)     calendar.style.display     = 'none';
    if (settings)     settings.style.display     = 'none';
    if (analytics)    analytics.style.display    = 'none';
    if (priorities)   priorities.style.display   = 'none';
    if (weeklyReview) weeklyReview.style.display = 'none';
    if (groupsPanel)  groupsPanel.style.display  = 'none';

    // Show the selected view
    switch (viewName) {
      case 'calendar':
        if (calendar) calendar.style.display = '';
        break;
      case 'settings':
        if (typeof SettingsView !== 'undefined' && SettingsView.show) {
          // SettingsView.show() handles its own display logic; we already hid everything
          if (settings) settings.style.display = '';
          SettingsView.init(); // re-render to pick up latest settings
        }
        break;
      case 'priorities':
        if (typeof PrioritiesView !== 'undefined' && PrioritiesView.show) {
          if (priorities) { priorities.style.display = ''; PrioritiesView.render(); }
        }
        break;
      case 'analytics':
        if (typeof AnalyticsView !== 'undefined' && AnalyticsView.show) {
          if (analytics) analytics.style.display = '';
          AnalyticsView.render();
        }
        break;
      case 'groups':
        if (typeof GroupsView !== 'undefined' && GroupsView.show) {
          if (groupsPanel) { groupsPanel.style.display = ''; GroupsView.render(); }
        }
        break;
    }

    // Update active button highlight
    _updateActiveButton(viewName);
  }

  /** Highlight the active view button in the sidebar footer */
  function _updateActiveButton(viewName) {
    // Map view names to button IDs
    const viewButtonMap = {
      'calendar':   'btnCalendar',
      'settings':   'btnSettings',
      'priorities': 'btnPriorities',
      'analytics':  'btnAnalytics',
      'groups':     'btnGroups'
    };

    // Remove active class from all nav buttons
    const allNavIds = ['btnCalendar', 'btnSettings', 'btnPriorities', 'btnGroups', 'btnAnalytics'];
    allNavIds.forEach(id => {
      const btn = $(id);
      if (btn) btn.classList.remove('sidebar-btn-active');
    });

    // Add active class to the current view's button
    const activeId = viewButtonMap[viewName];
    if (activeId) {
      const btn = $(activeId);
      if (btn) btn.classList.add('sidebar-btn-active');
    }
  }

  /* ── Theme ── */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const settings = Store.getSettings();
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    Store.updateSettings({ theme: next });
    applyTheme(next);
  }

  /* ── UI Mode ── */

  function applyUiMode(mode) {
    document.documentElement.setAttribute('data-ui-mode', mode);
  }

  function setUiMode(mode) {
    Store.updateSettings({ uiMode: mode });
    applyUiMode(mode);
    // Update segmented pill active state
    const modeSimple = $('modeSimple');
    const modeAdvanced = $('modeAdvanced');
    if (modeSimple) modeSimple.classList.toggle('active', mode === 'simple');
    if (modeAdvanced) modeAdvanced.classList.toggle('active', mode === 'advanced');
  }

  function toggleUiMode() {
    const settings = Store.getSettings();
    const next = settings.uiMode === 'advanced' ? 'simple' : 'advanced';
    setUiMode(next);
  }

  /* ── Logo 3D cursor tracker ── */

  function setupLogoCursorTracker() {
    const logoWrap = $('logoWrap');
    if (!logoWrap) return;

    document.addEventListener('mousemove', (e) => {
      const rect = logoWrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      const rotateX = dy * -15;
      const rotateY = dx * 15;
      logoWrap.style.transform = `perspective(400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
  }

  /* ── Pixel pet in footer ── */

  function initPixelPet() {
    if (!FOOTER_ICON) return;
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    const img = document.createElement('img');
    img.src = FOOTER_ICON;
    img.alt = 'Pixel Pet';
    img.className = 'pixel-pet';
    img.width = 32;
    img.height = 32;
    footer.prepend(img);
  }

  /* ── Hijri date ── */

  function initHijriDate() {
    const hijri = Utils.calcHijriDate();
    if (!hijri) return;
    const el = document.querySelector('.toolbar-date-range') || $('dateRange');
    if (el) el.title = hijri;
  }

  /* ── Bismillah pulse ── */

  function pulseBismillah() {
    const bism = $('bismillah');
    if (!bism) return;
    bism.classList.add('pulse');
    setTimeout(() => bism.classList.remove('pulse'), 1500);
  }

  /* ── Tooltip attributes for toolbar buttons ── */

  function _addTooltips() {
    const tooltips = {
      'btnUndo': I18n.t('common.undo') + ' (Ctrl+Z)',
      'btnRedo': I18n.t('common.redo') + ' (Ctrl+Shift+Z)',
      'btnPrev': I18n.t('calendar.prev'),
      'btnNext': I18n.t('calendar.next'),
      'btnToday': I18n.t('calendar.today'),
      'btnSettings': I18n.t('sidebar.settings'),
      'btnCalendar': I18n.t('nav.calendar'),
      'btnAnalytics': I18n.t('sidebar.analytics'),
      'btnPriorities': I18n.t('nav.priorities'),
      'btnGroups': I18n.t('nav.groups'),
      'btnFindTime': I18n.t('findTime.title'),
      'btnHelp': I18n.t('sidebar.help'),
      'btnTheme': I18n.t('settings.theme'),
      'btnNewTask': I18n.t('sidebar.newTask') + ' (N)',
      'btnMenuToggle': 'Menu',
      'searchInput': I18n.t('sidebar.search') + ' (/)'
    };

    for (const [id, tip] of Object.entries(tooltips)) {
      const el = $(id);
      if (el) el.setAttribute('title', tip);
    }
  }

  /* ── Apply i18n to data-i18n elements + placeholders ── */

  function _applyI18nAttributes() {
    // Update text content of elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = I18n.t(key);
      if (val !== key) el.textContent = val;
    });
    // Update placeholder on search input
    const searchInput = $('searchInput');
    if (searchInput) searchInput.placeholder = I18n.t('search.placeholder');
    // Update find-time button text
    const findTimeText = document.querySelector('.btn-find-time-text');
    if (findTimeText) findTimeText.textContent = I18n.t('findTime.title');
    // Update focus score tooltip
    const focusScore = $('focusScore');
    if (focusScore) focusScore.setAttribute('data-tooltip', I18n.t('analytics.focusScore'));
  }

  /* ── Keyboard shortcuts ── */

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        const btnUndo = $('btnUndo');
        if (btnUndo && !btnUndo.disabled) btnUndo.click();
        return;
      }

      // Ctrl+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        const btnRedo = $('btnRedo');
        if (btnRedo && !btnRedo.disabled) btnRedo.click();
        return;
      }

      // Skip remaining shortcuts when typing in inputs
      if (isInput) return;

      // N — open quick-add bar (or fall back to new task button)
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (typeof QuickAdd !== 'undefined' && QuickAdd.show) {
          QuickAdd.show();
        } else {
          const btnNew = $('btnNewTask');
          if (btnNew) btnNew.click();
        }
        return;
      }

      // Escape — close quick-add, find-time, popover, modal, onboarding, settings
      if (e.key === 'Escape') {
        // Close quick-add bar first if open
        if (typeof QuickAdd !== 'undefined' && QuickAdd.isVisible && QuickAdd.isVisible()) {
          QuickAdd.hide();
          return;
        }
        // Close find-time panel first if open
        if (typeof FindTimeView !== 'undefined' && FindTimeView.isVisible && FindTimeView.isVisible()) {
          FindTimeView.hide();
          return;
        }
        // Close popover first if open
        const popover = $('popover');
        if (popover && popover.style.display !== 'none') {
          if (typeof PopoverView !== 'undefined' && PopoverView.close) {
            PopoverView.close();
          }
          return;
        }
        // Close modal
        const overlay = $('modalOverlay');
        if (overlay && overlay.classList.contains('active')) {
          if (typeof ModalView !== 'undefined' && ModalView.close) {
            ModalView.close();
          } else {
            overlay.classList.remove('active');
          }
          return;
        }
        // Close onboarding overlay
        const onboarding = $('onboardingOverlay');
        if (onboarding && onboarding.style.display !== 'none') {
          return; // Onboarding has its own skip button
        }
        // Close any active panel and return to calendar view
        if (_activeView !== 'calendar') {
          _setActiveView('calendar');
          return;
        }
        // Close mobile sidebar
        const sidebar = $('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          return;
        }
        return;
      }

      // / — focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = $('searchInput');
        if (searchInput) searchInput.focus();
        return;
      }
    });
  }

  /* ── Resizable sidebar ── */

  function initResizeHandle(settings) {
    const handle = $('resizeHandle');
    if (!handle) return;

    const MIN = 240, MAX = 500;
    let dragging = false, startX = 0, startWidth = 0;

    // Restore saved width
    if (settings.sidebarWidth) {
      const w = Utils.clamp(settings.sidebarWidth, MIN, MAX);
      document.documentElement.style.setProperty('--sidebar-width', w + 'px');
    }

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 320;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      handle.classList.add('dragging');
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newWidth = Utils.clamp(startWidth + (e.clientX - startX), MIN, MAX);
      document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      handle.classList.remove('dragging');
      const finalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 320;
      Store.updateSettings({ sidebarWidth: finalWidth });
    });
  }

  /* ── Main init ── */

  async function init() {
    const settings = Store.getSettings();

    // 0. Clean up orphaned lockedEvents (drag-to-move was removed)
    const allTasks = Store.getAllTasks();
    for (const t of allTasks) {
      if (t.lockedEvents && t.lockedEvents.length > 0) {
        Store.updateTask(t.id, { lockedEvents: [] });
      }
    }

    // 1. Load i18n (fr by default)
    await I18n.load(settings.language || 'fr');

    // 2. Apply theme
    applyTheme(settings.theme || 'dark');

    // 3. Apply UI mode
    applyUiMode(settings.uiMode || 'advanced');

    // 4. Inject logo SVG
    const logoWrap = $('logoWrap');
    if (logoWrap) logoWrap.innerHTML = LOGO_SVG;

    // 5. Pixel pet
    initPixelPet();

    // 6. Hijri date
    initHijriDate();

    // 7. Logo 3D cursor tracker
    setupLogoCursorTracker();

    // 8. Theme toggle button
    const btnTheme = $('btnTheme');
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

    // 9. UI mode segmented pill
    const modeToggle = $('modeToggle');
    if (modeToggle) {
      modeToggle.addEventListener('click', (e) => {
        const seg = e.target.closest('.mode-toggle-segment');
        if (!seg) return;
        const mode = seg.dataset.mode;
        if (mode) setUiMode(mode);
      });
    }
    // Set initial pill state
    {
      const currentMode = settings.uiMode || 'advanced';
      const modeSimple = $('modeSimple');
      const modeAdvanced = $('modeAdvanced');
      if (modeSimple) modeSimple.classList.toggle('active', currentMode === 'simple');
      if (modeAdvanced) modeAdvanced.classList.toggle('active', currentMode === 'advanced');
    }

    // 10. Init all view modules
    SidebarView.init();
    CalendarView.init();
    ModalView.init();
    PopoverView.init();
    SettingsView.init();
    AnalyticsView.init();
    PrioritiesView.init();
    if (typeof GroupsView !== 'undefined') GroupsView.init();
    if (typeof FindTimeView !== 'undefined') FindTimeView.init();
    Onboarding.init();
    Notifications.init();

    // 10b. Init new modules
    if (typeof ICSImport !== 'undefined') ICSImport.init();
    if (typeof Templates !== 'undefined') Templates.init();
    if (typeof WeeklyReview !== 'undefined') WeeklyReview.init();

    // 10c. Init QuickAdd
    if (typeof QuickAdd !== 'undefined') QuickAdd.init();

    // 10c. Init Touch Gestures (mobile swipe & long-press)
    if (typeof TouchGestures !== 'undefined') TouchGestures.init();

    // 10c. Request browser notification permission
    if (typeof Notifications !== 'undefined' && Notifications.requestPermission) {
      Notifications.requestPermission();
    }

    // 10d. Set initial active view to calendar
    _updateActiveButton('calendar');

    // 10e. Listen for view:changed events from panel close buttons
    document.addEventListener('view:changed', (e) => {
      const view = e.detail && e.detail.view;
      if (view) {
        _activeView = view;
        _updateActiveButton(view);
      }
    });

    // 10f. Listen for view:requestCalendar (e.g. from "Voir dans le calendrier" button)
    document.addEventListener('view:requestCalendar', () => {
      _setActiveView('calendar');
    });

    // 11. Keyboard shortcuts
    setupKeyboardShortcuts();

    // 12. Pulse bismillah on load
    pulseBismillah();

    // 12b. Focus score: update on store changes
    function updateFocusScore() {
      if (typeof FocusScore !== 'undefined' && FocusScore.calculate) {
        const result = FocusScore.calculate();
        const badge = $('focusScore');
        if (badge) badge.textContent = result.score;
      }
    }
    document.addEventListener('store:changed', updateFocusScore);
    updateFocusScore();

    // 13. Listen for event:click from CalendarView → open PopoverView
    document.addEventListener('event:click', (e) => {
      const { event: ev, element } = e.detail || {};
      if (ev && element && typeof PopoverView !== 'undefined' && PopoverView.open) {
        PopoverView.open(ev, element);
      }
    });

    // 14. Bind view navigation buttons
    const btnSettings = $('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => _setActiveView('settings'));
    }

    const btnCalendar = $('btnCalendar');
    if (btnCalendar) {
      btnCalendar.addEventListener('click', () => _setActiveView('calendar'));
    }

    const btnPriorities = $('btnPriorities');
    if (btnPriorities) {
      btnPriorities.addEventListener('click', () => _setActiveView('priorities'));
    }

    // 14b. Bind analytics button
    const btnAnalytics = $('btnAnalytics');
    if (btnAnalytics) {
      btnAnalytics.addEventListener('click', () => _setActiveView('analytics'));
    }

    // 14d. Bind groups button — opens groups Kanban view
    const btnGroups = $('btnGroups');
    if (btnGroups) {
      btnGroups.addEventListener('click', () => _setActiveView('groups'));
    }

    // 14e. Bind help button to open docs
    const btnHelp = $('btnHelp');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        window.open('./docs/index.html', '_blank');
      });
    }

    // 14f. Bind Find Time button
    const btnFindTime = $('btnFindTime');
    if (btnFindTime) {
      btnFindTime.addEventListener('click', () => {
        if (typeof FindTimeView !== 'undefined' && FindTimeView.toggle) {
          FindTimeView.toggle();
        }
      });
    }

    // 14f. Bind Weekly Review button
    const btnWeeklyReview = $('btnWeeklyReview');
    if (btnWeeklyReview) {
      btnWeeklyReview.addEventListener('click', () => {
        if (typeof WeeklyReview !== 'undefined' && WeeklyReview.show) {
          // Use the panel system: hide all, show weekly review
          const calendar      = $('calendarContainer');
          const settings      = $('settingsPanel');
          const analyticsP    = $('analyticsPanel');
          const priorities    = $('prioritiesPanel');
          const weeklyReview  = $('weeklyReviewPanel');
          const groupsP       = $('groupsPanel');
          if (calendar)     calendar.style.display     = 'none';
          if (settings)     settings.style.display     = 'none';
          if (analyticsP)   analyticsP.style.display   = 'none';
          if (priorities)   priorities.style.display   = 'none';
          if (groupsP)      groupsP.style.display      = 'none';
          if (weeklyReview) { weeklyReview.style.display = ''; WeeklyReview.render(); }
          _activeView = 'weeklyReview';
          _updateActiveButton('weeklyReview');
        }
      });
    }

    // 14c. Resizable sidebar
    initResizeHandle(settings);

    // 15. PWA: register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // 15b. PWA: install prompt
    let _deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _deferredInstallPrompt = e;
      const banner = $('installBanner');
      if (banner) banner.classList.add('visible');
    });

    const btnInstall = $('btnInstall');
    if (btnInstall) {
      btnInstall.addEventListener('click', () => {
        if (_deferredInstallPrompt) {
          _deferredInstallPrompt.prompt();
          _deferredInstallPrompt.userChoice.then(() => {
            _deferredInstallPrompt = null;
            const banner = $('installBanner');
            if (banner) banner.classList.remove('visible');
          });
        }
      });
    }

    // 15c. Add tooltip attributes to toolbar buttons
    _addTooltips();

    // 15d. Apply i18n translations to data-i18n elements and placeholders
    _applyI18nAttributes();

    // 16. Focus status indicator — update now + every 60s
    function _updateFocusStatus() {
      const dot = document.querySelector('#focusIndicator .focus-dot');
      const label = $('focusLabel');
      if (!dot || !label) return;

      const now = new Date();
      const events = CalendarView.getEvents();

      // Find event covering current time
      let current = null;
      for (const ev of events) {
        if (ev.start <= now && ev.end > now) {
          current = ev;
          break;
        }
      }

      if (current) {
        dot.className = 'focus-dot active';
        label.textContent = I18n.t('focus.inProgress') + ': ' + (current.taskName || '');
      } else {
        dot.className = 'focus-dot free';
        label.textContent = I18n.t('focus.free');
      }
    }
    _updateFocusStatus();
    document.addEventListener('store:changed', _updateFocusStatus);

    // 16b. Upcoming event notifications (2-minute lookahead)
    const _notifiedEventIds = new Set();

    function _checkUpcomingNotifications() {
      const settings = Store.getSettings();
      if (!settings.notificationsEnabled) return;

      if (typeof CalendarView === 'undefined' || !CalendarView.getEvents) return;
      const events = CalendarView.getEvents();
      if (!events || events.length === 0) return;

      const now = new Date();
      const twoMinMs = 2 * 60000;

      for (const ev of events) {
        if (!ev.start || !ev.taskName) continue;
        const evKey = ev.id || (ev.taskId + '_' + ev.start.getTime());
        if (_notifiedEventIds.has(evKey)) continue;

        const timeUntil = ev.start.getTime() - now.getTime();
        if (timeUntil > 0 && timeUntil <= twoMinMs) {
          _notifiedEventIds.add(evKey);
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const n = new Notification('PlanPilot', {
                body: I18n.t('notification.upcoming') + ': ' + ev.taskName + ' ' + I18n.t('notification.startsIn') + ' 2 min',
                icon: './icons/icon-192.png',
                tag: evKey,
                requireInteraction: false
              });
              setTimeout(() => n.close(), 8000);
            } catch (e) {
              if (typeof Utils !== 'undefined' && Utils.toast) {
                Utils.toast(ev.taskName + ' ' + I18n.t('notification.startsIn') + ' 2 min', 'info', 5000);
              }
            }
          }
        }
      }

      // Cleanup old entries to prevent unbounded growth
      if (_notifiedEventIds.size > 200) _notifiedEventIds.clear();
    }

    // 17. Clock tick (every 60s) for auto-start behavior + focus update + notifications
    setInterval(() => {
      _updateFocusStatus();

      // Check for upcoming event notifications (within 2 minutes)
      _checkUpcomingNotifications();

      const settings = Store.getSettings();
      if (settings.startMode !== 'auto') return;

      const tasks = Store.getAllTasks();
      const now = new Date();
      const events = Scheduler.schedule(tasks, Utils.startOfWeek(now), 7);

      for (const ev of events) {
        if (!ev.isActive) continue;
        const task = Store.getTask(ev.taskId);
        if (!task || task.status === 'done') continue;
        if (task.startMode !== 'auto') continue;
        // Auto-start if not already running
        if (typeof TaskActions !== 'undefined' && TaskActions.isRunning && !TaskActions.isRunning(ev.taskId)) {
          TaskActions.start(ev.taskId);
          break; // only auto-start one task per tick
        }
      }
    }, 60000);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
