import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout, Header, Button } from '@/components/tiktok-commerce';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Phone, MessageSquare, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyErrorMessage } from '@/lib/api';

const Login = () => {
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>('/dashboard');

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { signin, verifySignin } = useAuth();

  // Check for redirect parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const redirect = urlParams.get('redirect');
    if (redirect) {
      setRedirectPath(decodeURIComponent(redirect));
    }
  }, [location.search]);

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number to E.164 format
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+256${phoneNumber}`;

      const response = await signin(formattedPhone);

      if (response.success) {
        setStep('otp');
        toast({
          title: "OTP Sent!",
          description: response.data.codeDelivery?.destination
            ? `Verification code sent to ${response.data.codeDelivery.destination}`
            : `Verification code sent to your phone`,
        });
      }
    } catch (error) {
      const errorMessage = getUserFriendlyErrorMessage(error, 'signin');

      toast({
        title: "Sign In Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number to E.164 format
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+256${phoneNumber}`;

      const response = await verifySignin(formattedPhone, otp);

      if (response.success && response.data) {
        setStep('success');

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });

        // Redirect to appropriate page after success message
        setTimeout(() => {
          navigate(redirectPath);
        }, 2000);
      }
    } catch (error) {
      const errorMessage = getUserFriendlyErrorMessage(error, 'verify');

      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive"
      });

      // Clear OTP on error
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout
      header={
        <Header 
          title="Seller Login"
        />
      }
    >
      <div className="max-w-md mx-auto space-y-lg">
        {/* Step Indicator */}
        <div className="flex justify-center space-x-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'phone' ? 'bg-primary text-white' : 
            step === 'otp' || step === 'success' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            1
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'otp' ? 'bg-primary text-white' :
            step === 'success' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            2
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'success' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
          }`}>
            ✓
          </div>
        </div>

        {/* Phone Number Step */}
        {step === 'phone' && (
          <Card>
            <CardContent className="p-lg space-y-lg">
              <div className="text-center space-y-sm">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Enter Your Phone Number</h2>
                <p className="text-muted-foreground">
                  We'll send you a verification code to confirm it's you
                </p>
              </div>

              <div className="space-y-md">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      +256
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="700 123 456"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-16"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    "Sending..."
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OTP Verification Step */}
        {step === 'otp' && (
          <Card>
            <CardContent className="p-lg space-y-lg">
              <div className="text-center space-y-sm">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-xl font-bold">Enter Verification Code</h2>
                <p className="text-muted-foreground">
                  Enter the 6-digit code sent to<br />
                  <span className="font-medium">+256 {phoneNumber}</span>
                </p>
              </div>

              <div className="space-y-lg">
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-sm">
                  <Button 
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otp.length !== 6}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? "Verifying..." : "Verify & Login"}
                  </Button>

                  <Button 
                    variant="ghost" 
                    onClick={() => setStep('phone')}
                    className="w-full"
                  >
                    Change Phone Number
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <Card>
            <CardContent className="p-lg space-y-lg text-center">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <div className="space-y-sm">
                <h2 className="text-xl font-bold text-success">Login Successful!</h2>
                <p className="text-muted-foreground">
                  Redirecting you to your dashboard...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
