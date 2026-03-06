import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from '../types/request-with-context.type';

@Injectable()
export class RoleCheckMiddleware implements NestMiddleware {
  use(req: RequestWithContext, _res: Response, next: NextFunction): void {
    if (req.user && !req.user.role) {
      throw new UnauthorizedException(
        'Authenticated user missing role context.',
      );
    }

    next();
  }
}
