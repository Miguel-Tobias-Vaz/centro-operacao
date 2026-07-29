-- Limite de upload 15 MB (GIFs de fundo/perfil; fotos continuam a ser comprimidas no browser).

UPDATE storage.buckets
SET file_size_limit = 15728640
WHERE id IN ('perfis-midia', 'modulos-imagens');
