import { Request } from 'express';

export type JwtUserPayload = {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  permissions: string[];
};

export interface RequestWithContext extends Request {
  tenantId?: string;
  user?: JwtUserPayload;
}
