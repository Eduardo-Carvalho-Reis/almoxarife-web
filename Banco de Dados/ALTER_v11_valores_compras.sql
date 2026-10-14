-- Migração não destrutiva. Execute uma única vez antes de iniciar a nova API.
-- O total já existe: reaproveita Compra.valor_total_pedido DECIMAL(12,4).
-- Identidade por linha permite o mesmo produto com preços distintos.
-- Mantém um índice para a FK da compra ao substituir a chave primária antiga.
ALTER TABLE Item_Compra
    ADD INDEX idx_item_compra_pedido (id_compra),
    DROP PRIMARY KEY,
    ADD COLUMN id_item_compra INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    MODIFY COLUMN preco_unitario_acordado DECIMAL(12,4) NOT NULL;

-- Mesma regra do backend: arredonda cada subtotal em centavos, depois soma.
-- Preserva quantidades e preços históricos; não consulta Produtos.
START TRANSACTION;
UPDATE Compra c
LEFT JOIN (
    SELECT id_compra, SUM(ROUND(quantidade * preco_unitario_acordado, 2)) AS total
    FROM Item_Compra
    GROUP BY id_compra
) itens ON itens.id_compra = c.id_compra
SET c.valor_total_pedido = COALESCE(itens.total, 0);
COMMIT;
