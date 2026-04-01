import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requestPasswordReset } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const token = await requestPasswordReset(email.trim().toLowerCase());

  // Always return success to avoid leaking whether an email exists
  if (token) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const from = process.env.RESEND_FROM_EMAIL ?? 'IPL Auction <onboarding@resend.dev>';
      await resend.emails.send({
        from,
        to: email.trim(),
        subject: 'Reset your IPL Auction password',
        html: `
          <p>Hi,</p>
          <p>Click the link below to reset your password. The link expires in 1 hour.</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        `,
      });
    } else {
      // Dev fallback: log the reset URL to server console
      console.log(`[dev] Password reset URL for ${email}: ${resetUrl}`);
    }
  }

  return NextResponse.json({ ok: true });
}
