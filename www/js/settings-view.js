/* ═══════════════════════════════════════════════════════════════════
   SETTINGS VIEW — PlanPilot
   Full settings panel replacing the calendar area.
   ═══════════════════════════════════════════════════════════════════ */

const SettingsView = (() => {
  'use strict';

  const $ = Utils.$;

  /* ═══════ INIT ═══════ */

  function init() {
    _render();
  }

  /* ═══════ GROUPS LIST HELPER ═══════ */

  const GROUP_PALETTE = ['#9b59b6', '#2ecc71', '#1abc9c', '#e74c3c', '#95a5a6', '#3498db', '#e67e22', '#f1c40f'];

  function _renderGroupsList() {
    const groups = Store.getGroups();
    let html = '';
    groups.forEach(g => {
      html += `
        <div class="group-item" data-group-id="${g.id}" style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${g.color};flex-shrink:0"></span>
            <span style="color:var(--text)">${g.name}</span>
          </div>
          <button type="button" class="btn-ghost btn-delete-group" data-group-id="${g.id}" title="${I18n.t('modal.delete')}" style="color:var(--danger,#ef4444)">&times;</button>
        </div>
      `;
    });
    return html;
  }

  /* ═══════ TEMPLATES LIST HELPER ═══════ */

  function _renderTemplatesList() {
    if (typeof Templates === 'undefined') return '';
    const all = Templates.getAll();
    if (all.length === 0) {
      return `<div style="color:var(--text-muted);font-size:var(--font-size-sm);padding:var(--sp-2) 0">${I18n.t('templates.none')}</div>`;
    }
    return all.map(tpl => `
      <div class="template-item" data-tpl-id="${tpl.id}" style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border)">
        <div>
          <strong style="color:var(--text)">${tpl.name}</strong>
          <span style="color:var(--text-muted);font-size:var(--font-size-sm);margin-left:var(--sp-2)">${Utils.formatDuration(tpl.duration)} | ${tpl.priority}</span>
        </div>
        <button type="button" class="btn-ghost btn-delete-template" data-tpl-id="${tpl.id}" title="${I18n.t('modal.delete')}" style="color:var(--danger,#ef4444)">&times;</button>
      </div>
    `).join('');
  }

  /* ═══════ RENDER ═══════ */

  function _render() {
    const panel = $('settingsPanel');
    if (!panel) return;

    const s = Store.getSettings();
    const schedType = s.defaultSchedulingHours ? s.defaultSchedulingHours.type : 'working';
    const schedStart = s.defaultSchedulingHours ? s.defaultSchedulingHours.startHour : 9;
    const schedEnd = s.defaultSchedulingHours ? s.defaultSchedulingHours.endHour : 17;

    panel.innerHTML = `
      <div class="settings-container">
        <div class="settings-header">
          <h2 class="settings-title">${I18n.t('settings.title')}</h2>
          <button class="modal-close" id="settingsClose" type="button" aria-label="${I18n.t('settings.close')}">&times;</button>
        </div>

        <form class="settings-form" id="settingsForm" novalidate>

          <!-- ═══ Section 1: Planification (open by default) ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header open" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.scheduling')}</span>
            </div>
            <div class="settings-accordion-body">

              <!-- Scheduling Hours (always custom) -->
              <input type="hidden" id="setSchedulingType" value="custom">
              <div class="form-group-split" id="setCustomHoursFields">
                <div class="form-group">
                  <label class="form-label" for="setStartHour">${I18n.t('modal.startHour')}</label>
                  <input type="number" id="setStartHour" class="form-input" min="0" max="24" step="1" value="${schedStart}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="setEndHour">${I18n.t('modal.endHour')}</label>
                  <input type="number" id="setEndHour" class="form-input" min="0" max="24" step="1" value="${schedEnd}">
                </div>
              </div>

              <!-- Default Duration -->
              <div class="form-group">
                <label class="form-label" for="setDefaultDuration">${I18n.t('settings.defaultDuration')}</label>
                <input type="number" id="setDefaultDuration" class="form-input" min="1" step="1" value="${s.defaultDuration}">
              </div>

              <!-- Min / Max Session -->
              <div class="form-group-split">
                <div class="form-group">
                  <label class="form-label" for="setDefaultMinSession">${I18n.t('settings.defaultMinSession')}</label>
                  <input type="number" id="setDefaultMinSession" class="form-input" min="1" step="1" value="${s.defaultMinSession}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="setDefaultMaxSession">${I18n.t('settings.defaultMaxSession')}</label>
                  <input type="number" id="setDefaultMaxSession" class="form-input" min="1" step="1" value="${s.defaultMaxSession}">
                </div>
              </div>

              <!-- Default Split Up -->
              <div class="form-group form-group-toggle">
                <label class="form-label" for="setDefaultSplitUp">${I18n.t('settings.defaultSplitUp')}</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="setDefaultSplitUp" ${s.defaultSplitUp ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Start Delay -->
              <div class="form-group">
                <label class="form-label" for="setStartDelay">${I18n.t('settings.defaultStartDelay')}</label>
                <input type="number" id="setStartDelay" class="form-input" min="0" step="1" value="${s.defaultStartDelay}">
              </div>

              <!-- Due Date Offset -->
              <div class="form-group">
                <label class="form-label" for="setDueDateOffset">${I18n.t('settings.defaultDueDateOffset')}</label>
                <input type="number" id="setDueDateOffset" class="form-input" min="0" step="1" value="${s.defaultDueDateOffset}">
              </div>

              <!-- Start Mode -->
              <div class="form-group">
                <label class="form-label" for="setStartMode">${I18n.t('settings.startMode')}</label>
                <select id="setStartMode" class="form-input">
                  <option value="auto" ${s.startMode === 'auto' ? 'selected' : ''}>${I18n.t('modal.startModes.auto')}</option>
                  <option value="manual" ${s.startMode === 'manual' ? 'selected' : ''}>${I18n.t('modal.startModes.manual')}</option>
                </select>
              </div>

            </div>
          </div>

          <!-- ═══ Section 2: Priorites et groupes ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.prioritiesGroups')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <!-- Default Priority -->
              <div class="form-group">
                <label class="form-label" for="setDefaultPriority">${I18n.t('settings.defaultPriority')}</label>
                <select id="setDefaultPriority" class="form-input">
                  <option value="P1" ${s.defaultPriority === 'P1' ? 'selected' : ''}>${I18n.t('priority.p1')}</option>
                  <option value="P2" ${s.defaultPriority === 'P2' ? 'selected' : ''}>${I18n.t('priority.p2')}</option>
                  <option value="P3" ${s.defaultPriority === 'P3' ? 'selected' : ''}>${I18n.t('priority.p3')}</option>
                  <option value="P4" ${s.defaultPriority === 'P4' ? 'selected' : ''}>${I18n.t('priority.p4')}</option>
                </select>
              </div>

              <!-- Default Visibility -->
              <div class="form-group">
                <label class="form-label" for="setDefaultVisibility">${I18n.t('settings.defaultVisibility')}</label>
                <select id="setDefaultVisibility" class="form-input">
                  <option value="busy" ${s.defaultVisibility === 'busy' ? 'selected' : ''}>${I18n.t('modal.visibilityOptions.busy')}</option>
                  <option value="free" ${s.defaultVisibility === 'free' ? 'selected' : ''}>${I18n.t('modal.visibilityOptions.free')}</option>
                </select>
              </div>

              <!-- Groups -->
              <div id="settingsGroupsList">
                ${_renderGroupsList()}
              </div>
              <div class="form-group" style="margin-top:var(--sp-3)">
                <button type="button" class="btn-secondary" id="settingsAddGroup" ${Store.getGroups().length >= 8 ? 'disabled' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  ${Store.getGroups().length >= 8 ? I18n.t('groups.maxReached') : I18n.t('groups.add')}
                </button>
              </div>

            </div>
          </div>

          <!-- ═══ Section 3: Apparence ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.appearance')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <!-- Theme -->
              <div class="form-group form-group-toggle">
                <label class="form-label">${I18n.t('settings.themes.light')} / ${I18n.t('settings.themes.dark')}</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="setTheme" ${s.theme === 'dark' ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- UI Mode -->
              <div class="form-group form-group-toggle">
                <label class="form-label">${I18n.t('settings.uiModes.simple')} / ${I18n.t('settings.uiModes.advanced')}</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="setUiMode" ${s.uiMode === 'advanced' ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Language -->
              <div class="form-group">
                <label class="form-label" for="setLanguage">${I18n.t('settings.language')}</label>
                <select id="setLanguage" class="form-input">
                  <option value="fr" selected>${I18n.t('languages.fr')}</option>
                  <option value="en" disabled>English</option>
                  <option value="ar" disabled>${I18n.t('languages.ar')}</option>
                </select>
              </div>

            </div>
          </div>

          <!-- ═══ Section 4: Notifications ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.notifications')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <!-- Notifications Enabled -->
              <div class="form-group form-group-toggle">
                <label class="form-label" for="setNotifications">${I18n.t('settings.notificationsEnabled')}</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="setNotifications" ${s.notificationsEnabled ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Notification Lead Time -->
              <div class="form-group">
                <label class="form-label" for="setNotificationLead">${I18n.t('settings.notificationLead')}</label>
                <input type="number" id="setNotificationLead" class="form-input" min="1" step="1" value="${s.notificationLead}">
              </div>

              <!-- Pomodoro -->
              <div class="form-group">
                <label class="form-label" for="setPomodoroWork">${I18n.t('pomodoro.workDuration')}</label>
                <input type="number" id="setPomodoroWork" class="form-input" min="1" max="120" step="1" value="${s.pomodoroWork || 25}">
              </div>
              <div class="form-group">
                <label class="form-label" for="setPomodoroBreak">${I18n.t('pomodoro.breakDuration')}</label>
                <input type="number" id="setPomodoroBreak" class="form-input" min="1" max="60" step="1" value="${s.pomodoroBreak || 5}">
              </div>

            </div>
          </div>

          <!-- ═══ Section 5: Energie ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.energy')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <!-- Peak Hours -->
              <div class="form-group-split">
                <div class="form-group">
                  <label class="form-label" for="setPeakStart">${I18n.t('settings.peakStart')}</label>
                  <input type="number" id="setPeakStart" class="form-input" min="0" max="23" step="1" value="${s.peakStartHour}">
                </div>
                <div class="form-group">
                  <label class="form-label" for="setPeakEnd">${I18n.t('settings.peakEnd')}</label>
                  <input type="number" id="setPeakEnd" class="form-input" min="0" max="23" step="1" value="${s.peakEndHour}">
                </div>
              </div>

            </div>
          </div>

          <!-- ═══ Section 6: Donnees ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span>${I18n.t('settings.sections.data')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <!-- Auto Backup -->
              <div class="form-group form-group-toggle">
                <label class="form-label" for="setAutoBackup">${I18n.t('settings.autoBackup')}</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="setAutoBackup" ${s.autoBackup ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Export / Import -->
              <div class="form-group-split">
                <button type="button" class="btn-secondary" id="settingsExport">${I18n.t('settings.export')}</button>
                <button type="button" class="btn-secondary" id="settingsImport">${I18n.t('settings.import')}</button>
              </div>
              <input type="file" id="settingsImportFile" accept=".json" style="display:none">

              <!-- ICS Calendar Import -->
              <div class="form-group">
                <button type="button" class="btn-secondary" id="settingsICSImport">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  ${I18n.t('ics.importButton')}
                </button>
                <input type="file" id="settingsICSFile" accept=".ics" style="display:none">
              </div>

              <!-- Task Templates -->
              <div id="settingsTemplatesList" class="templates-manage-list">
                ${_renderTemplatesList()}
              </div>
              <div class="form-group" style="margin-top:var(--sp-3)">
                <button type="button" class="btn-secondary" id="settingsAddTemplate">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  ${I18n.t('templates.add')}
                </button>
              </div>

            </div>
          </div>

          <!-- ═══ Section 7: Zone dangereuse ═══ -->
          <div class="settings-accordion-section">
            <div class="settings-accordion-header" data-accordion>
              <span class="arrow">\u25B6</span>
              <span style="color:#e74c3c">${I18n.t('settings.sections.danger')}</span>
            </div>
            <div class="settings-accordion-body" style="display:none">

              <div class="form-group">
                <button type="button" class="btn-primary" id="settingsResetAll" style="background:#e74c3c;width:100%">
                  ${I18n.t('settings.resetAll')}
                </button>
              </div>

            </div>
          </div>

        </form>
      </div>
    `;

    _bindEvents(panel);
  }

  /* ═══════ BIND EVENTS ═══════ */

  function _bindEvents(panel) {
    // Close button
    const closeBtn = panel.querySelector('#settingsClose');
    if (closeBtn) closeBtn.addEventListener('click', hide);

    // Accordion toggle
    panel.querySelectorAll('.settings-accordion-header[data-accordion]').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        if (!body) return;
        const isOpen = header.classList.contains('open');
        if (isOpen) {
          header.classList.remove('open');
          body.style.display = 'none';
        } else {
          header.classList.add('open');
          body.style.display = '';
        }
      });
    });

    // Theme toggle - apply immediately
    const themeToggle = panel.querySelector('#setTheme');
    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        const theme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        _saveAll();
      });
    }

    // UI mode toggle - apply immediately
    const uiModeToggle = panel.querySelector('#setUiMode');
    if (uiModeToggle) {
      uiModeToggle.addEventListener('change', () => {
        const mode = uiModeToggle.checked ? 'advanced' : 'simple';
        document.documentElement.setAttribute('data-ui-mode', mode);
        _saveAll();
      });
    }

    // All other inputs — save on change
    const inputs = panel.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (input.id === 'settingsImportFile' || input.id === 'settingsICSFile') return;
      const eventType = (input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'input';
      input.addEventListener(eventType, Utils.debounce(() => _saveAll(), 300));
    });

    // Export button — use ExportImport module if available
    const exportBtn = panel.querySelector('#settingsExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (typeof ExportImport !== 'undefined' && ExportImport.exportData) {
          ExportImport.exportData();
        } else {
          _handleExport();
        }
      });
    }

    // Import button — use ExportImport module if available
    const importBtn = panel.querySelector('#settingsImport');
    const importFile = panel.querySelector('#settingsImportFile');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => {
        if (typeof ExportImport !== 'undefined' && ExportImport.importData) {
          ExportImport.importData();
        } else {
          importFile.click();
        }
      });
      importFile.addEventListener('change', _handleImport);
    }

    // ICS import button
    const icsBtn = panel.querySelector('#settingsICSImport');
    const icsFile = panel.querySelector('#settingsICSFile');
    if (icsBtn && icsFile) {
      icsBtn.addEventListener('click', () => icsFile.click());
      icsFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (typeof ICSImport !== 'undefined' && ICSImport.importFile) {
          ICSImport.importFile(file);
        }
        e.target.value = '';
      });
    }

    // Group delete buttons
    panel.querySelectorAll('.btn-delete-group').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm(I18n.t('groups.deleteConfirm'))) return;
        const groupId = btn.dataset.groupId;
        Store.deleteGroup(groupId);
        _render();
      });
    });

    // Add group button
    const addGroupBtn = panel.querySelector('#settingsAddGroup');
    if (addGroupBtn) {
      addGroupBtn.addEventListener('click', () => {
        const groups = Store.getGroups();
        if (groups.length >= 8) return;
        const name = prompt(I18n.t('groups.name'));
        if (!name || !name.trim()) return;
        // Pick next color from palette not already used
        const usedColors = new Set(groups.map(g => g.color));
        let color = GROUP_PALETTE.find(c => !usedColors.has(c)) || GROUP_PALETTE[0];
        // Show color picker via prompt with palette
        const colorChoice = prompt(
          I18n.t('groups.name') + ' — ' + name.trim() + '\n' +
          'Couleur (1-8):\n' +
          GROUP_PALETTE.map((c, i) => `${i + 1}. ${c}`).join('\n'),
          String(GROUP_PALETTE.indexOf(color) + 1)
        );
        if (colorChoice) {
          const idx = parseInt(colorChoice, 10) - 1;
          if (idx >= 0 && idx < GROUP_PALETTE.length) color = GROUP_PALETTE[idx];
        }
        Store.saveGroup({ name: name.trim(), color });
        _render();
      });
    }

    // Template delete buttons
    const deleteBtns = panel.querySelectorAll('.btn-delete-template');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tplId = btn.dataset.tplId;
        if (typeof Templates !== 'undefined' && Templates.delete) {
          Templates.delete(tplId);
          _render();
        }
      });
    });

    // Add template button
    const addTplBtn = panel.querySelector('#settingsAddTemplate');
    if (addTplBtn) {
      addTplBtn.addEventListener('click', () => {
        const name = prompt(I18n.t('templates.namePrompt'));
        if (!name || !name.trim()) return;
        const durationStr = prompt(I18n.t('templates.durationPrompt'), '60');
        const duration = parseInt(durationStr, 10) || 60;
        if (typeof Templates !== 'undefined' && Templates.save) {
          Templates.save({
            name: name.trim(),
            duration: duration,
            priority: 'P2',
            splitUp: false,
            minSession: 15,
            maxSession: 120,
            schedulingHours: { type: 'working', startHour: 9, endHour: 17 },
            energyLevel: 'any'
          });
          _render();
        }
      });
    }

    // Reset all data
    const resetBtn = panel.querySelector('#settingsResetAll');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm(I18n.t('settings.resetConfirm'))) {
          localStorage.clear();
          window.location.reload();
        }
      });
    }
  }

  /* ═══════ COLLECT & SAVE ═══════ */

  function _saveAll() {
    const panel = $('settingsPanel');
    if (!panel) return;

    const schedTypeEl = panel.querySelector('#setSchedulingType');
    const schedType = schedTypeEl ? schedTypeEl.value : 'working';

    let schedulingHours;
    if (schedType === 'working') {
      schedulingHours = { type: 'working', startHour: 9, endHour: 17 };
    } else if (schedType === 'personal') {
      schedulingHours = { type: 'personal', startHour: 18, endHour: 22 };
    } else {
      const startH = parseInt(panel.querySelector('#setStartHour')?.value, 10) || 9;
      const endH = parseInt(panel.querySelector('#setEndHour')?.value, 10) || 17;
      schedulingHours = { type: 'custom', startHour: startH, endHour: endH };
    }

    const changes = {
      defaultPriority: panel.querySelector('#setDefaultPriority')?.value || 'P2',
      defaultDuration: parseInt(panel.querySelector('#setDefaultDuration')?.value, 10) || 60,
      defaultSplitUp: panel.querySelector('#setDefaultSplitUp')?.checked || false,
      defaultMinSession: parseInt(panel.querySelector('#setDefaultMinSession')?.value, 10) || 15,
      defaultMaxSession: parseInt(panel.querySelector('#setDefaultMaxSession')?.value, 10) || 120,
      defaultSchedulingHours: schedulingHours,
      defaultStartDelay: parseInt(panel.querySelector('#setStartDelay')?.value, 10) || 0,
      defaultDueDateOffset: parseInt(panel.querySelector('#setDueDateOffset')?.value, 10) || 3,
      defaultVisibility: panel.querySelector('#setDefaultVisibility')?.value || 'busy',
      startMode: panel.querySelector('#setStartMode')?.value || 'auto',
      theme: panel.querySelector('#setTheme')?.checked ? 'dark' : 'light',
      uiMode: panel.querySelector('#setUiMode')?.checked ? 'advanced' : 'simple',
      language: panel.querySelector('#setLanguage')?.value || 'fr',
      notificationsEnabled: panel.querySelector('#setNotifications')?.checked || false,
      notificationLead: parseInt(panel.querySelector('#setNotificationLead')?.value, 10) || 5,
      pomodoroWork: parseInt(panel.querySelector('#setPomodoroWork')?.value, 10) || 25,
      pomodoroBreak: parseInt(panel.querySelector('#setPomodoroBreak')?.value, 10) || 5,
      peakStartHour: parseInt(panel.querySelector('#setPeakStart')?.value, 10) || 9,
      peakEndHour: parseInt(panel.querySelector('#setPeakEnd')?.value, 10) || 12,
      autoBackup: panel.querySelector('#setAutoBackup')?.checked || false
    };

    Store.updateSettings(changes);
  }

  /* ═══════ EXPORT / IMPORT ═══════ */

  function _handleExport() {
    try {
      const data = Store.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planpilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Export failed:', err);
    }
  }

  function _handleImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        Store.importAll(data, 'replace');
        // Re-render settings with new data
        _render();
        // Re-apply theme and ui mode from imported settings
        const s = Store.getSettings();
        document.documentElement.setAttribute('data-theme', s.theme || 'dark');
        document.documentElement.setAttribute('data-ui-mode', s.uiMode || 'advanced');
      } catch (err) {
        console.error('[Settings] Import failed:', err);
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  }

  /* ═══════ SHOW / HIDE ═══════ */

  function show() {
    const panel = $('settingsPanel');
    const calendar = $('calendarContainer');
    const analytics = $('analyticsPanel');
    const priorities = $('prioritiesPanel');
    const weeklyReview = $('weeklyReviewPanel');
    const groupsPanel = $('groupsPanel');

    // Re-render to pick up current settings
    _render();

    if (panel) panel.style.display = '';
    if (calendar) calendar.style.display = 'none';
    if (analytics) analytics.style.display = 'none';
    if (priorities) priorities.style.display = 'none';
    if (weeklyReview) weeklyReview.style.display = 'none';
    if (groupsPanel) groupsPanel.style.display = 'none';
  }

  function hide() {
    const panel = $('settingsPanel');
    const calendar = $('calendarContainer');

    if (panel) panel.style.display = 'none';
    if (calendar) calendar.style.display = '';

    // Notify app to update active view state
    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: 'calendar' } }));
  }

  function toggle() {
    const panel = $('settingsPanel');
    if (panel && panel.style.display !== 'none') {
      hide();
    } else {
      show();
    }
  }

  function isVisible() {
    const panel = $('settingsPanel');
    return panel && panel.style.display !== 'none';
  }

  /* ═══════ PUBLIC API ═══════ */

  return { init, show, hide, toggle, isVisible };
})();
