// Login page (route: /login): delegates auth to the context and navigates to the
// dashboard on success; offers a verification shortcut on unverified-email failures.
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
import GoogleSignInButton from '../components/GoogleSignInButton';
import useUserCount from '../hooks/useUserCount';
import useFormState from '../hooks/useFormState';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const { values: formData, setField } = useFormState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setField(e.target.name, e.target.value);
  };

  // Validate locally, then authenticate; on success go to the dashboard,
  // otherwise show the returned business-error message inline.
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
      navigate('/app/dashboard');
    } else if (result.message) {
      setError(result.message);
      setErrorCode(result.code || '');
    }
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
      navigate('/app/dashboard');
    } else if (result.message) {
      setError(result.message);
      setErrorCode('');
    }
  };

  const userCount = useUserCount();

  return (
    <AuthLayout
      swapOnMobile
     
      hero={
        <>
          <div className="flex items-center mb-2">
            <Link to="/" aria-label="Go to homepage" className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-24 sm:w-20">
              <Logo className="object-contain w-full h-auto" />
            </Link>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-primary leading-tight">
            Define your <br />
            <span className="font-bold text-primary">visual identity.</span>
          </h1>

          <p className="text-lg text-primary max-w-md leading-relaxed">
            FrameSet centralizes the graphic foundations of your creative projects, for a clear and confident art direction.
          </p>

          <div className="flex items-center space-x-4 pt-4">
            <span className="text-sm text-blue">
              {userCount !== null ? `Joined by ${userCount} illustrator${userCount > 1 ? 's' : ''}` : ' '}
            </span>
          </div>
        </>
      }
    >
      <Card className="w-full max-w-md p-6 sm:p-10 rounded-3xl  animate-fade-in" style={{ animationDelay: '150ms' }}>
        <Seo title="Sign in" path="/login" description="Sign in to your FrameSet workspace to manage your projects' standards and palettes." />
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Welcome back</h2>
          <p className="text-primary text-sm mt-2">Pick up right where you left off.</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="danger">{error}</Alert>
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

        <form className="space-y-5" onSubmit={handleLogin} noValidate>
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

          <FormField label="Password" required>
            <PasswordInput
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </FormField>

          <Button type="submit" fullWidth className="mt-2" loading={submitting}>
            Sign in
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-primary/10" />
          <span className="text-xs uppercase tracking-widest text-primary/50">or</span>
          <span className="h-px flex-1 bg-primary/10" />
        </div>

        <GoogleSignInButton onCredential={handleGoogleCredential} disabled={submitting} />

        <div className="mt-8 text-center flex flex-col gap-2">
          <Link to="/register" className="text-sm font-medium text-blue hover:text-primary transition-colors">No account yet? Create one</Link>
          <Link to="/forgot-password" className="text-xs text-blue hover:text-primary transition-colors">Forgot password?</Link>
        </div>
      </Card>
    </AuthLayout>
  );
}
