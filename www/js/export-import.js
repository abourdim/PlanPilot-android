/* ═══════════════════════════════════════════════════════════════════
   EXPORT / IMPORT — PlanPilot
   ═══════════════════════════════════════════════════════════════════ */

const ExportImport = (() => {
  'use strict';

  /**
   * Export all data as a JSON file download.
   */
  function exportData() {
    try {
      const data = Store.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `planpilot-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.toast(I18n.t('export.success'), 'success');
    } catch (err) {
      console.error('[ExportImport] Export failed:', err);
      Utils.toast(I18n.t('export.error'), 'error');
    }
  }

  /**
   * Import data from a JSON file. Opens a file picker, reads the file,
   * validates it, and imports into Store.
   */
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);

          // Validate
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
          }
          if (data.version !== 1) {
            throw new Error('Unsupported data version: ' + (data.version || 'none'));
          }

          Store.importAll(data, 'replace');

          // Re-apply theme and UI mode from imported settings
          const s = Store.getSettings();
          document.documentElement.setAttribute('data-theme', s.theme || 'dark');
          document.documentElement.setAttribute('data-ui-mode', s.uiMode || 'advanced');

          Utils.toast(I18n.t('import.success'), 'success');
        } catch (err) {
          console.error('[ExportImport] Import failed:', err);
          Utils.toast(I18n.t('import.error') + ': ' + err.message, 'error');
        }
      };

      reader.onerror = () => {
        Utils.toast(I18n.t('import.error'), 'error');
      };

      reader.readAsText(file);
      // Clean up
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  }

  return { exportData, importData };
})();
