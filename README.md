# LISE — Biologia Por Etimologia

LISE É Uma Plataforma Educacional Para Explorar A Etimologia De Termos De Biologia, Relacionar Raízes Gregas E Latinas A Conceitos Científicos E Praticar O Conteúdo Com Atividades Interativas. O Projeto Combina Uma Interface Web Estática, Uma API Em Flask E Um Banco PostgreSQL Hospedado No Supabase.

> **Estado Do Projeto:** A Versão Da API Está Identificada Como `2.0.0b1` (`2.0.0-beta.1`). A Demonstração Local Usa Dados Fictícios E Não Substitui Uma Instalação De Produção.

## Conteúdo

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura Do Repositório](#estrutura-do-repositório)
- [Demonstração Local](#demonstração-local)
- [Execução Em Desenvolvimento](#execução-em-desenvolvimento)
- [Configuração Do Backend](#configuração-do-backend)
- [Banco De Dados E Migrações](#banco-de-dados-e-migrações)
- [Testes](#testes)
- [Publicação Na Vercel](#publicação-na-vercel)
- [Segurança E Privacidade](#segurança-e-privacidade)
- [Tecnologias](#tecnologias)
- [Solução De Problemas](#solução-de-problemas)

## Visão Geral

A LISE Foi Pensada Para O Estudo De Biologia Por Meio Da Origem E Da Formação Das Palavras. O Aplicativo Apresenta Termos, Definições E Radicais Etimológicos, E Oferece Atividades Para Ajudar A Fixar Essas Relações.

Há Dois Perfis Principais:

- **Aluno:** Explora Conteúdo, Participa De Atividades, Acompanha O Progresso E Pode Integrar Turmas E Trilhas.
- **Professor:** Organiza Turmas, Trilhas E Conteúdos, Acompanha A Experiência De Aprendizagem E Gerencia Os Recursos Disponíveis Para Suas Turmas.

O Frontend É Uma Aplicação De Página Única (SPA) Feita Com JavaScript E CSS, Sem Etapa De Compilação. O Backend Expõe Uma API JSON, Valida A Sessão E As Permissões E Acessa O Banco De Dados. O Supabase É Usado Para Persistência PostgreSQL E Autenticação.

## Funcionalidades

- **Aprendizagem De Etimologia:** Consulta De Termos Biológicos, Definições, Áreas E Radicais Com Seus Significados E Referências.
- **Atividades Interativas:** Jogos E Exercícios De Reconhecimento Etimológico, Quiz De Biologia, Família De Palavras E Memória.
- **Acompanhamento Do Progresso:** Registro De Atividades, Pontuação, XP, Nível, Sequência De Dias De Estudo E Progresso Em Trilhas.
- **Turmas E Trilhas:** Recursos Para Organização De Estudantes E Conteúdos, Matrícula Por Código E Associação De Trilhas Às Turmas.
- **Gestão De Conteúdo:** Operações De Criação, Leitura, Edição, Arquivamento E Restauração Com Verificações De Acesso E Revisão.
- **Conta E Privacidade:** Gerenciamento De Sessões, Solicitação De Exclusão De Conta E Páginas De Privacidade, Termos De Uso E Cookies.
- **Personalização:** Avatares E Interface Responsiva Com Componentes E Estilos Organizados Por Área.

## Arquitetura

```text
Navegador
  └── frontend_spa/ (HTML, CSS, JavaScript)
        └── API HTTPS /api/v1
              ├── Flask (autorização, validação e regras de negócio)
              ├── Supabase Auth (identidade e autenticação)
              └── PostgreSQL Supabase (dados da aplicação)
```

O Frontend E A API Podem Ser Publicados Como Projetos Separados Na Vercel. Em Desenvolvimento, Também É Possível Servir O Frontend Separadamente Ou Usar O Servidor Integrado De Demonstração.

As Sessões Da Aplicação São Mantidas No Banco E Associadas A Um Token Bearer. O Backend Consulta A Sessão E O Usuário Antes De Atender Rotas Protegidas. O Acesso A Dados De Turmas, Trilhas E Conteúdos É Limitado Pelas Regras De Propriedade, Matrícula E Papel Do Usuário.

## Estrutura Do Repositório

| Caminho | Responsabilidade |
| --- | --- |
| `run_demo.py` | Cria E Executa A Demonstração Integrada Com Banco SQLite Local E Dados Fictícios. |
| `INICIAR_DEMO.bat` | Atalho Para Windows Que Cria Um Ambiente Virtual, Instala As Dependências E Inicia A Demonstração. |
| `frontend_spa/` | Aplicação Web Estática, Recursos Visuais, Configuração Da API E Testes De Interface. |
| `backend_service/app.py` | Fábrica Da Aplicação Flask, Configuração De Banco, Sessões, CORS E Cabeçalhos. |
| `backend_service/vercel_app.py` | Ponto De Entrada Da Aplicação Backend Para A Vercel. |
| `backend_service/backend/` | Rotas De API, Modelos, Regras De Acesso, Serviços E Recursos De Conta, CRUD E Privacidade. |
| `backend_service/tests/` | Testes Da API, Regras De CRUD, Privacidade, Jogos E Segurança. |
| `backend_service/templates/` | Conteúdo HTML Usado Nas Páginas Legais Servidas Pelo Backend. |
| `supabase/migrations/` | Migrações SQL Do Banco, Em Ordem Cronológica Pelo Nome Do Arquivo. |
| `supabase/email_recuperacao.html` | Modelo De E-Mail De Recuperação De Acesso. |
| `tools/` | Utilitários De Configuração Da API E Exportação De Conteúdo Legal. |
| `pytest.ini` | Configuração Do Pytest Para Executar Os Testes Do Backend A Partir Da Raiz. |

O Frontend É Dividido Em Módulos: `components.js`, `navigation.js`, `activities.js`, `screens.js`, `interactions.js`, `crud.js` E `app.js`. A Folha De Estilos De Entrada É `app.css`, Que Carrega Os Estilos Da Pasta `styles/`.

## Demonstração Local

A Forma Mais Rápida De Conhecer A Aplicação No Windows É Executar `INICIAR_DEMO.bat`. O Script Cria `.venv` Se Necessário, Usa Python 3.12, Instala As Dependências Do Backend E Executa `run_demo.py`.

Também É Possível Iniciar A Demonstração Manualmente:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend_service\requirements.txt
.\.venv\Scripts\python.exe run_demo.py
```

Depois, Acesse `http://127.0.0.1:5001`.

**Contas Fictícias Da Demonstração:**

| Perfil | E-Mail | Senha |
| --- | --- | --- |
| Aluno | `aluno@lise.demo` | `LiseDemo123!` |
| Professor | `professor@lise.demo` | `LiseDemo123!` |

A Demonstração Cria O Banco SQLite `demo_privacidade.db` Na Pasta Raiz E Insere Dados De Exemplo. O Servidor Escuta Apenas Em `127.0.0.1`. As Contas E A Senha São Exclusivas Para Essa Demonstração E Não Devem Ser Reutilizadas Em Um Ambiente Real. O Cadastro E A Autenticação Real Do Supabase Não Estão Disponíveis Nesse Modo.

Para Escolher Outra Porta, Informe O Argumento `--port`, Por Exemplo:

```powershell
.\.venv\Scripts\python.exe run_demo.py --port 5002
```

## Execução Em Desenvolvimento

Para Testar O Frontend E O Backend Separadamente, Configure O Backend E Inicie Cada Servidor Em Um Terminal Diferente.

1. **Prepare O Backend:** Instale Python 3.12 E Crie `backend_service\.env` A Partir De `backend_service\.env.example`.
2. **Instale As Dependências:** Na Raiz Do Projeto, Execute:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r backend_service\requirements-dev.txt
   ```

3. **Inicie A API:** No Terminal Do Backend, Execute:

   ```powershell
   Set-Location backend_service
   ..\.venv\Scripts\python.exe app.py
   ```

   A API Local Escuta Em `http://127.0.0.1:5000`.

4. **Configure O Frontend:** Em `frontend_spa\config.js`, Defina `API_BASE_URL` Como `http://127.0.0.1:5000`. O Valor Deve Ser A Origem Da API, Sem O Sufixo `/api/v1` E Sem Barra Final.
5. **Sirva O Frontend:** Em Outro Terminal, Execute:

   ```powershell
   Set-Location frontend_spa
   py -3.12 -m http.server 5500
   ```

6. **Acesse A Interface:** Abra `http://127.0.0.1:5500`.

Para A Demonstração Simples, Prefira `run_demo.py`: Ela Serve A SPA E A API Na Mesma Origem, Gera Uma Configuração De Frontend Local E Não Exige Alterar `config.js`.

## Configuração Do Backend

As Variáveis São Lidas De `backend_service\.env` Em Desenvolvimento E Das Configurações De Ambiente Do Provedor Em Produção.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `SECRET_KEY` | Sim | Chave Aleatória De Pelo Menos 32 Caracteres Para A Aplicação Flask. |
| `DATABASE_URL` | Sim | URL De Conexão PostgreSQL; A Demonstração Usa SQLite Local. |
| `SUPABASE_URL` | Sim Fora Da Demonstração | URL Do Projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Sim Fora Da Demonstração | Chave Publicável Usada Pelo Backend Para A Integração De Autenticação. |
| `SUPABASE_SECRET_KEY` | Para Exclusão De Conta | Chave Administrativa Necessária Para Remover A Identidade Do Supabase Auth; Deve Existir Somente No Backend. |
| `FRONTEND_URL` | Recomendado | Origem Principal Do Frontend, Usada Em Redirecionamentos. |
| `FRONTEND_ORIGINS` | Recomendado | Lista Separada Por Vírgulas De Origens Permitidas Para CORS. |
| `DEMO_MODE` | Não | Use `true` Somente Na Demonstração Local; O Padrão É `false`. |
| `PROXY_HOPS` | Conforme Hospedagem | Quantidade De Proxies Confiáveis Quando `ProxyFix` For Necessário. |
| `PRIVACY_CONTROLLER` | Conforme Publicação Legal | Identificação Do Controlador De Dados Nos Documentos De Privacidade. |
| `PRIVACY_EMAIL` | Conforme Publicação Legal | Contato De Privacidade Exibido Nos Documentos. |
| `PRIVACY_PUBLICATION_READY` | Conforme Publicação Legal | Indica Se Os Documentos Legais Foram Revisados E Estão Prontos Para Publicação. |

**Importante:** Não Envie O Arquivo `.env` Para O Repositório. Use Segredos Fortes E Exclusivos Em Produção. A URL `DATABASE_URL` Do Supabase Deve Usar O Modo Adequado À Hospedagem; O README Do Backend Recomenda O Transaction Pooler Na Porta `6543` Para A Vercel.

## Banco De Dados E Migrações

O Banco Principal É PostgreSQL No Supabase. As Migrações Em `supabase/migrations/` Estão Nomeadas Com Data E Hora E Devem Ser Aplicadas Em Ordem Cronológica, Uma Única Vez Em Cada Banco. Antes De Aplicar Migrações Em Produção, Revise O SQL, Faça Backup E Confirme O Projeto Supabase De Destino.

As Migrações Cobrem A Integração Inicial Da API, Dados E Atividades, Curadoria Etimológica, Taxonomia, Perfis, Janelas De Avaliação, Privacidade, Gerenciamento CRUD E Avatar Padrão. A Demonstração Local Usa Uma Inicialização SQLite Específica E Não Aplica As Migrações PostgreSQL.

O Backend Inclui `check_schema.py` Para Verificar O Esquema Esperado. Execute-o Com O Ambiente Do Backend Configurado E Aponte `DATABASE_URL` Para O Banco Que Deseja Verificar. Não Use A Demonstração Como Banco De Dados De Produção.

## Testes

Os Testes Python Do Backend Podem Ser Executados Na Raiz Do Projeto:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

O `pytest.ini` Define `backend_service/tests` Como Diretório De Testes E Adiciona `backend_service` Ao Caminho De Importação. Os Testes Usam Dependências Substituídas E Dados Isolados; Não Devem Exigir Credenciais Reais Do Supabase.

Há Também Testes De Frontend Em `frontend_spa/tests/`, Incluindo Arquivos Node (`*.cjs`) E Testes De Navegador (`browser_*.py`). Esses Testes São Ferramentas De Desenvolvimento E Podem Exigir Node.js, Playwright E Navegadores Instalados; O Projeto Não Mantém Um `package.json` Para A Aplicação Estática.

## Publicação Na Vercel

O Frontend E O Backend São Publicados Como Projetos Separados:

### Frontend

1. **Crie Um Projeto Vercel Apontando Para Este Repositório.**
2. **Defina `frontend_spa` Como Root Directory.**
3. **Use O Preset `Other`, Sem Comando De Build E Com Output Directory `.`.**
4. **Confirme As Regras De Navegação SPA E Cabeçalhos Em `frontend_spa\vercel.json`.**
5. **Depois De Publicar A API, Atualize `API_BASE_URL` Em `frontend_spa\config.js` Com A Origem Do Backend, Sem `/api/v1` E Sem Barra Final, E Publique Novamente.**

### Backend

1. **Crie Outro Projeto Vercel Para O Mesmo Repositório.**
2. **Defina `backend_service` Como Root Directory.**
3. **Configure As Variáveis De Ambiente Da Seção [Configuração Do Backend](#configuração-do-backend).**
4. **Use `vercel_app:app` Como Entrada WSGI; A Configuração De Função Está Em `backend_service\vercel.json`.**
5. **Aplique As Migrações Supabase Antes De Direcionar Tráfego Para A API.**
6. **Verifique A Saúde Da API Em `/api/v1/healthz`.**

O Backend Espera As Origens Do Frontend Em `FRONTEND_ORIGINS` Para Liberar CORS. Configure A URL Pública Do Frontend Em `FRONTEND_URL`. Para Instruções Operacionais Complementares, Consulte [backend_service/README.md](./backend_service/README.md) E O Guia De Implantação Referenciado Nele.

## Segurança E Privacidade

- **Tokens E Sessões:** A API Recebe O Token De Autenticação E Confere A Sessão No Backend.
- **Autorização:** Rotas Protegidas Conferem O Perfil, A Propriedade E O Vínculo Com Turmas, Trilhas E Dados Solicitados.
- **CORS:** As Origens Permitidas São Explicitamente Configuradas; Não Use Uma Lista Aberta Em Produção.
- **Chaves Administrativas:** `SUPABASE_SECRET_KEY` É Exclusiva Do Servidor E Nunca Deve Ser Incorporada Ao Frontend.
- **Cabeçalhos:** A API Define Cabeçalhos De Proteção E Respostas Sem Cache Para Rotas Da Aplicação.
- **Exclusão De Conta:** A Exclusão Do Usuário No Supabase Auth Requer A Chave Administrativa No Backend; Falhas Pendentes Podem Ser Reprocessadas Pelo Comando Flask `process-account-deletions`.
- **Documentos Legais:** Revise Os Dados Do Controlador, Contato E Conteúdo Legal Antes De Ativar A Publicação Em Um Ambiente Real.
- **Demonstração:** Contém Contas E Conteúdo Fictícios; Não Insira Dados Pessoais Ou Reais Nesse Modo.

Este Texto Descreve Os Mecanismos Implementados No Projeto E Não Substitui Uma Auditoria De Segurança, Uma Revisão Jurídica Ou A Configuração Segura Da Infraestrutura.

## Tecnologias

- **Frontend:** HTML, CSS E JavaScript Sem Framework De Build.
- **Backend:** Python 3.12, Flask E SQLAlchemy.
- **Banco De Dados:** PostgreSQL, Com SQLite Para A Demonstração Local.
- **Autenticação:** Supabase Auth.
- **Hospedagem:** Vercel Para Frontend E API; Supabase Para Banco E Serviços De Autenticação.
- **Testes:** Pytest, Node.js E Ferramentas De Teste De Navegador.

As Versões Python Do Backend Estão Fixadas Em `backend_service\requirements.txt`; As Dependências De Desenvolvimento Estão Em `backend_service\requirements-dev.txt`.

## Solução De Problemas

- **A Demonstração Não Inicia:** Confirme Que Python 3.12 Está Instalado E Que As Dependências Foram Instaladas Sem Erros.
- **A API Informa Que Falta `SECRET_KEY` Ou `DATABASE_URL`:** Preencha `backend_service\.env` Para A Execução Separada. `run_demo.py` Configura Esses Valores Para A Demonstração.
- **O Frontend Não Consegue Acessar A API:** Confira `API_BASE_URL`, `FRONTEND_ORIGINS`, A Porta E A Disponibilidade Da API.
- **A API Recusa Uma Origem Do Navegador:** Adicione A Origem Exata Do Frontend A `FRONTEND_ORIGINS`, Sem Caminhos.
- **A API Falha Ao Acessar O Banco:** Verifique `DATABASE_URL`, A Conectividade, As Credenciais E Se Todas As Migrações Foram Aplicadas.
- **A Exclusão De Conta Não Está Disponível:** Verifique Se `SUPABASE_SECRET_KEY` Está Configurada Somente No Backend E Se A Rotina De Processamento De Exclusões Pendentes Foi Agendada.
