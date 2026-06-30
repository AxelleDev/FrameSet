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
import AuthLayout from '../components/AuthLayout';
import Logo from '../components/Logo';
import Card from '../components/Card';
import Seo from '../components/Seo';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
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
    <AuthLayout
     
      hero={
        <>
          <div className="flex items-center mb-2">
            <Logo className="object-contain mr-2" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
          </div>
          <h1 className="text-6xl font-light tracking-tight text-primary leading-tight">
            Confirmez <br />
            <span className="font-bold text-primary">votre email.</span>
          </h1>
          <p className="text-lg text-primary max-w-md leading-relaxed">
            Une dernière étape : saisissez le code que nous venons de vous envoyer pour activer votre accès.
          </p>
        </>
      }
    >
      <Card className="w-full max-w-md p-10 rounded-3xl  animate-fade-in" style={{ animationDelay: '150ms' }}>
        <Seo title="Vérification de l’email" path="/verify" noindex />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Vérification</h2>
          <p className="text-primary text-sm mt-2">
            Entrez le code envoyé à <strong>{email}</strong>.
          </p>
        </div>

        {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
        {resendMsg && <Alert variant="info" className="mb-4">{resendMsg}</Alert>}
        {success && <Alert variant="success" className="mb-4">Vérifié ! Redirection en cours…</Alert>}

        {!success && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleVerify(); }} noValidate>
            <FormField label="Code de vérification">
              <TextInput
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="tracking-widest"
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </FormField>

            <div className="flex flex-col gap-3">
              <Button type="submit" fullWidth>Vérifier</Button>
              <Button type="button" onClick={handleResend} variant="ghost" className="w-full">
                Renvoyer le code
              </Button>
            </div>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
