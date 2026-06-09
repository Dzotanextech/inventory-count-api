import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  WAREHOUSE_MANAGER: 'WAREHOUSE_MANAGER',
  COUNTER: 'COUNTER',
  REVIEWER: 'REVIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
