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

  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function scoreField(field, key) {
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

  function matchGenericFields(fields, profileKeys) {
    const matches = [];
    const usedFields = new Set();
    const sortedKeys = [...profileKeys].sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      let best = null, bestScore = 0;
      for (const field of fields) {
        if (usedFields.has(field)) continue;
        if (field.type === 'radio') continue;
        const s = scoreField(field, key);
        if (s > bestScore) { bestScore = s; best = field; }
      }
      if (best && bestScore >= 6) {
        matches.push({ field: best, key, score: bestScore, source: 'generic' });
        usedFields.add(best);
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
    for (const opt of field.options) {
      if (normalize(opt.text) === normVal || normalize(opt.value) === normVal) return opt.element;
    }
    for (const opt of field.options) {
      if (normalize(opt.text).includes(normVal) || normVal.includes(normalize(opt.text))) return opt.element;
    }
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
    for (const f of fields) {
      const label = f.label || f.element.value || '';
      if (normalize(label) === normVal || normalize(f.element.value) === normVal) return f.element;
      if (normalize(label).includes(normVal) || normVal.includes(normalize(label))) return f.element;
    }
    const valLower = value.toLowerCase().trim();
    const isYes = ['sim','yes','true','1'].includes(valLower);
    const isNo = ['nao','não','no','false','0'].includes(valLower);
    for (const f of fields) {
      const label = normalize(f.label || f.element.value || '');
      if (isYes && (label.includes('sim') || label.includes('yes'))) return f.element;
      if (isNo && (label.includes('nao') || label.includes('não') || label.includes('no'))) return f.element;
    }
    return null;
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
      el.value = value;
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
    if (platformMappings) {
      for (const { element, key } of platformMappings.mappings) {
        if (profile[key] !== undefined && profile[key] !== '') {
          plan.push({ element, key, value: profile[key], source: 'platform' });
        }
      }
    }
    const { fields, radioGroups } = detectFields();
    const genericMatches = matchGenericFields(fields, profileKeys);
    const radioMatches = matchRadioGroups(radioGroups, profileKeys);
    const usedElements = new Set(plan.map(p => p.element));
    for (const m of genericMatches) {
      if (!usedElements.has(m.field.element)) {
        plan.push({ element: m.field.element, key: m.key, value: profile[m.key], source: m.source });
        usedElements.add(m.field.element);
      }
    }
    for (const m of radioMatches) {
      const val = profile[m.key];
      if (val !== undefined && val !== '') {
        plan.push({ type: 'radio', name: m.name, fields: m.fields, key: m.key, value: val, source: m.source });
      }
    }
    return { plan, platform: platformMappings?.platform || 'generic' };
  }

  async function executePlan(plan) {
    const results = [];
    for (const item of plan) {
      if (item.type === 'radio') {
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
    return plan.map(p => ({
      key: p.key,
      value: p.value,
      source: p.source,
      type: p.type || p.element?.tagName?.toLowerCase() || 'text',
      label: p.element
        ? (window.__DFA_FieldDetector.getFieldMetadata(p.element).label || p.element.placeholder || p.element.name || '')
        : (p.fields?.[0]?.label || p.name || ''),
    }));
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

  function autoPromptKey() {
    return `__formphantom_auto_prompted:${location.origin}${location.pathname}`;
  }

  function maybeShowAutoPrompt() {
    if (window.__DFA_AutoPromptStarted) return;
    window.__DFA_AutoPromptStarted = true;

    window.setTimeout(() => {
      if (sessionStorage.getItem(autoPromptKey()) === '1') return;
      if (document.getElementById('dfa-overlay')) return;

      chrome.storage.local.get(['profile', 'resumeText'], (res) => {
        const profile = res.profile || {};
        if (!hasUsableProfile(profile)) return;

        const data = { ...profile, resumeText: res.resumeText || '' };
        const platformMappings = getPlatformMappings();
        const { plan, platform } = buildFillPlan(data, platformMappings);
        if (!looksLikeJobApplication(platformMappings, plan)) return;

        const serializable = serializablePlan(plan);
        if (!serializable.length) return;

        sessionStorage.setItem(autoPromptKey(), '1');
        window.__DFA_Overlay.show(plan, serializable, async (approvedPlan) => {
          const results = await executePlan(approvedPlan);
          window.__DFA_Overlay.hide();
          console.log('[DevFormAutofill] Auto prompt results:', results);
        });
        console.log(`[DevFormAutofill] Sugestão automática aberta. ${serializable.length} campos detectados (${platform}).`);
      });
    }, 900);
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
