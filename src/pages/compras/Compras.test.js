import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompraForm from "./Form";
import AlmoxarifadoDetalhes from "../almoxarifados/Detalhes";
import { notificarComprasAtualizadas } from "../../utils/comprasAtualizadas";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "1" }),
}), { virtual: true });
jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ user: { access_level: "ALMOXARIFE", cod_almoxarifado: 1 }, podeEditar: () => false }),
}));
jest.mock("../../components/FormPageHeader", () => () => null);
jest.mock("../../components/EntityAutocomplete", () => ({ label, value, onChange, options, getOptionId, getOptionLabel }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Selecione</option>
    {options.map((opcao) => <option key={getOptionId(opcao)} value={getOptionId(opcao)}>{getOptionLabel(opcao)}</option>)}
  </select>
));

const originalFetch = global.fetch;
let valorCard;
let respostaSalvar;
let finalizarCompra;
beforeEach(() => {
  valorCard = 1000;
  respostaSalvar = { sucesso: true };
  finalizarCompra = null;
  mockNavigate.mockClear();
  global.fetch = jest.fn(async (url, options) => {
    if (options?.method === "POST") {
      await new Promise((resolve) => { finalizarCompra = resolve; });
      return { json: async () => respostaSalvar };
    }
    let dados;
    if (url.includes("/totais-movimentacao")) dados = { valor_abastecimento_tanque: valorCard };
    else if (url.endsWith("/anos-movimentacao")) dados = [2026];
    else if (url.endsWith("/estoque")) dados = [];
    else if (url.endsWith("/almoxarifados/1")) dados = { nome: "Almox", ativo: 1, endereco: {}, data_atualizacao: "2026-10-13" };
    else if (url.endsWith("/fornecedores")) dados = [{ id_fornecedor: 1, razao_social: "Fornecedor" }];
    else if (url.endsWith("/lookups/funcionarios")) dados = [{ id_funcionario: "func", nome: "Comprador" }];
    else if (url.endsWith("/almoxarifados")) dados = [{ cod_almoxarifado: 1, nome: "Almox" }];
    else if (url.endsWith("/produtos")) dados = [{ id_produto: 1, nome: "Gasolina", unidade_medida: "LT", preco_custo: 99, fornecedores: [{ id_fornecedor: 1 }] }];
    return { json: async () => ({ sucesso: true, dados }) };
  });
});
afterEach(() => { global.fetch = originalFetch; });

async function preencherCompra() {
  fireEvent.change(await screen.findByLabelText("Fornecedor"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Funcionário comprador"), { target: { value: "func" } });
  fireEvent.change(screen.getByLabelText(/Nota Fiscal/), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText(/Data da compra/), { target: { value: "2026-10-13" } });
  fireEvent.change(screen.getByLabelText(/Valor unit/), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(/Quantidade/), { target: { value: "100" } });
  const produto = screen.getByRole("combobox", { name: /Produto/ });
  fireEvent.focus(produto);
  fireEvent.mouseDown(produto);
  fireEvent.change(produto, { target: { value: "Gas" } });
  fireEvent.click(await screen.findByRole("option", { name: "Gasolina" }));
  expect(screen.getByLabelText(/Valor unit/)).toHaveValue("5");
  expect(screen.queryByText("Automático")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Subtotal")).toHaveValue("R$\u00a0500,00");
  expect(screen.getByText(/Total da compra: R\$ 500,00/)).toBeInTheDocument();
}

test("preço manual e total exibido são preservados; card atualiza só após salvar com sucesso", async () => {
  const formulario = render(<CompraForm />);
  await preencherCompra();
  render(<AlmoxarifadoDetalhes />);
  expect(await screen.findByText(/R\$ 1\.000,00/)).toBeInTheDocument();
  fireEvent.submit(formulario.container.querySelector("form"));
  await waitFor(() => expect(finalizarCompra).not.toBeNull());
  expect(screen.getByText(/R\$ 1\.000,00/)).toBeInTheDocument();
  const chamada = global.fetch.mock.calls.find(([, opcoes]) => opcoes?.method === "POST");
  expect(JSON.parse(chamada[1].body).itens[0].valor_unitario).toBe("5");
  valorCard = 1500;
  await act(async () => finalizarCompra());
  expect(await screen.findByText(/R\$ 1\.500,00/)).toBeInTheDocument();
  expect(mockNavigate).toHaveBeenCalledWith("/compras");
  act(() => notificarComprasAtualizadas());
  expect(await screen.findByText(/R\$ 1\.500,00/)).toBeInTheDocument();
});

test("erro ao cadastrar não emite atualização de compras", async () => {
  const listener = jest.fn();
  window.addEventListener("compras-atualizadas", listener);
  try {
    const { container } = render(<CompraForm />);
    await preencherCompra();
    respostaSalvar = { sucesso: false, erro: "Falha ao salvar" };
    fireEvent.submit(container.querySelector("form"));
    await waitFor(() => expect(finalizarCompra).not.toBeNull());
    await act(async () => finalizarCompra());
    expect(await screen.findByText("Falha ao salvar")).toBeInTheDocument();
    expect(listener).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("compras-atualizadas", listener);
  }
});

test("campo aceita 6,785, calcula o subtotal e impede uma quarta casa decimal", async () => {
  const { container } = render(<CompraForm />);
  await preencherCompra();
  const preco = screen.getByLabelText(/Valor unit/);
  fireEvent.change(preco, { target: { value: "6,78" } });
  expect(preco).toHaveValue("6,78");
  expect(preco.checkValidity()).toBe(true);
  expect(screen.getByLabelText("Subtotal")).toHaveValue("R$\u00a0678,00");
  expect(screen.getByText(/Total da compra: R\$ 678,00/)).toBeInTheDocument();
  fireEvent.change(preco, { target: { value: "6,785" } });
  expect(preco.checkValidity()).toBe(true);
  expect(screen.getByLabelText("Subtotal")).toHaveValue("R$\u00a0678,50");
  expect(screen.getByText(/Total da compra: R\$ 678,50/)).toBeInTheDocument();
  fireEvent.change(preco, { target: { value: "6,7851" } });
  expect(preco.checkValidity()).toBe(false);
  fireEvent.change(preco, { target: { value: "6,785" } });
  fireEvent.submit(container.querySelector("form"));
  await waitFor(() => expect(finalizarCompra).not.toBeNull());
  const chamada = global.fetch.mock.calls.find(([, opcoes]) => opcoes?.method === "POST");
  expect(JSON.parse(chamada[1].body).itens[0].valor_unitario).toBe("6,785");
  await act(async () => finalizarCompra());
});

test("card consulta novamente após compra em outra aba e mantém os filtros", async () => {
  render(<AlmoxarifadoDetalhes />);
  expect(await screen.findByText(/R\$ 1\.000,00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "JAN" }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => /mes=1$/.test(url))).toBe(true));
  valorCard = 1500;
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "compras-atualizadas", newValue: "nova-compra" })));
  expect(await screen.findByText(/R\$ 1\.500,00/)).toBeInTheDocument();
  const consultas = global.fetch.mock.calls.filter(([url]) => url.includes("totais-movimentacao"));
  expect(consultas.at(-1)[0]).toMatch(/mes=1$/);
});
