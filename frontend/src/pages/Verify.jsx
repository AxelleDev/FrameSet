// Email verification page (route: /verify): the email + flow `type` are passed
// via router navigation state (so the email never lands in the URL / history /
// Referer). `type` picks the flow — signup (-> /login) or "pending-email"
// change (-> /app/profile). Falls back to a query string, then to manual entry.
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import AuthLogoLink from '../components/AuthLogoLink';
import AuthCard from '../components/AuthCard';
import Seo from '../components/Seo';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
import Button from '../components/Button';

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, resendVerificationCode, verifyPendingEmail, resendPendingEmailCode } =
    useAuth();
  // Prefer router state (keeps the email out of the URL); fall back to the query
  // string for older links, then to manual entry when nothing was provided.
  const routeState = location.state || {};
  const params = new URLSearchParams(location.search);
  const initialEmail = routeState.email || params.get('email') || '';
  const type = routeState.type || params.get('type') || undefined;
  const emailWasProvided = Boolean(initialEmail);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  // Guards against a double submit (e.g. a double-Enter firing /auth/verify twice);
  // the submit Button is type="submit", so it doesn't get onClick auto-loading.
  const [submitting, setSubmitting] = useState(false);

  // Submit the code through the matching flow, then redirect after a short delay.
  const handleVerify = async () => {
    if (submitting) return;
    setError('');
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const result =
        type === 'pending-email'
          ? await verifyPendingEmail(email, code)
          : await verifyEmail(email, code);

      if (result.success) {
        setSuccess(true);
        // Brief success message before redirecting to the relevant destination.
        setTimeout(() => navigate(type === 'pending-email' ? '/app/profile' : '/login'), 2000);
      } else {
        setError(result.message || 'That code is incorrect.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Request a fresh code via the matching flow.
  const handleResend = async () => {
    if (submitting) return;
    setResendMsg('');
    setError('');
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const result =
        type === 'pending-email'
          ? await resendPendingEmailCode(email)
          : await resendVerificationCode(email);

      if (result.success) {
        setResendMsg('Code resent! Check your email.');
      } else {
        setError(result.message || 'Something went wrong sending the code.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      swapOnMobile
      hero={
        <>
          <AuthLogoLink />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-primary leading-tight">
            Confirm <br />
            <span className="font-bold text-primary">your email.</span>
          </h1>
          <p className="text-lg text-primary max-w-md leading-relaxed">
            One last step: enter the code we just sent you to activate your access.
          </p>
        </>
      }
    >
      <AuthCard>
        <Seo title="Email verification" path="/verify" noindex />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Email verification</h2>
          <p className="text-primary text-sm mt-2">
            {emailWasProvided ? (
              <>
                Enter the code sent to <strong className="break-all">{email}</strong>.
              </>
            ) : (
              'Enter your email and the verification code you received.'
            )}
          </p>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}
        {resendMsg && (
          <Alert variant="info" className="mb-4">
            {resendMsg}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-4">
            Verified! Redirecting…
          </Alert>
        )}

        {!success && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            noValidate
          >
            {!emailWasProvided && (
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </FormField>
            )}

            <FormField label="Verification code">
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
              <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
                Verify
              </Button>
              <Button
                type="button"
                onClick={handleResend}
                variant="ghost"
                className="w-full"
                disabled={submitting}
              >
                Resend code
              </Button>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
