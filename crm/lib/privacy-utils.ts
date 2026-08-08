export function onlyDigits(value: unknown, max = 32): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, max);
}

export function maskCpfCnpj(value: unknown): string {
  const digits = onlyDigits(value, 14);
  if (!digits) return "não informado";
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskEmail(value: unknown): string {
  const email = String(value ?? "").trim();
  const at = email.indexOf("@");
  if (at <= 0) return email ? "***" : "não informado";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, 1)}${local.length > 1 ? "***" : ""}@${domain}`;
}

export function maskPhone(value: unknown): string {
  const digits = onlyDigits(value, 15);
  if (!digits) return "não informado";
  return `*** *** ${digits.slice(-4)}`;
}

export function maskIp(value: unknown): string {
  const ip = String(value ?? "").trim();
  if (!ip) return "não informado";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 2).join(":")}:…`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : "mascarado";
}
