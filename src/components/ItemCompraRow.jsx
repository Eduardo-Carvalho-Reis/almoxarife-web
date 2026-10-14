import { previaValorTotal, formatarMoedaCompra } from "../utils/valoresCompra.mjs";
// src/components/ItemCompraRow.jsx
import { Stack, TextField, Autocomplete, IconButton } from "@mui/material";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { passoQuantidade, ehUnidadeInteira } from "../utils/quantidade";

export default function ItemCompraRow({
  item,
  index,
  produtos,
  onChange,
  onRemove,
  disableRemove,
  valorCasas = 3
}) {
  const selecionado = produtos.find(
    (p) => Number(p.id_produto) === Number(item.id_produto)
  );
  const unidade = selecionado?.unidade_medida;
  const passo = passoQuantidade(unidade);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      {/* Autocomplete: digita e filtra pelo nome do produto, em vez de rolar
          uma lista longa de MenuItem. selecionado pode ser undefined
          (nenhum produto escolhido ainda), o que o Autocomplete trata como
          "sem valor" normalmente. */}
      <Autocomplete
        options={produtos}
        getOptionLabel={(p) => p?.nome || ""}
        isOptionEqualToValue={(opcao, valor) =>
          Number(opcao.id_produto) === Number(valor?.id_produto)
        }
        value={selecionado || null}
        onChange={(_, novoValor) =>
          onChange(index, "id_produto", novoValor ? novoValor.id_produto : "")
        }
        noOptionsText="Nenhum produto encontrado"
        sx={{ width: { xs: "100%", sm: "35%" } }}
        renderInput={(params) => (
          <TextField {...params} size="small" label="Produto" required />
        )}
      />

      <TextField
        size="small"
        label="Quantidade"
        type="number"
        value={item.quantidade}
        onChange={(e) => onChange(index, "quantidade", e.target.value)}
        required
        // O passo depende da unidade do produto: inteiro (UN/PC/CX/SC) ou
        // fracionado (KG/LT/M...).
        inputProps={{ min: ehUnidadeInteira(unidade) ? 1 : 0.001, step: ehUnidadeInteira(unidade) ? passo : "0.001" }}
        helperText={
          unidade
            ? `${unidade}${ehUnidadeInteira(unidade) ? " (inteiro)" : ""}`
            : undefined
        }
        sx={{ width: { xs: "100%", sm: "18%" } }}
      />

      <TextField
        size="small"
        label="Valor unit."
        type="text"
        value={String(item.valor_unitario).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1").replace(".", ",")}
        onChange={(e) => onChange(index, "valor_unitario", e.target.value)}
        required
        // Enviado como valor_unitario; o model mapeia p/ preco_unitario_acordado.
        inputProps={{ inputMode: "decimal", pattern: `[0-9]+([.,][0-9]{1,${valorCasas}})?` }}
        helperText={`Até ${valorCasas} casas decimais (ex.: 6,${"0".repeat(valorCasas)})`}
        sx={{ width: { xs: "100%", sm: "18%" } }}
      />

      <TextField
        size="small"
        label="Subtotal"
        type="text"
        value={formatarMoedaCompra(previaValorTotal([item], { casasValor: valorCasas }))}
        InputProps={{ readOnly: true }}
        inputProps={{ tabIndex: -1 }}
        helperText=" "
        sx={{ width: { xs: "100%", sm: "18%" } }}
      />

      <IconButton
        color="error"
        onClick={() => onRemove(index)}
        disabled={disableRemove}
        sx={{ flexShrink: 0 }}
      >
        <RemoveCircleOutlineIcon />
      </IconButton>
    </Stack>
  );
}
