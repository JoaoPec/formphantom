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

function normalizeSearch(str) {
  return normalizeSpaces(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function stripPdfIconGlyphs(str) {
  return String(str || '')
    .replace(/[\u0080-\u009f]/g, ' ')
    .replace(/[•–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  const cleaned = String(url)
    .replace(/^mailto:/i, '')
    .replace(/[),.;]+$/, '');
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(cleaned)) return '';
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
    .map(line => stripPdfIconGlyphs(line))
    .filter(Boolean);
}

function isSectionHeading(line) {
  return /^(resumo|perfil|objetivo|experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|skills|compet[eê]ncias|habilidades|projetos|idiomas|certifica[cç][oõ]es|contato|links detectados)\b/i.test(line);
}

function stripContactDetails(line) {
  return stripPdfIconGlyphs(line)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, ' ')
    .replace(/(?:\+?55[-.\s]*)?(?:\(?\d{2}\)?[-.\s]*)?(?:9?\d{4})[-.\s]?\d{4}/g, ' ')
    .replace(/(?:https?:\/\/|www\.)[^\s),;]+/gi, ' ')
    .replace(/\b[a-z0-9-]+\.(?:com|dev|app|io|net|org|com\.br)(?:\/[^\s),;]*)?/gi, ' ')
    .replace(/[#|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFullName(lines, text) {
  const badLine = /(curr[ií]culo|resume|email|e-mail|telefone|phone|linkedin|github|portfolio|www\.|https?:|@|resumo|experi[eê]ncia|forma[cç][aã]o|skills)/i;
  const candidates = lines.slice(0, 10).map(stripContactDetails).filter(line => {
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2
      && words.length <= 6
      && !badLine.test(line)
      && !isSectionHeading(line)
      && !/\d/.test(line)
      && words.every(word => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+$/.test(word));
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

function extractFlexibleSection(lines, headingRegex, stopRegex, maxLines = 8, options = {}) {
  const start = lines.findIndex(line => headingRegex.test(line));
  if (start === -1) return '';

  const collected = [];
  const skipRegex = options.skipRegex || null;
  for (const line of lines.slice(start + 1)) {
    if (stopRegex.test(line)) break;
    if (skipRegex && skipRegex.test(line)) continue;
    collected.push(line);
    if (collected.length >= maxLines) break;
  }
  return normalizeSpaces(collected.join(' '));
}

function extractSkills(lines, text) {
  const known = [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'NestJS', 'Python', 'Django',
    'Flask', 'Java', 'Spring', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
    'Go', 'Rust', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker',
    'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'GraphQL', 'REST', 'HTML', 'CSS',
    'Tailwind', 'Vue', 'Angular', 'Linux', 'Nginx', 'PIX', 'Flutter', 'Dart',
    'Cloudflare', 'IT Integration', 'React Native'
  ];
  const skillStart = lines.findIndex(line => {
    const norm = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /^(skills|competencias|habilidades|tecnologias)\b/.test(norm)
      || /^(stack|stack tecnico|stack tecnica)$/.test(norm);
  });
  let skillSection = '';
  if (skillStart !== -1) {
    const collected = [];
    for (const line of lines.slice(skillStart + 1)) {
      if (/^(experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|projetos|idiomas|certifica[cç][oõ]es|links detectados)\b/i.test(line)) break;
      collected.push(line);
      if (collected.length >= 6) break;
    }
    skillSection = normalizeSpaces(collected.join(' '));
  }
  if (skillSection) return skillSection;
  const found = known.filter(skill => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  return found.slice(0, 12).join(', ');
}

function extractLinks(text) {
  const inlineText = normalizeSpaces(text);
  const explicitUrls = inlineText.match(/(?:https?:\/\/|www\.)[^\s),;]+/gi) || [];
  const bareDomains = [...inlineText.matchAll(/\b[a-z0-9-]+\.(?:com|dev|app|io|net|org|com\.br)(?:\/[^\s),;]*)?/gi)]
    .filter(match => inlineText[Math.max(0, match.index - 1)] !== '@')
    .map(match => match[0]);
  return [...new Set([...explicitUrls, ...bareDomains].map(normalizeUrl).filter(Boolean))];
}

function extractLocation(lines, inlineText) {
  const ufMatch = lines.slice(0, 20)
    .map(line => line.match(/\b([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,3})\s*[-,]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/))
    .find(Boolean);
  if (ufMatch) return { city: ufMatch[1], state: ufMatch[2], country: 'Brasil' };

  const brazilLine = lines.slice(0, 20).find(line => /\bBrasil\b/i.test(line));
  if (brazilLine) {
    const cityMatch = brazilLine.match(/\b([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,3})\s*,\s*Brasil\b/i);
    if (cityMatch) return { city: cityMatch[1], country: 'Brasil' };
  }

  const remoteMatch = inlineText.match(/\b([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,3})\s*,\s*Brasil\s*\(Remoto\)/i);
  if (remoteMatch) return { city: remoteMatch[1], country: 'Brasil' };

  return {};
}

const BRAZIL_STATE_NAMES = {
  acre: 'AC',
  alagoas: 'AL',
  amapá: 'AP',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceará: 'CE',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espírito santo': 'ES',
  'espirito santo': 'ES',
  goiás: 'GO',
  goias: 'GO',
  maranhão: 'MA',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  pará: 'PA',
  para: 'PA',
  paraíba: 'PB',
  paraiba: 'PB',
  paraná: 'PR',
  parana: 'PR',
  pernambuco: 'PE',
  piauí: 'PI',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondônia: 'RO',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'são paulo': 'SP',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO'
};

function isLinkedInProfilePdf(lines, text) {
  const norm = normalizeSearch(text);
  const hasLinkedInUrl = /linkedin\.com\/in\//i.test(text);
  const hasLinkedInSections = lines.some(line => /^contato\b/i.test(line))
    && lines.some(line => /^experi[eê]ncia\b/i.test(line))
    && lines.some(line => /principais compet[eê]ncias/i.test(line));
  return hasLinkedInUrl && (hasLinkedInSections || norm.includes('page 1 of'));
}

function extractLinkedInUrlFromLines(lines) {
  const startIndex = lines.findIndex(line => /linkedin\.com\/in\//i.test(line));
  if (startIndex === -1) return '';

  const firstPart = normalizeSpaces(lines[startIndex])
    .replace(/\s*\(LinkedIn\).*$/i, '')
    .split(/\s+/)
    .find(part => /linkedin\.com\/in\//i.test(part));
  if (!firstPart) return '';

  let url = firstPart;
  if (/-$/.test(url)) {
    const tail = lines.slice(startIndex + 1, startIndex + 5)
      .map(line => normalizeSpaces(line).replace(/\s*\(LinkedIn\).*$/i, ''))
      .find(line => /^[A-Za-z0-9À-ÿ-]+-\d{4,}/.test(line));
    if (tail) url += tail;
  }

  return normalizeUrl(url);
}

function extractLinkedInName(lines) {
  const contactLine = lines.slice(0, 8).find(line => /^contato\b/i.test(line));
  if (!contactLine) return '';
  return normalizeSpaces(contactLine.replace(/^contato\b/i, ''))
    .replace(/^[^\p{L}]+/u, '')
    .trim();
}

function extractLinkedInLocation(lines) {
  const locationLine = lines.slice(0, 20).find(line => /\b(Brasil|Brazil)\b/i.test(line));
  if (!locationLine) return {};

  const parts = locationLine.split(',').map(part => normalizeSpaces(part)).filter(Boolean);
  if (!parts.length) return {};

  const city = parts[0] || '';
  const stateText = parts.length >= 3 ? parts[1] : '';
  const state = BRAZIL_STATE_NAMES[normalizeSearch(stateText)] || stateText;
  return {
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    country: /Brazil/i.test(locationLine) ? 'Brasil' : 'Brasil'
  };
}

function extractLinkedInHeadline(lines) {
  const emailIndex = lines.findIndex(line => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line));
  if (emailIndex >= 0) {
    const rawHeadline = [];
    for (const line of lines.slice(emailIndex, emailIndex + 4)) {
      if (/linkedin\.com\/in\//i.test(line) || /\b(Brasil|Brazil)\b/i.test(line) || /^resumo\b/i.test(line)) break;
      rawHeadline.push(line);
    }
    const joined = stripContactDetails(rawHeadline.join(' '));
    if (/(developer|engineer|software|desenvolvedor|engenheiro|full stack|backend|frontend|analista)/i.test(joined)) {
      return joined;
    }
  }

  const candidates = emailIndex >= 0 ? lines.slice(emailIndex, emailIndex + 4) : lines.slice(0, 12);
  const headline = candidates
    .map(line => stripContactDetails(line))
    .find(line => /(developer|engineer|software|desenvolvedor|engenheiro|full stack|backend|frontend|analista)/i.test(line));
  return headline || '';
}

function extractLinkedInCompany(lines) {
  const start = lines.findIndex(line => /^experi[eê]ncia\b/i.test(line));
  if (start === -1) return '';
  return lines.slice(start + 1).find(line => {
    if (isSectionHeading(line)) return false;
    if (/^\d+\s+anos?/i.test(line)) return false;
    if (/^(desenvolvedor|developer|software|engineer|engenheiro|analista)/i.test(line)) return false;
    return line.length >= 3 && line.length <= 90;
  }) || '';
}

function extractLinkedInSkills(lines, text) {
  const start = lines.findIndex(line => /principais compet[eê]ncias/i.test(line));
  const skills = [];
  if (start !== -1) {
    for (const line of lines.slice(start + 1, start + 12)) {
      if (/^(resumo|experi[eê]ncia|languages|idiomas|certifications|certifica[cç][oõ]es)\b/i.test(line)) break;
      if (line.length <= 45 && line.split(/\s+/).length <= 4) skills.push(line);
      if (skills.length >= 6) break;
    }
  }

  const fallback = extractSkills(lines, text);
  const merged = [...new Set([...skills, ...fallback.split(/\s*,\s*/).filter(Boolean)])];
  return merged.slice(0, 14).join(', ');
}

function extractLinkedInProfile(lines, inlineText) {
  const profile = {};
  profile.fullName = extractLinkedInName(lines);
  if (profile.fullName) {
    const parts = profile.fullName.split(/\s+/);
    profile.firstName = parts[0] || '';
    profile.lastName = parts.slice(1).join(' ');
  }

  profile.linkedin = extractLinkedInUrlFromLines(lines);
  profile.currentRole = extractLinkedInHeadline(lines);
  profile.currentCompany = extractLinkedInCompany(lines);
  profile.summary = extractFlexibleSection(
    lines,
    /^resumo\b/i,
    /^experi[eê]ncia\b/i,
    10,
    { skipRegex: /^(principais compet[eê]ncias|languages|idiomas|certifications|certifica[cç][oõ]es|page \d+ of \d+|portugu[eê]s|ingl[eê]s|python\s+\d|scrum|l[oó]gica de programa[cç][aã]o|cs50)\b/i }
  );
  profile.education = extractFlexibleSection(
    lines,
    /^(forma[cç][aã]o|forma[cç][aã]o acad[eê]mica|education)\b/i,
    /^(licen[cç]as|certifica[cç][oõ]es|compet[eê]ncias|idiomas|page \d+ of \d+)/i,
    6
  );
  profile.skills = extractLinkedInSkills(lines, inlineText);
  Object.assign(profile, extractLinkedInLocation(lines));

  return Object.fromEntries(Object.entries(profile).filter(([, value]) => normalizeSpaces(value)));
}

function cleanRoleLine(line) {
  return stripContactDetails(line)
    .replace(/\b(LinkedIn|GitHub|Portfolio|Portfólio)\b.*$/i, '')
    .trim();
}

function extractResumeProfile(text) {
  const lines = splitResumeLines(text);
  const inlineText = stripPdfIconGlyphs(text);
  const profile = {};

  profile.email = firstMatch(inlineText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  profile.phone = firstMatch(inlineText, /(?:\+?55[-.\s]*)?(?:\(?\d{2}\)?[-.\s]*)?(?:9?\d{4})[-.\s]?\d{4}/);
  profile.cpf = firstMatch(inlineText, /\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{3}\.\d{3}\.\d{3}\.?\d{2})\b/);
  profile.postalCode = firstMatch(inlineText, /\b\d{5}-?\d{3}\b/);

  const links = extractLinks(inlineText);
  profile.linkedin = links.find(url => /linkedin\.com\/in\//i.test(url)) || '';
  profile.github = links.find(url => /github\.com\//i.test(url)) || '';
  profile.portfolio = links.find(url => !/linkedin\.com|github\.com|mailto:/i.test(url)) || '';

  profile.fullName = extractFullName(lines, text);
  if (profile.fullName) {
    const parts = profile.fullName.split(/\s+/);
    profile.firstName = parts[0] || '';
    profile.lastName = parts.slice(1).join(' ');
  }

  Object.assign(profile, extractLocation(lines, inlineText));

  const roleLine = lines.slice(0, 16)
    .map(cleanRoleLine)
    .find(line => /(desenvolvedor|developer|engenheiro|engineer|software|full stack|frontend|front-end|backend|back-end|analista|tech lead|arquiteto)/i.test(line));
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
    /^(experi[eê]ncia|skills|compet[eê]ncias|habilidades|projetos|idiomas|certifica[cç][oõ]es|links detectados)\b/i,
    5
  );
  profile.skills = extractSkills(lines, inlineText);

  if (isLinkedInProfilePdf(lines, inlineText)) {
    Object.assign(profile, extractLinkedInProfile(lines, inlineText));
  }

  return Object.fromEntries(Object.entries(profile).filter(([, value]) => normalizeSpaces(value)));
}

function mergeProfileWithResume(profile, resumeProfile, options = {}) {
  const merged = { ...profile };
  const imported = [];
  const skipped = [];
  const replaced = [];

  for (const [key, value] of Object.entries(resumeProfile)) {
    if (!normalizeSpaces(value)) continue;
    if (options.overwrite && normalizeSpaces(merged[key]) && merged[key] !== value) {
      merged[key] = value;
      replaced.push(key);
    } else if (!normalizeSpaces(merged[key])) {
      merged[key] = value;
      imported.push(key);
    } else {
      skipped.push(key);
    }
  }

  if (options.overwrite && resumeProfile.city && !resumeProfile.state && normalizeSpaces(merged.state)) {
    merged.state = '';
    replaced.push('state');
  }

  return { merged, imported, skipped, replaced };
}

function labelList(keys) {
  return keys.map(key => PROFILE_LABELS[key] || key).join(', ');
}

function applyResumeToProfile(resumeText, options = {}) {
  const resumeProfile = extractResumeProfile(resumeText);
  chrome.storage.local.get(['profile'], (res) => {
    const { merged, imported, skipped, replaced } = mergeProfileWithResume(res.profile || {}, resumeProfile, options);

    if (!Object.keys(resumeProfile).length) {
      showNotice('#pdfImportSummary', 'Extraí o texto, mas não encontrei dados de perfil com confiança. Você ainda pode copiar trechos do preview manualmente.', 'warning');
      return;
    }

    chrome.storage.local.set({ profile: merged }, () => {
      fillProfileForm(merged);

      if (imported.length || replaced.length) {
        const parts = [];
        if (imported.length) parts.push(`<strong>${imported.length} campo(s) importado(s):</strong> ${labelList(imported)}`);
        if (replaced.length) parts.push(`<strong>${replaced.length} campo(s) atualizado(s):</strong> ${labelList(replaced)}`);
        const message = `${parts.join('. ')}. Revise a aba Perfil antes de preencher candidaturas.`;
        showNotice('#pdfImportSummary', message);
        showNotice('#profileImportNotice', message);
        log(`Perfil atualizado pelo PDF: ${labelList([...imported, ...replaced])}.`);
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

async function getPageLinks(page) {
  try {
    const annotations = await page.getAnnotations();
    return annotations.map(annot => annot.url).filter(Boolean);
  } catch {
    return [];
  }
}

function appendDetectedLinks(text, links) {
  const cleanLinks = [...new Set(links.map(link => String(link || '').trim()).filter(Boolean))];
  if (!cleanLinks.length) return text;
  return `${text}\n\nLinks detectados\n${cleanLinks.join('\n')}`;
}

async function processPdfFile(file) {
  if (!file) return;
  $('#pdfStatus').textContent = 'Processando PDF...';
  hideNotice('#pdfImportSummary');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    const links = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      pages.push(textContentToLines(textContent).join('\n'));
      links.push(...await getPageLinks(page));
    }
    const extractedText = pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const cleaned = appendDetectedLinks(extractedText, links);
    chrome.storage.local.set({ resumeText: cleaned, resumeFileName: file.name, resumeLinks: links }, () => {
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

$('#btnReplacePdfProfile').addEventListener('click', () => {
  chrome.storage.local.get(['resumeText'], (res) => {
    if (!res.resumeText) {
      showNotice('#pdfImportSummary', 'Anexe um PDF antes de atualizar dados do perfil.', 'warning');
      return;
    }
    applyResumeToProfile(res.resumeText, { overwrite: true });
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
