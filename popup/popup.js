// popup.js

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Configura worker do PDF.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
}

/* ---------- Tabs ---------- */
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(`#${btn.dataset.tab}`).classList.add('active');
  });
});

/* ---------- Profile Load/Save ---------- */
function loadProfile() {
  chrome.storage.local.get(['profile', 'resumeText'], (res) => {
    const profile = res.profile || {};
    $$('#profileForm [data-key]').forEach(el => {
      const key = el.dataset.key;
      if (profile[key] !== undefined) el.value = profile[key];
    });
    if (res.resumeText) {
      $('#pdfTextPreview').textContent = res.resumeText.slice(0, 2000);
      $('#pdfPreview').classList.remove('hidden');
      $('#pdfStatus').textContent = 'PDF já carregado.';
    }
  });
}

$('#profileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const profile = {};
  $$('#profileForm [data-key]').forEach(el => {
    profile[el.dataset.key] = el.value.trim();
  });
  chrome.storage.local.set({ profile }, () => {
    const status = $('#saveStatus');
    status.textContent = 'Perfil salvo!';
    setTimeout(() => status.textContent = '', 2000);
  });
});

/* ---------- PDF Parsing ---------- */
$('#pdfInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $('#pdfStatus').textContent = 'Processando PDF...';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(it => it.str).join(' ');
      fullText += pageText + '\n';
    }
    const cleaned = fullText.replace(/\s+/g, ' ').trim();
    chrome.storage.local.set({ resumeText: cleaned, resumeFileName: file.name }, () => {
      $('#pdfStatus').textContent = `PDF processado: ${file.name} (${pdf.numPages} páginas)`;
      $('#pdfTextPreview').textContent = cleaned.slice(0, 2000);
      $('#pdfPreview').classList.remove('hidden');
      log(`PDF "${file.name}" processado. ${cleaned.length} caracteres extraídos.`);
    });
  } catch (err) {
    $('#pdfStatus').textContent = 'Erro ao ler PDF: ' + err.message;
  }
});

/* ---------- Drag & Drop PDF ---------- */
const uploadArea = $('.upload-area');
['dragenter','dragover','dragleave','drop'].forEach(evt => {
  uploadArea.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter','dragover'].forEach(evt => {
  uploadArea.addEventListener(evt, () => uploadArea.style.borderColor = 'var(--primary)');
});
['dragleave','drop'].forEach(evt => {
  uploadArea.addEventListener(evt, () => uploadArea.style.borderColor = '');
});
uploadArea.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files.length && files[0].type === 'application/pdf') {
    $('#pdfInput').files = files;
    $('#pdfInput').dispatchEvent(new Event('change'));
  }
});

/* ---------- Actions ---------- */
function log(msg) {
  const logs = $('#actionLogs');
  logs.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  logs.scrollTop = logs.scrollHeight;
}

async function detectPageInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const inputs = document.querySelectorAll('input, textarea, select');
        const platform = (() => {
          const h = location.hostname;
          if (h.includes('linkedin.com')) return 'LinkedIn';
          if (h.includes('gupy.io')) return 'Gupy';
          if (h.includes('greenhouse.io')) return 'Greenhouse';
          if (h.includes('lever.co')) return 'Lever';
          if (h.includes('workable.com')) return 'Workable';
          if (h.includes('indeed.com')) return 'Indeed';
          if (h.includes('vagas.com.br')) return 'Vagas.com';
          if (h.includes('catho.com.br')) return 'Catho';
          if (h.includes('infojobs.com.br')) return 'InfoJobs';
          if (h.includes('kenoby.com')) return 'Kenoby';
          return 'Genérico';
        })();
        return { platform, fieldCount: inputs.length };
      }
    });
    $('#platformBadge').textContent = result.platform;
    $('#fieldsBadge').textContent = `${result.fieldCount} campos`;
  } catch {
    $('#platformBadge').textContent = 'N/A';
    $('#fieldsBadge').textContent = '0 campos';
  }
}

$('#btnFill').addEventListener('click', async () => {
  const mode = $('input[name="fillMode"]:checked').value;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { log('Nenhuma aba ativa.'); return; }

  chrome.storage.local.get(['profile', 'resumeText'], (res) => {
    if (!res.profile) { log('Configure seu perfil primeiro.'); return; }
    chrome.tabs.sendMessage(tab.id, {
      action: 'startAutofill',
      mode,
      data: { ...res.profile, resumeText: res.resumeText || '' }
    }, (response) => {
      if (chrome.runtime.lastError) {
        log('Erro: ' + chrome.runtime.lastError.message);
        return;
      }
      log(response?.message || 'Comando enviado.');
    });
  });
});

/* ---------- Init ---------- */
loadProfile();
detectPageInfo();
log('Extensão carregada.');
