# LISE frontend estático

A interface da LISE, atualmente na versão `2.0.0-beta.1`, é uma SPA em HTML, CSS e JavaScript sem etapa de compilação. Componentes estão em `components.js`, navegação em `navigation.js`, telas em `screens.js` e atividades e formulários em `activities.js`; o estado e as integrações permanecem em `app.js`. O CSS-fonte é organizado em `styles/` e agrupado em seis arquivos de entrega por `tools/build_css.py`, mantendo a ordem original da cascata.

Para uma demonstração sem Supabase e sem editar `config.js`, execute `python run_demo.py` na pasta superior e abra `http://127.0.0.1:5001`.

Publique esta pasta como projeto Vercel independente: **Root Directory** `frontend_spa`, preset **Other**, sem build e **Output Directory** `.`. O arquivo `vercel.json` define a navegação SPA e os cabeçalhos.

Após publicar o backend, informe a origem da API em `config.js` (`https://...`, sem `/api/v1` e sem barra final) e publique novamente. O frontend não usa chaves do Supabase. `GOOGLE_AUTH_ENABLED` permanece `false`: o botão Google está oculto e essa integração não faz parte desta rodada.

Localmente, configure `API_BASE_URL` como `http://127.0.0.1:5000`, inicie `python app.py` dentro de `backend_service/` e `python -m http.server 5500` nesta pasta.

`interactions.js` e `styles/interactions.css` concentram interações e componentes compartilhados, sem novas dependências de execução.

Depois de alterar um CSS-fonte, execute `python tools/build_css.py` na raiz. Para recriar os nove avatares WebP a partir dos PNG oficiais, execute `python tools/optimize_avatars.py`; o tardígrado continua em SVG.

## Gestão de conteúdo e conta

`crud.js` reúne os controles de gestão e conta, carregado depois de `interactions.js` e antes de `app.js`. As edições enviam a revisão do item e as criações usam chave de idempotência. Os bloqueios de autorização, arquivamento e dependências são responsabilidade da API.

Os testes de navegador em `tests/browser_*.py` são ferramentas de desenvolvimento e estão excluídos do upload estático por `.vercelignore`.
