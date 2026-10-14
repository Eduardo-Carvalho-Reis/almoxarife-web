import { test } from "node:test";
import assert from "node:assert/strict";
import { decimalEscalado, formatarDecimal, calcularSubtotal, calcularValorTotal } from "../../utils/valoresCompra.mjs";

const item = (quantidade, valor_unitario, id_produto = 1) => ({ id_produto, quantidade, valor_unitario });

test("serviço com um item calcula subtotal e total", () => {
  const precisao = { casasValor: 3 };
  assert.equal(calcularSubtotal(item(10, "6,780"), precisao), "67.80");
  assert.equal(calcularValorTotal([item(10, "6,780")], precisao), "67.80");
});

test("serviço com vários itens soma preços próprios", () => {
  assert.equal(calcularValorTotal([item(10, 6), item(5, "2,500", 2), item(2, "6,790", 3)], { casasValor: 3 }), "86.08");
});

test("valores inteiros, uma e duas casas são aceitos; terceira casa é rejeitada", () => {
  assert.equal(formatarDecimal(decimalEscalado("6", 3, 10), 3), "6.000");
  assert.equal(formatarDecimal(decimalEscalado("6,7", 3, 10), 3), "6.700");
  assert.equal(formatarDecimal(decimalEscalado("6,78", 3, 10), 3), "6.780");
  assert.equal(formatarDecimal(decimalEscalado("6,785", 3, 10), 3), "6.785");
  assert.throws(() => decimalEscalado("6,7851", 3, 10));
});
