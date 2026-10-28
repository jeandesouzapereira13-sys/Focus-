# Focus — produtividade gamificada (PWA)

Aplicativo web instalável, 100% offline e local. Sem conta, sem servidor, sem anúncios.

## Arquivos
- `index.html` — estrutura do app
- `app.css` — visual (tema escuro/claro)
- `app.js` — toda a lógica (tarefas, XP, níveis, metas, desafios, histórico, backup)
- `sw.js` — service worker (funcionamento offline)
- `manifest.webmanifest` — dados de instalação
- `icons/` — ícones (inclui o ícone da tela de início do iPhone)

## Publicar grátis no GitHub Pages
1. Crie uma conta gratuita em github.com (não pede cartão).
2. Toque em **New repository**, nome `focus`, marque **Public**, crie.
3. Em **Add file › Upload files**, envie TODO o conteúdo desta pasta (incluindo a pasta `icons`), mantendo a estrutura. Confirme em **Commit changes**.
4. Vá em **Settings › Pages**. Em *Source*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e salve.
5. Aguarde 1–2 minutos. O endereço será `https://SEU-USUARIO.github.io/focus/`.

Todos os caminhos são relativos, então o app funciona nesse subendereço sem ajustes.

## Instalar no iPhone
1. Abra o endereço no **Safari** (precisa ser o Safari).
2. Toque em **Compartilhar** (quadrado com seta) › **Adicionar à Tela de Início** › **Adicionar**.
3. Abra o Focus pelo ícone. Ele abre em tela cheia, sem a barra do navegador.

Importante: os dados do app instalado ficam separados dos dados da aba do Safari. Use sempre o ícone.

## Verificar o modo offline
Abra o Focus pelo ícone uma vez com internet, feche, ative o Modo Avião e abra de novo.

## Backup
Ajustes › Exportar backup › salvar em Arquivos/iCloud Drive. Para restaurar: Ajustes › Importar backup.

## Publicar uma atualização
Altere os arquivos, troque `focus-v1.0.0` em `sw.js` por uma nova versão (ex.: `focus-v1.0.1`) e envie de novo.
O app mostrará “Nova versão disponível — Atualizar”.
