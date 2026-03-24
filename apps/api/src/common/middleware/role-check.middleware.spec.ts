import { UnauthorizedException } from '@nestjs/common';
import { RoleCheckMiddleware } from './role-check.middleware';

describe('RoleCheckMiddleware', () => {
  const middleware = new RoleCheckMiddleware();

  it('throws UnauthorizedException when user exists without role', () => {
    expect(() =>
      middleware.use(
        {
          user: {
            sub: 'user-1',
            tenantId: 'tenant-1',
            email: 'user@orion.local',
            role: '' as never,
            permissions: [],
          },
        } as never,
        {} as never,
        jest.fn(),
      ),
    ).toThrow(UnauthorizedException);
  });
});
