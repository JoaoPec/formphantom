# Guia de publicação na Chrome Web Store

Este documento reúne tudo o que você precisa para publicar o FormPhantom na Chrome Web Store.

---

## 1. Taxa de desenvolvedor

- Acesse o [Google Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole/).
- Pague a taxa única de **US$ 5** para ativar sua conta de desenvolvedor.

---

## 2. Texto da descrição da loja

Copie e cole os campos abaixo no formulário de publicação.

### Descrição curta (máximo 132 caracteres)

```
Extensão Chrome que preenche formulários de candidatura com perfil, PDF e matching inteligente.
```

### Descrição completa

```
O FormPhantom é uma extensão para quem se candidata a muitas vagas e está cansado de preencher os mesmos formulários várias vezes.

Com um perfil único, a extensão detecta automaticamente os campos das páginas de candidatura e preenche nome, e-mail, telefone, experiência, formação e muito mais — em segundos.

Principais funcionalidades:

• Perfil persistente: cadastre seus dados uma vez e reutilize em qualquer vaga.
• Extração de currículo em PDF: a extensão lê o texto do seu CV e usa como contexto.
• Detecção automática de campos: funciona em formulários genéricos e nas principais plataformas de RH.
• Suporte otimizado para LinkedIn, Gupy, Greenhouse, Lever, Workable, Indeed, Vagas.com, Catho, InfoJobs e Kenoby.
• Modo de revisão: visualize e edite os valores antes de confirmar o preenchimento.
• Matching inteligente: algoritmo heurístico encontra o campo certo mesmo em sites novos.

Seus dados ficam salvos localmente no navegador. Nada é enviado para servidores externos.

Código aberto: github.com/JoaoPec/formphantom
Política de privacidade: https://formphantom.vercel.app/privacy.html
```

> Ajuste a URL da política de privacidade para o domínio real onde a landing estiver hospedada.

---

## 3. Explicação das permissões

Durante a publicação, a Chrome Web Store pode pedir justificativa para cada permissão. Use os textos abaixo:

| Permissão | Justificativa |
|-----------|---------------|
| `storage` | Para salvar o perfil do usuário localmente no navegador, permitindo reutilização entre sessões. |
| `activeTab` | Para executar ações de preenchimento apenas na aba que o usuário está visualizando no momento. |
| `scripting` | Para injetar scripts que detectam e preenchem os campos dos formulários de candidatura. |
| `tabs` | Para identificar a página ativa e executar o preenchimento no contexto correto. |
| `host_permissions` (`<all_urls>`) | A extensão precisa funcionar em qualquer site de vagas, pois as plataformas de RH são diversas e não limitadas a domínios específicos. |

---

## 4. Imagens obrigatórias

### Ícone da extensão

Já existem na pasta `icons/`:

- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

Verifique se o ícone de 128×128 está legível e com bom contraste.

### Screenshots da loja

A Chrome Web Store exige pelo menos 1 screenshot, mas recomenda 3 a 5. Tamanho ideal: **1280×800** ou **640×400**.

Sugestões de screenshots:

1. Tela do popup com a aba "Perfil" preenchida.
2. Demonstração do overlay de revisão sobre um formulário de vaga.
3. Tela da aba "Currículo PDF" com extração de texto.
4. A extensão em ação em uma plataforma de RH conhecida.

> Dica: use a ferramenta de captura do Chrome (F12 → Ctrl+Shift+P → "Capture full size screenshot") para gerar imagens nítidas.

### Imagem promocional (opcional)

- **Small promo tile:** 440×280 px
- **Marquee promo tile:** 1400×560 px

Use a identidade visual do FormPhantom (fundo escuro, roxo #9d65ff, cyan #73e3ff).

---

## 5. Empacotar a extensão

Use o script `build-zip.ps1` para gerar o arquivo `.zip` que será enviado para a loja:

```powershell
.\build-zip.ps1
```

O arquivo `formphantom-v{versao}.zip` será criado na pasta `dist/`.

> Antes de empacotar, remova arquivos desnecessários como `.git/`, `node_modules/`, `dist/`, `build-zip.ps1` e a pasta `landing/` (a menos que a extensão precise dela).

---

## 6. Checklist antes de enviar

- [ ] Ícones nos tamanhos 16, 48 e 128 estão presentes.
- [ ] `manifest.json` está com `manifest_version: 3` e versão atualizada.
- [ ] Descrição curta e completa foram preenchidas.
- [ ] Justificativas das permissões estão claras.
- [ ] Política de privacidade está publicada e acessível.
- [ ] Screenshots de 1280×800 foram gerados.
- [ ] Arquivo `.zip` foi criado sem lixo de desenvolvimento.
- [ ] A extensão foi testada no Chrome em modo desenvolvedor.

---

## 7. Após o envio

- A revisão do Google geralmente leva de algumas horas a alguns dias.
- Extensões com permissões amplas (`<all_urls>`, `scripting`) podem passar por análise mais detalhada.
- Se houver rejeição, o Google envia um e-mail com o motivo específico.

---

## 8. Links úteis

- [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole/)
- [Program Policies - Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
