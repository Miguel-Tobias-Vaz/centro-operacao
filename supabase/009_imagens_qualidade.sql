-- Limite de upload um pouco maior para GIFs leves + imagens WebP de boa qualidade.
-- A compressão real continua a ser feita no browser (imagem-otimizar.js).

UPDATE storage.buckets
SET file_size_limit = 3145728
WHERE id IN ('perfis-midia', 'modulos-imagens');
