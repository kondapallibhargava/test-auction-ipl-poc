// TODO: Replace with NextAuth.js + OAuth when going live
import { User, Session } from './types';
import { registerUser, loginUser } from './store';

export async function register(username: string, password: string): Promise<User> {
  // TODO: Hash password with bcrypt before storing
  return registerUser(username, password);
}

export async function login(username: string, password: string): Promise<User | null> {
  // TODO: Use bcrypt.compare when passwords are hashed
  return loginUser(username, password);
}

export function getSession(cookieValue: string | undefined): Session | null {
  if (!cookieValue) return null;
  try {
    // TODO: Verify HMAC signature before decoding
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const session = JSON.parse(decoded) as Session;
    if (!session.userId || !session.username) return null;
    return session;
  } catch {
    return null;
  }
}

export function createSessionCookie(user: User): string {
  // TODO: Add HMAC signing for production use
  const session: Session = { userId: user.id, username: user.username };
  return Buffer.from(JSON.stringify(session)).toString('base64');
}
