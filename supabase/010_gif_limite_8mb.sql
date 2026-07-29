-- Limite de upload 8 MB (GIFs maiores; fotos continuam a ser comprimidas no browser).

UPDATE storage.buckets
SET file_size_limit = 8388608
WHERE id IN ('perfis-midia', 'modulos-imagens');
