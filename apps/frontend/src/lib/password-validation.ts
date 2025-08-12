export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  met?: boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    test: (password: string) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'One special character (!@#$%^&*)',
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  },
];

export const validatePassword = (password: string): PasswordRequirement[] => {
  return PASSWORD_REQUIREMENTS.map(requirement => ({
    ...requirement,
    met: requirement.test(password),
  }));
};

export const isPasswordValid = (password: string): boolean => {
  return PASSWORD_REQUIREMENTS.every(requirement => requirement.test(password));
};

export const getPasswordStrength = (password: string): {
  score: number;
  label: string;
  color: string;
} => {
  const metRequirements = PASSWORD_REQUIREMENTS.filter(req => req.test(password)).length;
  const score = (metRequirements / PASSWORD_REQUIREMENTS.length) * 100;
  
  if (score < 40) {
    return { score, label: 'Weak', color: 'text-red-500' };
  } else if (score < 80) {
    return { score, label: 'Medium', color: 'text-yellow-500' };
  } else {
    return { score, label: 'Strong', color: 'text-green-500' };
  }
};
