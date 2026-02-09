import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import AuthLayout from '../components/AuthLayout';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useData();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    const result = await register(formData);
    if (result.success) {
      navigate(`/verify?email=${encodeURIComponent(formData.email)}`);
    } else {
      setError(result.message || 'Erreur lors de l\'inscription');
    }
  };

  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/users/count')
      .then(res => res.json())
      .then(data => setUserCount(data.count))
      .catch(() => setUserCount(null));
  }, []);

  return (
    <AuthLayout
      variant="register"
      swapOnMobile
      hero={
        <>
          <div className="flex items-center mb-2">
            <img src="/FrameSet_Logo.png" alt="FrameSet Logo" className="object-contain mr-2" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
          </div>
          
          <h1 className="text-6xl font-light tracking-tight text-primary leading-tight">
            Rejoignez le <br />
            <span className="font-bold text-primary">Standard.</span>
          </h1>
          
          <p className="text-lg text-primary max-w-md leading-relaxed">
            Commencez à structurer les fondations graphiques de vos projets et donnez à votre univers créatif une direction claire et cohérente.
          </p>

          <div className="flex flex-col space-y-2 pt-4 border-l-2 border-primary pl-6">
            <p className="text-sm font-medium text-primary">"Un outil essentiel pour reprendre un projet sans perdre mes réglages graphiques."</p>
            <p className="text-xs text-blue uppercase tracking-widest">Alyse C., Illustratrice</p>
            <span className="text-sm text-blue pt-2">
              {userCount !== null ? `Rejoint par ${userCount} Illustrateur${userCount > 1 ? 's' : ''}` : 'Rejoint par ... Illustrateurs'}
            </span>
          </div>
        </>
      }
    >
      <div className="glass-panel w-full max-w-md p-10 rounded-3xl shadow-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-medium text-primary">Inscription</h2>
          <p className="text-primary text-sm mt-2">Votre référence graphique commence ici.</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-pink text-primary text-xs rounded-lg text-center font-medium">{error}</div>}

        <div className="space-y-4">
          <div className="group">
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Nom Complet</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="ex: Prénom Nom" />
          </div>

          <div className="group">
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="email@exemple.com" />
          </div>
          
          <div className="group">
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Mot de passe</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="8+ caractères" />
          </div>
          
          <button onClick={handleRegister} className="w-full py-4 mt-2 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg transition-all">
            Créer un compte
          </button>
        </div>

        <div className="mt-8 text-center">
          <span className="text-sm text-primary">Vous avez déjà un compte ? </span>
          <Link to="/login" className="text-sm font-medium text-blue hover:text-pink transition-colors">Se connecter</Link>
        </div>
      </div>
    </AuthLayout>
  );
}