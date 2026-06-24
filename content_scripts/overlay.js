// content_scripts/overlay.js

(() => {
  let overlayEl = null;
  let approvedCallback = null;
  let planData = [];

  function createOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'dfa-overlay';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function renderFields(serializable, originalPlan) {
    const body = overlayEl.querySelector('.dfa-body');
    body.innerHTML = '';
    if (!serializable.length) {
      body.innerHTML = '<div class="dfa-empty">Nenhum campo detectado.</div>';
      return;
    }
    serializable.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'dfa-field-row';
      row.dataset.index = idx;

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'dfa-check';
      check.checked = true;
      check.title = 'Marcar para preencher';

      const info = document.createElement('div');
      info.className = 'dfa-field-info';

      const tag = document.createElement('span');
      tag.className = 'dfa-tag';
      tag.textContent = item.source;

      const label = document.createElement('label');
      label.textContent = item.label || item.key;

      let input;
      if (item.value && item.value.length > 60) {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }
      input.value = item.value || '';
      input.dataset.key = item.key;

      info.appendChild(tag);
      info.appendChild(label);
      info.appendChild(input);

      row.appendChild(check);
      row.appendChild(info);
      body.appendChild(row);
    });
  }

  function show(plan, serializable, onApprove) {
    approvedCallback = onApprove;
    planData = plan;
    const el = createOverlay();
    el.innerHTML = `
      <div class="dfa-header">
        <h2>Revisar Preenchimento</h2>
        <button class="dfa-close" title="Fechar">&times;</button>
      </div>
      <div class="dfa-body"></div>
      <div class="dfa-footer">
        <button class="dfa-btn dfa-btn-danger" id="dfa-cancel">Cancelar</button>
        <button class="dfa-btn dfa-btn-secondary" id="dfa-toggle">Inverter seleção</button>
        <button class="dfa-btn dfa-btn-primary" id="dfa-confirm">Confirmar</button>
      </div>
    `;

    renderFields(serializable, plan);

    el.querySelector('.dfa-close').addEventListener('click', hide);
    el.querySelector('#dfa-cancel').addEventListener('click', hide);

    el.querySelector('#dfa-toggle').addEventListener('click', () => {
      el.querySelectorAll('.dfa-check').forEach(ch => {
        ch.checked = !ch.checked;
        ch.closest('.dfa-field-row').classList.toggle('disabled', !ch.checked);
      });
    });

    el.querySelectorAll('.dfa-check').forEach(ch => {
      ch.addEventListener('change', () => {
        ch.closest('.dfa-field-row').classList.toggle('disabled', !ch.checked);
      });
    });

    el.querySelector('#dfa-confirm').addEventListener('click', () => {
      const rows = el.querySelectorAll('.dfa-field-row');
      const approvedPlan = [];
      rows.forEach((row, idx) => {
        if (!row.querySelector('.dfa-check').checked) return;
        const input = row.querySelector('.dfa-field-info input, .dfa-field-info textarea');
        const val = input.value;
        const original = plan[idx];
        approvedPlan.push({ ...original, value: val });
      });
      if (approvedCallback) approvedCallback(approvedPlan);
    });

    el.style.display = 'flex';
  }

  function hide() {
    if (overlayEl) {
      overlayEl.style.display = 'none';
      overlayEl.innerHTML = '';
    }
  }

  window.__DFA_Overlay = { show, hide };
})();
