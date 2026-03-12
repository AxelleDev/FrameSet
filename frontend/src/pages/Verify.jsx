import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Button from '../components/Button';

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyUserUpdate, setGlobalError } = useAuth();
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const type = params.get('type');

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const handleVerify = async () => {
    setError('');
    try {
      const data = await api.post(type === 'pending-email' ? '/users/email/verify' : '/auth/verify', { email, code }, { onGlobalError: setGlobalError });
      if (data.success) {
        if (type === 'pending-email' && data.user) {
          applyUserUpdate(data.user);
        }
        setSuccess(true);
        setError('');
        setTimeout(() => navigate(type === 'pending-email' ? '/app/profile' : '/login'), 2000);
      } else {
        setError(data.error || 'Code incorrect');
      }
    } catch (err) {
      if (err.status && err.status < 500) setError(err.data?.error || err.message);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setError('');
    try {
      const data = await api.post(type === 'pending-email' ? '/users/email/resend' : '/auth/resend-code', { email }, { onGlobalError: setGlobalError });
      if (data.success) {
        setResendMsg('Code renvoyé ! Vérifiez votre email.');
      } else {
        setError(data.error || "Erreur lors de l'envoi du code.");
      }
    } catch (err) {
      if (err.status && err.status < 500) setError(err.data?.error || err.message);
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
        {error && <div className="text-pink mb-4">{error}</div>}
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
