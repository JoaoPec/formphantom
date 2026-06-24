// content_scripts/platformMappers.js

(() => {
  const MAPPERS = {
    linkedin: {
      host: /linkedin\.com/,
      selectors: {
        'input#first-name-application-ui': 'firstName',
        'input#last-name-application-ui': 'lastName',
        'input#email-application-ui': 'email',
        'input#phone-national-number-application-ui': 'phone',
        'input#job-application-resume': 'resumeFile',
        'input#job-application-cover-letter': 'coverLetter',
        'textarea#job-application-cover-letter': 'coverLetter',
        // LinkedIn usa IDs dinâmicos, então fallback por name/aria
        'input[name="firstName"]': 'firstName',
        'input[name="lastName"]': 'lastName',
        'input[name="email"]': 'email',
        'input[name="phoneNumber"]': 'phone',
        'input[name="phone"]': 'phone',
        'input[name="linkedin"]': 'linkedin',
        'input[name="website"]': 'portfolio',
        'input[name="portfolio"]': 'portfolio',
        'input[name="github"]': 'github',
      }
    },
    gupy: {
      host: /gupy\.io/,
      selectors: {
        'input[name="firstName"], input[placeholder*="nome" i]': 'firstName',
        'input[name="lastName"], input[placeholder*="sobrenome" i]': 'lastName',
        'input[name="email"], input[type="email"]': 'email',
        'input[name="phone"], input[placeholder*="telefone" i], input[placeholder*="celular" i]': 'phone',
        'input[name="linkedin"], input[placeholder*="linkedin" i]': 'linkedin',
        'input[name="portfolio"], input[placeholder*="portfólio" i], input[placeholder*="portfolio" i]': 'portfolio',
        'input[name="github"], input[placeholder*="github" i]': 'github',
        'input[name="salaryExpectation"], input[placeholder*="pretensão" i], input[placeholder*="salário" i]': 'salaryExpectation',
        'textarea[name="summary"], textarea[placeholder*="sobre" i], textarea[placeholder*="resumo" i]': 'summary',
        'textarea[name="coverLetter"], textarea[placeholder*="carta" i], textarea[placeholder*="apresentação" i]': 'coverLetter',
        'input[name="city"], input[placeholder*="cidade" i]': 'city',
        'input[name="state"], input[placeholder*="estado" i]': 'state',
        'input[name="country"], input[placeholder*="país" i], input[placeholder*="pais" i]': 'country',
        'input[name="postalCode"], input[placeholder*="cep" i], input[placeholder*="CEP" i]': 'postalCode',
        'input[name="cpf"], input[placeholder*="cpf" i], input[placeholder*="CPF" i]': 'cpf',
        'select[name="gender"]': 'gender',
        'select[name="ethnicity"]': 'ethnicity',
        'select[name="disability"]': 'disability',
        'select[name="availability"]': 'availability',
      }
    },
    greenhouse: {
      host: /greenhouse\.io|boards\.greenhouse\.io/,
      selectors: {
        'input#first_name': 'firstName',
        'input#last_name': 'lastName',
        'input#email': 'email',
        'input#phone': 'phone',
        'input#job_application[linkedin_url]': 'linkedin',
        'input#job_application[website]': 'portfolio',
        'input#job_application[github_username]': 'github',
        'input#job_application[location]': 'city',
        'textarea#cover_letter_text': 'coverLetter',
        'input#job_application[salary_expectations]': 'salaryExpectation',
      }
    },
    lever: {
      host: /lever\.co/,
      selectors: {
        'input[name="name"]': 'fullName',
        'input[name="email"]': 'email',
        'input[name="phone"]': 'phone',
        'input[name="org"]': 'currentCompany',
        'input[name="urls[LinkedIn]"]': 'linkedin',
        'input[name="urls[Portfolio]"]': 'portfolio',
        'input[name="urls[GitHub]"]': 'github',
        'input[name="urls[Twitter]"]': 'twitter',
        'textarea[name="comments"]': 'summary',
        'textarea[name="coverLetter"]': 'coverLetter',
      }
    },
    workable: {
      host: /workable\.com|apply\.workable\.com/,
      selectors: {
        'input[name="firstname"]': 'firstName',
        'input[name="lastname"]': 'lastName',
        'input[name="email"]': 'email',
        'input[name="phone"]': 'phone',
        'input[name="linkedinurl"]': 'linkedin',
        'input[name="portfolio"]': 'portfolio',
        'input[name="github"]': 'github',
        'textarea[name="summary"]': 'summary',
        'textarea[name="cover_letter"]': 'coverLetter',
      }
    },
    indeed: {
      host: /indeed\.com/,
      selectors: {
        'input[name="fullName"]': 'fullName',
        'input[name="email"]': 'email',
        'input[name="phone"]': 'phone',
        'input[name="resume"]': 'resumeFile',
      }
    },
    vagas: {
      host: /vagas\.com\.br/,
      selectors: {
        'input#nome': 'fullName',
        'input#email': 'email',
        'input#telefone': 'phone',
        'input#linkedin': 'linkedin',
        'input#portfolio': 'portfolio',
        'input#pretensao': 'salaryExpectation',
      }
    },
    catho: {
      host: /catho\.com\.br/,
      selectors: {
        'input[name="nome"]': 'fullName',
        'input[name="email"]': 'email',
        'input[name="telefone"]': 'phone',
      }
    },
    infojobs: {
      host: /infojobs\.com\.br/,
      selectors: {
        'input#txtNome': 'fullName',
        'input#txtEmail': 'email',
        'input#txtTelefone': 'phone',
      }
    },
    airtable: {
      host: /airtable\.com/,
      selectors: {
        'textarea, input[type="text"], input[type="email"], input[type="tel"], input[type="number"]': null,
      }
    },
    kenoby: {
      host: /kenoby\.com/,
      selectors: {
        'input[name="nome"], input[placeholder*="nome" i]': 'fullName',
        'input[name="email"], input[type="email"]': 'email',
        'input[name="telefone"], input[placeholder*="telefone" i], input[placeholder*="celular" i]': 'phone',
        'input[name="linkedin"], input[placeholder*="linkedin" i]': 'linkedin',
        'input[name="portfolio"], input[placeholder*="portfólio" i], input[placeholder*="portfolio" i]': 'portfolio',
        'textarea[name="mensagem"], textarea[placeholder*="mensagem" i], textarea[placeholder*="apresentação" i]': 'coverLetter',
      }
    },
  };

  function detectPlatform() {
    const host = location.hostname;
    for (const [key, cfg] of Object.entries(MAPPERS)) {
      if (cfg.host.test(host)) return { key, ...cfg };
    }
    return null;
  }

  function getPlatformMappings() {
    const platform = detectPlatform();
    if (!platform) return null;
    const map = [];
    for (const [selector, key] of Object.entries(platform.selectors)) {
      if (!key) continue;
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        map.push({ element: el, key, selector });
      });
    }
    return { platform: platform.key, mappings: map };
  }

  window.__DFA_PlatformMapper = { detectPlatform, getPlatformMappings, MAPPERS };
})();
