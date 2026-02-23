import { ForbiddenException } from '@nestjs/common';
import { RequestWithContext } from '../types/request-with-context.type';

export function resolveTenantId(request: RequestWithContext): string {
  const tenantId = request.user?.tenantId ?? request.tenantId;
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required.');
  }
  return tenantId;
}
