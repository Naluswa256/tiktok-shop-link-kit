import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout, Header, Button } from '@/components/tiktok-commerce';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AtSign, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePasswordSignin } from '@/hooks/useAuth';
import { cleanTikTokHandle } from '@/lib/api';

const Login = () => {
  const [formData, setFormData] = useState({
    handle: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>('/dashboard');

  const navigate = useNavigate();
  const location = useLocation();
  const passwordSignin = usePasswordSignin();

  // Check for redirect parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const redirect = urlParams.get('redirect');
    if (redirect) {
      setRedirectPath(decodeURIComponent(redirect));
    }
  }, [location.search]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!formData.handle.trim()) {
      toast.error('Please enter your TikTok handle');
      return;
    }

    if (!formData.password) {
      toast.error('Please enter your password');
      return;
    }

    try {
      await passwordSignin.mutateAsync({
        handle: formData.handle,
        password: formData.password
      });

      // Success is handled by the usePasswordSignin hook
      // It will automatically navigate to the shop page

    } catch (error) {
      // Error is handled by the usePasswordSignin hook
      // It will show appropriate error messages
    }
  };

  const isFormValid = formData.handle.trim() && formData.password;

  return (
    <Layout
      header={
        <Header
          title="Sign In to Your Shop"
        />
      }
    >
      <div className="max-w-md mx-auto space-y-lg">
        <Card>
          <CardContent className="p-lg space-y-lg">
            <div className="text-center space-y-sm">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <AtSign className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Welcome Back</h2>
              <p className="text-muted-foreground">
                Sign in to manage your TikTok shop
              </p>
            </div>

            <form onSubmit={handleSignin} className="space-y-md">
              <div className="space-y-2">
                <Label htmlFor="handle">TikTok Handle</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="handle"
                    type="text"
                    placeholder="your_tiktok_handle"
                    value={formData.handle}
                    onChange={(e) => handleInputChange('handle', e.target.value)}
                    className="pl-10"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!isFormValid || passwordSignin.isPending}
                className="w-full"
                size="lg"
              >
                {passwordSignin.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-center pt-md border-t">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  to="/"
                  className="text-primary hover:underline font-medium"
                >
                  Create your shop
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help? Contact us on WhatsApp at{' '}
            <span className="font-medium text-foreground">+256 700 000 000</span>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
