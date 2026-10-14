import { useEffect, useState } from "react";

const EVENTO = "compras-atualizadas";

// Emitido somente depois da confirmação de sucesso pela API.
export function notificarComprasAtualizadas() {
  window.dispatchEvent(new Event(EVENTO));
  try {
    localStorage.setItem(EVENTO, `${Date.now()}-${Math.random()}`);
  } catch {
    // A atualização na aba atual funciona mesmo sem acesso ao localStorage.
  }
}

export function useComprasAtualizadas() {
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const atualizar = () => setRevisao((valor) => valor + 1);
    const aoArmazenar = (evento) => {
      if (evento.key === EVENTO) atualizar();
    };
    window.addEventListener(EVENTO, atualizar);
    window.addEventListener("storage", aoArmazenar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(EVENTO, atualizar);
      window.removeEventListener("storage", aoArmazenar);
      window.removeEventListener("focus", atualizar);
    };
  }, []);
  return revisao;
}
