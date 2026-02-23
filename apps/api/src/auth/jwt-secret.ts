const DEFAULT_DEV_SECRET = 'ORION_local_dev_jwt_secret_change_in_production';

export function resolveJwtSecret(): string {
  return (
    process.env.ORION_JWT_SECRET ?? process.env.JWT_SECRET ?? DEFAULT_DEV_SECRET
  );
}
