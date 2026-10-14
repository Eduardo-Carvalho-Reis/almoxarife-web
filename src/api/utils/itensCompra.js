import { decimalEscalado, formatarDecimal, calcularValorTotal } from "../../utils/valoresCompra.mjs";

export function normalizarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Adicione ao menos um item à compra.");
  }
  const normalizados = itens.map((item) => {
    const idProduto = Number(item?.id_produto);
    if (!Number.isInteger(idProduto) || idProduto <= 0 || idProduto > 4294967295) {
      throw new Error("Produto informado inválido.");
    }
    const quantidade = decimalEscalado(item.quantidade, 3, 10);
    const preco = decimalEscalado(item.valor_unitario, 3, 10);
    if (quantidade <= BigInt(0) || preco <= BigInt(0)) {
      throw new Error("A quantidade e o valor devem ser maiores que zero.");
    }
    // Cada linha mantém seu próprio preço, inclusive para produtos repetidos.
    return {
      id_produto: idProduto,
      quantidade: formatarDecimal(quantidade, 3),
      valor_unitario: formatarDecimal(preco, 3),
    };
  });
  decimalEscalado(calcularValorTotal(normalizados), 4, 12);
  return normalizados;
}
