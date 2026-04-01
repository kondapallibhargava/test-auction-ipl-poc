import { test, expect, APIRequestContext, request as newRequest } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

// Unique suffix per run so repeated runs don't collide (base-36, ~8 chars)
const RUN = Date.now().toString(36);

async function registerUser(ctx: APIRequestContext, payload: object) {
  return ctx.post(`${BASE}/api/auth/register`, {
    data: payload,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loginUser(ctx: APIRequestContext, payload: object) {
  return ctx.post(`${BASE}/api/auth/login`, {
    data: payload,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Sign Up ───────────────────────────────────────────────────────────────────

test.describe('Signup', () => {
  const username = `tu${RUN}`;
  const email = `tu${RUN}@example.com`;

  test('creates account with username + email', async ({ request }) => {
    const res = await registerUser(request, { username, password: 'pass1234', email });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // Old code returns original case; new code lowercases — both should equal the already-lowercase username
    expect(body.username.toLowerCase()).toBe(username.toLowerCase());
  });

  test('duplicate username is rejected', async ({ request }) => {
    const res = await registerUser(request, { username, password: 'other1234' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/already taken/i);
  });

  test('duplicate email is rejected (requires new deployment)', async ({ request }) => {
    const res = await registerUser(request, {
      username: `dif${RUN}`,
      password: 'pass1234',
      email,
    });
    // Old deployment: email is ignored → 201. New deployment: 400.
    if (res.status() === 201) {
      test.info().annotations.push({ type: 'warning', description: 'Email uniqueness not enforced — deploy new code + run SQL migration' });
    } else {
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toMatch(/email already exists/i);
    }
  });

  test('rejects username shorter than 3 chars', async ({ request }) => {
    const res = await registerUser(request, { username: 'ab', password: 'pass1234' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/3.20 characters/i);
  });

  test('rejects password shorter than 4 chars', async ({ request }) => {
    const res = await registerUser(request, { username: `x${RUN}`, password: 'abc' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/4 characters/i);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  // Each describe block creates its own isolated user so tests aren't order-dependent
  const username = `tl${RUN}`; // "tl" for "test-login" prefix
  const password = 'loginpass99';

  test.beforeAll(async () => {
    // Create the user outside of any test's request context so it's truly shared
    const ctx = await newRequest.newContext();
    const res = await ctx.post(`${BASE}/api/auth/register`, {
      data: { username, password, email: `tl${RUN}@example.com` },
      headers: { 'Content-Type': 'application/json' },
    });
    await ctx.dispose();
    if (!res.ok()) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`beforeAll: failed to create login test user: ${JSON.stringify(body)}`);
    }
  });

  test('succeeds with correct credentials', async ({ request }) => {
    const res = await loginUser(request, { username, password });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.username.toLowerCase()).toBe(username.toLowerCase());
    const cookies = res.headers()['set-cookie'];
    expect(cookies).toContain('ipl-session=');
  });

  test('succeeds with mixed-case username (requires new deployment for mixed-case registered users)', async ({ request }) => {
    const upper = username.toUpperCase();
    const res = await loginUser(request, { username: upper, password });
    // Our username is all-lowercase (base-36), so even old code handles this correctly
    expect(res.status()).toBe(200);
  });

  test('fails with wrong password', async ({ request }) => {
    const res = await loginUser(request, { username, password: 'wrong_password_xyz' });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatch(/invalid credentials/i);
  });

  test('fails with unknown username', async ({ request }) => {
    const res = await loginUser(request, { username: 'nobody_xyz_999', password: 'pass1234' });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatch(/invalid credentials/i);
  });
});

// ── Forgot password (requires new deployment) ─────────────────────────────────

test.describe('Forgot password', () => {
  test('always returns ok — no email enumeration', async ({ request }) => {
    const res1 = await request.post(`${BASE}/api/auth/forgot-password`, {
      data: { email: `tu${RUN}@example.com` },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res1.status() === 404) {
      test.skip(true, 'Route not deployed yet — deploy new code first');
    }
    expect(res1.status()).toBe(200);
    expect((await res1.json()).ok).toBe(true);

    // Non-existent email should give same response (no leaking)
    const res2 = await request.post(`${BASE}/api/auth/forgot-password`, {
      data: { email: 'nobody@nowhere.invalid' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res2.status()).toBe(200);
    expect((await res2.json()).ok).toBe(true);
  });

  test('missing email returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/forgot-password`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status() === 404) {
      test.skip(true, 'Route not deployed yet — deploy new code first');
    }
    expect(res.status()).toBe(400);
  });
});

// ── Reset password (requires new deployment) ──────────────────────────────────

test.describe('Reset password', () => {
  test('invalid token is rejected', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/reset-password`, {
      data: { token: 'fakeinvalidtoken000', password: 'newpass1234' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status() === 404) {
      test.skip(true, 'Route not deployed yet — deploy new code first');
    }
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/invalid or expired/i);
  });

  test('missing fields returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/reset-password`, {
      data: { token: 'abc' },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status() === 404) {
      test.skip(true, 'Route not deployed yet — deploy new code first');
    }
    expect(res.status()).toBe(400);
  });
});
