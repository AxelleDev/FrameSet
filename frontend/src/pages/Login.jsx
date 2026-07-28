// Login page (route: /login): delegates auth to the context and navigates to the
// dashboard on success; offers a verification shortcut on unverified-email failures.
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import useUserCount from '../hooks/useUserCount';
import useFormState from '../hooks/useFormState';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, completeTotpLogin, loginWithGoogle, loginAsDemo } = useAuth();

  const { values: formData, setField } = useFormState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Set once login() (or Google sign-in — possibly from the register page,
  // which hands its challenge over via route state) reports the account has
  // 2FA enabled: the first factor already checked out, and this challenge
  // token is exchanged for the real session once the code below also
  // succeeds (see handleTotpSubmit).
  const [totpChallengeToken, setTotpChallengeToken] = useState(
    location.state?.totpChallengeToken ?? null,
  );
  const [totpCode, setTotpCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const handleChange = (e) => {
    setField(e.target.name, e.target.value);
  };

  // Validate locally, then authenticate; on success go to the dashboard,
  // on a 2FA-enabled account switch to the code-entry step, otherwise show
  // the returned business-error message inline.
  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!formData.email || !formData.password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    const result = await login(formData.email.trim(), formData.password);
    setSubmitting(false);

    if (result.success) {
      setError('');
      setErrorCode('');
      setRetryAfterSeconds(undefined);
      navigate('/app/dashboard');
    } else if (result.requiresTotp) {
      setError('');
      setErrorCode('');
      setRetryAfterSeconds(undefined);
      setTotpChallengeToken(result.challengeToken);
    } else if (result.message) {
      setError(result.message);
      setErrorCode(result.code || '');
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  // Second step of a 2FA-enabled login: exchanges the challenge token plus a
  // live authenticator code (or a single-use recovery code) for the session.
  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!totpCode.trim()) {
      setError(useRecoveryCode ? 'Enter a recovery code.' : 'Enter your 6-digit code.');
      return;
    }

    setSubmitting(true);
    const result = await completeTotpLogin(totpChallengeToken, totpCode.trim());
    setSubmitting(false);

    if (result.success) {
      navigate('/app/dashboard');
    } else if (result.message) {
      setError(result.message);
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  // Abandons the 2FA step and returns to the email/password form.
  const cancelTotpChallenge = () => {
    setTotpChallengeToken(null);
    setTotpCode('');
    setUseRecoveryCode(false);
    setError('');
    setRetryAfterSeconds(undefined);
  };

  // Google sign-in: the GIS button hands us a verified-by-Google credential;
  // the backend does the cryptographic check and opens the session.
  const handleGoogleCredential = async (credential) => {
    if (submitting) return;

    setSubmitting(true);
    const result = await loginWithGoogle(credential);
    setSubmitting(false);

    if (result.success) {
      setError('');
      setErrorCode('');
      setRetryAfterSeconds(undefined);
      navigate('/app/dashboard');
    } else if (result.requiresTotp) {
      // Google proved the identity, but the account has 2FA enabled: same
      // code-entry step as a password login.
      setError('');
      setErrorCode('');
      setRetryAfterSeconds(undefined);
      setTotpChallengeToken(result.challengeToken);
    } else if (result.message) {
      setError(result.message);
      setErrorCode('');
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  // Lets a recruiter/visitor explore instantly, without registering, on a
  // shared read-only account seeded with real project data.
  const handleDemoLogin = async () => {
    if (submitting) return;

    setSubmitting(true);
    const result = await loginAsDemo();
    setSubmitting(false);

    if (result.success) {
      setError('');
      setErrorCode('');
      setRetryAfterSeconds(undefined);
      navigate('/app/dashboard');
    } else if (result.message) {
      setError(result.message);
      setErrorCode('');
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
            Define your <br />
            <span className="font-bold text-primary">visual identity.</span>
          </h1>

          <p className="text-lg text-primary max-w-md leading-relaxed">
            FrameSet centralizes the graphic foundations of your creative projects, for a clear and
            confident art direction.
          </p>

          <div className="flex items-center space-x-4 pt-4">
            <span className="text-sm text-blue">
              {userCount !== null
                ? `Joined by ${userCount} illustrator${userCount > 1 ? 's' : ''}`
                : ' '}
            </span>
          </div>
        </>
      }
    >
      <AuthCard>
        <Seo
          title="Sign in"
          path="/login"
          description="Sign in to your FrameSet workspace to manage your projects' standards and palettes."
        />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">
            {totpChallengeToken ? 'Two-factor authentication' : 'Welcome back'}
          </h2>
          <p className="text-primary text-sm mt-2">
            {totpChallengeToken
              ? useRecoveryCode
                ? 'Enter one of your recovery codes.'
                : 'Enter the 6-digit code from your authenticator app.'
              : 'Pick up right where you left off.'}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} />
            {/* Offer a verification shortcut when login failed due to an unverified email */}
            {errorCode === 'EMAIL_NOT_VERIFIED' && (
              <Button
                type="button"
                onClick={() => navigate('/verify', { state: { email: formData.email.trim() } })}
                className="mt-3 w-full"
              >
                Verify my email
              </Button>
            )}
          </div>
        )}

        {totpChallengeToken ? (
          <form className="space-y-4" onSubmit={handleTotpSubmit} noValidate>
            <FormField label={useRecoveryCode ? 'Recovery code' : 'Verification code'} required>
              <TextInput
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder={useRecoveryCode ? 'XXXXX-XXXXX-XXXXX-XXXXX' : '123456'}
                autoComplete="one-time-code"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- focus belongs in the code field once this step opens
                autoFocus
              />
            </FormField>

            <Button type="submit" fullWidth className="mt-2" loading={submitting}>
              Verify
            </Button>

            <button
              type="button"
              onClick={() => setUseRecoveryCode((current) => !current)}
              className="block w-full text-center text-xs text-blue hover:text-primary transition-colors rounded focus-ring"
            >
              {useRecoveryCode ? 'Use my authenticator app instead' : 'Use a recovery code instead'}
            </button>

            <button
              type="button"
              onClick={cancelTotpChallenge}
              className="block w-full text-center text-xs text-primary/60 hover:text-primary transition-colors rounded focus-ring"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <>
            <form className="space-y-4" onSubmit={handleLogin} noValidate>
              <FormField label="Email" required>
                <TextInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </FormField>

              <div>
                <FormField label="Password" required>
                  <PasswordInput
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Your password"
                    autoComplete="current-password"
                  />
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue hover:text-primary transition-colors rounded focus-ring"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button type="submit" fullWidth className="mt-2" loading={submitting}>
                Sign in
              </Button>
            </form>

            <Divider className="my-6" />

            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={submitting} />

            <Button
              type="button"
              variant="outline"
              fullWidth
              className="mt-3"
              onClick={handleDemoLogin}
              disabled={submitting}
            >
              Try the demo — no account needed
            </Button>

            <TermsNotice />

            <div className="mt-8 text-center">
              <span className="text-sm text-primary">No account yet? </span>
              <Link
                to="/register"
                className="text-sm font-medium text-blue hover:text-primary transition-colors rounded focus-ring"
              >
                Create one
              </Link>
            </div>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
