const RESIDUAL_FALLBACK_ENTRIES = Object.freeze({
  "Start with product names, strength, and pack so the workspace can judge readiness honestly.":
    "ابدأ باسمَي المنتج والتركيز والعبوة حتى تقيّم مساحة العمل الجاهزية بدقة.",
  "Core details are saved. Capture barcode before moving into catalog.":
    "تم حفظ البيانات الأساسية. التقط الباركود قبل النقل إلى الفهرس.",
  "Required details are complete. The draft can move into catalog as inactive.":
    "المتطلبات مكتملة. يمكن نقل المسودة إلى الفهرس بوضع غير نشط.",
  "Move working draft into catalog when readiness is complete.":
    "انقل المسودة العاملة إلى الفهرس بعد اكتمال الجاهزية.",
  "Submit for approval if governance requires it, then promote when ready.":
    "أرسل للاعتماد إذا تطلبت الحوكمة ذلك، ثم نفّذ الترقية عند الجاهزية.",
  "Decide every changed field before approval or promotion.":
    "احسم قرار كل حقل متغيّر قبل الاعتماد أو الترقية.",
  "Record approval decision, then promote when approved.":
    "سجّل قرار الاعتماد ثم نفّذ الترقية بعد الموافقة.",
  "Promote when readiness and barcode checks pass.":
    "نفّذ الترقية بعد استيفاء الجاهزية والتحقق من الباركود.",
  "Review the execution plan below, then confirm the promotion before executing it.":
    "راجع خطة التنفيذ أدناه ثم أكّد الترقية قبل تنفيذها.",
  "Activate when the product is truly launch-ready":
    "فعّل المنتج فقط عندما يصبح جاهزًا فعليًا للإطلاق",
  "Keep active or return the draft to planning mode before editing":
    "أبقِ المنتج نشطًا أو أعد المسودة إلى وضع التخطيط قبل التعديل",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const PRODUCTS_RESIDUAL_FALLBACK_KEYS = Object.freeze(
  Object.keys(RESIDUAL_FALLBACK_ENTRIES),
);

export function resolveProductsResidualFallback(
  value,
  language,
) {
  if (!value || language !== "AR") {
    return null;
  }

  const normalized = normalizeText(value);
  return RESIDUAL_FALLBACK_ENTRIES[normalized] ?? null;
}
