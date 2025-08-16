import { useState } from 'react';
import { Button, Input } from '@/components/tiktok-commerce';
import { MessageCircle, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface WhatsAppPromptProps {
  onClose: () => void;
  onSuccess: (phoneNumber: string) => void;
  trigger?: 'tooltip' | 'modal';
}

export const WhatsAppPrompt = ({ onClose, onSuccess, trigger = 'modal' }: WhatsAppPromptProps) => {
  const { token } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a WhatsApp number');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error('Please enter a valid WhatsApp number in international format (e.g., +256700123456)');
      return;
    }

    if (!token) {
      toast.error('Please sign in to update your profile');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.updateProfile(token, {
        phoneNumber: phoneNumber
      });
      
      toast.success('WhatsApp number added successfully!');
      onSuccess(phoneNumber);
      onClose();
    } catch (error) {
      toast.error('Failed to save WhatsApp number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Add WhatsApp Number</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add your WhatsApp number so customers can contact you directly about your products.
        </p>

        <Input
          label="WhatsApp Number"
          placeholder="+256700123456"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          helper="Include country code (e.g., +256 for Uganda)"
        />

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">💡 Benefits:</p>
            <ul className="text-xs space-y-1">
              <li>• Direct customer communication with product links</li>
              <li>• Customers can share specific products easily</li>
              <li>• Faster response times and sales conversion</li>
              <li>• Build stronger customer relationships</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            Skip for Now
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1 gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Number
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (trigger === 'tooltip') {
    return (
      <div className="absolute top-full left-0 mt-2 w-80 z-50">
        <Card className="shadow-lg border-primary/20">
          <CardContent className="p-4">
            {content}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {content}
        </CardContent>
      </Card>
    </div>
  );
};

// Hook to manage WhatsApp prompt state
export const useWhatsAppPrompt = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<'tooltip' | 'modal'>('modal');

  const openPrompt = (triggerType: 'tooltip' | 'modal' = 'modal') => {
    setTrigger(triggerType);
    setIsOpen(true);
  };

  const closePrompt = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    trigger,
    openPrompt,
    closePrompt,
  };
};
