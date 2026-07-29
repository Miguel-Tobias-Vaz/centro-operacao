-- Posição de enquadramento das imagens (object-position / background-position).
-- Formato: "X% Y%" (ex.: "50% 30%"). Default: centro.

alter table public.profiles
    add column if not exists avatar_pos text default '50% 50%',
    add column if not exists fundo_pos text default '50% 50%',
    add column if not exists barra_esq_pos text default '50% 50%',
    add column if not exists barra_dir_pos text default '50% 50%';

alter table public.modulos
    add column if not exists imagem_pos text default '50% 50%';
