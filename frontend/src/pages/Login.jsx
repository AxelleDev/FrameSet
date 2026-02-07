import React, { useState } from 'react';
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#F8F9FF]">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 p-8">
        
        <div className="flex flex-col justify-center space-y-6 animate-fade-in">
           <div className="inline-flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-lavender-DEFAULT"></div>
              <span className="text-sm font-semibold tracking-widest uppercase text-slate-500">Système v1.0</span>
           </div>
           
           <h1 className="text-6xl font-light tracking-tight text-slate-900 leading-tight">
             Définissez votre <br />
             <span className="font-bold text-slate-900">Vérité Visuelle.</span>
           </h1>
           
           <p className="text-lg text-slate-500 max-w-md leading-relaxed">
             Axelle est la source de vérité définitive pour vos projets créatifs. Gérez normes, palettes et fiches personnages avec une précision rigoureuse.
           </p>

           <div className="flex items-center space-x-4 pt-4">
              <div className="flex -space-x-3">
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200"></div>
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-300"></div>
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-medium text-white bg-slate-800">+4</div>
              </div>
              <span className="text-sm text-slate-400">Rejoint par 200+ Illustrateurs</span>
           </div>
        </div>

        <div className="flex items-center justify-center md:justify-end">
          <div className="glass-panel w-full max-w-md p-10 rounded-3xl shadow-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-medium text-slate-900">Bon retour</h2>
              <p className="text-slate-500 text-sm mt-2">Entrez vos identifiants pour accéder à l'espace.</p>
            </div>
            
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg text-center font-medium">{error}</div>}

            <div className="space-y-5">
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-DEFAULT/50 focus:border-lavender-DEFAULT transition-all" placeholder="nom@studio.com" />
              </div>
              
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mot de passe</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-DEFAULT/50 focus:border-lavender-DEFAULT transition-all" placeholder="••••••••" />
              </div>
              
              <button onClick={handleLogin} className="w-full py-4 mt-2 bg-slate-900 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-lavender-DEFAULT/20 transform hover:-translate-y-0.5 transition-all duration-200">
                Accéder à l'espace
              </button>
            </div>

            <div className="mt-8 text-center flex flex-col gap-2">
              <Link to="/register" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pas encore de compte ? Créer un compte</Link>
              <a href="#" className="text-xs text-slate-400 hover:text-lavender-500 transition-colors">Mot de passe oublié ?</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}