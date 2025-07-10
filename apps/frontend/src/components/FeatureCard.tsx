
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  highlight
}) => {
  return (
    <Card className="group hover:shadow-elevation-md transition-shadow">
      <CardContent className="p-lg text-center space-y-md">
        <div className="w-12 h-12 bg-primary/10 rounded-ds-lg flex items-center justify-center mx-auto text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        
        <div className="space-y-sm">
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          {highlight && (
            <div className="inline-flex px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded-ds-sm">
              {highlight}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
