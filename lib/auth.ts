import { createHmac } from 'crypto';
import bcrypt from 'bcryptjs';
import { User, Session } from './types';
import { registerUser, getUserByUsername } from './store';

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-insecure-secret';

export async function register(username: string, password: string): Promise<User> {
  const hash = await bcrypt.hash(password, 10);
  return registerUser(username, hash);
}

export async function login(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;
  return user;
}

export function getSession(cookieValue: string | undefined): Session | null {
  if (!cookieValue) return null;
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const payload = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  if (expected !== sig) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as Session;
    if (!session.userId || !session.username) return null;
    return session;
  } catch {
    return null;
  }
}

export function createSessionCookie(user: User): string {
  const session: Session = { userId: user.id, username: user.username };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64');
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
