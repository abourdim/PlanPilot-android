/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const Notifications = (() => {
  'use strict';

  let _checkInterval = null;
  const _notifiedIds = new Set();

  /**
   * Initialise notification checking.
   * Runs a check every 60 seconds for upcoming events.
   */
  function init() {
    // Run first check after a short delay to let the app finish loading
    setTimeout(_check, 5000);
    _checkInterval = setInterval(_check, 60000);
  }

  /**
   * Request browser notification permission.
   * Returns a promise that resolves with the permission state.
   */
  function requestPermission() {
    if (!('Notification' in window)) return Promise.resolve('denied');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    return Notification.requestPermission();
  }

  /**
   * Check for upcoming events and fire notifications.
   */
  function _check() {
    const settings = Store.getSettings();
    if (!settings.notificationsEnabled) return;

    // Get events from CalendarView
    if (typeof CalendarView === 'undefined' || !CalendarView.getEvents) return;
    const events = CalendarView.getEvents();
    if (!events || events.length === 0) return;

    const now = new Date();
    const leadMinutes = settings.notificationLead || 5;
    const leadMs = leadMinutes * 60000;

    for (const ev of events) {
      if (!ev.start || !ev.taskName) continue;

      // Create a stable ID for this event to avoid duplicates
      const evKey = ev.id || (ev.taskId + '_' + ev.start.getTime());
      if (_notifiedIds.has(evKey)) continue;

      const timeUntilStart = ev.start.getTime() - now.getTime();

      // Fire notification if event starts within lead time and hasn't started yet
      if (timeUntilStart > 0 && timeUntilStart <= leadMs) {
        _notifiedIds.add(evKey);
        _fireNotification(ev, leadMinutes);
      }
    }

    // Cleanup: remove old notified IDs for events that have passed
    const cutoff = now.getTime() - 3600000; // 1 hour ago
    for (const key of _notifiedIds) {
      // Keep the set from growing without bound
      if (_notifiedIds.size > 500) {
        _notifiedIds.clear();
        break;
      }
    }
  }

  /**
   * Fire a browser notification or fall back to in-app toast.
   */
  function _fireNotification(ev, leadMinutes) {
    const priorityLabel = I18n.t(TaskModel.priorityLabel(ev.priority));
    const title = I18n.t('notification.upcoming');
    const body = ev.taskName + ' (' + priorityLabel + ') — ' +
                 I18n.t('notification.startsIn') + ' ' + leadMinutes + 'min';

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: './icons/icon-192.png',
          tag: ev.id || ev.taskId,
          requireInteraction: false
        });
        // Auto-close after 8 seconds
        setTimeout(() => notification.close(), 8000);
      } catch (e) {
        // Fallback to toast
        _showToast(body);
      }
    } else {
      // Permission denied or not available — show in-app toast
      _showToast(body);
    }
  }

  /**
   * Show an in-app toast notification via Utils.toast.
   */
  function _showToast(message) {
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(message, 'info', 5000);
    }
  }

  return { init, requestPermission };
})();
