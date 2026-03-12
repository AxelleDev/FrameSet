import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/Button';
import Card from '../components/Card';
import PasswordInput from '../components/PasswordInput';
import useUserCount from '../hooks/useUserCount';
import useFormState from '../hooks/useFormState';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const { values: formData, setField } = useFormState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setField(e.target.name, e.target.value);
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    const result = await login(formData.email, formData.password);
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
      variant="login"
      hero={
        <>
          <div className="flex items-center mb-2">
            <img src="/FrameSet_Logo.png" alt="Logo FrameSet" className="object-contain mr-2" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
          </div>
          
          <h1 className="text-6xl font-light tracking-tight text-primary leading-tight">
            Définissez votre <br />
            <span className="font-bold text-primary">Vérité Visuelle.</span>
          </h1>
          
          <p className="text-lg text-primary max-w-md leading-relaxed">
            FrameSet centralise les fondations graphiques de vos projets créatifs, pour une direction artistique claire et maîtrisée.
          </p>

          <div className="flex items-center space-x-4 pt-4">
            <span className="text-sm text-blue">
              {userCount !== null ? `Rejoint par ${userCount} Illustrateur${userCount > 1 ? 's' : ''}` : 'Rejoint par ... Illustrateurs'}
            </span>
          </div>
        </>
      }
    >
      <Card variant="card" className="w-full max-w-md p-10 rounded-3xl shadow-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Connexion</h2>
          <p className="text-primary text-sm mt-2">Reprenez là où vous vous êtes arrêté.</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-pink text-primary text-xs rounded-lg text-center font-medium">{error}
          {error.includes('vérifier votre email') && (
            <button
              onClick={() => navigate(`/verify?email=${encodeURIComponent(formData.email)}`)}
              className="mt-2 w-full py-2 bg-blue text-white rounded-xl hover:bg-pink transition-all text-sm font-medium"
            >
              Vérifier mon email
            </button>
          )}
        </div>}

        <div className="space-y-5">
          <div className="group">
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="email@exemple.com" />
          </div>
          
          <div className="group">
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Mot de passe</label>
            <PasswordInput
              name="password"
              value={formData.password}
              onChange={handleChange}
              inputClassName="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          
          <Button onClick={handleLogin} fullWidth className="mt-2">
            Continuer
          </Button>
        </div>

        <div className="mt-8 text-center flex flex-col gap-2">
          <Link to="/register" className="text-sm font-medium text-blue hover:text-pink transition-colors">Pas encore de compte ? Créer un compte</Link>
          <a href="#" className="text-xs text-blue hover:text-pink transition-colors">Mot de passe oublié ?</a>
        </div>
      </Card>
    </AuthLayout>
  );
}