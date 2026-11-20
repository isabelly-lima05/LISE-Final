# LISE API

Backend Flask da LISE, atualmente na versão `2.0.0-beta.1`. Para a visão completa do projeto, consulte o [README principal](../README.md).

## Publicação

Configure `backend_service` como **Root Directory** de um projeto Vercel separado. A entrada WSGI é `vercel_app:app` e o health check é `/api/v1/healthz`.

Cadastre no painel da Vercel: `DATABASE_URL` (Transaction Pooler do Supabase, porta `6543`), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SECRET_KEY`, `FRONTEND_URL`, `FRONTEND_ORIGINS` e `DEMO_MODE=false`. Para exclusão de contas, configure também `SUPABASE_SECRET_KEY` somente no backend.

O navegador não recebe senha do banco nem chave administrativa. A API restringe CORS às origens configuradas e valida autenticação, papel e vínculo com os dados pedidos.

## Executar localmente

Use Python 3.12, crie `backend_service/.env` com as variáveis descritas na seção [Configuração do backend](../README.md#configuração-do-backend) e rode:

```bash
python -m pip install -r requirements-dev.txt
python app.py
```

Em outro terminal, dentro de `frontend_spa/`, rode `python -m http.server 5500` e configure a URL local da API em `config.js`. Execute testes com `python -m pytest` nesta pasta.

## CRUD e exclusão de conta

Aplique as migrações de `supabase/migrations/` antes de publicar. `SUPABASE_SECRET_KEY` configura somente o cliente administrativo usado na exclusão da identidade do Supabase Auth. Mesmo sem ela, a API remove os dados e acessos da LISE e registra a identidade externa em uma fila; configure a chave e agende `flask --app app:create_app process-account-deletions` para concluir e repetir operações pendentes no provedor.

Os testes de desenvolvimento também podem ser executados pelo pytest na raiz do workspace. Eles usam banco e provedores isolados, sem autenticação real no Supabase.
