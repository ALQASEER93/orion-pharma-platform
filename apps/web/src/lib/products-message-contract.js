/**
 * @typedef {{ en: string, ar?: string | null }} ServerLocalizedMessage
 * @typedef {{
 *   activationReady?: ServerLocalizedMessage | string | null;
 *   activationBlocked?: ServerLocalizedMessage | string | null;
 *   alreadyActive?: ServerLocalizedMessage | string | null;
 *   staleConflictRejection?: ServerLocalizedMessage | string | null;
 *   recoveryGuidance?: ServerLocalizedMessage | string | null;
 *   mergeSummary?: ServerLocalizedMessage | string | null;
 *   approvalSummary?: ServerLocalizedMessage | string | null;
 *   handoffSummary?: ServerLocalizedMessage | string | null;
 *   activationSummary?: {
 *     currentState?: ServerLocalizedMessage | string | null;
 *     pendingState?: ServerLocalizedMessage | string | null;
 *     changedState?: ServerLocalizedMessage | string | null;
 *     nextStep?: ServerLocalizedMessage | string | null;
 *   } | null;
 * }} ProductsMessageContract
 */

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveLocalizedValue(value, language, fallbackArabic = "") {
  if (!value) {
    return language === "AR" ? fallbackArabic : "";
  }

  if (typeof value === "string") {
    return language === "AR" ? fallbackArabic || value : value;
  }

  if (language === "AR") {
    return normalizeText(value.ar) || fallbackArabic || normalizeText(value.en);
  }

  return normalizeText(value.en);
}

export function resolveServerLocalizedMessage(value, language, fallbackArabic = "") {
  return resolveLocalizedValue(value, language, fallbackArabic);
}

export function resolveProductsCriticalMessage(contract, key, language, fallbackArabic = "") {
  const message = contract?.[key];
  return resolveLocalizedValue(message, language, fallbackArabic);
}

function hasMessageContent(value) {
  if (!value) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value !== "object") {
    return false;
  }

  if ("en" in value || "ar" in value) {
    return Boolean(normalizeText(value.en) || normalizeText(value.ar));
  }

  return Object.values(value).some((nested) => hasMessageContent(nested));
}

export function hasProductsMessageContract(contract) {
  return Boolean(contract && Object.values(contract).some((message) => hasMessageContent(message)));
}
