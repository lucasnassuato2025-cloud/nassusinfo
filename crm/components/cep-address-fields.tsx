"use client";

import { useRef, useState } from "react";

import styles from "./cep-address-fields.module.css";

type AddressValue = {
  zipCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type Props = {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
};

type LookupStatus = "idle" | "loading" | "success" | "error";

type AddressResult = {
  zipCode: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatCep(value: string): string {
  const digits = onlyDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Serviço de CEP indisponível.");
  return response.json();
}

async function lookupViaCep(cep: string, signal: AbortSignal): Promise<AddressResult | null> {
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
    zipCode: formatCep(data.cep || cep),
    address: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: (data.uf || "").toUpperCase(),
  };
}

async function lookupBrasilApi(cep: string, signal: AbortSignal): Promise<AddressResult | null> {
  const data = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, signal) as {
    cep?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };

  if (!data.cep) return null;
  return {
    zipCode: formatCep(data.cep),
    address: data.street || "",
    neighborhood: data.neighborhood || "",
    city: data.city || "",
    state: (data.state || "").toUpperCase(),
  };
}

export function CepAddressFields({ value, onChange }: Props) {
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [message, setMessage] = useState("");
  const lastLookup = useRef("");
  const requestRef = useRef<AbortController | null>(null);
  const numberRef = useRef<HTMLInputElement | null>(null);

  function patch(next: Partial<AddressValue>) {
    onChange({ ...value, ...next });
  }

  async function searchCep(rawCep = value.zipCode, force = false) {
    const cep = onlyDigits(rawCep);
    if (cep.length !== 8) {
      setStatus("error");
      setMessage("Digite um CEP com 8 números.");
      return;
    }
    if (!force && lastLookup.current === cep) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    setStatus("loading");
    setMessage("Buscando endereço...");

    try {
      let result: AddressResult | null = null;
      try {
        result = await lookupViaCep(cep, controller.signal);
      } catch (reason) {
        if (controller.signal.aborted) throw reason;
      }

      if (!result) result = await lookupBrasilApi(cep, controller.signal);
      if (!result) throw new Error("CEP não encontrado.");

      lastLookup.current = cep;
      patch({
        zipCode: result.zipCode,
        address: result.address || value.address,
        neighborhood: result.neighborhood || value.neighborhood,
        city: result.city || value.city,
        state: result.state || value.state,
      });
      setStatus("success");
      setMessage(result.address ? "Endereço preenchido. Informe o número." : "CEP localizado. Complete a rua e o número.");
      window.requestAnimationFrame(() => numberRef.current?.focus());
    } catch (reason) {
      if (controller.signal.aborted) {
        setStatus("error");
        setMessage("A consulta demorou demais. Tente novamente.");
      } else {
        setStatus("error");
        setMessage(reason instanceof Error ? reason.message : "Não foi possível consultar o CEP.");
      }
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
    }
  }

  function handleCepChange(rawValue: string) {
    const formatted = formatCep(rawValue);
    patch({ zipCode: formatted });
    setStatus("idle");
    setMessage("");
    const digits = onlyDigits(formatted);
    if (digits.length === 8 && digits !== lastLookup.current) {
      window.setTimeout(() => void searchCep(formatted), 0);
    }
  }

  return (
    <div className="form-section">
      <div className="form-section-title">
        <strong>Endereço</strong>
        <small>Digite o CEP para preencher a localização automaticamente</small>
      </div>
      <div className="form-grid">
        <div className={styles.cepField}>
          <span className={styles.labelText}>CEP</span>
          <div className={styles.cepRow}>
            <input
              value={value.zipCode}
              onChange={(event) => handleCepChange(event.target.value)}
              onBlur={() => {
                if (onlyDigits(value.zipCode).length === 8) void searchCep(value.zipCode);
              }}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              placeholder="00000-000"
              aria-describedby="cep-status"
            />
            <button
              type="button"
              className="pro-secondary"
              onClick={() => void searchCep(value.zipCode, true)}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Buscando..." : "Buscar CEP"}
            </button>
          </div>
          <p
            id="cep-status"
            className={`${styles.status} ${status === "loading" ? styles.loading : status === "success" ? styles.success : status === "error" ? styles.error : ""}`}
            aria-live="polite"
          >
            {message}
          </p>
        </div>

        <label className="span-2">Endereço
          <input value={value.address} onChange={(event) => patch({ address: event.target.value })} autoComplete="street-address" />
        </label>
        <label>Número
          <input ref={numberRef} value={value.addressNumber} onChange={(event) => patch({ addressNumber: event.target.value })} autoComplete="address-line2" />
        </label>
        <label>Complemento
          <input value={value.complement} onChange={(event) => patch({ complement: event.target.value })} placeholder="Apto, sala, fundos..." />
        </label>
        <label>Bairro
          <input value={value.neighborhood} onChange={(event) => patch({ neighborhood: event.target.value })} />
        </label>
        <label>Cidade
          <input value={value.city} onChange={(event) => patch({ city: event.target.value })} autoComplete="address-level2" />
        </label>
        <label>Estado
          <input maxLength={2} value={value.state} onChange={(event) => patch({ state: event.target.value.toUpperCase() })} autoComplete="address-level1" />
        </label>
      </div>
    </div>
  );
}
