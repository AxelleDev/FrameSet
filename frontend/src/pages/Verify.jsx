import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const email = params.get('email');

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

  const handleVerify = async () => {
    setError('');
    const res = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (data.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(data.error || 'Code incorrect');
    }
  };

    const handleResend = async () => {
      setResendMsg('');
      setError('');
      const res = await fetch('http://localhost:3000/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setResendMsg('Code renvoyé ! Vérifiez votre email.');
      } else {
        setError(data.error || "Erreur lors de l'envoi du code.");
      }
    };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FF]">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-lavender-600">Email Verification</h2>
        <p className="mb-6 text-slate-600">Enter the code sent to <strong>{email}</strong>.</p>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Verification code"
          className="w-full px-4 py-3 mb-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-400"
        />
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {resendMsg && <div className="text-green-500 mb-4">{resendMsg}</div>}
        <div className="flex gap-2">
          {!success && (
            <>
              <button
                onClick={handleVerify}
                className="w-full py-3 bg-lavender-600 text-white font-medium rounded-xl hover:bg-lavender-700 transition-all"
              >
                Verify
              </button>
              <button
                onClick={handleResend}
                className="w-full py-3 bg-slate-200 text-lavender-600 font-medium rounded-xl hover:bg-lavender-100 transition-all"
                style={{ marginLeft: '8px' }}
              >
                Renvoyer le code
              </button>
            </>
          )}
        </div>
        {success && <div className="text-green-600 font-semibold">Verified! Redirecting...</div>}
      </div>
    </div>
  );
}
