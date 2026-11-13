# LISE frontend estático

A interface atual segue o caderno de naturalista. Componentes estão em `components.js`, navegação em `navigation.js`, telas em `screens.js` e atividades/formulários em `activities.js`; o estado e as integrações permanecem em `app.js`. O CSS é organizado em `styles/`, carregado por `app.css`.

Para uma demonstração sem Supabase e sem editar `config.js`, execute `python run_demo.py` na pasta superior e abra `http://127.0.0.1:5001`. Veja [o relatório de implementação e testes](../REFATORACAO_NATURALISTA.md).

Publique esta pasta como projeto Vercel independente: **Root Directory** `frontend_spa`, preset **Other**, sem build e **Output Directory** `.`. O arquivo `vercel.json` define a navegação SPA e os cabeçalhos.

Após publicar o backend, informe a origem da API em `config.js` (`https://...`, sem `/api/v1` e sem barra final) e publique novamente. O frontend não usa chaves do Supabase.

Localmente, configure `API_BASE_URL` como `http://127.0.0.1:5000`, inicie `python app.py` dentro de `backend_service/` e `python -m http.server 5500` nesta pasta.

A rodada 2 acrescenta `interactions.js` e `styles/interactions.css` para movimento e componentes compartilhados. Consulte [o relatório](../FRONT_LISE_2_IMPLEMENTACAO.md). Sem novas dependências de execução.

## CRUD — 2.0.0-beta.1

`crud.js` reúne os controles de gestão e conta, carregado depois de interactions.js e antes de app.js. As edições enviam revisão do item; as criações usam chave de idempotência. Os bloqueios de autorização, arquivos e dependências são da API. [Estado e testes atuais](../CRUD_2_IMPLEMENTACAO.md).

Os testes de navegador em `tests/browser_*.py` são ferramentas de desenvolvimento e estão excluídos do upload estático por `.vercelignore`.
