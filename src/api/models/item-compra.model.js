import { calcularSubtotal } from "../../utils/valoresCompra.mjs";

/**
 * Define o modelo Sequelize para a tabela Item_Compra.
 * Cada linha tem identidade própria para preservar preços distintos do mesmo produto.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {import("sequelize").DataTypes} DataTypes
 */
export default (sequelize, DataTypes) => {
  const ItemCompra = sequelize.define("ItemCompra", {
    id_item_compra: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    id_compra: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    id_produto: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false
    },
    subtotal: {
      type: DataTypes.VIRTUAL,
      get() {
        return calcularSubtotal(this);
      }
    },
    valor_unitario: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      field: "preco_unitario_acordado"
    }
  }, {
    tableName: "Item_Compra",
    timestamps: false,
    charset: "utf8mb4"
  })

  return ItemCompra
}
