import React from 'react';
import { Check, X } from 'lucide-react';
import { validatePassword, getPasswordStrength, type PasswordRequirement } from '@/lib/password-validation';

interface PasswordRequirementsProps {
  password: string;
  showStrength?: boolean;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ 
  password, 
  showStrength = true 
}) => {
  const requirements = validatePassword(password);
  const strength = getPasswordStrength(password);

  return (
    <div className="space-y-3">
      {showStrength && password && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Password strength:</span>
            <span className={`font-medium ${strength.color}`}>{strength.label}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                strength.score < 40 
                  ? 'bg-red-500' 
                  : strength.score < 80 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${strength.score}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Password must contain:</p>
        <ul className="space-y-1">
          {requirements.map((requirement) => (
            <li key={requirement.id} className="flex items-center gap-2 text-sm">
              {requirement.met ? (
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <span className={requirement.met ? 'text-green-700' : 'text-muted-foreground'}>
                {requirement.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
