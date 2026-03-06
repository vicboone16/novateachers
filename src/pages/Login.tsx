import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Check your email', description: 'A password reset link has been sent.' });
      }
      setLoading(false);
      return;
    }

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      toast({
        title: isSignUp ? 'Sign up failed' : 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    } else if (isSignUp) {
      toast({ title: 'Account created!', description: 'You are now signed in.' });
    }

    setLoading(false);
  };

  const title = isForgot ? 'Reset password' : isSignUp ? 'Create account' : 'Sign in';
  const description = isForgot
    ? 'Enter your email to receive a reset link'
    : isSignUp
      ? 'Enter your details to get started'
      : 'Enter your credentials to continue';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            NovaTrack
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Teacher Workspace</p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {!isForgot && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
              {!isForgot && !isSignUp && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setIsForgot(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? 'Please wait…'
                  : isForgot
                    ? 'Send reset link'
                    : isSignUp
                      ? 'Create account'
                      : 'Sign in'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isForgot ? (
                <button type="button" className="text-primary underline" onClick={() => setIsForgot(false)}>
                  Back to sign in
                </button>
              ) : (
                <>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button type="button" className="text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
                    {isSignUp ? 'Sign in' : 'Sign up'}
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
