// Mise en page pour les pages d'authentification.
import React from 'react';

export default function AuthLayout({ hero, children, variant = 'login', swapOnMobile = false }) {
  const heroOrderClass = swapOnMobile ? 'order-2 md:order-1' : 'order-1';
  const formOrderClass = swapOnMobile ? 'order-1 md:order-2' : 'order-2';

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#F8F9FF] text-primary">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        {variant === 'register' ? (
          <>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-pink/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute top-[20%] right-[20%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-pink/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
          </>
        )}
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 p-8">
        <div className={`flex flex-col justify-center space-y-6 animate-fade-in ${heroOrderClass}`}>
          {hero}
        </div>
        <div className={`flex items-center justify-center md:justify-end ${formOrderClass}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
