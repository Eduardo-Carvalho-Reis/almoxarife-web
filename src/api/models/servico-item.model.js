import { calcularSubtotal } from "../../utils/valoresCompra.mjs";

const PRECISAO_SERVICO = { casasValor: 3 };

export default (sequelize, DataTypes) =>
  sequelize.define("ServicoItem", {
    id_servico_item: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    id_servico: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    id_produto: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
    valor_unitario: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    subtotal: {
      type: DataTypes.VIRTUAL,
      get() {
        return calcularSubtotal({ quantidade: this.getDataValue("quantidade") || 0, valor_unitario: this.getDataValue("valor_unitario") || 0 }, PRECISAO_SERVICO);
      }
    }
  }, { tableName: "Servico_Item", timestamps: false, charset: "utf8mb4" })
