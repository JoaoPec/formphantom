// popup.js

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const PROFILE_LABELS = {
  fullName: 'nome completo',
  firstName: 'primeiro nome',
  lastName: 'sobrenome',
  email: 'email',
  phone: 'telefone',
  cpf: 'CPF',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'portfólio',
  city: 'cidade',
  state: 'estado',
  country: 'país',
  postalCode: 'CEP',
  currentRole: 'cargo atual',
  currentCompany: 'empresa atual',
  experienceYears: 'anos de experiência',
  summary: 'resumo',
  education: 'formação',
  skills: 'skills'
};

// Configura worker do PDF.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
}

/* ---------- Tabs ---------- */
function switchTab(tabId) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
}

$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

/* ---------- Profile Load/Save ---------- */
function fillProfileForm(profile = {}) {
  $$('#profileForm [data-key]').forEach(el => {
    const key = el.dataset.key;
    if (profile[key] !== undefined) el.value = profile[key];
  });
}

function collectProfileForm() {
  const profile = {};
  $$('#profileForm [data-key]').forEach(el => {
    profile[el.dataset.key] = el.value.trim();
  });
  return profile;
}

function showNotice(target, message, type = 'info') {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  el.classList.toggle('warning', type === 'warning');
  el.innerHTML = message;
  el.classList.remove('hidden');
}

function hideNotice(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el) el.classList.add('hidden');
}

function loadProfile() {
  chrome.storage.local.get(['profile', 'resumeText'], (res) => {
    const profile = res.profile || {};
    fillProfileForm(profile);
    if (res.resumeText) {
      $('#pdfTextPreview').textContent = res.resumeText.slice(0, 2000);
      $('#pdfPreview').classList.remove('hidden');
      $('#pdfStatus').textContent = 'PDF já carregado.';
    }
  });
}

$('#profileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const profile = collectProfileForm();
  chrome.storage.local.set({ profile }, () => {
    const status = $('#saveStatus');
    status.textContent = 'Perfil salvo!';
    setTimeout(() => status.textContent = '', 2000);
  });
});

/* ---------- Resume Profile Import ---------- */
function normalizeSpaces(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  const cleaned = url.replace(/[),.;]+$/, '');
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? normalizeSpaces(match[0]) : '';
}

function splitResumeLines(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(line => normalizeSpaces(line))
    .filter(Boolean);
}

function isSectionHeading(line) {
  return /^(resumo|perfil|objetivo|experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|skills|compet[eê]ncias|habilidades|projetos|idiomas|certifica[cç][oõ]es|contato)$/i.test(line);
}

function extractFullName(lines, text) {
  const badLine = /(curr[ií]culo|resume|email|e-mail|telefone|phone|linkedin|github|portfolio|www\.|https?:|@)/i;
  const candidates = lines.slice(0, 12).filter(line => {
    const words = line.split(/\s+/);
    return words.length >= 2
      && words.length <= 6
      && !badLine.test(line)
      && !isSectionHeading(line)
      && !/\d/.test(line);
  });
  if (candidates.length) return candidates[0];
  const nearEmail = text.match(/(?:^|\n)\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ']+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ']+){1,5})\s+(?:[\w._%+-]+@)/);
  return nearEmail ? normalizeSpaces(nearEmail[1]) : '';
}

function extractSection(lines, headingRegex, stopRegex, maxLines = 4) {
  const start = lines.findIndex(line => headingRegex.test(line));
  if (start === -1) return '';
  const collected = [];
  for (const line of lines.slice(start + 1)) {
    if (stopRegex.test(line)) break;
    collected.push(line);
    if (collected.length >= maxLines) break;
  }
  return normalizeSpaces(collected.join(' '));
}

function extractSkills(lines, text) {
  const known = [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Django',
    'Flask', 'Java', 'Spring', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
    'Go', 'Rust', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker',
    'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'GraphQL', 'REST', 'HTML', 'CSS',
    'Tailwind', 'Vue', 'Angular'
  ];
  const skillSection = extractSection(
    lines,
    /^(skills|compet[eê]ncias|habilidades|tecnologias|stack)\b/i,
    /^(experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|projetos|idiomas|certifica[cç][oõ]es)\b/i,
    5
  );
  if (skillSection) return skillSection;
  const found = known.filter(skill => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  return found.slice(0, 12).join(', ');
}

function extractResumeProfile(text) {
  const lines = splitResumeLines(text);
  const inlineText = normalizeSpaces(text);
  const profile = {};

  profile.email = firstMatch(inlineText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  profile.phone = firstMatch(inlineText, /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-.\s]?\d{4}/);
  profile.cpf = firstMatch(inlineText, /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  profile.postalCode = firstMatch(inlineText, /\b\d{5}-?\d{3}\b/);

  const linkedin = inlineText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s),;]+/i);
  const github = inlineText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s),;]+/i);
  const urls = inlineText.match(/(?:https?:\/\/|www\.)[^\s),;]+/gi) || [];
  profile.linkedin = linkedin ? normalizeUrl(linkedin[0]) : '';
  profile.github = github ? normalizeUrl(github[0]) : '';
  profile.portfolio = normalizeUrl((urls.find(url => !/linkedin\.com|github\.com/i.test(url)) || ''));

  profile.fullName = extractFullName(lines, text);
  if (profile.fullName) {
    const parts = profile.fullName.split(/\s+/);
    profile.firstName = parts[0] || '';
    profile.lastName = parts.slice(1).join(' ');
  }

  const location = inlineText.match(/\b([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,3})\s*[-,]\s*([A-Z]{2})\b/);
  if (location) {
    profile.city = location[1];
    profile.state = location[2];
    profile.country = 'Brasil';
  }

  const roleLine = lines.slice(0, 16).find(line => /(desenvolvedor|developer|engenheiro|engineer|software|full stack|frontend|front-end|backend|back-end|analista|tech lead|arquiteto)/i.test(line));
  profile.currentRole = roleLine || '';

  const years = inlineText.match(/(\d{1,2})\+?\s+anos?\s+(?:de\s+)?experi[eê]ncia/i);
  profile.experienceYears = years ? years[1] : '';

  profile.summary = extractSection(
    lines,
    /^(resumo|perfil|objetivo|sobre)\b/i,
    /^(experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|skills|compet[eê]ncias|habilidades|projetos)\b/i,
    4
  );
  profile.education = extractSection(
    lines,
    /^(forma[cç][aã]o|educa[cç][aã]o|academic|education)\b/i,
    /^(experi[eê]ncia|skills|compet[eê]ncias|habilidades|projetos|idiomas|certifica[cç][oõ]es)\b/i,
    5
  );
  profile.skills = extractSkills(lines, inlineText);

  return Object.fromEntries(Object.entries(profile).filter(([, value]) => normalizeSpaces(value)));
}

