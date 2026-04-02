import { createHmac } from 'crypto';
import bcrypt from 'bcryptjs';
import { User, Session } from './types';
import {
  registerUser, getUserByUsername, getUserByEmail,
  updateUserPassword, createPasswordResetToken, consumePasswordResetToken,
} from './store';

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-insecure-secret';

export async function register(username: string, password: string, email?: string, ip?: string): Promise<User> {
  const hash = await bcrypt.hash(password, 10);
  return registerUser(username, hash, email, ip);
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
  const session: Session = { userId: user.id, username: user.username, isAdmin: user.isAdmin };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64');
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Returns the reset token, or null if no account with that email exists. */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await getUserByEmail(email.toLowerCase());
  if (!user) return null;
  return createPasswordResetToken(user.id);
}

/** Returns true and updates the password if the token is valid; false otherwise. */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const userId = await consumePasswordResetToken(token);
  if (!userId) return false;
  const hash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword(userId, hash);
  return true;
}
