-- INICIO LISE-PRIVACIDADE-06: migracao ADITIVA. Aplicar depois das migracoes da versao API/SPA.
-- Se 202611080001_privacidade_conta.sql ja foi aplicada, as tabelas/funcoes sao reutilizadas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lise_aceites_legais (
    id SERIAL PRIMARY KEY,
    fk_usuario UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    termos_versao VARCHAR(30) NOT NULL,
    privacidade_versao VARCHAR(30) NOT NULL,
    aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (fk_usuario, termos_versao, privacidade_versao)
);
CREATE INDEX IF NOT EXISTS ix_lise_aceites_legais_fk_usuario ON public.lise_aceites_legais(fk_usuario);

CREATE TABLE IF NOT EXISTS public.lise_pedidos_privacidade (
    id VARCHAR(36) PRIMARY KEY,
    fk_usuario UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    detalhes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido_em TIMESTAMPTZ,
    resposta TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_lise_pedidos_privacidade_fk_usuario ON public.lise_pedidos_privacidade(fk_usuario);
ALTER TABLE public.lise_aceites_legais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lise_pedidos_privacidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lise_aceites_legais, public.lise_pedidos_privacidade FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.lise_aceites_legais_id_seq FROM PUBLIC, anon, authenticated;

-- Mantem a criacao de usuarios; acrescenta o comprovante dos documentos do cadastro.
-- Contas antigas NAO recebem aceite presumido. Aceitam na area Minha conta.
CREATE OR REPLACE FUNCTION lise_private.handle_new_lise_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.usuarios (id_usuario, nome, email, perfil, criado_em)
    VALUES (NEW.id,
        LEFT(COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'nome'), ''), 'Usuário'), 150),
        NEW.email,
        CASE WHEN NEW.raw_user_meta_data->>'perfil' = 'Professor' THEN 'Professor' ELSE 'Aluno' END,
        NOW())
    ON CONFLICT (id_usuario) DO NOTHING;
    IF NEW.raw_user_meta_data->>'termos_versao' IS NOT NULL
       AND NEW.raw_user_meta_data->>'privacidade_versao' IS NOT NULL THEN
        INSERT INTO public.lise_aceites_legais (fk_usuario, termos_versao, privacidade_versao)
        VALUES (NEW.id, LEFT(NEW.raw_user_meta_data->>'termos_versao', 30),
                LEFT(NEW.raw_user_meta_data->>'privacidade_versao', 30))
        ON CONFLICT (fk_usuario, termos_versao, privacidade_versao) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION lise_private.handle_new_lise_user() FROM PUBLIC, anon, authenticated;

COMMIT;
-- FIM LISE-PRIVACIDADE-06
