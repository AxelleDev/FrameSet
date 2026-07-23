// Registration page (/register): collect name/email/password, validate on the
// client, create the account, then redirect to email verification.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import AuthLogoLink from '../components/AuthLogoLink';
import AuthCard from '../components/AuthCard';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Seo from '../components/Seo';
import PasswordInput from '../components/PasswordInput';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
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

  const { values: formData, setField } = useFormState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setField(e.target.name, e.target.value);
  };

  // Live validation flags used for inline hints and to gate the submit button.
  const emailValid = isValidEmail(formData.email);
  const passwordValid = isPasswordValid(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const canSubmit = formData.name.trim() !== '' && emailValid && passwordValid && passwordsMatch;

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
      // Prefer the server-confirmed email; fall back to what the user typed.
      const verificationEmail = result.data?.email || formData.email.trim();
      navigate('/verify', { state: { email: verificationEmail } });
    } else if (result.message) {
      setError(result.message);
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
      navigate('/app/dashboard');
    } else if (result.message) {
      setError(result.message);
    }
  };

  const userCount = useUserCount();

  return (
    <AuthLayout
      swapOnMobile
      hero={
        <>
          <AuthLogoLink />
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
                "An essential tool for picking a project back up without losing my graphic
                settings."
              </p>
              <p className="text-xs text-blue uppercase tracking-widest">Alyse C., Illustrator</p>
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
          <p className="text-primary text-sm mt-2">Your graphic reference starts here.</p>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleRegister} noValidate>
          <FormField label="Full name" required>
            <TextInput
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Jane Doe"
              autoComplete="name"
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

          <div>
            <FormField label="Password" required>
              <PasswordInput
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Your password"
                autoComplete="new-password"
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
        </form>

        <Divider className="my-6" />

        <GoogleSignInButton onCredential={handleGoogleCredential} disabled={submitting} />

        <TermsNotice />

        <div className="mt-8 text-center">
          <span className="text-sm text-primary">Already have an account? </span>
          <Link
            to="/login"
            className="text-sm font-medium text-blue hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
