# LISE — Biologia por etimologia

![Versão](https://img.shields.io/badge/vers%C3%A3o-2.0.0--beta.1-4A5D4E)
![Status](https://img.shields.io/badge/status-beta-C49A5A)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=111111)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)

A LISE é uma plataforma educacional para aprender Biologia a partir da origem e da formação das palavras. Ela relaciona termos científicos a raízes gregas e latinas e transforma essas relações em explorações, trilhas, avaliações e atividades interativas.

> **Estado atual:** versão `2.0.0-beta.1`. A demonstração local usa dados fictícios e não substitui uma instalação de produção.

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Demonstração local](#demonstração-local)
- [Desenvolvimento](#desenvolvimento)
- [Configuração do backend](#configuração-do-backend)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Testes](#testes)
- [Publicação](#publicação)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Versionamento](#versionamento)
- [Solução de problemas](#solução-de-problemas)

## Visão geral

A plataforma atende a dois perfis:

- **Aluno:** explora termos, participa de jogos e avaliações, acompanha o próprio progresso e integra turmas e trilhas.
- **Professor:** organiza turmas, trilhas, conteúdos e avaliações e acompanha a aprendizagem dos estudantes.

O frontend é uma aplicação de página única (SPA) feita em JavaScript e CSS, sem etapa de compilação. O backend expõe uma API JSON em Flask, aplica as regras de autorização e acessa o banco. O Supabase fornece PostgreSQL e autenticação na instalação de produção.

## Funcionalidades

- consulta de termos biológicos, definições, áreas e elementos etimológicos;
- jogos de exploração, quiz de Biologia, família de palavras e memória;
- registro de progresso, XP, nível, sequência de estudo e conclusão de trilhas;
- turmas, matrículas por código, trilhas e avaliações com janelas de disponibilidade;
- criação, edição, arquivamento e restauração de conteúdos com controle de acesso;
- gerenciamento de sessões, exportação de dados e solicitação de exclusão de conta;
- interface responsiva, temas, avatares e recursos de acessibilidade.

## Arquitetura

```text
Navegador
  └── frontend_spa/ (HTML, CSS e JavaScript)
        └── HTTPS /api/v1
              ├── Flask (API, autorização e regras de negócio)
              ├── Supabase Auth (identidade)
              └── PostgreSQL / Supabase (persistência)
```

Frontend e backend podem ser publicados como projetos separados na Vercel. A demonstração local serve a SPA e a API na mesma origem e usa SQLite.

As rotas protegidas conferem a sessão, o perfil e o vínculo do usuário com cada turma, trilha ou conteúdo solicitado.

## Estrutura do repositório

| Caminho | Responsabilidade |
| --- | --- |
| [`run_demo.py`](./run_demo.py) | Inicializa a demonstração integrada com SQLite e dados fictícios. |
| [`INICIAR_DEMO.bat`](./INICIAR_DEMO.bat) | Prepara o ambiente e inicia a demonstração no Windows. |
| [`frontend_spa/`](./frontend_spa/) | SPA, estilos, recursos visuais e testes de interface. |
| [`backend_service/`](./backend_service/) | API Flask, modelos, serviços, regras de acesso e testes. |
| [`supabase/migrations/`](./supabase/migrations/) | Migrações PostgreSQL em ordem cronológica. |
| [`tools/`](./tools/) | Utilitários de configuração da API e conteúdo legal. |
| [`pytest.ini`](./pytest.ini) | Configuração da suíte Python. |

Os módulos principais do frontend são `components.js`, `navigation.js`, `activities.js`, `screens.js`, `interactions.js`, `crud.js` e `app.js`. A folha de entrada `app.css` carrega os estilos organizados em `frontend_spa/styles/`.

## Demonstração local

### Inicialização rápida no Windows

Execute:

```powershell
.\INICIAR_DEMO.bat
```

Ou prepare o ambiente manualmente:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend_service\requirements.txt
.\.venv\Scripts\python.exe run_demo.py
```

Acesse `http://127.0.0.1:5001`.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Aluno | `aluno@lise.demo` | `LiseDemo123!` |
| Professor | `professor@lise.demo` | `LiseDemo123!` |

Para escolher outra porta:

```powershell
.\.venv\Scripts\python.exe run_demo.py --port 5002
```

A demonstração escuta somente em `127.0.0.1`, cria `demo_privacidade.db` na raiz e não oferece cadastro ou autenticação real pelo Supabase. Não use as credenciais fictícias nem o banco local em produção.

## Desenvolvimento

### 1. Backend

Instale Python 3.12, crie `backend_service/.env` com as variáveis da próxima seção e execute:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend_service\requirements-dev.txt
Set-Location backend_service
..\.venv\Scripts\python.exe app.py
```

A API ficará disponível em `http://127.0.0.1:5000`.

### 2. Frontend

Defina temporariamente `API_BASE_URL` como `http://127.0.0.1:5000` em `frontend_spa/config.js`. Em outro terminal:

```powershell
Set-Location frontend_spa
py -3.12 -m http.server 5500
```

Acesse `http://127.0.0.1:5500`. A URL da API deve conter apenas a origem, sem `/api/v1` e sem barra final.

Para uma demonstração simples, prefira `run_demo.py`: ele gera a configuração local sem exigir alterações permanentes em `config.js`.

O acesso Google está desativado por padrão com `GOOGLE_AUTH_ENABLED=false`. O botão permanece oculto até uma revisão futura da integração.

## Configuração do backend

Em desenvolvimento, as variáveis são lidas de `backend_service/.env`. Na hospedagem, cadastre-as no provedor.

| Variável | Obrigatoriedade | Finalidade |
| --- | --- | --- |
| `SECRET_KEY` | Sempre | Chave aleatória com pelo menos 32 caracteres. |
| `DATABASE_URL` | Sempre | Conexão PostgreSQL; a demonstração configura SQLite automaticamente. |
| `SUPABASE_URL` | Fora da demonstração | URL do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Fora da demonstração | Chave publicável usada pelo backend na autenticação. |
| `SUPABASE_SECRET_KEY` | Recomendada para exclusão | Chave administrativa exclusiva do servidor, usada para remover imediatamente a identidade do Supabase Auth. |
| `FRONTEND_URL` | Recomendado | Origem principal do frontend e destino dos redirecionamentos. |
| `FRONTEND_ORIGINS` | Recomendado | Origens liberadas pelo CORS, separadas por vírgula. |
| `DEMO_MODE` | Não | Use `true` somente na demonstração local. |
| `PROXY_HOPS` | Conforme a hospedagem | Número de proxies confiáveis para `ProxyFix`. |
| `PRIVACY_CONTROLLER` | Publicação legal | Identificação do controlador de dados. |
| `PRIVACY_EMAIL` | Publicação legal | Contato exibido nos documentos de privacidade. |
| `PRIVACY_PUBLICATION_READY` | Publicação legal | Indica se os documentos foram revisados para publicação. |

Nunca versione o arquivo `.env`. Em hospedagens serverless como a Vercel, use a URL do Transaction Pooler do Supabase, normalmente na porta `6543`, de acordo com a configuração do projeto.

## Banco de dados e migrações

O banco de produção é PostgreSQL. Os arquivos em `supabase/migrations/` são ordenados por data e hora e devem ser aplicados uma única vez, do mais antigo para o mais recente.

Antes de alterar um banco real:

1. confirme o projeto Supabase de destino;
2. faça backup dos dados;
3. revise o SQL da migração;
4. aplique as migrações na ordem;
5. execute `backend_service/check_schema.py` apontando `DATABASE_URL` para o banco verificado.

A demonstração usa um esquema SQLite próprio e não executa as migrações PostgreSQL.

## Testes

Depois de instalar `requirements-dev.txt`, execute na raiz:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Os testes do backend usam dados e provedores isolados e não precisam de credenciais reais do Supabase.

`frontend_spa/tests/` também contém testes Node (`*.cjs`) e testes de navegador (`browser_*.py`). Eles são ferramentas de desenvolvimento e podem exigir Node.js, `linkedom`, Playwright e navegadores instalados. Os bundles de CSS e os avatares WebP podem ser recriados com `tools/build_css.py` e `tools/optimize_avatars.py`.

## Publicação

### Frontend na Vercel

1. crie um projeto apontando para este repositório;
2. selecione `frontend_spa` como **Root Directory**;
3. use o preset **Other**, sem comando de build e com **Output Directory** `.`;
4. publique o backend e atualize `API_BASE_URL` em `frontend_spa/config.js`;
5. publique novamente e valide autenticação, navegação e CORS.

### Backend na Vercel

1. crie outro projeto apontando para o mesmo repositório;
2. selecione `backend_service` como **Root Directory**;
3. configure as variáveis de ambiente;
4. aplique as migrações antes de receber tráfego;
5. valide `GET /api/v1/healthz`.

A configuração WSGI usa `vercel_app:app`. Para exclusões de conta que falharem no provedor de identidade, agende a execução de `flask --app app:create_app process-account-deletions`.

## Segurança e privacidade

- tokens de sessão são validados no backend;
- autorização considera perfil, propriedade e vínculo com os dados;
- CORS aceita somente as origens configuradas;
- a chave administrativa do Supabase nunca deve chegar ao frontend;
- rotas da aplicação recebem cabeçalhos de proteção e respostas sem cache;
- os documentos legais precisam ser revisados antes de `PRIVACY_PUBLICATION_READY=true`;
- dados pessoais reais não devem ser inseridos na demonstração.

Esses mecanismos não substituem auditoria de segurança, revisão jurídica ou configuração adequada da infraestrutura.

## Versionamento

A versão atual do produto é `2.0.0-beta.1`:

- `backend_service/backend/__init__.py` é a fonte usada pela API e pelo endpoint `/api/v1/healthz`;
- `backend_service/pyproject.toml` usa a forma PEP 440 equivalente: `2.0.0b1`;
- `frontend_spa/VERSION` registra a versão do frontend;
- os READMEs exibem a mesma versão pública.

Ao preparar um release, atualize esses pontos no mesmo commit. A versão dos documentos legais (`LEGAL_VERSION`) é independente da versão do aplicativo e só deve mudar quando os termos ou a política forem revisados.

## Solução de problemas

- **A demonstração não inicia:** confirme o Python 3.12 e reinstale `backend_service/requirements.txt`.
- **A API informa que falta configuração:** revise `SECRET_KEY`, `DATABASE_URL` e as variáveis do Supabase em `backend_service/.env`.
- **O frontend não alcança a API:** confira `API_BASE_URL`, `FRONTEND_ORIGINS`, a porta e a disponibilidade do backend.
- **A API recusa a origem:** adicione a origem exata do frontend a `FRONTEND_ORIGINS`, sem caminhos.
- **O banco falha:** valide conexão, credenciais, SSL e migrações.
- **A identidade continua pendente após excluir a conta:** configure `SUPABASE_SECRET_KEY` somente no backend e execute a rotina de reprocessamento. Os dados e acessos da LISE já permanecem removidos.

Mais detalhes específicos estão em [`backend_service/README.md`](./backend_service/README.md) e [`frontend_spa/README.md`](./frontend_spa/README.md).
