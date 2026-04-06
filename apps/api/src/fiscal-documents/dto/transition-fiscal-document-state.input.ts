import { FiscalDocumentState } from '@prisma/client';

export type FiscalDocumentKind = 'SALE' | 'RETURN' | 'CREDIT_NOTE';

export interface TransitionFiscalDocumentStateInput {
  tenantId: string;
  documentKind: FiscalDocumentKind;
  documentId: string;
  toState: FiscalDocumentState;
  reason?: string | null;
}
