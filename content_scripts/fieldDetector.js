// content_scripts/fieldDetector.js

(() => {
  const FIELD_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function textWithoutControls(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button, [contenteditable="true"]').forEach(n => n.remove());
    return cleanText(clone.innerText || clone.textContent || '');
  }

  function extractQuestionLabel(text) {
    const cleaned = cleanText(text);
    if (!cleaned) return '';

    const beforeRequiredMark = cleaned.split('*')[0].trim();
    if (beforeRequiredMark && beforeRequiredMark.length <= 180) return beforeRequiredMark;

    const questionIndex = cleaned.indexOf('?');
    if (questionIndex >= 0 && questionIndex < 180) return cleaned.slice(0, questionIndex + 1).trim();

    const withoutFormatHints = cleaned
      .replace(/\bFormat:\s*\S+.*/i, '')
      .replace(/\bapenas numeros\b.*/i, '')
      .replace(/\bdigite\b.*/i, '')
      .trim();
    if (withoutFormatHints && withoutFormatHints.length <= 120) return withoutFormatHints;

    return cleaned.length <= 80 ? cleaned : '';
  }

  function getContextualLabelText(el) {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 9; depth++, node = node.parentElement) {
      const text = textWithoutControls(node);
      if (!text || text.length > 600) continue;
      const candidate = extractQuestionLabel(text);
      if (candidate) return candidate;
    }
    return '';
  }

  function getLabelText(el) {
    // 1. label[for=id]
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return cleanText(label.innerText);
    }
    // 2. parent label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // remove o próprio elemento do texto para evitar duplicação
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, textarea, select').forEach(n => n.remove());
      return cleanText(clone.innerText);
    }
    // 3. aria-labelledby
    if (el.getAttribute('aria-labelledby')) {
      const ids = el.getAttribute('aria-labelledby').split(/\s+/);
      return ids.map(id => cleanText(document.getElementById(id)?.innerText)).filter(Boolean).join(' ');
    }
    // 4. aria-label
    if (el.getAttribute('aria-label')) return cleanText(el.getAttribute('aria-label'));
    // 5. visual form block text (Airtable and similar no-label builders)
    return getContextualLabelText(el);
  }

  function getXPath(el) {
    const idx = (sib, name) => {
      let count = 1;
      for (const e of sib) {
        if (e.nodeName.toLowerCase() === name) {
          if (e === el) return count;
          count++;
        }
      }
      return 0;
    };
    const segs = (elm) => {
      if (!elm || elm.nodeType !== 1) return [''];
      const name = elm.nodeName.toLowerCase();
      return [...segs(elm.parentNode), `${name}[${idx(elm.parentNode ? elm.parentNode.children : [], name)}]`];
    };
    return segs(el).join('/');
  }

  function getCssSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    let path = [];
    let current = el;
    while (current && current.nodeType === 1) {
      let selector = current.nodeName.toLowerCase();
      if (current.className) {
        selector += '.' + current.className.trim().split(/\s+/).map(CSS.escape).join('.');
      }
      const siblings = Array.from(current.parentNode?.children || []).filter(s => s.nodeName === current.nodeName);
      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      path.unshift(selector);
      current = current.parentNode;
      if (path.length > 4) break;
    }
    return path.join(' > ');
  }

  function getFieldType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['checkbox','radio'].includes(type)) return type;
    if (['email','tel','url','number','date','file'].includes(type)) return type;
    return 'text';
  }

  function getFieldMetadata(el) {
    const label = getLabelText(el);
    const name = el.name || '';
    const id = el.id || '';
    const placeholder = el.placeholder || '';
    const type = getFieldType(el);
    const text = [label, name, id, placeholder].join(' ').toLowerCase();

    return {
      element: el,
      tag: el.tagName.toLowerCase(),
      type,
      name,
      id,
      placeholder,
      label,
      ariaLabel: el.getAttribute('aria-label') || '',
      text,
      xpath: getXPath(el),
      cssSelector: getCssSelector(el),
      required: el.required || el.getAttribute('aria-required') === 'true',
      visible: el.offsetParent !== null && !el.disabled
    };
  }

  function detectFields() {
    const all = Array.from(document.querySelectorAll(FIELD_SELECTOR));
    const fields = all
      .map(getFieldMetadata)
      .filter(f => f.visible);

    // Agrupar radios por nome
    const radioGroups = {};
    fields.filter(f => f.type === 'radio').forEach(f => {
      if (!radioGroups[f.name]) radioGroups[f.name] = [];
      radioGroups[f.name].push(f);
    });

    // Para selects, capturar opções
    fields.filter(f => f.type === 'select').forEach(f => {
      f.options = Array.from(f.element.options).map(o => ({
        text: o.text.trim().toLowerCase(),
        value: o.value,
        element: o
      }));
    });

    return { fields, radioGroups };
  }

  // Expor globalmente no content script scope
  window.__DFA_FieldDetector = { detectFields, getFieldMetadata };
})();
