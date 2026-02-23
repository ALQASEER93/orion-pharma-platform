import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  permissions: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.ORION_JWT_SECRET ??
        'ORION_local_dev_jwt_secret_change_in_production',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
