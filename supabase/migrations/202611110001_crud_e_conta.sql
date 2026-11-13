-- LISE 2.0.0-beta.1: CRUD, arquivos e exclusao direta de conta.
-- Revisar com Livia. Nao executado automaticamente pela aplicacao.
-- Somente adicoes e preenchimentos; preserva notas, partidas e vinculos existentes.
BEGIN;
ALTER TABLE public.termos ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMPTZ;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS matriculas_abertas BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.trilhas ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMPTZ;
ALTER TABLE public.trilhas ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.trilha_termos ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;
WITH positions AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY fk_trilha ORDER BY id) AS pos
  FROM public.trilha_termos
) UPDATE public.trilha_termos AS t SET ordem=p.pos FROM positions p WHERE t.id=p.id AND t.ordem=0;
ALTER TABLE public.turma_trilha ADD COLUMN IF NOT EXISTS desvinculada_em TIMESTAMPTZ;
ALTER TABLE public.turma_trilha ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.lise_colecoes ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.lise_sessoes ADD COLUMN IF NOT EXISTS dispositivo VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE public.lise_sessoes ADD COLUMN IF NOT EXISTS ultimo_uso_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.lise_avaliacoes ADD COLUMN IF NOT EXISTS revisao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.lise_avaliacoes ADD COLUMN IF NOT EXISTS janela_versao INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.lise_avaliacoes ADD COLUMN IF NOT EXISTS historico_janelas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.lise_avaliacao_sessoes ADD COLUMN IF NOT EXISTS janela_versao INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.lise_crud_operacoes (
 id VARCHAR(64) PRIMARY KEY,
 fk_usuario UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
 assinatura VARCHAR(64) NOT NULL,
 resposta JSONB,
 status_http INTEGER,
 criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_lise_crud_operacoes_fk_usuario ON public.lise_crud_operacoes(fk_usuario);
CREATE TABLE IF NOT EXISTS public.lise_exclusoes_auth (
 id VARCHAR(36) PRIMARY KEY,
 criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 tentativa_em TIMESTAMPTZ,
 tentativas INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.lise_crud_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lise_exclusoes_auth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lise_crud_operacoes, public.lise_exclusoes_auth FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lise_crud_operacoes, public.lise_exclusoes_auth TO service_role;
COMMIT;
