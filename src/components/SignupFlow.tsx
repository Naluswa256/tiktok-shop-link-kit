
import React, { useState } from 'react';
import { Button, Input } from '@/components/tiktok-commerce';
import { ArrowRight, ArrowLeft, Check, Phone, AtSign, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Step = 1 | 2 | 3;

export const SignupFlow = () => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    tiktokHandle: '',
    phoneNumber: '',
    countryCode: '+256' // Default to Uganda
  });

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.tiktokHandle.length > 0;
      case 2:
        return formData.phoneNumber.length >= 9;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const getShopUrl = () => {
    const handle = formData.tiktokHandle.replace('@', '');
    return `tiktokshop.ug/shop/${handle}`;
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
                    We'll use this to find your videos and create your shop
                  </p>
                </div>

                <Input
                  label="TikTok Handle"
                  placeholder="@yourhandle"
                  value={formData.tiktokHandle}
                  onChange={(e) => handleInputChange('tiktokHandle', e.target.value)}
                  helper="Include the @ symbol"
                />
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
                  <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-success">You're In!</h3>
                  <p className="text-sm text-muted-foreground">
                    Preview your shop link below
                  </p>
                </div>

                <div className="bg-muted/50 rounded-ds-md p-md space-y-sm">
                  <p className="text-sm font-medium">Your Shop Link:</p>
                  <div className="flex items-center gap-sm p-sm bg-background rounded-ds-sm border">
                    <code className="text-sm text-primary flex-1">{getShopUrl()}</code>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link anywhere - Instagram bio, WhatsApp status, or SMS
                  </p>
                </div>

                <div className="text-center">
                  <Button variant="primary" size="block">
                    Complete Setup
                  </Button>
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
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!isStepValid()}
                className="gap-2"
              >
                {currentStep === 2 ? 'Finish' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* No Password Note */}
          {currentStep < 3 && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                🔒 No passwords required - we keep it simple
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
