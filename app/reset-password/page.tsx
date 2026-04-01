import { Suspense } from 'react';
import Card from '@/components/ui/Card';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-2" style={{ color: '#f7941d' }}>🏏 IPL Auction</h1>
      </div>
      <Card bordered className="w-full max-w-md">
        <Suspense fallback={<p className="text-gray-400 text-sm">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  );
}
