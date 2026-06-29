/**
 * Email verification page (route: /verify?email=...&type=...).
 *
 * Used for two flows, distinguished by the `type` query param:
 *   - default ("signup"): confirm a new account's email, then go to /login.
 *   - "pending-email": confirm a pending email change, then go to the profile.
 * The user enters the emailed code and can also request a new code.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, resendVerificationCode, verifyPendingEmail, resendPendingEmailCode } = useAuth();
  // Email and flow type are passed via query string from the originating page.
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const type = params.get('type');

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  // Submit the code through the matching flow, then redirect after a short delay.
  const handleVerify = async () => {
    setError('');
    const result = type === 'pending-email'
      ? await verifyPendingEmail(email, code)
      : await verifyEmail(email, code);

    if (result.success) {
      setSuccess(true);
      // Brief success message before redirecting to the relevant destination.
      setTimeout(() => navigate(type === 'pending-email' ? '/app/profile' : '/login'), 2000);
    } else {
      setError(result.message || 'Code incorrect');
    }
  };

  // Request a fresh code via the matching flow.
  const handleResend = async () => {
    setResendMsg('');
    setError('');
    const result = type === 'pending-email'
      ? await resendPendingEmailCode(email)
      : await resendVerificationCode(email);

    if (result.success) {
      setResendMsg('Code renvoyé ! Vérifiez votre email.');
    } else {
      setError(result.message || "Erreur lors de l'envoi du code.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FF] text-primary">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md border border-primary">
        <h2 className="text-2xl font-bold mb-4 text-blue">Vérification de l'email</h2>
        <p className="mb-6 text-primary">Entrez le code envoyé à <strong>{email}</strong>.</p>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Code de vérification"
          className="w-full px-4 py-3 mb-4 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue"
        />
        {error && <div className="text-pink mb-4" aria-live="polite" role="alert">{error}</div>}
        {resendMsg && <div className="text-blue mb-4">{resendMsg}</div>}
        <div className="flex gap-2">
          {!success && (
            <>
              <Button
                onClick={handleVerify}
                fullWidth
                className="py-3"
              >
                Vérifier
              </Button>
              <Button
                onClick={handleResend}
                fullWidth
                variant="ghost"
                className="py-3 bg-blue/10 text-blue font-medium hover:bg-pink/10"
              >
                Renvoyer le code
              </Button>
            </>
          )}
        </div>
        {success && <div className="text-pink font-semibold">Vérifié ! Redirection...</div>}
      </div>
    </div>
  );
}
