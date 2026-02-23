import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from '../types/request-with-context.type';

@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  use(req: RequestWithContext, _res: Response, next: NextFunction): void {
    req.tenantId = req.headers['x-tenant-id']?.toString() ?? undefined;
    next();
  }
}
