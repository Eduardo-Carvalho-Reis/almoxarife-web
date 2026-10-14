import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarItens } from "../utils/itensCompra.js";
import { calcularSubtotal, calcularValorTotal } from "../../utils/valoresCompra.mjs";

const item = (quantidade, valor_unitario, id_produto = 1) => ({ id_produto, quantidade, valor_unitario });

test("uma compra com um produto usa exclusivamente o preço do item", () => {
  assert.equal(calcularValorTotal(normalizarItens([
    { ...item(100, 6), produto: { preco_custo: 99 } },
  ])), "600.00");
});

test("vários produtos e linhas do mesmo produto mantêm os preços: R$ 999", () => {
  const itens = normalizarItens([item(100, 6), item(50, 5.5, 2), item(20, 6.2)]);
  assert.equal(itens.length, 3);
  assert.deepEqual(itens.map(calcularSubtotal), ["600.00", "275.00", "124.00"]);
  assert.equal(calcularValorTotal(itens), "999.00");
});

test("decimais e arredondamento de cada linha não acumulam erros binários", () => {
  const itens = normalizarItens([item("0.1", "0.2"), item("1", "1.01"), item("1", "1.01")]);
  assert.deepEqual(itens.map(calcularSubtotal), ["0.02", "1.01", "1.01"]);
  assert.equal(calcularValorTotal(itens), "2.04");
  assert.equal(calcularSubtotal(item("0.001", "5.0000")), "0.01");
});

test("preço 6,78, 6,79 ou 6,785 preserva até três casas e totaliza corretamente", () => {
  for (const [preco, persistido, total] of [["6,78", "6.780", "678.00"], ["6.79", "6.790", "679.00"], ["6,785", "6.785", "678.50"]]) {
    const itens = normalizarItens([item(100, preco)]);
    assert.equal(itens[0].valor_unitario, persistido);
    assert.equal(calcularValorTotal(itens), total);
  }
});

for (const [nome, itens] of [
  ["compra vazia", []],
  ["zero", [item(0, 1)]],
  ["negativo", [item(1, -1)]],
  ["infinito", [item(Infinity, 1)]],
  ["preço ausente", [item(1, null)]],
  ["quantidade com excesso de casas", [item("0.0001", 1)]],
  ["preço com quarta casa decimal", [item(1, "6.7851")]],
  ["preço com quarta casa decimal após vírgula", [item(1, "6,7851")]],
  ["limite da quantidade", [item("10000000", 1)]],
  ["limite do total", [item("9999999.999", "99999999.999")]],
]) {
  test(`rejeita ${nome} antes de persistir`, () => assert.throws(() => normalizarItens(itens)));
}
