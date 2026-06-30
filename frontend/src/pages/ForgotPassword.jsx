/**
 * Forgot-password page (route: /forgot-password).
 *
 * Two steps on a single page:
 *   1. "request" — the user enters their email; the backend emails a reset code
 *      (responding the same way whether or not the account exists).
 *   2. "reset"   — the user enters the code and a new password (with live policy
 *      feedback and confirmation), then is redirected to the login page.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Logo from '../components/Logo';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Card from '../components/Card';
import Seo from '../components/Seo';
import PasswordInput from '../components/PasswordInput';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
import PasswordChecklist from '../components/PasswordChecklist';
import useFormState from '../hooks/useFormState';
import { isPasswordValid, isValidEmail } from '../utils/passwordRules';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset, resetPassword } = useAuth();

  const [step, setStep] = useState('request');
  const { values: form, setField } = useFormState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setField(e.target.name, e.target.value);

  const emailValid = isValidEmail(form.email);
  const passwordValid = isPasswordValid(form.newPassword);
  const passwordsMatch = form.newPassword === form.confirmPassword;
  const canRequest = emailValid;
  const canReset = form.code.trim() !== '' && passwordValid && passwordsMatch;

  // Step 1: request a reset code by email.
  const handleRequest = async (e) => {
    e.preventDefault();
    if (!canRequest || submitting) return;

    setSubmitting(true);
    const result = await requestPasswordReset(form.email.trim());
    setSubmitting(false);

    if (result.success) {
      setError('');
      setInfo('Si un compte existe pour cet email, un code de réinitialisation vient d\'être envoyé.');
      setStep('reset');
    } else if (result.message) {
      setError(result.message);
    }
  };

  // Step 2: submit the code and the new password.
  const handleReset = async (e) => {
    e.preventDefault();
    if (!canReset || submitting) return;

    setSubmitting(true);
    const result = await resetPassword(form.email.trim(), form.code.trim(), form.newPassword);
    setSubmitting(false);

    if (result.success) {
      // Send the user to the login page to sign in with the new password.
      navigate('/login');
    } else if (result.message) {
      setError(result.message);
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
            Mot de passe <br />
            <span className="font-bold text-primary">oublié ?</span>
          </h1>
          <p className="text-lg text-primary max-w-md leading-relaxed">
            Pas de panique. Indiquez votre email, recevez un code, et choisissez un nouveau mot de passe.
          </p>
        </>
      }
    >
      <Card className="w-full max-w-md p-10 rounded-3xl  animate-fade-in" style={{ animationDelay: '150ms' }}>
        <Seo title="Mot de passe oublié" path="/forgot-password" description="Réinitialisez le mot de passe de votre compte FrameSet." />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Réinitialisation</h2>
          <p className="text-primary text-sm mt-2">
            {step === 'request'
              ? 'Étape 1 sur 2 — entrez votre email pour recevoir un code.'
              : 'Étape 2 sur 2 — entrez le code reçu et votre nouveau mot de passe.'}
          </p>
        </div>

        {info && (
          <Alert variant="info" className="mb-4">{info}</Alert>
        )}
        {error && (
          <Alert variant="danger" className="mb-4">{error}</Alert>
        )}

        {step === 'request' ? (
          <form className="space-y-5" onSubmit={handleRequest} noValidate>
            <FormField label="Email">
              <TextInput
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@exemple.com"
                autoComplete="email"
              />
              {form.email !== '' && !emailValid && (
                <p className="text-xs text-danger mt-1">Format d'email invalide.</p>
              )}
            </FormField>

            <Button type="submit" fullWidth className="mt-2" disabled={!canRequest} loading={submitting}>
              Envoyer le code
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleReset} noValidate>
            <FormField label="Code de réinitialisation">
              <TextInput
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                className="tracking-widest"
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </FormField>

            <FormField label="Nouveau mot de passe">
              <PasswordInput
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Votre nouveau mot de passe"
                autoComplete="new-password"
              />
              <PasswordChecklist password={form.newPassword} />
            </FormField>

            <FormField label="Confirmer le mot de passe">
              <PasswordInput
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirmez votre mot de passe"
                autoComplete="new-password"
              />
              {form.confirmPassword !== '' && !passwordsMatch && (
                <p className="text-xs text-danger mt-1">Les mots de passe ne correspondent pas.</p>
              )}
            </FormField>

            <Button type="submit" fullWidth className="mt-2" disabled={!canReset} loading={submitting}>
              Réinitialiser le mot de passe
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm font-medium text-blue hover:text-primary transition-colors">Retour à la connexion</Link>
        </div>
      </Card>
    </AuthLayout>
  );
}
