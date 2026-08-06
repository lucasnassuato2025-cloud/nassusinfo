"use client";

import { useEffect } from "react";

type LookupResult = {
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
};

type LookupState = "idle" | "loading" | "success" | "error";

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatCep(value: string): string {
  const clean = digits(value);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

function directLabelText(label: HTMLLabelElement): string {
  const direct = Array.from(label.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join(" ")
    .trim();
  return direct || (label.textContent || "").trim();
}

function findInput(scope: ParentNode, names: string[]): HTMLInputElement | null {
  const normalized = names.map((name) => name.toLocaleLowerCase("pt-BR"));
  for (const label of Array.from(scope.querySelectorAll<HTMLLabelElement>("label"))) {
    const text = directLabelText(label).toLocaleLowerCase("pt-BR");
    if (normalized.some((name) => text === name || text.startsWith(`${name} `))) {
      const input = label.querySelector<HTMLInputElement>("input");
      if (input) return input;
    }
  }
  return null;
}

function setReactInput(input: HTMLInputElement | null, value: string) {
  if (!input || !value) return;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Serviço de CEP indisponível.");
  return response.json();
}

async function viaCep(cep: string, signal: AbortSignal): Promise<LookupResult | null> {
  const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`, signal) as {
    erro?: boolean;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    cep: formatCep(data.cep || cep),
    address: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: (data.uf || "").toUpperCase(),
  };
}

async function brasilApi(cep: string, signal: AbortSignal): Promise<LookupResult | null> {
  const data = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, signal) as {
    cep?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  if (!data.cep) return null;
  return {
    cep: formatCep(data.cep),
    address: data.street || "",
    neighborhood: data.neighborhood || "",
    city: data.city || "",
    state: (data.state || "").toUpperCase(),
  };
}

function attachCepLookup(input: HTMLInputElement) {
  if (input.dataset.cepAutofill === "true") return;
  input.dataset.cepAutofill = "true";
  input.inputMode = "numeric";
  input.autocomplete = "postal-code";
  input.maxLength = 9;
  input.placeholder ||= "00000-000";

  const label = input.closest("label");
  const scope = input.closest(".form-section") || input.closest("form") || document;
  const status = document.createElement("small");
  status.className = "cep-auto-status";
  status.setAttribute("aria-live", "polite");
  status.dataset.state = "idle";
  label?.append(status);

  let timer = 0;
  let lastLookup = "";
  let controller: AbortController | null = null;
  let formatting = false;

  const show = (state: LookupState, message: string) => {
    status.dataset.state = state;
    status.textContent = message;
    input.dataset.cepLoading = state === "loading" ? "true" : "false";
  };

  const search = async (force = false) => {
    const cep = digits(input.value);
    if (cep.length !== 8) {
      if (force) show("error", "Digite um CEP com 8 números.");
      return;
    }
    if (!force && cep === lastLookup) return;

    controller?.abort();
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller?.abort(), 7000);
    show("loading", "Buscando endereço...");

    try {
      let result: LookupResult | null = null;
      try {
        result = await viaCep(cep, controller.signal);
      } catch (reason) {
        if (controller.signal.aborted) throw reason;
      }
      if (!result) result = await brasilApi(cep, controller.signal);
      if (!result) throw new Error("CEP não encontrado.");

      const addressInput = findInput(scope, ["Endereço", "Logradouro", "Rua"]);
      const neighborhoodInput = findInput(scope, ["Bairro"]);
      const cityInput = findInput(scope, ["Cidade", "Município"]);
      const stateInput = findInput(scope, ["Estado", "UF"]);
      const numberInput = findInput(scope, ["Número"]);

      setReactInput(input, result.cep);
      if (result.address) setReactInput(addressInput, result.address);
      if (result.neighborhood) setReactInput(neighborhoodInput, result.neighborhood);
      if (result.city) setReactInput(cityInput, result.city);
      if (result.state) setReactInput(stateInput, result.state);

      lastLookup = cep;
      show("success", result.address ? "Endereço preenchido. Informe o número." : "CEP localizado. Complete a rua e o número.");
      window.requestAnimationFrame(() => numberInput?.focus());
    } catch (reason) {
      show(
        "error",
        controller.signal.aborted
          ? "A consulta demorou demais. Tente novamente."
          : reason instanceof Error
            ? reason.message
            : "Não foi possível consultar o CEP.",
      );
    } finally {
      window.clearTimeout(timeout);
      controller = null;
    }
  };

  input.addEventListener("input", () => {
    if (formatting) return;
    const formatted = formatCep(input.value);
    if (input.value !== formatted) {
      formatting = true;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(input, formatted);
      formatting = false;
    }
    show("idle", "");
    window.clearTimeout(timer);
    if (digits(formatted).length === 8) {
      timer = window.setTimeout(() => void search(), 220);
    }
  });

  input.addEventListener("blur", () => {
    if (digits(input.value).length === 8) void search();
  });
}

function scan() {
  for (const label of Array.from(document.querySelectorAll<HTMLLabelElement>("label"))) {
    const text = directLabelText(label).toLocaleLowerCase("pt-BR");
    if (text === "cep" || text.startsWith("cep ")) {
      const input = label.querySelector<HTMLInputElement>("input");
      if (input) attachCepLookup(input);
    }
  }
}

export function CepAutofillAgent() {
  useEffect(() => {
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
