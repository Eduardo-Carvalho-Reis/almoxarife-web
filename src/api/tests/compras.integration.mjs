import "../config/load-env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

// Somente este banco novo e aleatório recebe fixtures e é removido ao terminar.
// Nunca executa USE/DROP do script de instalação, nem altera o banco configurado.
test("compras, migração e cards com MySQL real", async (t) => {
  const nomeTeste = `almox_compras_test_${randomUUID().replaceAll("-", "")}`;
  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
  });
  let criado = false;
  let db;
  try {
    await conexao.query(`CREATE DATABASE \`${nomeTeste}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    criado = true;
    await conexao.query(`USE \`${nomeTeste}\``);
    const sql = await readFile(new URL("../../../Banco de Dados/CREATE_DB_ALMOXARIFADO_GILFER_v8.sql", import.meta.url), "utf8");
    const comandos = sql.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim());
    await conexao.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const comando of comandos.filter((s) => /^CREATE TABLE /i.test(s))) await conexao.query(comando);
    await conexao.query("SET FOREIGN_KEY_CHECKS = 1");
    process.env.DB_NAME = nomeTeste;
    db = (await import("../models/index.js")).default;
    const compras = await import("../services/compra.service.js");
    const servicos = await import("../services/servico.service.js");
    const manutencoes = await import("../services/manutencao.service.js");
    const { cadastrarSaida, listarProdutosComSaidas } = await import("../services/saida.service.js");
    const { calcularTotaisMovimentacao, listarAnosMovimentacao } = await import("../services/almoxarifado.service.js");

    const endereco = await db.EnderecoAlmoxarifado.create({ logradouro: "Teste", numero: "1", bairro: "Teste", cidade: "Teste", estado: "SP", cep: "00000000" });
    const almox = await db.Almoxarifado.create({ nome: "Teste", email: "almox@example.com", id_endereco: endereco.id_endereco });
    const outro = await db.Almoxarifado.create({ nome: "Outro", email: "outro@example.com", id_endereco: endereco.id_endereco });
    const cargo = await db.Cargo.create({ nome_cargo: "Teste" });
    const funcionario = await db.Funcionario.create({ nome: "Teste", cpf: "00000000000", email: "func@example.com", id_cargo: cargo.id_cargo });
    const fornecedor = await db.Fornecedor.create({ razao_social: "Teste", cnpj: "00000000000000", email: "forn@example.com" });
    const gasolina = await db.Produto.create({ nome: "Gasolina", preco_custo: 99, unidade_medida: "LT", estoque_minimo: 0 });
    const diesel = await db.Produto.create({ nome: "Diesel", preco_custo: 88, unidade_medida: "LT", estoque_minimo: 0 });
    const material = await db.Produto.create({ nome: "Cimento", preco_custo: 77, unidade_medida: "SC", estoque_minimo: 0 });
    let nota = 0;
    const item = (quantidade, valor_unitario, id_produto = gasolina.id_produto) => ({ id_produto, quantidade, valor_unitario });
    const dados = (itens, extras = {}) => ({
      id_fornecedor: fornecedor.id_fornecedor, id_funcionario_comprador: funcionario.id_funcionario,
      cod_almoxarifado_destino: almox.cod_almoxarifado, numero_nota_fiscal: `TESTE-${++nota}`,
      data_compra: "2026-10-13", itens, ...extras,
    });
    const card = async (periodo = {}) => (await calcularTotaisMovimentacao(almox.cod_almoxarifado, periodo)).valor_abastecimento_tanque;
    const criar = (itens, extras) => compras.cadastrarCompra(dados(itens, extras));

    await t.test("migração preserva itens antigos e corrige o total existente", async () => {
      const antiga = await db.Compra.create({ ...dados([]), status: "CANCELADO", valor_total: 0 });
      await conexao.query("INSERT INTO Item_Compra (id_compra,id_produto,quantidade,preco_unitario_acordado) VALUES (?,?,?,?)", [antiga.id_compra, gasolina.id_produto, "1.000", "1.0050"]);
      const migracao = await readFile(new URL("../../../Banco de Dados/ALTER_v11_valores_compras.sql", import.meta.url), "utf8");
      for (const comando of migracao.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean)) await conexao.query(comando);
      const migracaoServicos = await readFile(new URL("../../../Banco de Dados/ALTER_v12_servicos_valor_total.sql", import.meta.url), "utf8");
      for (const comando of migracaoServicos.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean)) await conexao.query(comando);
      const salva = await compras.buscarCompraPorId(antiga.id_compra);
      assert.equal(salva.valor_total, "1.0100");
      assert.equal(salva.itens.length, 1);
      assert.equal(salva.itens[0].valor_unitario, "1.0050");
      assert.ok(salva.itens[0].id_item_compra);
      assert.equal(await card(), 0);
    });

    let primeira;
    await t.test("nova compra pendente persiste R$ 1.000 e atualiza o card sem recebimento", async () => {
      primeira = await criar([item(200, 5)], { valor_total: 999999 });
      assert.equal(primeira.valor_total, "1000.0000");
      assert.equal(primeira.status, "PENDENTE");
      assert.equal(primeira.itens[0].subtotal, "1000.00");
      assert.equal(await card(), 1000);
      assert.equal(await db.Estoque.count(), 0);
      assert.equal(await card(), 1000);
    });

    await t.test("recebimento e saída atualizam estoque sem alterar o card", async () => {
      await compras.confirmarRecebimento(primeira.id_compra);
      assert.equal(await card(), 1000);
      await cadastrarSaida({ cod_almoxarifado_origem: almox.cod_almoxarifado, id_funcionario_responsavel: funcionario.id_funcionario, tipo_saida: "CONSUMO", data_saida: "2026-10-13", itens: [{ id_produto: gasolina.id_produto, quantidade: 100 }] });
      assert.equal(await card(), 1000);
      assert.equal(Number((await db.Estoque.findOne()).quantidade), 100);
      await assert.rejects(compras.confirmarRecebimento(primeira.id_compra));
      assert.equal(await card(), 1000);
    });

    await t.test("lista no filtro apenas produtos que ja tiveram saida", async () => {
      const produtosComSaida = await listarProdutosComSaidas(almox.cod_almoxarifado);
      const ids = produtosComSaida.map((produto) => produto.id_produto);
      assert.ok(ids.includes(gasolina.id_produto));
      assert.ok(!ids.includes(diesel.id_produto));
      assert.ok(!ids.includes(material.id_produto));
    });

    await t.test("segunda compra com outro preço aumenta apenas R$ 500; nota repetida é rejeitada", async () => {
      const payload = dados([item(50, 10)]);
      await compras.cadastrarCompra(payload);
      assert.equal(await card(), 1500);
      await assert.rejects(compras.cadastrarCompra(payload));
      await db.Produto.update({ preco_custo: 999 }, { where: { id_produto: gasolina.id_produto } });
      assert.equal(await card(), 1500);
      await cadastrarSaida({ cod_almoxarifado_origem: almox.cod_almoxarifado, id_funcionario_responsavel: funcionario.id_funcionario, tipo_saida: "CONSUMO", data_saida: "2026-10-13", itens: [{ id_produto: gasolina.id_produto, quantidade: 10 }] });
      assert.equal(await card(), 1500);
    });

    await t.test("três linhas, incluindo gasolina repetida, persistem e somam R$ 999", async () => {
      const compra = await criar([item(100, 6), item(50, 5.5, diesel.id_produto), item(20, 6.2)]);
      assert.equal(compra.itens.length, 3);
      assert.equal(new Set(compra.itens.map((i) => i.id_item_compra)).size, 3);
      assert.equal(compra.valor_total, "999.0000");
      assert.equal(compra.itens.reduce((total, i) => total + Number(i.subtotal), 0), 999);
      assert.equal(await card(), 2499);
      const editada = await compras.editarCompra(compra.id_compra, { itens: [item(10, 6), item(10, 7)] });
      assert.equal(editada.valor_total, "130.0000");
      assert.equal(await card(), 1630);
      await compras.excluirCompra(compra.id_compra);
      assert.equal(await card(), 1500);
    });

    await t.test("filtros de período, almoxarifado, canceladas e materiais são respeitados", async () => {
      await criar([item(1, 25)], { data_compra: "2025-12-31" });
      await criar([item(1, 30)], { cod_almoxarifado_destino: outro.cod_almoxarifado });
      const cancelada = await criar([item(1, 40)]);
      await db.Compra.update({ status: "CANCELADO" }, { where: { id_compra: cancelada.id_compra } });
      const mista = await criar([item(1, 50, material.id_produto), item(1, 2)]);
      assert.equal(mista.valor_total, "52.0000");
      assert.equal(await card({ ano: 2026, mes: 10 }), 1502);
      assert.equal(await card({ ano: 2025, mes: 12 }), 25);
      assert.equal(await card({ ano: 2026, mes: 11 }), 0);
      assert.equal(await card(), 1527);
      assert.ok((await listarAnosMovimentacao(almox.cod_almoxarifado)).includes(2025));
      assert.equal((await calcularTotaisMovimentacao(almox.cod_almoxarifado)).valor_entrada, 0);
      await compras.confirmarRecebimento(mista.id_compra);
      assert.equal((await calcularTotaisMovimentacao(almox.cod_almoxarifado)).valor_entrada, 50);
      assert.equal(await card(), 1527);
    });

    await t.test("preço com três casas persiste integralmente e atualiza o card", async () => {
      const antes = await card();
      const compra = await criar([item(100, "6,785")]);
      assert.equal(compra.itens[0].valor_unitario, "6.7850");
      assert.equal(compra.valor_total, "678.5000");
      assert.equal(await card(), antes + 678.5);
      await assert.rejects(criar([item(100, "6,7851")]), /3 casas decimais/);
      assert.equal(await card(), antes + 678.5);
    });

    await t.test("serviço persiste total, subtotal e preço informado pelo item", async () => {
      const produtoAntes = await db.Produto.findByPk(gasolina.id_produto);
      const criado = await servicos.cadastrarServico({
        id_fornecedor: fornecedor.id_fornecedor,
        id_funcionario_responsavel: funcionario.id_funcionario,
        cod_almoxarifado: almox.cod_almoxarifado,
        data_servico: "2026-10-13",
        numero_nota_fiscal: "SERVICO-1",
        aplicacao: "Manutenção",
        itens: [item(10, "6,785")]
      });
      assert.equal(criado.valor_total, "67.85");
      assert.equal(criado.itens[0].valor_unitario, "6.785");
      assert.equal(criado.itens[0].subtotal, "67.85");
      await db.Produto.update({ preco_custo: 999 }, { where: { id_produto: gasolina.id_produto } });
      const lido = await servicos.buscarServicoPorId(criado.id_servico);
      assert.equal(lido.valor_total, "67.85");
      assert.equal(lido.itens[0].valor_unitario, "6.785");
      const editado = await servicos.editarServico(criado.id_servico, {
        id_fornecedor: fornecedor.id_fornecedor,
        id_funcionario_responsavel: funcionario.id_funcionario,
        cod_almoxarifado: almox.cod_almoxarifado,
        data_servico: "2026-10-13",
        numero_nota_fiscal: "SERVICO-1",
        aplicacao: "Manutenção",
        itens: [item(2, "1,234")]
      });
      assert.equal(editado.valor_total, "2.47");
      assert.equal(editado.itens[0].subtotal, "2.47");
      await db.Produto.update({ preco_custo: produtoAntes.preco_custo }, { where: { id_produto: gasolina.id_produto } });
    });

    await t.test("exclusão remove leitura de horímetro e manutenção do histórico", async () => {
      const equipamento = await db.Equipamento.create({
        descricao: "Equipamento de teste",
        codigo: "EQ-TESTE-001",
        capacidadePotencia: "100 CV",
        marca: "Teste",
        serieChassis: "SERIE-001",
        placa: "ABC1D23",
        anoFabricacao: 2024,
        obraId: almox.cod_almoxarifado
      });
      const usuario = { id_funcionario: funcionario.id_funcionario };
      const leitura = await manutencoes.registrarHorimetro(equipamento.id_equipamento, { horimetro: 100, dataLeitura: "2026-10-13" }, usuario, almox.cod_almoxarifado);
      const manutencao = await manutencoes.registrarManutencao(equipamento.id_equipamento, { horimetro: 100, dataManutencao: "2026-10-13", tipo: "Preventiva", intervaloHoras: 500 }, usuario, almox.cod_almoxarifado);
      assert.equal((await manutencoes.buscarDetalhes(equipamento.id_equipamento, almox.cod_almoxarifado)).horimetros.length, 1);
      assert.equal((await manutencoes.buscarDetalhes(equipamento.id_equipamento, almox.cod_almoxarifado)).manutencoes.length, 1);
      await manutencoes.excluirHorimetro(equipamento.id_equipamento, leitura.id_horimetro, almox.cod_almoxarifado);
      await manutencoes.excluirManutencao(equipamento.id_equipamento, manutencao.id_manutencao, almox.cod_almoxarifado);
      const detalhes = await manutencoes.buscarDetalhes(equipamento.id_equipamento, almox.cod_almoxarifado);
      assert.equal(detalhes.horimetros.length, 0);
      assert.equal(detalhes.manutencoes.length, 0);
      await assert.rejects(manutencoes.excluirHorimetro(equipamento.id_equipamento, leitura.id_horimetro, almox.cod_almoxarifado), /não encontrada/);
      await assert.rejects(manutencoes.excluirManutencao(equipamento.id_equipamento, manutencao.id_manutencao, almox.cod_almoxarifado), /não encontrada/);
    });

    await t.test("falha de persistência reverte compra e mantém o total do card", async () => {
      const total = await card();
      const quantidade = await db.Compra.count();
      await assert.rejects(criar([item(1, 1)], { id_funcionario_comprador: randomUUID() }));
      assert.equal(await db.Compra.count(), quantidade);
      assert.equal(await card(), total);
    });
  } finally {
    if (db) await db.sequelize.close();
    if (criado && /^almox_compras_test_[a-f0-9]{32}$/.test(nomeTeste)) await conexao.query(`DROP DATABASE \`${nomeTeste}\``);
    await conexao.end();
  }
});
