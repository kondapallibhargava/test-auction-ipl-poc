import { Session } from './types';

export function isAdmin(session: Session | null): boolean {
  return session?.isAdmin === true;
}
