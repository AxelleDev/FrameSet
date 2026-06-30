/**
 * Registration page (route: /register).
 *
 * Collects name + email + password (with confirmation), validates everything on
 * the client (email format, live password policy, matching confirmation), then
 * creates the account via the auth context and redirects to email verification.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Logo from '../components/Logo';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Card from '../components/Card';
import PasswordInput from '../components/PasswordInput';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
import PasswordChecklist from '../components/PasswordChecklist';
import useUserCount from '../hooks/useUserCount';
import useFormState from '../hooks/useFormState';
import { isPasswordValid, isValidEmail } from '../utils/passwordRules';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

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
  const canSubmit =
    formData.name.trim() !== '' && emailValid && passwordValid && passwordsMatch;

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
      navigate(`/verify?email=${encodeURIComponent(verificationEmail)}`);
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
          <div className="flex items-center mb-2">
            <Logo className="object-contain mr-2" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
          </div>
          <h1 className="text-6xl font-light tracking-tight text-primary leading-tight">
            Rejoignez le <br />
            <span className="font-bold text-primary">Référentiel.</span>
          </h1>

          <p className="text-lg text-primary max-w-md leading-relaxed">
            Commencez à structurer les fondations graphiques de vos projets et donnez à votre univers créatif une direction claire et cohérente.
          </p>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-primary">"Un outil essentiel pour reprendre un projet sans perdre mes réglages graphiques."</p>
              <p className="text-xs text-blue uppercase tracking-widest">Alyse C., Illustratrice</p>
            </div>
            <p className="text-sm text-blue">
              {userCount !== null ? `Rejoint par ${userCount} Illustrateur${userCount > 1 ? 's' : ''}` : 'Rejoint par ... Illustrateurs'}
            </p>
          </div>
        </>
      }
    >
      <Card className="w-full max-w-md p-10 rounded-3xl  animate-fade-in" style={{ animationDelay: '150ms' }}>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Inscription</h2>
          <p className="text-primary text-sm mt-2">Votre référence graphique commence ici.</p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleRegister} noValidate>
          <FormField label="Nom Complet">
            <TextInput
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="ex: Prénom Nom"
              autoComplete="name"
            />
          </FormField>

          <FormField label="Email">
            <TextInput
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@exemple.com"
              autoComplete="email"
            />
            {formData.email !== '' && !emailValid && (
              <p className="text-xs text-danger mt-1">Format d'email invalide.</p>
            )}
          </FormField>

          <FormField label="Mot de passe">
            <PasswordInput
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Votre mot de passe"
              autoComplete="new-password"
            />
            <PasswordChecklist password={formData.password} />
          </FormField>

          <FormField label="Confirmer le mot de passe">
            <PasswordInput
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Retapez votre mot de passe"
              autoComplete="new-password"
            />
            {formData.confirmPassword !== '' && !passwordsMatch && (
              <p className="text-xs text-danger mt-1">Les mots de passe ne correspondent pas.</p>
            )}
          </FormField>

          <Button type="submit" fullWidth className="mt-2" disabled={!canSubmit} loading={submitting}>
            Créer un compte
          </Button>
        </form>

        <div className="mt-8 text-center">
          <span className="text-sm text-primary">Vous avez déjà un compte ? </span>
          <Link to="/login" className="text-sm font-medium text-blue hover:text-primary transition-colors">Se connecter</Link>
        </div>
      </Card>
    </AuthLayout>
  );
}
