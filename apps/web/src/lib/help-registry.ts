export type PageHelpSection = {
  id: string;
  title: string;
  summary: string;
  details: string[];
};

export type HelpGlossaryTerm = {
  term: string;
  meaning: string;
};

export type PageHelpContent = {
  route: string;
  pageName: string;
  purpose: string;
  startHere: string[];
  sections: PageHelpSection[];
  glossary: HelpGlossaryTerm[];
  truthNotes: string[];
};

export const pageHelpRegistry: Record<string, PageHelpContent> = {
  products: {
    route: "/products",
    pageName: "Products workspace",
    purpose:
      "Prepare one working draft, compare it against reference products, and move the draft into real catalog states only when the server says it is ready.",
    startHere: [
      "Use Search to bring the product you want to work on into view.",
      "Select one row to unlock action controls and context.",
      "Open the Working draft panel when you need to save product details to the server.",
    ],
    sections: [
      {
        id: "table",
        title: "Main table",
        summary: "This is the primary work area.",
        details: [
          "Every row is either your working draft or a read-only reference product.",
          "Filters help you focus by readiness or activation state.",
          "Selection drives what actions are enabled.",
        ],
      },
      {
        id: "draft",
        title: "Working draft",
        summary: "Use this for editable product details only.",
        details: [
          "Draft fields save to the server for the active tenant.",
          "Reference products are never edited from here.",
          "Readiness is derived from required fields, not from cosmetic labels.",
        ],
      },
      {
        id: "barcode",
        title: "Barcode flow",
        summary: "Scan-first workflow with clear fallback.",
        details: [
          "Preferred: scan first.",
          "Second: keyboard-wedge scanner input into the barcode field.",
          "Fallback only: manual typing.",
        ],
      },
      {
        id: "conflicts",
        title: "Conflict handling",
        summary: "Unsafe actions are blocked with clear next steps.",
        details: [
          "If another operator updates the draft first, your action is blocked instead of overwritten.",
          "Duplicate barcode attempts are blocked and the existing product owner is shown clearly.",
          "Use Refresh, compare what changed, then retry only after review.",
        ],
      },
      {
        id: "queues-history",
        title: "Worklists and action log",
        summary: "Save repeatable review context and track server-backed actions.",
        details: [
          "Saved worklists restore search, filter, selection, and focus.",
          "Action log records meaningful server-backed workspace actions.",
          "View preferences can stay local while product truth stays tenant-safe on the backend.",
        ],
      },
    ],
    glossary: [
      {
        term: "Working draft",
        meaning: "Editable product record used for tenant-safe preparation before catalog changes.",
      },
      {
        term: "Reference product",
        meaning: "Read-only catalog product used for comparison.",
      },
      {
        term: "Needs details",
        meaning: "Required fields are still missing.",
      },
      {
        term: "Ready for review",
        meaning: "Core fields are complete; owner check is next.",
      },
      {
        term: "Ready for catalog",
        meaning: "Draft can be promoted into catalog flow.",
      },
      {
        term: "Conflict blocked",
        meaning:
          "An action was stopped because the draft or linked catalog record changed after you opened it.",
      },
      {
        term: "Saved worklist",
        meaning:
          "Saved server-backed review context that restores search, filter, selected rows, and focus.",
      },
    ],
    truthNotes: [
      "No sensitive token is written to the URL.",
      "Working draft, worklists, and action log are server-backed for the active tenant.",
      "Mutating actions require a fresh concurrency marker so stale writes cannot silently overwrite teammate changes.",
      "View-only preferences such as density or sort can remain local on this device.",
      "Reference products stay read-only in this workspace.",
    ],
  },
};
