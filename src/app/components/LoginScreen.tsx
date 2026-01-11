import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-sm p-8">
          <div className="mb-8">
            <h1 className="text-[#0a1628] mb-2">Cargo Management System</h1>
            <p className="text-[#64748b]">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[#0a1628]">
                Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748b]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[#f8fafc] border-[#e2e8f0] focus:border-[#0a1628] focus:ring-0"
                  placeholder="user@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[#0a1628]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748b]" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-[#f8fafc] border-[#e2e8f0] focus:border-[#0a1628] focus:ring-0"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0a1628] hover:bg-[#162844] text-white"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-[#94a3b8]">
          © 2025 Cargo Management System
        </p>
      </div>
    </div>
  );
}