function mergeProfileWithResume(profile, resumeProfile) {
  const merged = { ...profile };
  const imported = [];
  const skipped = [];

  for (const [key, value] of Object.entries(resumeProfile)) {
    if (!normalizeSpaces(value)) continue;
    if (!normalizeSpaces(merged[key])) {
      merged[key] = value;
      imported.push(key);
    } else {
      skipped.push(key);
    }
  }

  return { merged, imported, skipped };
}

function labelList(keys) {
  return keys.map(key => PROFILE_LABELS[key] || key).join(', ');
}

function applyResumeToProfile(resumeText, options = {}) {
  const resumeProfile = extractResumeProfile(resumeText);
  chrome.storage.local.get(['profile'], (res) => {
    const { merged, imported, skipped } = mergeProfileWithResume(res.profile || {}, resumeProfile);

    if (!Object.keys(resumeProfile).length) {
      showNotice('#pdfImportSummary', 'Extraí o texto, mas não encontrei dados de perfil com confiança. Você ainda pode copiar trechos do preview manualmente.', 'warning');
      return;
    }

    chrome.storage.local.set({ profile: merged }, () => {
      fillProfileForm(merged);

      if (imported.length) {
        const message = `<strong>${imported.length} campo(s) importado(s):</strong> ${labelList(imported)}. Revise a aba Perfil antes de preencher candidaturas.`;
        showNotice('#pdfImportSummary', message);
        showNotice('#profileImportNotice', message);
        log(`Perfil atualizado pelo PDF: ${labelList(imported)}.`);
      } else {
        const skippedText = skipped.length ? ` Dados detectados já existiam no perfil: ${labelList(skipped)}.` : '';
        showNotice('#pdfImportSummary', `PDF lido com sucesso, mas nenhum campo vazio precisava ser preenchido.${skippedText}`, 'warning');
        if (!options.silent) log('PDF lido, mas nenhum campo vazio do perfil foi alterado.');
      }
    });
  });
}

/* ---------- PDF Parsing ---------- */
function textContentToLines(textContent) {
  const lines = [];
  let currentLine = [];
  let previousY = null;

  for (const item of textContent.items) {
    const value = normalizeSpaces(item.str);
    if (!value) continue;

    const y = Math.round(item.transform?.[5] || 0);
    if (previousY !== null && Math.abs(y - previousY) > 4 && currentLine.length) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }

    currentLine.push(value);
    previousY = y;
  }

  if (currentLine.length) lines.push(currentLine.join(' '));
  return lines;
}

async function processPdfFile(file) {
  if (!file) return;
  $('#pdfStatus').textContent = 'Processando PDF...';
  hideNotice('#pdfImportSummary');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      pages.push(textContentToLines(textContent).join('\n'));
    }
    const cleaned = pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    chrome.storage.local.set({ resumeText: cleaned, resumeFileName: file.name }, () => {
      $('#pdfStatus').textContent = `PDF processado: ${file.name} (${pdf.numPages} páginas)`;
      $('#pdfTextPreview').textContent = cleaned.slice(0, 2000);
      $('#pdfPreview').classList.remove('hidden');
      log(`PDF "${file.name}" processado. ${cleaned.length} caracteres extraídos.`);
      applyResumeToProfile(cleaned);
    });
  } catch (err) {
    $('#pdfStatus').textContent = 'Erro ao ler PDF: ' + err.message;
  }
}

$('#pdfInput').addEventListener('change', async (e) => {
  await processPdfFile(e.target.files[0]);
});

$('#btnImportPdfProfile').addEventListener('click', () => {
  chrome.storage.local.get(['resumeText'], (res) => {
    if (!res.resumeText) {
      showNotice('#pdfImportSummary', 'Anexe um PDF antes de importar dados para o perfil.', 'warning');
      return;
    }
    applyResumeToProfile(res.resumeText);
  });
});

$('#btnReviewProfile').addEventListener('click', () => {
  switchTab('profile');
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
    processPdfFile(files[0]);
  } else {
    $('#pdfStatus').textContent = 'Solte um arquivo PDF válido.';
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
