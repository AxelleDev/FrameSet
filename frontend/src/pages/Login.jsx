import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useData();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate('/app/dashboard');
    } else {
      setError(result.message || 'Identifiants invalides');
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
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#F8F9FF] text-primary">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-pink/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 p-8">
        
        <div className="flex flex-col justify-center space-y-6 animate-fade-in">
           <div className="flex items-center mb-2">
             <img src="/FrameSet_Logo.png" alt="FrameSet Logo" className="object-contain mr-2" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
           </div>
           
           <h1 className="text-6xl font-light tracking-tight text-primary leading-tight">
             Définissez votre <br />
             <span className="font-bold text-primary">Vérité Visuelle.</span>
           </h1>
           
           <p className="text-lg text-primary max-w-md leading-relaxed">
             FrameSet est la source de vérité définitive pour vos projets créatifs. Gérez normes, palettes et fiches personnages avec une précision rigoureuse.
           </p>

           <div className="flex items-center space-x-4 pt-4">
                <span className="text-sm text-blue">
                  {userCount !== null ? `Rejoint par ${userCount} Illustrateur${userCount > 1 ? 's' : ''}` : 'Rejoint par ... Illustrateurs'}
                </span>
           </div>
        </div>

        <div className="flex items-center justify-center md:justify-end">
          <div className="glass-panel w-full max-w-md p-10 rounded-3xl shadow-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-medium text-primary">Bon retour</h2>
              <p className="text-primary text-sm mt-2">Entrez vos identifiants pour accéder à l'espace.</p>
            </div>
            
            {error && <div className="mb-4 p-3 bg-pink text-pink text-xs rounded-lg text-center font-medium">{error}
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
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="nom@studio.com" />
              </div>
              
              <div className="group">
                <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Mot de passe</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue transition-all" placeholder="••••••••" />
              </div>
              
              <button onClick={handleLogin} className="w-full py-4 mt-2 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg transition-all">
                Accéder à l'espace
              </button>
            </div>

            <div className="mt-8 text-center flex flex-col gap-2">
              <Link to="/register" className="text-sm font-medium text-blue hover:text-pink transition-colors">Pas encore de compte ? Créer un compte</Link>
              <a href="#" className="text-xs text-blue hover:text-pink transition-colors">Mot de passe oublié ?</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}