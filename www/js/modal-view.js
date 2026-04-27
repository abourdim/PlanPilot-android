/* ═══════════════════════════════════════════════════════════════════
   MODAL VIEW — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const ModalView = (() => {
  'use strict';

  const $ = Utils.$;
  let _editingTask = null;
  let _confirmingDelete = false;

  /* ── Render form HTML ── */

  function _renderForm() {
    const modal = $('modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title" id="modalTitle"></h2>
        <button class="modal-close" id="modalClose" type="button" aria-label="Fermer">&times;</button>
      </div>
      <form class="modal-form" id="modalForm" novalidate>

        <!-- Modele (Template) -->
        <div class="form-group" id="templateGroup">
          <label class="form-label" for="fieldTemplate">${I18n.t('templates.label')}</label>
          <select id="fieldTemplate" class="form-input">
            <option value="">${I18n.t('templates.none')}</option>
          </select>
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label" for="fieldName">${I18n.t('modal.name')}</label>
          <input type="text" id="fieldName" class="form-input" placeholder="${I18n.t('modal.namePlaceholder')}" required>
          <span class="form-error" id="errorName"></span>
        </div>

        <!-- Groupe -->
        <div class="form-group" id="groupField">
          <label class="form-label" for="fieldGroup">${I18n.t('groups.title')}</label>
          <select id="fieldGroup" class="form-input">
            <option value="">${I18n.t('groups.none')}</option>
          </select>
        </div>

        <!-- Priorite -->
        <div class="form-group">
          <label class="form-label">${I18n.t('modal.priority')}</label>
          <input type="hidden" id="fieldPriority" value="P2">
          <div class="priority-dropdown" id="priorityDropdown">
            <div class="priority-dropdown-display" id="priorityDropdownDisplay">
              ${Utils.priorityBarsHTML('P2')}
              <span class="priority-dropdown-label">${I18n.t('priority.p2')}</span>
              <span class="priority-dropdown-arrow">&#9662;</span>
            </div>
            <div class="priority-dropdown-menu" id="priorityDropdownMenu" style="display:none">
              <div class="priority-dropdown-option" data-value="P1">${Utils.priorityBarsHTML('P1')}<span>${I18n.t('priority.p1')}</span></div>
              <div class="priority-dropdown-option" data-value="P2">${Utils.priorityBarsHTML('P2')}<span>${I18n.t('priority.p2')}</span></div>
              <div class="priority-dropdown-option" data-value="P3">${Utils.priorityBarsHTML('P3')}<span>${I18n.t('priority.p3')}</span></div>
              <div class="priority-dropdown-option" data-value="P4">${Utils.priorityBarsHTML('P4')}<span>${I18n.t('priority.p4')}</span></div>
            </div>
          </div>
        </div>

        <!-- Duree -->
        <div class="form-group">
          <label class="form-label" for="fieldDuration">${I18n.t('modal.duration')}</label>
          <input type="number" id="fieldDuration" class="form-input" min="1" step="1">
          <span class="form-error" id="errorDuration"></span>
        </div>

        <!-- Decouper -->
        <div class="form-group form-group-toggle">
          <label class="form-label" for="fieldSplitUp">${I18n.t('modal.splitUp')}</label>
          <label class="toggle-switch">
            <input type="checkbox" id="fieldSplitUp">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Session min / max (conditionnel) -->
        <div class="form-group-split" id="splitFields" style="display:none">
          <div class="form-group">
            <label class="form-label" for="fieldMinSession">${I18n.t('modal.minSession')}</label>
            <input type="number" id="fieldMinSession" class="form-input" min="1" step="1">
            <span class="form-error" id="errorMinSession"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="fieldMaxSession">${I18n.t('modal.maxSession')}</label>
            <input type="number" id="fieldMaxSession" class="form-input" min="1" step="1">
          </div>
        </div>

        <!-- Section: Planification -->
        <div class="form-section-header" id="modalSectionScheduling">${I18n.t('modal.schedulingHours')}</div>

        <!-- Heures de planification -->
        <div class="form-group">
          <select id="fieldSchedulingType" class="form-input">
            <option value="working">${I18n.t('modal.schedulingType.working')}</option>
            <option value="personal">${I18n.t('modal.schedulingType.personal')}</option>
            <option value="custom">${I18n.t('modal.schedulingType.custom')}</option>
          </select>
        </div>

        <!-- Custom hours (conditionnel) -->
        <div class="form-group-split" id="customHoursFields" style="display:none">
          <div class="form-group">
            <label class="form-label" for="fieldStartHour">${I18n.t('modal.startHour')}</label>
            <input type="number" id="fieldStartHour" class="form-input" min="0" max="23" step="1">
          </div>
          <div class="form-group">
            <label class="form-label" for="fieldEndHour">${I18n.t('modal.endHour')}</label>
            <input type="number" id="fieldEndHour" class="form-input" min="0" max="23" step="1">
          </div>
        </div>

        <!-- Dates -->
        <div class="form-group-split">
          <div class="form-group">
            <label class="form-label" for="fieldDueDate">${I18n.t('modal.dueDate')}</label>
            <input type="date" id="fieldDueDate" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label" for="fieldStartDate">${I18n.t('modal.startDate')}</label>
            <input type="date" id="fieldStartDate" class="form-input">
          </div>
        </div>

        <!-- Mode de demarrage -->
        <div class="form-group">
          <label class="form-label" for="fieldStartMode">${I18n.t('modal.startMode')}</label>
          <select id="fieldStartMode" class="form-input">
            <option value="auto">${I18n.t('modal.startModes.auto')}</option>
            <option value="manual">${I18n.t('modal.startModes.manual')}</option>
          </select>
        </div>

        <!-- Section: Avance -->
        <div class="form-section-header" id="modalSectionAdvanced">${I18n.t('modal.energy')}</div>

        <!-- Niveau d'energie -->
        <div class="form-group">
          <select id="fieldEnergy" class="form-input">
            <option value="high">${I18n.t('modal.energyLevels.high')}</option>
            <option value="low">${I18n.t('modal.energyLevels.low')}</option>
            <option value="any">${I18n.t('modal.energyLevels.any')}</option>
          </select>
        </div>

        <!-- Depend de -->
        <div class="form-group">
          <label class="form-label" for="fieldDependsOn">${I18n.t('modal.dependsOn')}</label>
          <div class="multi-select" id="multiSelectDeps">
            <div class="multi-select-display" id="depsDisplay">${I18n.t('modal.dependsOnNone')}</div>
            <div class="multi-select-dropdown" id="depsDropdown" style="display:none"></div>
          </div>
        </div>

        <!-- Visibilite -->
        <div class="form-group">
          <label class="form-label" for="fieldVisibility">${I18n.t('modal.visibility')}</label>
          <select id="fieldVisibility" class="form-input">
            <option value="busy">${I18n.t('modal.visibilityOptions.busy')}</option>
            <option value="free">${I18n.t('modal.visibilityOptions.free')}</option>
          </select>
        </div>

        <!-- A suivre -->
        <div class="form-group form-group-toggle">
          <label class="form-label" for="fieldUpNext">${I18n.t('modal.upNext')}</label>
          <label class="toggle-switch">
            <input type="checkbox" id="fieldUpNext">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Habitude -->
        <div class="form-group form-group-toggle">
          <label class="form-label" for="fieldHabit">${I18n.t('modal.habit')}</label>
          <label class="toggle-switch">
            <input type="checkbox" id="fieldHabit">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Frequence habitude (conditionnel) -->
        <div class="form-group" id="habitFreqField" style="display:none">
          <label class="form-label" for="fieldHabitFreq">${I18n.t('modal.habitFrequency')}</label>
          <input type="number" id="fieldHabitFreq" class="form-input" min="1" max="7" step="1" value="3">
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label" for="fieldNotes">${I18n.t('modal.notes')}</label>
          <textarea id="fieldNotes" class="form-input form-textarea" rows="3" placeholder="${I18n.t('modal.notesPlaceholder')}"></textarea>
        </div>

        <!-- Buttons -->
        <div class="modal-actions">
          <button type="button" class="btn-danger" id="btnDelete" style="display:none">${I18n.t('modal.delete')}</button>
          <div class="modal-actions-right">
            <button type="button" class="btn-secondary" id="btnCancel">${I18n.t('modal.cancel')}</button>
            <button type="submit" class="btn-primary" id="btnSave">${I18n.t('modal.save')}</button>
          </div>
        </div>
      </form>
    `;
  }

  /* ── Bind events ── */

  function _bindEvents() {
    const overlay = $('modalOverlay');
    const form = $('modalForm');

    // Overlay click to close
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    // Close button
    const btnClose = $('modalClose');
    if (btnClose) btnClose.addEventListener('click', close);

    // Cancel
    const btnCancel = $('btnCancel');
    if (btnCancel) btnCancel.addEventListener('click', close);

    // Save (form submit)
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        _handleSave();
      });
    }

    // Delete
    const btnDelete = $('btnDelete');
    if (btnDelete) btnDelete.addEventListener('click', _handleDelete);

    // Split up toggle
    const fieldSplitUp = $('fieldSplitUp');
    if (fieldSplitUp) {
      fieldSplitUp.addEventListener('change', () => {
        const splitFields = $('splitFields');
        if (splitFields) splitFields.style.display = fieldSplitUp.checked ? '' : 'none';
      });
    }

    // Scheduling type toggle
    const fieldSchedulingType = $('fieldSchedulingType');
    if (fieldSchedulingType) {
      fieldSchedulingType.addEventListener('change', () => {
        const customFields = $('customHoursFields');
        if (customFields) customFields.style.display = fieldSchedulingType.value === 'custom' ? '' : 'none';
      });
    }

    // Template dropdown
    const fieldTemplate = $('fieldTemplate');
    if (fieldTemplate) {
      fieldTemplate.addEventListener('change', () => {
        if (!fieldTemplate.value) return;
        if (typeof Templates !== 'undefined' && Templates.applyTemplate) {
          const data = Templates.applyTemplate(fieldTemplate.value);
          if (data) {
            $('fieldDuration').value = data.totalDuration || 60;
            const tplPriority = data.priority || 'P2';
            $('fieldPriority').value = tplPriority;
            _updatePriorityDisplay(tplPriority);
            $('fieldSplitUp').checked = !!data.splitUp;
            $('splitFields').style.display = data.splitUp ? '' : 'none';
            $('fieldMinSession').value = data.minSessionDuration || 15;
            $('fieldMaxSession').value = data.maxSessionDuration || 120;
            const sched = data.schedulingHours || { type: 'working', startHour: 9, endHour: 17 };
            $('fieldSchedulingType').value = sched.type || 'working';
            $('customHoursFields').style.display = sched.type === 'custom' ? '' : 'none';
            $('fieldStartHour').value = sched.startHour || 9;
            $('fieldEndHour').value = sched.endHour || 17;
            $('fieldEnergy').value = data.energyLevel || 'any';
          }
        }
      });
    }

    // Priority custom dropdown
    const priorityDisplay = $('priorityDropdownDisplay');
    const priorityMenu = $('priorityDropdownMenu');
    if (priorityDisplay && priorityMenu) {
      priorityDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        priorityMenu.style.display = priorityMenu.style.display === 'none' ? '' : 'none';
      });
      priorityMenu.addEventListener('click', (e) => {
        const opt = e.target.closest('.priority-dropdown-option');
        if (!opt) return;
        const val = opt.dataset.value;
        $('fieldPriority').value = val;
        const labels = { P1: I18n.t('priority.p1'), P2: I18n.t('priority.p2'), P3: I18n.t('priority.p3'), P4: I18n.t('priority.p4') };
        priorityDisplay.innerHTML = Utils.priorityBarsHTML(val) +
          '<span class="priority-dropdown-label">' + (labels[val] || '') + '</span>' +
          '<span class="priority-dropdown-arrow">&#9662;</span>';
        priorityMenu.style.display = 'none';
      });
      document.addEventListener('click', (e) => {
        const dropdown = $('priorityDropdown');
        if (dropdown && !dropdown.contains(e.target)) {
          const menu = $('priorityDropdownMenu');
          if (menu) menu.style.display = 'none';
        }
      });
    }

    // Habit toggle
    const fieldHabit = $('fieldHabit');
    if (fieldHabit) {
      fieldHabit.addEventListener('change', () => {
        const habitFreqField = $('habitFreqField');
        if (habitFreqField) habitFreqField.style.display = fieldHabit.checked ? '' : 'none';
      });
    }

    // Multi-select depends-on
    const depsDisplay = $('depsDisplay');
    if (depsDisplay) {
      depsDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = $('depsDropdown');
        if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
      });
    }

    // Close deps dropdown on outside click
    document.addEventListener('click', (e) => {
      const multiSelect = $('multiSelectDeps');
      const dropdown = $('depsDropdown');
      if (dropdown && multiSelect && !multiSelect.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  /* ── Populate depends-on dropdown ── */

  function _populateDependsOn(selectedIds) {
    const dropdown = $('depsDropdown');
    const display = $('depsDisplay');
    if (!dropdown || !display) return;

    const tasks = Store.getAllTasks();
    const currentId = _editingTask ? _editingTask.id : null;
    const available = tasks.filter(t => t.id !== currentId);

    dropdown.innerHTML = '';

    if (available.length === 0) {
      dropdown.innerHTML = `<div class="multi-select-empty">${I18n.t('modal.dependsOnNone')}</div>`;
      return;
    }

    const selected = new Set(selectedIds || []);

    available.forEach(t => {
      const item = Utils.el('label', 'multi-select-item');
      const cb = Utils.el('input', '', { type: 'checkbox' });
      cb.checked = selected.has(t.id);
      cb.dataset.taskId = t.id;
      cb.addEventListener('change', () => {
        _updateDepsDisplay();
      });
      const span = Utils.el('span', '', { text: t.name || t.id });
      item.appendChild(cb);
      item.appendChild(span);
      dropdown.appendChild(item);
    });

    _updateDepsDisplay();
  }

  function _updateDepsDisplay() {
    const dropdown = $('depsDropdown');
    const display = $('depsDisplay');
    if (!dropdown || !display) return;

    const checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) {
      display.textContent = I18n.t('modal.dependsOnNone');
    } else {
      const names = [];
      checked.forEach(cb => {
        const span = cb.nextElementSibling;
        if (span) names.push(span.textContent);
      });
      display.textContent = names.join(', ');
    }
  }

  function _getSelectedDeps() {
    const dropdown = $('depsDropdown');
    if (!dropdown) return [];
    const checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.dataset.taskId);
  }

  /* ── Populate template dropdown ── */

  function _populateTemplates() {
    const select = $('fieldTemplate');
    if (!select) return;
    // Clear existing options
    select.innerHTML = `<option value="">${I18n.t('templates.none')}</option>`;
    if (typeof Templates === 'undefined') return;
    const all = Templates.getAll();
    for (const tpl of all) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      select.appendChild(opt);
    }
  }

  /* ── Populate group dropdown ── */

  function _populateGroups(selectedGroupId) {
    const select = $('fieldGroup');
    if (!select) return;
    select.innerHTML = `<option value="">${I18n.t('groups.none')}</option>`;
    const groups = Store.getGroups();
    for (const g of groups) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      opt.style.cssText = `padding-left:20px`;
      if (g.id === selectedGroupId) opt.selected = true;
      select.appendChild(opt);
    }
  }

  /* ── Collect form data into task object ── */

  function _collectFormData() {
    const fieldSchedulingType = $('fieldSchedulingType');
    const schedType = fieldSchedulingType ? fieldSchedulingType.value : 'working';

    let schedulingHours;
    if (schedType === 'working') {
      schedulingHours = { type: 'working', startHour: 9, endHour: 17 };
    } else if (schedType === 'personal') {
      schedulingHours = { type: 'personal', startHour: 18, endHour: 22 };
    } else {
      const startH = parseInt($('fieldStartHour').value, 10) || 9;
      const endH = parseInt($('fieldEndHour').value, 10) || 17;
      schedulingHours = { type: 'custom', startHour: startH, endHour: endH };
    }

    const data = {
      name: ($('fieldName').value || '').trim(),
      priority: $('fieldPriority').value,
      totalDuration: parseInt($('fieldDuration').value, 10) || 0,
      splitUp: $('fieldSplitUp').checked,
      minSessionDuration: parseInt($('fieldMinSession').value, 10) || 15,
      maxSessionDuration: parseInt($('fieldMaxSession').value, 10) || 120,
      schedulingHours,
      dueDate: $('fieldDueDate').value || '',
      startDate: $('fieldStartDate').value || '',
      startMode: $('fieldStartMode').value,
      energyLevel: $('fieldEnergy').value,
      dependsOn: _getSelectedDeps(),
      visibility: $('fieldVisibility').value,
      upNext: $('fieldUpNext').checked,
      isHabit: $('fieldHabit').checked,
      habitFrequency: $('fieldHabit').checked ? (parseInt($('fieldHabitFreq').value, 10) || 3) : null,
      notes: ($('fieldNotes').value || '').trim(),
      groupId: $('fieldGroup') ? ($('fieldGroup').value || null) : null
    };

    // In edit mode, keep the remaining duration in sync if total duration changed
    if (_editingTask) {
      data.id = _editingTask.id;
      data.status = _editingTask.status;
      data.lockedEvents = _editingTask.lockedEvents || [];
      data.loggedWork = _editingTask.loggedWork || 0;
      data.createdAt = _editingTask.createdAt;
      // Adjust remaining duration proportionally
      const oldTotal = _editingTask.totalDuration;
      const oldRemaining = _editingTask.remainingDuration;
      if (data.totalDuration !== oldTotal) {
        const diff = data.totalDuration - oldTotal;
        data.remainingDuration = Math.max(0, oldRemaining + diff);
      } else {
        data.remainingDuration = oldRemaining;
      }
    } else {
      data.remainingDuration = data.totalDuration;
    }

    return data;
  }

  /* ── Clear errors ── */

  function _clearErrors() {
    const errors = document.querySelectorAll('#modal .form-error');
    errors.forEach(el => { el.textContent = ''; });
  }

  /* ── Show validation errors ── */

  function _showErrors(errors) {
    _clearErrors();
    errors.forEach(errKey => {
      if (errKey === 'name_required') {
        const el = $('errorName');
        if (el) el.textContent = I18n.t('modal.name') + ' — ' + I18n.t('modal.namePlaceholder');
      }
      if (errKey === 'duration_invalid') {
        const el = $('errorDuration');
        if (el) el.textContent = I18n.t('modal.duration') + ' > 0';
      }
      if (errKey === 'min_gt_max_session') {
        const el = $('errorMinSession');
        if (el) el.textContent = 'Min > Max';
      }
      if (errKey === 'circular_dependency') {
        Utils.toast(I18n.t('dependency.circular'), 'error');
      }
    });
  }

  /* ── Save handler ── */

  function _handleSave() {
    _clearErrors();
    _clearConflictWarning();
    const data = _collectFormData();

    // Build a full task for validation
    const taskToValidate = _editingTask
      ? { ..._editingTask, ...data }
      : TaskModel.createTask(data);

    const result = TaskModel.validate(taskToValidate);
    if (!result.valid) {
      _showErrors(result.errors);
      return;
    }

    // Check for circular dependencies
    if (data.dependsOn && data.dependsOn.length > 0 && typeof Dependencies !== 'undefined' && Dependencies.hasCircularDependency) {
      const taskId = _editingTask ? _editingTask.id : taskToValidate.id;
      const allTasks = Store.getAllTasks();
      if (Dependencies.hasCircularDependency(taskId, data.dependsOn, allTasks)) {
        _showErrors(['circular_dependency']);
        return;
      }
    }

    // Check for conflicts
    if (typeof ConflictChecker !== 'undefined' && ConflictChecker.check) {
      const conflicts = ConflictChecker.check(taskToValidate);
      if (conflicts.length > 0) {
        _showConflictWarning(conflicts);
        // Still save, but warn the user
      }
    }

    // Save
    if (_editingTask) {
      Store.saveTask({ ..._editingTask, ...data, updatedAt: Date.now() });
    } else {
      const newTask = TaskModel.createTask(data);
      Store.saveTask(newTask);
    }

    close();
  }

  /* ── Conflict warning ── */

  function _showConflictWarning(conflicts) {
    const form = $('modalForm');
    if (!form) return;

    // Remove any existing warning
    _clearConflictWarning();

    const warning = Utils.el('div', 'conflict-warning');
    const title = Utils.el('strong', '', { text: I18n.t('conflict.warning') + ': ' });
    const msg = Utils.el('span', '', { text: I18n.t('conflict.tasksPushed') });
    warning.appendChild(title);
    warning.appendChild(msg);

    const list = Utils.el('ul', 'conflict-list');
    conflicts.forEach(c => {
      const li = Utils.el('li', '', { text: c.taskName + (c.dueDate ? ' (' + c.dueDate + ')' : '') });
      list.appendChild(li);
    });
    warning.appendChild(list);

    form.insertBefore(warning, form.firstChild);

    // Also show a toast
    Utils.toast(I18n.t('conflict.warning') + ': ' + conflicts.map(c => c.taskName).join(', '), 'warning', 5000);
  }

  function _clearConflictWarning() {
    const existing = document.querySelector('#modalForm .conflict-warning');
    if (existing) existing.remove();
  }

  /* ── Delete handler ── */

  function _handleDelete() {
    if (!_editingTask) return;

    const uiMode = document.documentElement.getAttribute('data-ui-mode');
    const btnDelete = $('btnDelete');

    if (uiMode === 'advanced') {
      // Inline confirm
      if (!_confirmingDelete) {
        _confirmingDelete = true;
        if (btnDelete) btnDelete.textContent = I18n.t('actions.confirm');
        return;
      }
      // Confirmed
      _confirmingDelete = false;
      Store.deleteTask(_editingTask.id);
      close();
    } else {
      // Classic mode: native confirm
      if (confirm(I18n.t('actions.confirm'))) {
        Store.deleteTask(_editingTask.id);
        close();
      }
    }
  }

  /* ── Fill form for editing ── */

  function _updatePriorityDisplay(val) {
    const display = $('priorityDropdownDisplay');
    if (!display) return;
    const labels = { P1: I18n.t('priority.p1'), P2: I18n.t('priority.p2'), P3: I18n.t('priority.p3'), P4: I18n.t('priority.p4') };
    display.innerHTML = Utils.priorityBarsHTML(val) +
      '<span class="priority-dropdown-label">' + (labels[val] || '') + '</span>' +
      '<span class="priority-dropdown-arrow">&#9662;</span>';
  }

  function _fillForm(task) {
    $('fieldName').value = task.name || '';
    const pVal = task.priority || 'P2';
    $('fieldPriority').value = pVal;
    _updatePriorityDisplay(pVal);
    $('fieldDuration').value = task.totalDuration || 60;
    $('fieldSplitUp').checked = !!task.splitUp;
    $('splitFields').style.display = task.splitUp ? '' : 'none';
    $('fieldMinSession').value = task.minSessionDuration || 15;
    $('fieldMaxSession').value = task.maxSessionDuration || 120;

    // Scheduling hours
    const sched = task.schedulingHours || { type: 'working', startHour: 9, endHour: 17 };
    $('fieldSchedulingType').value = sched.type || 'working';
    $('customHoursFields').style.display = sched.type === 'custom' ? '' : 'none';
    $('fieldStartHour').value = sched.startHour || 9;
    $('fieldEndHour').value = sched.endHour || 17;

    $('fieldDueDate').value = task.dueDate || '';
    $('fieldStartDate').value = task.startDate || '';
    $('fieldStartMode').value = task.startMode || 'auto';
    $('fieldEnergy').value = task.energyLevel || 'any';
    $('fieldVisibility').value = task.visibility || 'busy';
    $('fieldUpNext').checked = !!task.upNext;
    $('fieldHabit').checked = !!task.isHabit;
    $('habitFreqField').style.display = task.isHabit ? '' : 'none';
    $('fieldHabitFreq').value = task.habitFrequency || 3;
    $('fieldNotes').value = task.notes || '';

    _populateGroups(task.groupId || '');
    _populateDependsOn(task.dependsOn || []);
  }

  /* ── Set defaults for create mode ── */

  function _setDefaults() {
    const s = Store.getSettings();
    const defaults = TaskModel.createTask();

    $('fieldName').value = '';
    $('fieldPriority').value = defaults.priority;
    _updatePriorityDisplay(defaults.priority);
    $('fieldDuration').value = defaults.totalDuration;
    $('fieldSplitUp').checked = defaults.splitUp;
    $('splitFields').style.display = defaults.splitUp ? '' : 'none';
    $('fieldMinSession').value = defaults.minSessionDuration;
    $('fieldMaxSession').value = defaults.maxSessionDuration;

    const sched = defaults.schedulingHours;
    $('fieldSchedulingType').value = sched.type || 'working';
    $('customHoursFields').style.display = sched.type === 'custom' ? '' : 'none';
    $('fieldStartHour').value = sched.startHour || 9;
    $('fieldEndHour').value = sched.endHour || 17;

    $('fieldDueDate').value = defaults.dueDate;
    $('fieldStartDate').value = Utils.toDateInputValue(new Date());
    $('fieldStartMode').value = defaults.startMode;
    $('fieldEnergy').value = defaults.energyLevel;
    $('fieldVisibility').value = defaults.visibility;
    $('fieldUpNext').checked = defaults.upNext;
    $('fieldHabit').checked = defaults.isHabit;
    $('habitFreqField').style.display = defaults.isHabit ? '' : 'none';
    $('fieldHabitFreq').value = defaults.habitFrequency || 3;
    $('fieldNotes').value = '';

    _populateGroups('');
    _populateDependsOn([]);
  }

  /* ── Public API ── */

  function init() {
    _renderForm();
    _bindEvents();
  }

  function open(task, defaults) {
    _editingTask = task || null;
    _confirmingDelete = false;
    _clearErrors();
    _populateTemplates();

    const titleEl = $('modalTitle');
    const btnDelete = $('btnDelete');
    const templateGroup = $('templateGroup');

    if (_editingTask) {
      // Edit mode
      if (titleEl) titleEl.textContent = I18n.t('modal.title.edit');
      if (btnDelete) {
        btnDelete.style.display = '';
        btnDelete.textContent = I18n.t('modal.delete');
      }
      if (templateGroup) templateGroup.style.display = 'none';
      _fillForm(_editingTask);
    } else {
      // Create mode
      if (titleEl) titleEl.textContent = I18n.t('modal.title.create');
      if (btnDelete) btnDelete.style.display = 'none';
      if (templateGroup) templateGroup.style.display = '';
      _setDefaults();

      // Apply pre-filled defaults from caller (e.g., priority or group from Kanban)
      if (defaults) {
        if (defaults.priority) {
          const prioEl = $('fieldPriority') || document.querySelector('[name="priority"]');
          if (prioEl) prioEl.value = defaults.priority;
          if (typeof _updatePriorityDisplay === 'function') _updatePriorityDisplay(defaults.priority);
        }
        if (defaults.groupId) {
          const groupEl = $('fieldGroup');
          if (groupEl) groupEl.value = defaults.groupId;
        }
      }
    }

    // Show overlay
    const overlay = $('modalOverlay');
    if (overlay) overlay.classList.add('active');

    // Focus name field
    setTimeout(() => {
      const nameField = $('fieldName');
      if (nameField) nameField.focus();
    }, 100);
  }

  function close() {
    const overlay = $('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    _editingTask = null;
    _confirmingDelete = false;
  }

  return { init, open, close };
})();
