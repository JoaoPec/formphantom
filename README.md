<p align="center"><img src="landing/logo.png" width="120" alt="FormPhantom"></p>

# FormPhantom

Extensão de Chrome para preencher automaticamente formulários extensos de candidatura a vagas.

<!-- DEMO: grave um GIF de 3-5s preenchendo um formulário (LinkedIn/Gupy), salve em docs/demo.gif e descomente o bloco abaixo
<p align="center">
  <img src="docs/demo.gif" width="80%" alt="FormPhantom preenchendo um formulário automaticamente">
</p>
-->

## Funcionalidades

- **Perfil persistente**: cadastre seus dados uma única vez.
- **Leitura de PDF**: anexe seu currículo em PDF e a extensão extrai o texto automaticamente.
- **Detecção automática de campos**: funciona em formulários genéricos e nas principais plataformas de RH.
- **Mapeamento de plataformas**: suporte otimizado para LinkedIn, Gupy, Greenhouse, Lever, Workable, Indeed, Vagas.com, Catho, InfoJobs e Kenoby.
- **Modo de revisão**: visualize e edite os valores antes de preencher, ou use o modo automático.
- **Matching inteligente**: algoritmo de pontuação por heurísticas e palavras-chave para identificar o campo certo, mesmo em sites desconhecidos.

## Como instalar (modo desenvolvedor)

1. Clone ou baixe este repositório.
2. Abra o Chrome e vá para `chrome://extensions/`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `formphantom`.
5. A extensão aparecerá na barra de ferramentas.

## Como usar

1. Clique no ícone da extensão.
2. Preencha seus dados na aba **Perfil** e salve.
3. (Opcional) Vá na aba **Currículo PDF** e anexe seu CV para extração de texto.
4. Abra uma vaga em qualquer site suportado.
5. Na aba **Ações**, clique em **Preencher esta página**.
6. No modo **Revisar**, ajuste os valores no overlay e confirme.

## Estrutura

```
formphantom/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content_scripts/
│   ├── fieldDetector.js
│   ├── platformMappers.js
│   ├── autofill.js
│   └── overlay.js
├── styles/
│   └── overlay.css
├── lib/
│   ├── pdf.min.js
│   └── pdf.worker.min.js
└── icons/
    └── icon*.png
```

## Tecnologias

- Manifest V3
- Chrome Extensions API (storage, scripting, tabs)
- PDF.js para parsing de currículos
- Matching heurístico com normalização e scoring

## Licença

MIT
