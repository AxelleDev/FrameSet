import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

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
      navigate('/app/dashboard');
    } else {
      setError(result.message || 'Erreur lors de l\'inscription');
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-[#F8F9FF]">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[20%] right-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 p-8">
        
        <div className="flex flex-col justify-center space-y-6 animate-fade-in order-2 md:order-1">
           <div className="inline-flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-lavender-DEFAULT"></div>
              <span className="text-sm font-semibold tracking-widest uppercase text-slate-500">Early Access</span>
           </div>
           
           <h1 className="text-6xl font-light tracking-tight text-slate-900 leading-tight">
             Rejoignez le <br />
             <span className="font-bold text-slate-900">Standard.</span>
           </h1>
           
           <p className="text-lg text-slate-500 max-w-md leading-relaxed">
             Commencez dès aujourd'hui à structurer vos assets créatifs. Axelle unifie votre vision et celle de vos équipes.
           </p>

           <div className="flex flex-col space-y-2 pt-4 border-l-2 border-slate-200 pl-6">
              <p className="text-sm font-medium text-slate-800">"Un outil indispensable pour maintenir la cohérence de mes webtoons."</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Sarah K., Lead Artist</p>
           </div>
        </div>

        <div className="flex items-center justify-center md:justify-end order-1 md:order-2">
          <div className="glass-panel w-full max-w-md p-10 rounded-3xl shadow-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-medium text-slate-900">Créer un compte</h2>
              <p className="text-slate-500 text-sm mt-2">Rejoignez l'espace de travail.</p>
            </div>
            
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg text-center font-medium">{error}</div>}

            <div className="space-y-4">
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nom Complet</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-DEFAULT/50 focus:border-lavender-DEFAULT transition-all" placeholder="ex: Alex Chen" />
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Professionnel</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-DEFAULT/50 focus:border-lavender-DEFAULT transition-all" placeholder="nom@studio.com" />
              </div>
              
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mot de passe</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-DEFAULT/50 focus:border-lavender-DEFAULT transition-all" placeholder="8+ caractères" />
              </div>
              
              <button onClick={handleRegister} className="w-full py-4 mt-2 bg-slate-900 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-lavender-DEFAULT/20 transform hover:-translate-y-0.5 transition-all duration-200">
                S'inscrire gratuitement
              </button>
            </div>

            <div className="mt-8 text-center">
              <span className="text-sm text-slate-500">Vous avez déjà un compte ? </span>
              <Link to="/login" className="text-sm font-medium text-lavender-DEFAULT hover:text-purple-600 transition-colors">Se connecter</Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}