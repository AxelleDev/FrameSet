// Registration page (/register): a two-step flow — identity (username + email)
// first, then password — validated on the client at each step; creating the
// account redirects to email verification.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import AuthCard from '../components/AuthCard';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Seo from '../components/Seo';
import PasswordInput from '../components/PasswordInput';
import TextInput from '../components/TextInput';
import RateLimitAlert from '../components/RateLimitAlert';
import Divider from '../components/Divider';
import TermsNotice from '../components/TermsNotice';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PasswordChecklist from '../components/PasswordChecklist';
import useUserCount from '../hooks/useUserCount';
import useFormState from '../hooks/useFormState';
import { isPasswordValid, isValidEmail } from '../utils/passwordRules';

export default function Register() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  // 'identity' (username + email) then 'password' — splitting the form keeps
  // the card short without shrinking any field or spacing.
  const [step, setStep] = useState('identity');
  const { values: formData, setField } = useFormState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setField(e.target.name, e.target.value);
  };

  // Live validation flags used for inline hints and to gate the submit button.
  const emailValid = isValidEmail(formData.email);
  const passwordValid = isPasswordValid(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const canContinue = formData.name.trim() !== '' && emailValid;
  const canSubmit = canContinue && passwordValid && passwordsMatch;

  // Step 1 → step 2 (Enter in either identity field lands here too).
  const handleContinue = (e) => {
    e.preventDefault();
    if (!canContinue || submitting) return;
    setError('');
    setStep('password');
  };

  // Step 2 back to step 1, keeping everything already typed.
  const handleBack = () => {
    if (submitting) return;
    setError('');
    setRetryAfterSeconds(undefined);
    setStep('identity');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    const result = await register({
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
    });
    setSubmitting(false);

    if (result.success) {
      setError('');
      setRetryAfterSeconds(undefined);
      // Prefer the server-confirmed email; fall back to what the user typed.
      const verificationEmail = result.data?.email || formData.email.trim();
      navigate('/verify', { state: { email: verificationEmail } });
    } else if (result.message) {
      setError(result.message);
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  // Google sign-up: the account arrives already verified by Google, so it goes
  // straight to the dashboard (no email-code step).
  const handleGoogleCredential = async (credential) => {
    if (submitting) return;

    setSubmitting(true);
    const result = await loginWithGoogle(credential);
    setSubmitting(false);

    if (result.success) {
      setError('');
      setRetryAfterSeconds(undefined);
      navigate('/app/dashboard');
    } else if (result.requiresTotp) {
      // The Google identity resolved to an existing account with 2FA enabled:
      // hand the challenge over to the login page's code-entry step.
      navigate('/login', { state: { totpChallengeToken: result.challengeToken } });
    } else if (result.message) {
      setError(result.message);
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  const userCount = useUserCount();

  return (
    <AuthLayout
      swapOnMobile
      hero={
        <>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-primary leading-tight">
            Build your <br />
            <span className="font-bold text-primary">reference.</span>
          </h1>

          <p className="text-lg text-primary max-w-md leading-relaxed">
            Start structuring the graphic foundations of your projects and give your creative world
            a clear, consistent direction.
          </p>

          <div className="space-y-4 pt-2">
            <div className="border-l-2 border-blue/40 pl-5 space-y-1.5">
              <p className="text-sm font-medium text-primary">
                "I kept forgetting the exact brush size or black I'd used the day before — so I
                built FrameSet to never lose that again."
              </p>
              <p className="text-xs text-blue uppercase tracking-widest">
                Axelle, illustrator &amp; creator of FrameSet
              </p>
            </div>
            <p className="text-sm text-blue">
              {userCount !== null
                ? `Joined by ${userCount} illustrator${userCount > 1 ? 's' : ''}`
                : ' '}
            </p>
          </div>
        </>
      }
    >
      <AuthCard>
        <Seo
          title="Create account"
          path="/register"
          description="Create your FrameSet account and start structuring the graphic foundations of your projects."
        />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Create your account</h2>
          <p className="text-primary text-sm mt-2">
            {step === 'identity'
              ? 'Step 1 of 2 — choose your username and email.'
              : 'Step 2 of 2 — secure your account with a password.'}
          </p>
        </div>

        {error && (
          <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} className="mb-4" />
        )}

        {step === 'identity' ? (
          <>
            <form className="space-y-4" onSubmit={handleContinue} noValidate>
              <FormField label="Username" required>
                <TextInput
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your username"
                  autoComplete="nickname"
                />
              </FormField>

              <FormField
                label="Email"
                required
                error={formData.email !== '' && !emailValid ? 'Invalid email format.' : undefined}
              >
                <TextInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </FormField>

              <Button type="submit" fullWidth className="mt-2" disabled={!canContinue}>
                Continue
              </Button>
            </form>

            <Divider className="my-6" />

            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={submitting} />

            <TermsNotice />

            <div className="mt-8 text-center">
              <span className="text-sm text-primary">Already have an account? </span>
              <Link
                to="/login"
                className="text-sm font-medium text-blue hover:text-primary transition-colors rounded focus-ring"
              >
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister} noValidate>
            <div>
              <FormField label="Password" required>
                <PasswordInput
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  autoComplete="new-password"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus belongs in the first password field when this step opens
                  autoFocus
                />
              </FormField>
              <PasswordChecklist password={formData.password} />
            </div>

            <FormField
              label="Confirm password"
              required
              error={
                formData.confirmPassword !== '' && !passwordsMatch
                  ? "Passwords don't match."
                  : undefined
              }
            >
              <PasswordInput
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
            </FormField>

            <Button
              type="submit"
              fullWidth
              className="mt-2"
              disabled={!canSubmit}
              loading={submitting}
            >
              Create account
            </Button>

            <button
              type="button"
              onClick={handleBack}
              className="block w-full text-center text-xs text-primary/60 hover:text-primary transition-colors rounded focus-ring"
            >
              Back to username and email
            </button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
