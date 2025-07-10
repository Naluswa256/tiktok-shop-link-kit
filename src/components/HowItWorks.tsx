
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Video, Sparkles, MessageCircle } from 'lucide-react';

export const HowItWorks = () => {
  const steps = [
    {
      number: '1',
      icon: <Video className="w-6 h-6" />,
      title: 'Post on TikTok',
      description: 'Create your product video and add #TRACK in the caption'
    },
    {
      number: '2', 
      icon: <Sparkles className="w-6 h-6" />,
      title: 'We Auto-Create',
      description: 'Our AI extracts product details and creates your listing'
    },
    {
      number: '3',
      icon: <MessageCircle className="w-6 h-6" />,
      title: 'Buyers Message You',
      description: 'They click "Buy on WhatsApp" and message you directly'
    }
  ];

  return (
    <div className="space-y-lg">
      <div className="text-center space-y-sm">
        <h2 className="text-xl font-semibold text-foreground">
          How It Works
        </h2>
        <p className="text-sm text-muted-foreground">
          Turn your TikTok into sales in 3 simple steps
        </p>
      </div>
      
      <div className="grid gap-md sm:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.number} className="relative">
            <CardContent className="p-lg text-center space-y-md">
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  {step.icon}
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  {step.number}
                </div>
              </div>
              
              <div className="space-y-sm">
                <h3 className="font-semibold text-base">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </CardContent>
            
            {/* Connector Arrow */}
            {index < steps.length - 1 && (
              <div className="hidden sm:block absolute top-1/2 -right-6 transform -translate-y-1/2 text-muted-foreground">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
