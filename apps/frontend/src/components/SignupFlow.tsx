
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/tiktok-commerce';
import { ArrowRight, ArrowLeft, Check, AtSign, ExternalLink, Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shopLink, setShopLink] = useState<string>('');

  const [handleValidation, setHandleValidation] = useState<ValidationState>({
    isValid: false,
    isValidating: false
  });

  const { validateHandle, passwordSignup, isLoading } = useAuthFlow();

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
      // Create account with password
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      try {
        const response = await passwordSignup.mutateAsync({
          handle: formData.tiktokHandle,
          password: formData.password
        });
        setShopLink(response.data.shopLink);
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

  // Handle completing the signup flow
  const handleCompleteSignup = () => {
    // Navigate to the actual shop page for owner setup
    if (shopLink) {
      navigate(shopLink);
    } else {
      const handle = cleanTikTokHandle(formData.tiktokHandle);
      navigate(`/shop/${handle}`);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.tiktokHandle.length > 0 && !handleValidation.isValidating;
      case 2:
        return formData.password.length >= 8 &&
               formData.confirmPassword.length >= 8 &&
               formData.password === formData.confirmPassword;
      case 3:
        return true; // Success step
      default:
        return false;
    }
  };

  const getStepButtonText = () => {
    switch (currentStep) {
      case 1:
        return handleValidation.isValidating ? 'Validating...' : 'Validate Handle';
      case 2:
        return passwordSignup.isPending ? 'Creating Account...' : 'Create Account';
      case 3:
        return 'Visit Your Shop';
      default:
        return 'Continue';
    }
  };

  const isStepLoading = () => {
    switch (currentStep) {
      case 1:
        return handleValidation.isValidating;
      case 2:
        return passwordSignup.isPending;
      case 3:
        return false;
      default:
        return false;
    }
  };

  const getShopUrl = () => {
    if (shopLink) {
      return `${window.location.origin}${shopLink}`;
    }
    const handle = formData.tiktokHandle.replace('@', '');
    return `${window.location.origin}/shop/${handle}`;
  };



  const handleVisitLink = () => {
    // Open the shop link in a new tab
    if (shopLink) {
      window.open(shopLink, '_blank');
    } else {
      const handle = formData.tiktokHandle.replace('@', '');
      window.open(`/shop/${handle}`, '_blank');
    }
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
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Create Your Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a secure password for your account
                  </p>
                </div>

                <div className="space-y-sm">
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      helper="Must be at least 8 characters long"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label="Confirm Password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      error={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'Passwords do not match' : undefined}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Your password will be used to sign in to your account
                  </p>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-md">
                <div className="text-center space-y-sm">
                  <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold">Account Created Successfully!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your shop is ready and live at:
                  </p>
                </div>

                <div className="space-y-md">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Your Shop Link</p>
                      <p className="text-lg font-semibold text-primary break-all">
                        {getShopUrl()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleVisitLink}
                      className="flex-1 gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visit Shop
                    </Button>
                    <Button
                      onClick={handleCompleteSignup}
                      className="flex-1"
                    >
                      Continue Setup
                    </Button>
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

          {/* Success step - no navigation needed */}
        </CardContent>
      </Card>
    </div>
  );
};
