
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/tiktok-commerce';
import { ArrowRight, ArrowLeft, Check, Phone, AtSign, ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuthFlow } from '@/hooks/useAuth';
import { cleanTikTokHandle } from '@/lib/api';
import { toast } from 'sonner';

type Step = 1 | 2 | 3 | 4;

interface ValidationState {
  isValid: boolean;
  isValidating: boolean;
  message?: string;
}

export const SignupFlow = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    tiktokHandle: '',
    phoneNumber: '',
    countryCode: '+256', // Default to Uganda
    otpCode: ''
  });

  const [handleValidation, setHandleValidation] = useState<ValidationState>({
    isValid: false,
    isValidating: false
  });

  const { validateHandle, signup, verifySignup, checkAndPromptSubscription, isLoading } = useAuthFlow();

  // Handle TikTok handle validation and proceed to next step
  const handleValidateAndNext = async () => {
    if (currentStep === 1) {
      setHandleValidation({ isValid: false, isValidating: true });

      try {
        const result = await validateHandle.mutateAsync(formData.tiktokHandle);
        if (result.data.exists) {
          setHandleValidation({
            isValid: true,
            isValidating: false,
            message: `✓ Found @${cleanTikTokHandle(formData.tiktokHandle)}`
          });
          setCurrentStep(2);
        } else {
          setHandleValidation({
            isValid: false,
            isValidating: false,
            message: 'Handle not found on TikTok'
          });
        }
      } catch (error) {
        setHandleValidation({
          isValid: false,
          isValidating: false,
          message: 'Failed to validate handle'
        });
      }
    } else if (currentStep === 2) {
      // Send OTP
      try {
        await signup.mutateAsync({
          handle: formData.tiktokHandle,
          phoneNumber: formData.phoneNumber,
          countryCode: formData.countryCode
        });
        setCurrentStep(3);
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
      // Reset validation state when going back
      if (currentStep === 2) {
        setHandleValidation({ isValid: false, isValidating: false });
      }
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset handle validation when handle changes
    if (field === 'tiktokHandle') {
      setHandleValidation({ isValid: false, isValidating: false });
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async () => {
    try {
      await verifySignup.mutateAsync({
        handle: formData.tiktokHandle,
        phoneNumber: formData.phoneNumber,
        countryCode: formData.countryCode,
        code: formData.otpCode
      });

      // Check if user needs subscription
      const needsSubscription = checkAndPromptSubscription(cleanTikTokHandle(formData.tiktokHandle));

      if (!needsSubscription) {
        // Go directly to shop page
        navigate(`/shop/${cleanTikTokHandle(formData.tiktokHandle)}`);
      }
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.tiktokHandle.length > 0 && !handleValidation.isValidating;
      case 2:
        return formData.phoneNumber.length >= 9;
      case 3:
        return formData.otpCode.length === 6;
      default:
        return false;
    }
  };

  const getStepButtonText = () => {
    switch (currentStep) {
      case 1:
        return handleValidation.isValidating ? 'Validating...' : 'Validate Handle';
      case 2:
        return signup.isPending ? 'Sending...' : 'Send Code';
      case 3:
        return verifySignup.isPending ? 'Verifying...' : 'Verify & Continue';
      default:
        return 'Continue';
    }
  };

  const isStepLoading = () => {
    switch (currentStep) {
      case 1:
        return handleValidation.isValidating;
      case 2:
        return signup.isPending;
      case 3:
        return verifySignup.isPending;
      default:
        return false;
    }
  };

  const getShopUrl = () => {
    const handle = formData.tiktokHandle.replace('@', '');
    return `buylink.ug/shop/${handle}`;
  };

  const handleCompleteSetup = () => {
    // Navigate to the subscription page
    navigate('/subscription');
  };

  const handleVisitLink = () => {
    // Open the shop link in a new tab
    const handle = formData.tiktokHandle.replace('@', '');
    window.open(`/shop/${handle}`, '_blank');
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="overflow-hidden">
        <CardContent className="p-lg space-y-lg">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step < currentStep
                      ? 'bg-success text-success-foreground'
                      : step === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-12 h-0.5 mx-2 transition-colors ${
                      step < currentStep ? 'bg-success' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="space-y-md">
            {currentStep === 1 && (
              <div className="space-y-md">
                <div className="text-center space-y-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <AtSign className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Enter Your TikTok Handle</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll verify your handle exists on TikTok
                  </p>
                </div>

                <div className="space-y-sm">
                  <Input
                    label="TikTok Handle"
                    placeholder="@yourhandle"
                    value={formData.tiktokHandle}
                    onChange={(e) => handleInputChange('tiktokHandle', e.target.value)}
                    helper={handleValidation.message || "Include the @ symbol"}
                    error={handleValidation.message && !handleValidation.isValid ? handleValidation.message : undefined}
                  />

                  {handleValidation.isValidating && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking TikTok handle...
                    </div>
                  )}

                  {handleValidation.isValid && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle className="w-4 h-4" />
                      {handleValidation.message}
                    </div>
                  )}

                  {handleValidation.message && !handleValidation.isValid && !handleValidation.isValidating && (
                    <div className="flex items-center gap-2 text-sm text-error">
                      <XCircle className="w-4 h-4" />
                      {handleValidation.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-md">
                <div className="text-center space-y-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Enter Your Phone Number</h3>
                  <p className="text-sm text-muted-foreground">
                    Customers will reach you on WhatsApp to buy
                  </p>
                </div>

                <div className="space-y-sm">
                  <div className="flex gap-sm">
                    <select 
                      className="flex h-12 w-20 rounded-ds-md border border-input bg-background px-2 text-sm"
                      value={formData.countryCode}
                      onChange={(e) => handleInputChange('countryCode', e.target.value)}
                    >
                      <option value="+256">🇺🇬 +256</option>
                      <option value="+254">🇰🇪 +254</option>
                      <option value="+255">🇹🇿 +255</option>
                    </select>
                    
                    <Input
                      placeholder="70 123 4567"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We'll never spam you or share your number
                  </p>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-md">
                <div className="text-center space-y-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Enter Verification Code</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to {formData.countryCode} {formData.phoneNumber}
                  </p>
                </div>

                <div className="space-y-md">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={formData.otpCode}
                      onChange={(value) => handleInputChange('otpCode', value)}
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

                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        // Resend OTP
                        signup.mutate({
                          handle: formData.tiktokHandle,
                          phoneNumber: formData.phoneNumber,
                          countryCode: formData.countryCode
                        });
                      }}
                      disabled={signup.isPending}
                    >
                      {signup.isPending ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex justify-between items-center pt-md">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1 || isStepLoading()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <Button
                variant="primary"
                onClick={handleValidateAndNext}
                disabled={!isStepValid() || isStepLoading()}
                className="gap-2"
              >
                {isStepLoading() && <Loader2 className="w-4 h-4 animate-spin" />}
                {getStepButtonText()}
                {!isStepLoading() && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          )}

          {/* OTP Verification Button */}
          {currentStep === 3 && (
            <div className="flex justify-between items-center pt-md">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={verifySignup.isPending}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <Button
                variant="primary"
                onClick={handleVerifyOTP}
                disabled={!isStepValid() || verifySignup.isPending}
                className="gap-2"
              >
                {verifySignup.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {verifySignup.isPending ? 'Verifying...' : 'Verify & Continue'}
                {!verifySignup.isPending && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          )}

          {/* No Password Note */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              🔒 No passwords required - we keep it simple
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
