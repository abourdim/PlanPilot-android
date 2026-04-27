/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const Onboarding = (() => {
  'use strict';

  const $ = Utils.$;
  let _step = 0;
  let _sampleTaskIds = [];
  const TOTAL_STEPS = 4;

  /* ── CSS (injected once) ── */

  function _injectStyles() {
    if (document.getElementById('onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'onboarding-styles';
    style.textContent = `
      .onboarding-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, .65);
        z-index: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: obFadeIn .3s ease;
      }
      @keyframes obFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .ob-card {
        background: var(--surface);
        border-radius: var(--surface-radius);
        box-shadow: var(--surface-shadow);
        padding: var(--sp-6);
        max-width: 420px;
        width: 90%;
        text-align: center;
        position: relative;
        animation: obSlideUp .3s ease;
      }
      @keyframes obSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .ob-card h2 {
        font-size: var(--font-size-xl);
        color: var(--text);
        margin-bottom: var(--sp-3);
      }
      .ob-card p {
        color: var(--text-secondary);
        font-size: var(--font-size-base);
        line-height: 1.5;
        margin-bottom: var(--sp-4);
      }
      .ob-dots {
        display: flex;
        justify-content: center;
        gap: var(--sp-2);
        margin-bottom: var(--sp-4);
      }
      .ob-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--surface-border);
        transition: background var(--tr-normal);
      }
      .ob-dot.active {
        background: var(--accent);
      }
      .ob-actions {
        display: flex;
        justify-content: center;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
      }
      .ob-skip {
        position: absolute;
        top: var(--sp-3);
        right: var(--sp-3);
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        cursor: pointer;
        padding: var(--sp-1) var(--sp-2);
      }
      .ob-skip:hover {
        color: var(--text);
      }
      .ob-samples-option {
        display: flex;
        gap: var(--sp-3);
        justify-content: center;
        margin-top: var(--sp-3);
      }
      .ob-tour-tooltip {
        position: fixed;
        background: var(--accent);
        color: var(--text-on-accent);
        padding: var(--sp-2) var(--sp-3);
        border-radius: 8px;
        font-size: var(--font-size-sm);
        font-weight: 600;
        z-index: 510;
        max-width: 220px;
        box-shadow: 0 4px 16px rgba(0,0,0,.3);
        pointer-events: none;
      }
      .ob-tour-tooltip::after {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border: 6px solid transparent;
      }
      .ob-tour-tooltip.arrow-left::after {
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border-right-color: var(--accent);
      }
      .ob-tour-tooltip.arrow-top::after {
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: var(--accent);
      }
      .ob-highlight {
        position: relative;
        z-index: 501;
        box-shadow: 0 0 0 4px var(--accent), 0 0 0 8px rgba(92,107,192,.3);
        border-radius: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Init ── */

  function init() {
    if (Store.isOnboarded()) return;
    _injectStyles();
    _step = 0;
    _showStep();
  }

  /* ── Show current step ── */

  function _showStep() {
    const overlay = $('onboardingOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    _clearTooltips();

    switch (_step) {
      case 0: _stepWelcome(overlay); break;
      case 1: _stepCreateSamples(overlay); break;
      case 2: _stepTour(overlay); break;
      case 3: _stepFinish(overlay); break;
      default: _complete(true); break;
    }
  }

  /* ── Step 0: Welcome ── */

  function _stepWelcome(overlay) {
    overlay.innerHTML = `
      <div class="ob-card">
        <button class="ob-skip" id="obSkip">${I18n.t('onboarding.skip')}</button>
        <h2>${I18n.t('onboarding.welcome')}</h2>
        <p>${I18n.t('onboarding.welcomeDesc')}</p>
        ${_dotsHTML(0)}
        <div class="ob-actions">
          <button class="btn-primary" id="obNext">${I18n.t('common.next')} &rarr;</button>
        </div>
      </div>
    `;
    _bindStepButtons(overlay);
  }

  /* ── Step 1: Create sample tasks ── */

  function _stepCreateSamples(overlay) {
    // Create 3 sample tasks
    _sampleTaskIds = [];
    const now = new Date();

    const samples = [
      {
        name: 'Revoir le design',
        priority: 'P1',
        totalDuration: 120,
        remainingDuration: 120,
        dueDate: Utils.toDateInputValue(Utils.addDays(now, 2))
      },
      {
        name: 'Preparer la reunion',
        priority: 'P2',
        totalDuration: 60,
        remainingDuration: 60,
        dueDate: Utils.toDateInputValue(Utils.addDays(now, 3))
      },
      {
        name: 'Lire la documentation',
        priority: 'P4',
        totalDuration: 30,
        remainingDuration: 30,
        dueDate: Utils.toDateInputValue(Utils.addDays(now, 5))
      }
    ];

    samples.forEach(s => {
      const task = TaskModel.createTask(s);
      Store.saveTask(task);
      _sampleTaskIds.push(task.id);
    });

    overlay.innerHTML = `
      <div class="ob-card">
        <button class="ob-skip" id="obSkip">${I18n.t('onboarding.skip')}</button>
        <h2>${I18n.t('onboarding.step1')}</h2>
        <p>${I18n.t('onboarding.step2')}</p>
        ${_dotsHTML(1)}
        <div class="ob-actions">
          <button class="btn-primary" id="obNext">${I18n.t('common.next')} &rarr;</button>
        </div>
      </div>
    `;
    _bindStepButtons(overlay);
  }

  /* ── Step 2: Tour tooltips ── */

  function _stepTour(overlay) {
    overlay.innerHTML = `
      <div class="ob-card">
        <button class="ob-skip" id="obSkip">${I18n.t('onboarding.skip')}</button>
        <h2>${I18n.t('onboarding.step3')}</h2>
        ${_dotsHTML(2)}
        <div class="ob-actions">
          <button class="btn-primary" id="obNext">${I18n.t('common.next')} &rarr;</button>
        </div>
      </div>
    `;

    // Show tour tooltips near key UI elements
    _showTooltipNear('btnNewTask', I18n.t('onboarding.step1'), 'arrow-left');
    _showTooltipNear('calendarContainer', I18n.t('onboarding.step2'), 'arrow-top');
    _showTooltipNear('sidebarTabs', I18n.t('onboarding.step3'), 'arrow-left');

    _bindStepButtons(overlay);
  }

  /* ── Step 3: Finish ── */

  function _stepFinish(overlay) {
    overlay.innerHTML = `
      <div class="ob-card">
        <button class="ob-skip" id="obSkip">${I18n.t('onboarding.skip')}</button>
        <h2>${I18n.t('onboarding.finish')}</h2>
        <p>${I18n.t('onboarding.keepSamples')}</p>
        ${_dotsHTML(3)}
        <div class="ob-samples-option">
          <button class="btn-primary" id="obKeep">${I18n.t('onboarding.yes')}</button>
          <button class="btn-secondary" id="obRemove">${I18n.t('onboarding.no')}</button>
        </div>
      </div>
    `;

    const keepBtn = overlay.querySelector('#obKeep');
    const removeBtn = overlay.querySelector('#obRemove');

    if (keepBtn) keepBtn.addEventListener('click', () => _complete(true));
    if (removeBtn) removeBtn.addEventListener('click', () => _complete(false));

    // Skip button also completes (keeping samples)
    const skipBtn = overlay.querySelector('#obSkip');
    if (skipBtn) skipBtn.addEventListener('click', () => _complete(true));
  }

  /* ── Complete onboarding ── */

  function _complete(keepSamples) {
    if (!keepSamples && _sampleTaskIds.length > 0) {
      _sampleTaskIds.forEach(id => {
        try { Store.deleteTask(id); } catch (e) { /* ignore */ }
      });
    }
    _sampleTaskIds = [];
    Store.setOnboarded();
    _clearTooltips();

    const overlay = $('onboardingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }
  }

  /* ── Helpers ── */

  function _dotsHTML(activeIdx) {
    let html = '<div class="ob-dots">';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      html += `<div class="ob-dot${i === activeIdx ? ' active' : ''}"></div>`;
    }
    html += '</div>';
    return html;
  }

  function _bindStepButtons(overlay) {
    const nextBtn = overlay.querySelector('#obNext');
    const skipBtn = overlay.querySelector('#obSkip');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        _step++;
        _showStep();
      });
    }
    if (skipBtn) {
      skipBtn.addEventListener('click', () => _complete(true));
    }
  }

  function _showTooltipNear(elementId, text, arrowClass) {
    const target = $(elementId);
    if (!target) return;

    const tooltip = Utils.el('div', 'ob-tour-tooltip ' + arrowClass, { text: text });
    document.body.appendChild(tooltip);

    const rect = target.getBoundingClientRect();

    if (arrowClass === 'arrow-left') {
      tooltip.style.left = (rect.right + 12) + 'px';
      tooltip.style.top = (rect.top + rect.height / 2 - 16) + 'px';
    } else if (arrowClass === 'arrow-top') {
      tooltip.style.left = (rect.left + rect.width / 2 - 100) + 'px';
      tooltip.style.top = (rect.bottom + 12) + 'px';
    }
  }

  function _clearTooltips() {
    document.querySelectorAll('.ob-tour-tooltip').forEach(t => t.remove());
    document.querySelectorAll('.ob-highlight').forEach(el => el.classList.remove('ob-highlight'));
  }

  return { init };
})();
