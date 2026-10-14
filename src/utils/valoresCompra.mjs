/* global BigInt */
// Quantidade e valores monetários novos aceitam até três casas.
// Aritmética inteira; cada subtotal é arredondado para centavos (meio para cima).
export function decimalEscalado(valor, casas, digitos) {
  if (typeof valor !== "string" && typeof valor !== "number") {
    throw new Error("Informe quantidade e preço válidos.");
  }
  const texto = String(valor).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(texto)) {
    throw new Error("Informe quantidade e preço válidos.");
  }
  const [inteiro, fracao = ""] = texto.split(".");
  if (fracao.length > casas && /[1-9]/.test(fracao.slice(casas))) {
    throw new Error(`O valor deve ter no máximo ${casas} casas decimais.`);
  }
  const escalado = BigInt(inteiro + fracao.slice(0, casas).padEnd(casas, "0"));
  if (digitos && escalado >= BigInt(10) ** BigInt(digitos)) {
    throw new Error("Valor acima do limite permitido.");
  }
  return escalado;
}

export function formatarDecimal(valor, casas) {
  const texto = valor.toString().padStart(casas + 1, "0");
  return `${texto.slice(0, -casas)}.${texto.slice(-casas)}`;
}

export function subtotalCentavos(item, { casasValor = 3 } = {}) {
  const quantidade = decimalEscalado(item.quantidade, 3, 10);
  const preco = decimalEscalado(item.valor_unitario, casasValor, 10);
  // quantidade está em milésimos e o preço em centésimos: produto em 1e5;
  // para centavos, divide por 1e3 e arredonda meio para cima.
  const divisor = BigInt(10) ** BigInt(casasValor + 1);
  return (quantidade * preco + divisor / BigInt(2)) / divisor;
}

export function calcularSubtotal(item, opcoes = {}) {
  return formatarDecimal(subtotalCentavos(item, opcoes), 2);
}

export function calcularValorTotal(itens = [], opcoes = {}) {
  return formatarDecimal(itens.reduce((total, item) => total + subtotalCentavos(item, opcoes), BigInt(0)), 2);
}

// Prévia enquanto o usuário ainda preenche os campos; o backend valida ao salvar.
export function previaValorTotal(itens, opcoes = {}) {
  try {
    return calcularValorTotal(itens, opcoes);
  } catch {
    return null;
  }
}

export const formatarMoedaCompra = (valor) => valor == null ? "—" :
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
