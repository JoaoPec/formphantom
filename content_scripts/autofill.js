// content_scripts/autofill.js

(() => {
  const { detectFields } = window.__DFA_FieldDetector;
  const { getPlatformMappings } = window.__DFA_PlatformMapper;

  const KEYWORDS = {
    fullName: ['nome completo','full name','nome','name'],
    firstName: ['primeiro nome','first name','firstname','nome'],
    lastName: ['sobrenome','last name','lastname','sobre nome'],
    email: ['email','e-mail','correio eletronico'],
    phone: ['telefone','celular','phone','mobile','whatsapp','contato','fone'],
    cpf: ['cpf','cadastro de pessoa fisica'],
    linkedin: ['linkedin','linked in'],
    github: ['github','git hub'],
    portfolio: ['portfolio','portfólio','site','website','personal website'],
    salaryExpectation: ['pretensao','pretensão','salario','salário','remuneracao','expectativa salarial','salary expectation','faixa salarial'],
    city: ['cidade','city'],
    state: ['estado','state','uf','provincia'],
    country: ['pais','país','country','nacionalidade'],
    postalCode: ['cep','codigo postal','postal code','zip'],
    currentRole: ['cargo atual','current role','current title','job title','titulo'],
    currentCompany: ['empresa atual','current company','company','empresa'],
    experienceYears: ['anos de experiencia','anos experiencia','years of experience','tempo de experiencia'],
    availability: ['disponibilidade','availability','quando pode iniciar','start date','inicio'],
    gender: ['genero','gênero','gender','sexo'],
    ethnicity: ['raca','raça','etnia','ethnicity','cor'],
    disability: ['deficiencia','deficiência','pcd','disability'],
    summary: ['sobre voce','sobre você','resumo','summary','about you','tell us about','apresentacao','why you','motivo','descreva'],
    coverLetter: ['carta','cover letter','carta apresentacao','mensagem','message'],
    address: ['endereco','endereço','address','rua','street','logradouro','avenida'],
    resumeText: ['curriculo','currículo','resume','cv'],
    skills: ['habilidades','skills','competencias','tecnologias','stack'],
    education: ['formacao','formação','education','academico','graduacao'],
  };

  const KEY_PRIORITY = [
    'fullName',
    'email',
    'phone',
    'postalCode',
    'city',
    'state',
    'country',
    'linkedin',
    'github',
    'portfolio',
    'salaryExpectation',
    'experienceYears',
    'currentRole',
    'currentCompany',
    'summary',
    'coverLetter',
    'skills',
    'education',
    'firstName',
    'lastName',
  ];

  const REPEATABLE_KEYS = {
    phone: 2,
  };

  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  const UF_BY_NAME = {
    'acre': 'ac', 'alagoas': 'al', 'amapa': 'ap', 'amazonas': 'am', 'bahia': 'ba',
    'ceara': 'ce', 'distrito federal': 'df', 'espirito santo': 'es', 'goias': 'go',
    'maranhao': 'ma', 'mato grosso': 'mt', 'mato grosso do sul': 'ms', 'minas gerais': 'mg',
    'para': 'pa', 'paraiba': 'pb', 'parana': 'pr', 'pernambuco': 'pe', 'piaui': 'pi',
    'rio de janeiro': 'rj', 'rio grande do norte': 'rn', 'rio grande do sul': 'rs',
    'rondonia': 'ro', 'roraima': 'rr', 'santa catarina': 'sc', 'sao paulo': 'sp',
    'sergipe': 'se', 'tocantins': 'to'
  };
  const NAME_BY_UF = Object.fromEntries(Object.entries(UF_BY_NAME).map(([name, uf]) => [uf, name]));

  // Grupos de termos equivalentes (g\u00eanero, etnia, sim/n\u00e3o, prefiro n\u00e3o informar).
  const SYNONYM_GROUPS = [
    ['sim', 'yes', 'true', 'on', 'afirmativo'],
    ['nao', 'no', 'false', 'negativo'],
    ['masculino', 'male', 'homem'],
    ['feminino', 'female', 'mulher'],
    ['prefiro nao informar', 'prefiro nao responder', 'nao informar', 'nao declarar', 'prefer not to say', 'prefer not to answer', 'rather not say'],
    ['nao binario', 'non binary', 'nonbinary'],
    ['outro', 'outros', 'other'],
    ['branco', 'branca', 'white'],
    ['preto', 'preta', 'negro', 'negra', 'black'],
    ['pardo', 'parda', 'brown', 'mixed'],
    ['amarelo', 'amarela', 'asian', 'asiatico'],
    ['indigena', 'indigenous', 'native'],
    ['solteiro', 'solteira', 'single'],
    ['casado', 'casada', 'married'],
  ];

  function valueAliases(value) {
    const v = normalize(value);
    if (!v) return [];
    const set = new Set([v]);
    for (const group of SYNONYM_GROUPS) {
      if (group.some(term => v === term || v.includes(term) || term.includes(v))) {
        group.forEach(term => set.add(term));
      }
    }
    if (UF_BY_NAME[v]) set.add(UF_BY_NAME[v]);
    if (NAME_BY_UF[v]) set.add(NAME_BY_UF[v]);
    return [...set];
  }

  // Converte texto monet\u00e1rio/num\u00e9rico em n\u00famero (R$ 5.000,00 -> 5000).
  function parseNumber(str) {
    const cleaned = String(str).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isFinite(num) ? num : null;
  }

  // Casa um valor num\u00e9rico com a faixa correta (ex.: "R$ 5.000 a R$ 7.000", "acima de 10 anos").
  function findRangeOption(options, value) {
    const num = parseNumber(value);
    if (num === null) return null;
    for (const opt of options) {
      const t = opt.text.toLowerCase();
      const nums = (t.match(/\d[\d.,]*/g) || []).map(parseNumber).filter(n => n !== null);
      if (!nums.length) continue;
      const lo = Math.min(...nums);
      const hi = Math.max(...nums);
      if (/(acima|mais de|maior|superior|a partir|\+|>)/.test(t) && num >= lo) return opt.element;
      if (/(abaixo|menos de|menor|ate|inferior|<)/.test(t) && num <= hi) return opt.element;
      if (nums.length >= 2 && num >= lo && num <= hi) return opt.element;
      if (nums.length === 1 && Math.abs(num - nums[0]) < 0.5) return opt.element;
    }
    return null;
  }

  function base64ToBlob(base64, type) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/pdf' });
  }

  function setFileInput(el, fileData) {
    if (!el || !fileData || !fileData.data) return false;
    try {
      const blob = base64ToBlob(fileData.data, fileData.type);
      const file = new File([blob], fileData.name || 'curriculo.pdf', { type: fileData.type || 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      console.error('[FormPhantom] Falha ao anexar curr\u00edculo:', e);
      return false;
    }
  }

  // Encontra os inputs de arquivo que parecem ser o curr\u00edculo (inclui os escondidos por ATS).
  function detectResumeFileFields() {
    const els = Array.from(document.querySelectorAll('input[type="file"]'));
    if (!els.length) return [];
    const RESUME_KW = ['curriculo', 'curriculum', 'resume', 'cv', 'anexo', 'anexar', 'arquivo', 'attach'];
    const matched = els.filter(el => {
      const meta = window.__DFA_FieldDetector.getFieldMetadata(el);
      const accept = normalize(el.getAttribute('accept') || '');
      const text = ' ' + normalize(meta.text) + ' ' + accept + ' ';
      return RESUME_KW.some(kw => text.includes(' ' + kw + ' '));
    });
    if (matched.length) return matched;
    const pdfEls = els.filter(el => /pdf|doc/.test(normalize(el.getAttribute('accept') || '')));
    if (pdfEls.length === 1) return pdfEls;
    if (els.length === 1) return els;
    return [];
  }

  function scoreField(field, key) {
    const labelNorm = normalize(field.label);
    if (key === 'fullName' && /\b(primeiro nome|first name|sobrenome|last name)\b/.test(labelNorm)) return 0;
    if ((key === 'firstName' || key === 'lastName') && /\b(nome completo|full name)\b/.test(labelNorm)) return 0;

    const texts = [
      { text: field.label, weight: 10 },
      { text: field.name, weight: 8 },
      { text: field.placeholder, weight: 6 },
      { text: field.id, weight: 5 },
      { text: field.ariaLabel, weight: 7 },
    ];
    const keywords = KEYWORDS[key] || [];
    let total = 0;
    for (const { text, weight } of texts) {
      if (!text) continue;
      const norm = normalize(text);
      for (const kw of keywords) {
        const nkw = normalize(kw);
        if (norm === nkw) total += weight * 2;
        else if (norm.includes(nkw)) total += weight;
        else {
          const words = nkw.split(/\s+/);
          for (const w of words) {
            if (w.length > 2 && norm.includes(w)) total += weight * 0.3;
          }
        }
      }
    }
    return total;
  }

  function sortProfileKeys(profileKeys) {
    return [...profileKeys].sort((a, b) => {
      const priorityA = KEY_PRIORITY.includes(a) ? KEY_PRIORITY.indexOf(a) : 999;
      const priorityB = KEY_PRIORITY.includes(b) ? KEY_PRIORITY.indexOf(b) : 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });
  }

  function matchGenericFields(fields, profileKeys) {
    const matches = [];
    const usedFields = new Set();
    const sortedKeys = sortProfileKeys(profileKeys);
    for (const key of sortedKeys) {
      const bestMatches = [];
      for (const field of fields) {
        if (usedFields.has(field)) continue;
        if (field.type === 'radio' || field.type === 'file') continue;
        const s = scoreField(field, key);
        if (s >= 6) bestMatches.push({ field, key, score: s, source: 'generic' });
      }
      bestMatches.sort((a, b) => b.score - a.score);
      const maxMatches = REPEATABLE_KEYS[key] || 1;
      for (const match of bestMatches.slice(0, maxMatches)) {
        matches.push(match);
        usedFields.add(match.field);
      }
    }
    return matches;
  }

  function matchRadioGroups(radioGroups, profileKeys) {
    const matches = [];
    for (const [groupName, fields] of Object.entries(radioGroups)) {
      const text = fields.map(f => f.label).join(' ') + ' ' + groupName;
      const norm = normalize(text);
      for (const key of profileKeys) {
        for (const kw of (KEYWORDS[key] || [])) {
          if (norm.includes(normalize(kw))) {
            matches.push({ type: 'radio', name: groupName, fields, key, source: 'generic-radio' });
            break;
          }
        }
      }
    }
    return matches;
  }

  function findSelectOption(field, value) {
    if (!field.options || !value) return null;
    const normVal = normalize(value);
    const aliases = valueAliases(value);

    // 1. igualdade exata (valor ou qualquer sinônimo)
    for (const opt of field.options) {
      const ot = normalize(opt.text);
      const ov = normalize(opt.value);
      if (aliases.some(a => ot === a || ov === a)) return opt.element;
    }
    // 2. faixa numérica (salário, anos de experiência)
    const rangeMatch = findRangeOption(field.options, value);
    if (rangeMatch) return rangeMatch;
    // 3. inclusão por sinônimo (>=3 chars para evitar falsos positivos como "no" em "nome")
    for (const opt of field.options) {
      const ot = normalize(opt.text);
      if (aliases.some(a => a.length > 2 && (ot.includes(a) || a.includes(ot)))) return opt.element;
    }
    // 4. sobreposição de palavras
    const valWords = normVal.split(/\s+/).filter(w => w.length > 2);
    for (const opt of field.options) {
      const optWords = normalize(opt.text).split(/\s+/);
      if (valWords.some(w => optWords.includes(w))) return opt.element;
    }
    return null;
  }

  function findRadioOption(fields, value) {
    if (!value) return null;
    const normVal = normalize(value);
    const aliases = valueAliases(value);

    // 1. igualdade exata (label ou value, incluindo sinônimos)
    for (const f of fields) {
      const label = normalize(f.label || f.element.value || '');
      const optVal = normalize(f.element.value);
      if (aliases.some(a => label === a || optVal === a)) return f.element;
    }
    // 2. faixa numérica
    const asOptions = fields.map(f => ({ text: f.label || f.element.value || '', element: f.element }));
    const rangeMatch = findRangeOption(asOptions, value);
    if (rangeMatch) return rangeMatch;
    // 3. inclusão por sinônimo (>=3 chars para evitar falsos positivos)
    for (const f of fields) {
      const label = normalize(f.label || f.element.value || '');
      if (aliases.some(a => a.length > 2 && (label.includes(a) || a.includes(label)))) return f.element;
    }
    return null;
  }

  function fieldText(field) {
    if (!field) return '';
    return [
      field.label,
      field.name,
      field.placeholder,
      field.id,
      field.ariaLabel,
      field.element?.getAttribute?.('aria-describedby') || '',
      field.element?.closest?.('div')?.innerText || ''
    ].filter(Boolean).join(' ');
  }

  function formatValueForField(field, key, value) {
    const raw = String(value);
    const text = normalize(fieldText(field));
    const wantsDigits = [
      'apenas numeros',
      'format integer',
      'format r',
      'cep',
      'whatsapp',
      'telefone',
      'celular',
      'ddd',
      'pretensao',
      'salario'
    ].some(term => text.includes(term));

    if (!wantsDigits && field?.type !== 'number') return raw;

    if (key === 'salaryExpectation') {
      const currency = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '');
      const decimalCurrency = currency.match(/^(\d+),\d{2}$/);
      if (decimalCurrency) return decimalCurrency[1];
    }

    let digits = raw.replace(/\D/g, '');
    if (key === 'phone' && digits.startsWith('55') && digits.length > 11) {
      digits = digits.slice(2);
    }
    return digits || raw;
  }

  function setNativeValue(el, value) {
    const prototype = el.tagName.toLowerCase() === 'textarea'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) descriptor.set.call(el, value);
    else el.value = value;
  }

  function setFieldValue(field, value) {
    if (value === undefined || value === null || value === '') return false;
    const el = field.element || field;
    const tag = el.tagName.toLowerCase();
    const type = el.type || 'text';
    try {
      if (tag === 'select') {
        const option = findSelectOption(field, String(value));
        if (option) {
          el.value = option.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      }
      if (type === 'radio') return false;
      if (type === 'checkbox') {
        const shouldCheck = ['sim','yes','true','1','on'].includes(String(value).toLowerCase().trim());
        if (el.checked !== shouldCheck) {
          el.checked = shouldCheck;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
      if (type === 'file') return false;
      el.focus();
      if (tag === 'input' || tag === 'textarea') setNativeValue(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
      el.blur();
      return true;
    } catch (e) {
      console.error('[DevFormAutofill] Error:', e);
      return false;
    }
  }

  function buildFillPlan(profile, platformMappings) {
    const plan = [];
    const profileKeys = Object.keys(profile).filter(k => profile[k] !== '' && profile[k] !== undefined && profile[k] !== null);
    const usedElements = new Set();
    if (platformMappings) {
      for (const { element, key } of platformMappings.mappings) {
        if (usedElements.has(element)) continue;
        if (key === 'resumeFile') {
          if (profile.resumeFile && profile.resumeFile.data) {
            plan.push({ type: 'file', element, key, value: profile.resumeFile, source: 'platform-file' });
            usedElements.add(element);
          }
          continue;
        }
        if (profile[key] !== undefined && profile[key] !== '') {
          const field = window.__DFA_FieldDetector.getFieldMetadata(element);
          plan.push({ element, key, value: formatValueForField(field, key, profile[key]), source: 'platform' });
          usedElements.add(element);
        }
      }
    }
    const { fields, radioGroups } = detectFields();
    const genericMatches = matchGenericFields(fields, profileKeys);
    const radioMatches = matchRadioGroups(radioGroups, profileKeys);
    plan.forEach(p => p.element && usedElements.add(p.element));
    for (const m of genericMatches) {
      if (!usedElements.has(m.field.element)) {
        plan.push({ element: m.field.element, key: m.key, value: formatValueForField(m.field, m.key, profile[m.key]), source: m.source });
        usedElements.add(m.field.element);
      }
    }
    for (const m of radioMatches) {
      const val = profile[m.key];
      if (val !== undefined && val !== '') {
        plan.push({ type: 'radio', name: m.name, fields: m.fields, key: m.key, value: val, source: m.source });
      }
    }
    // Anexar currículo nos inputs de arquivo detectados (se ainda não cobertos por mapper)
    if (profile.resumeFile && profile.resumeFile.data) {
      for (const el of detectResumeFileFields()) {
        if (usedElements.has(el)) continue;
        plan.push({ type: 'file', element: el, key: 'resumeFile', value: profile.resumeFile, source: 'resume-file' });
        usedElements.add(el);
      }
    }
    return { plan, platform: platformMappings?.platform || 'generic' };
  }

  async function executePlan(plan) {
    const results = [];
    for (const item of plan) {
      if (item.type === 'file') {
        const ok = setFileInput(item.element, item.value);
        results.push({ ...item, success: ok, reason: ok ? undefined : 'File not attached' });
      } else if (item.type === 'radio') {
        const radioEl = findRadioOption(item.fields, item.value);
        if (radioEl) {
          radioEl.checked = true;
          radioEl.dispatchEvent(new Event('change', { bubbles: true }));
          results.push({ ...item, element: radioEl, success: true });
        } else {
          results.push({ ...item, success: false, reason: 'Option not found' });
        }
      } else {
        const success = setFieldValue({ element: item.element }, item.value);
        results.push({ ...item, success });
      }
      await new Promise(r => setTimeout(r, 30));
    }
    return results;
  }

  function serializablePlan(plan) {
    return plan.map(p => {
      if (p.type === 'file') {
        return {
          key: p.key,
          value: p.value?.name || 'currículo.pdf',
          source: p.source,
          type: 'file',
          label: 'Anexar currículo',
        };
      }
      return {
        key: p.key,
        value: p.value,
        source: p.source,
        type: p.type || p.element?.tagName?.toLowerCase() || 'text',
        label: p.element
          ? (window.__DFA_FieldDetector.getFieldMetadata(p.element).label || p.element.placeholder || p.element.name || '')
          : (p.fields?.[0]?.label || p.name || ''),
      };
    });
  }

  function hasUsableProfile(profile) {
    if (!profile) return false;
    return ['fullName', 'firstName', 'email', 'phone', 'linkedin', 'portfolio', 'summary', 'skills']
      .some(key => profile[key] !== undefined && String(profile[key]).trim() !== '');
  }

  function getPageSignalText() {
    const title = document.title || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .slice(0, 12)
      .map(el => el.innerText || el.textContent || '')
      .join(' ');
    const labels = Array.from(document.querySelectorAll('label, button, [aria-label], input[placeholder], textarea[placeholder]'))
      .slice(0, 80)
      .map(el => [
        el.innerText,
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('placeholder'),
        el.name,
        el.id
      ].filter(Boolean).join(' '))
      .join(' ');
    return normalize(`${location.hostname} ${location.pathname} ${title} ${headings} ${labels}`);
  }

  function looksLikeJobApplication(platformMappings, plan) {
    const signal = getPageSignalText();
    const jobSignals = [
      'vaga', 'vagas', 'carreira', 'carreiras', 'candidatura', 'candidate',
      'application', 'apply', 'job', 'jobs', 'resume', 'curriculo', 'cv',
      'linkedin', 'gupy', 'greenhouse', 'lever', 'workable', 'indeed'
    ];
    const fieldSignals = ['fullName', 'firstName', 'lastName', 'email', 'phone', 'linkedin', 'resumeText', 'portfolio'];
    const matchedFieldCount = new Set(plan.map(item => item.key).filter(key => fieldSignals.includes(key))).size;
    const platformKnown = Boolean(platformMappings?.platform);
    const hasJobSignal = jobSignals.some(term => signal.includes(normalize(term)));
    return plan.length >= 2 && matchedFieldCount >= 2 && (platformKnown || hasJobSignal);
  }

  // Assinatura do conjunto de campos detectados, para não repetir o prompt na mesma etapa.
  function planSignature(serializable) {
    return serializable.map(item => `${item.key}:${item.label}`).join('|');
  }

  const promptedSignatures = new Set();
  let autoCheckTimer = null;
  const MAX_AUTO_PROMPTS = 12;

  function overlayIsOpen() {
    const el = document.getElementById('dfa-overlay');
    return Boolean(el) && el.style.display !== 'none';
  }

  function runAutoCheck() {
    if (overlayIsOpen()) return;
    if (promptedSignatures.size >= MAX_AUTO_PROMPTS) return;

    chrome.storage.local.get(['profile', 'resumeText', 'resumeFile'], (res) => {
      const profile = res.profile || {};
      if (!hasUsableProfile(profile)) return;

      const data = { ...profile, resumeText: res.resumeText || '', resumeFile: res.resumeFile || null };
      const platformMappings = getPlatformMappings();
      const { plan, platform } = buildFillPlan(data, platformMappings);
      if (!looksLikeJobApplication(platformMappings, plan)) return;

      const serializable = serializablePlan(plan);
      if (!serializable.length) return;

      const signature = planSignature(serializable);
      if (promptedSignatures.has(signature)) return;
      promptedSignatures.add(signature);

      window.__DFA_Overlay.show(plan, serializable, async (approvedPlan) => {
        const results = await executePlan(approvedPlan);
        window.__DFA_Overlay.hide();
        console.log('[FormPhantom] Auto prompt results:', results);
      });
      console.log(`[FormPhantom] Sugestão automática aberta. ${serializable.length} campos detectados (${platform}).`);
    });
  }

  function scheduleAutoCheck(delay = 700) {
    clearTimeout(autoCheckTimer);
    autoCheckTimer = setTimeout(runAutoCheck, delay);
  }

  function maybeShowAutoPrompt() {
    if (window.__DFA_AutoPromptStarted) return;
    window.__DFA_AutoPromptStarted = true;

    scheduleAutoCheck(900);

    // Reage a etapas adicionais (formulários multi-step / SPA) que injetam novos campos.
    const observer = new MutationObserver((mutations) => {
      const addedFields = mutations.some(m =>
        Array.from(m.addedNodes).some(node =>
          node.nodeType === 1 &&
          (node.matches?.('input, select, textarea') || node.querySelector?.('input, select, textarea'))
        )
      );
      if (addedFields) scheduleAutoCheck(700);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'startAutofill') return true;

    (async () => {
      const platformMappings = getPlatformMappings();
      const { plan, platform } = buildFillPlan(request.data, platformMappings);
      const serializable = serializablePlan(plan);

      if (request.mode === 'review') {
        window.__DFA_Overlay.show(plan, serializable, async (approvedPlan) => {
          const results = await executePlan(approvedPlan);
          window.__DFA_Overlay.hide();
          console.log('[DevFormAutofill] Results:', results);
        });
        sendResponse({ message: `Overlay aberto. ${serializable.length} campos detectados (${platform}).` });
      } else {
        const results = await executePlan(plan);
        sendResponse({ message: `Preenchido ${results.filter(r => r.success).length}/${results.length} campos (${platform}).` });
      }
    })();

    return true;
  });

  window.__DFA_Autofill = { buildFillPlan, executePlan, setFieldValue, findSelectOption };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeShowAutoPrompt, { once: true });
  } else {
    maybeShowAutoPrompt();
  }
})();
