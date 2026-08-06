"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { PAYMENT_COLUMNS, Client, Payment, Project, mapPayment } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { openDocumentPrint } from "./contract-print";
import {
  BusinessProfile,
  CatalogService,
  ClauseItem,
  ClauseTemplate,
  CommercialDocument,
  ContractSnapshot,
  DocumentSignature,
  DocumentStatus,
  DocumentType,
  ServiceItem,
  SigningLink,
  STATUS_LABELS,
  TYPE_LABELS,
  buildContractSnapshot,
  businessProfileSnapshot,
  clientSnapshot,
  defaultNumber,
  formatCurrency,
  mapBusinessProfile,
  mapCatalogService,
  mapClauseTemplate,
  mapCommercialDocument,
  mapDocumentSignature,
  mapSigningLink,
  normalizeDocument,
  paymentSnapshot,
  projectSnapshot,
  randomCode,
  randomToken,
  rows,
  sha256,
  stableStringify,
} from "./contract-utils";
import { clientLabel, dateLabel, errorMessage, recordActivity, today } from "./shared";

type CenterTab = "documents" | "profiles" | "catalog";

type DocumentDraft = {
  documentType: DocumentType;
  number: string;
  title: string;
  status: DocumentStatus;
  clientId: string;
  clientDocumentType: "cpf" | "cnpj" | "rg";
  clientDocumentNumber: string;
  projectId: string | null;
  issuerProfileId: string | null;
  paymentId: string | null;
  issueDate: string;
  validUntil: string | null;
  amount: number;
  amountInWords: string;
  paymentTerms: string;
  scope: string;
  terms: string;
  notes: string;
  receiptType: string;
  selectedServiceIds: string[];
  serviceAmounts: Record<string, number>;
  selectedClauseIds: string[];
};

type ProfileDraft = Omit<BusinessProfile, "id">;
type ServiceDraft = Omit<CatalogService, "id">;
type ShareInfo = { documentId: string; url: string; code: string; expiresAt: string };

const DOCUMENT_COLUMNS = "id, client_id, project_id, issuer_profile_id, payment_id, document_type, number, title, status, issue_date, valid_until, amount, payment_terms, scope, terms, notes, service_items, clauses, client_snapshot, issuer_snapshot, receipt_type, amount_in_words, signature_status, current_version, sent_at, viewed_at, signed_at, document_hash, signed_hash, created_at, updated_at";
const PROFILE_COLUMNS = "id, profile_type, display_name, legal_name, trade_name, document_type, document_number, rg_number, state_registration, email, phone, whatsapp, address, address_number, complement, neighborhood, city, state, zip_code, pix_key, is_default, is_active";
const SERVICE_COLUMNS = "id, name, category, description, scope_template, base_price, default_days, active";
const CLAUSE_COLUMNS = "id, code, title, body, category, required, active, sort_order";
const LINK_COLUMNS = "id, document_id, document_version_id, status, expires_at, access_count, last_accessed_at, created_at";
const SIGNATURE_COLUMNS = "id, document_id, signer_name, signer_document_masked, signer_email, signer_phone, signature_method, signature_data, document_hash, evidence, signed_at";

const SMALL = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezo