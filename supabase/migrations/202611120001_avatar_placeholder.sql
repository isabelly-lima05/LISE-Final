-- Novas contas começam sem mascote escolhido; perfis existentes não são alterados.
BEGIN;

ALTER TABLE public.usuarios
    ALTER COLUMN avatar SET DEFAULT 'placeholder';

COMMIT;
