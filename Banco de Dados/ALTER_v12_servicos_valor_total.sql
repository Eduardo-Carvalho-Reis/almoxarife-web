-- Migração não destrutiva para Serviços.
-- Servico.valor_total já existe; recalcula registros antigos pelos itens.
-- A identidade própria permite preservar linhas do mesmo produto com valores distintos.
ALTER TABLE Servico_Item
    ADD INDEX idx_servico_item_servico (id_servico),
    DROP PRIMARY KEY,
    ADD COLUMN id_servico_item INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    MODIFY COLUMN valor_unitario DECIMAL(12,3) NOT NULL;

START TRANSACTION;
UPDATE Servico s
LEFT JOIN (
    SELECT id_servico, SUM(ROUND(quantidade * valor_unitario, 2)) AS total
    FROM Servico_Item
    GROUP BY id_servico
) itens ON itens.id_servico = s.id_servico
SET s.valor_total = COALESCE(itens.total, 0.00);
COMMIT;
