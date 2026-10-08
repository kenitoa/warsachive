import { check } from './errors.ts';
import type { User, UserRole } from '../application/auth.ts';
export const scopes = ['content:read','content:write','content:review','content:publish','finance:read','finance:manage','operations:manage','security:manage','rights:manage','analytics:read'] as const;
export type Scope = typeof scopes[number];
export function legacyScopes(role: UserRole): Scope[] {
  if (role === 'admin') return [...scopes];
  if (role === 'editor') return ['content:read','content:write'];
  if (role === 'reviewer') return ['content:read','content:review','finance:read','finance:manage','rights:manage','operations:manage'];
  if (role === 'publisher') return ['content:read','content:publish','operations:manage'];
  return [];
}
export function permissions(user: User): Scope[] { return user.scopes ?? legacyScopes(user.role); }
export function requirePermission(user: User | null, scope: Scope): User { check(user,401,'AUTH_REQUIRED','로그인이 필요합니다.'); check(permissions(user).includes(scope),403,'FORBIDDEN','이 업무 범위의 권한이 없습니다.'); return user; }
