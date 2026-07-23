import React from 'react';
import Card from './Card';

// The panel wrapping every auth form (Login, Register, ForgotPassword, Verify)
// inside AuthLayout — same size, radius and fade-in entrance everywhere.
export default function AuthCard({ children }) {
  return (
    <Card
      className="w-full max-w-md p-6 sm:p-10 rounded-3xl animate-fade-in"
      style={{ animationDelay: '150ms' }}
    >
      {children}
    </Card>
  );
}
