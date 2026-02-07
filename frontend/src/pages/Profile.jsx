import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, updateUserProfile, logout } = useData();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    email: ''
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name,
        role: user.role,
        email: user.email
      });
    }
  }, [user]);

  const toggleEdit = () => {
    if (isEditing) {
      updateUserProfile(editForm);
      setIsEditing(false);
    } else {
      setEditForm({
        name: user.name,
        role: user.role,
        email: user.email
      });
      setIsEditing(true);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const deleteAccount = () => {
    const confirmed = confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.");
    if (confirmed) {
      handleLogout();
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      
      <div className="glass-card p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center gap-8">
        
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-4 border-white shadow-xl flex items-center justify-center text-white text-4xl font-bold flex-shrink-0">
           {user.avatarInitials}
        </div>
        
        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
           <h1 className="text-3xl font-light text-slate-900 mb-1">{user.name}</h1>
           <p className="text-lavender-600 font-medium mb-6 text-lg">{user.role}</p>

           <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <button onClick={toggleEdit} 
                      className={`px-6 py-2.5 text-white rounded-xl text-sm font-medium transition shadow-lg min-w-[140px] transform active:scale-95 ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                 {isEditing ? 'Enregistrer' : 'Éditer le profil'}
              </button>
              
              <button onClick={handleLogout} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition shadow-sm min-w-[140px] transform active:scale-95">
                  Déconnexion
              </button>
           </div>
        </div>
      </div>

      <div className="space-y-8">
        <section className="glass-panel p-8 rounded-2xl">
          <h3 className="text-lg font-medium text-slate-900 mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-lavender-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Informations Personnelles
          </h3>
          
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nom complet</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} readOnly={!isEditing}
                         className={`w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none transition ${isEditing ? 'focus:border-lavender-400' : 'opacity-70 cursor-not-allowed'}`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Rôle</label>
                  <input type="text" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} readOnly={!isEditing}
                         className={`w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none transition ${isEditing ? 'focus:border-lavender-400' : 'opacity-70 cursor-not-allowed'}`} />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Adresse Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} readOnly={!isEditing}
                       className={`w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none transition ${isEditing ? 'focus:border-lavender-400' : 'opacity-70 cursor-not-allowed'}`} />
              </div>
          </div>
        </section>

        <section className="glass-panel p-8 rounded-2xl">
          <h3 className="text-lg font-medium text-slate-900 mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-lavender-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Sécurité & Connexion
          </h3>
          <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium text-slate-800">Mot de passe</p>
                <p className="text-xs text-slate-400">Dernière modification il y a 3 mois</p>
              </div>
              <button className="text-sm text-lavender-600 font-medium hover:underline">Modifier</button>
          </div>
        </section>

        <section className="glass-panel p-8 rounded-2xl border-l-4 border-l-red-400">
           <h3 className="text-lg font-medium text-slate-900 mb-2">Zone de Danger</h3>
           <p className="text-sm text-slate-500 mb-6">La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
           
           <button onClick={deleteAccount} className="px-5 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors">
              Supprimer mon compte
           </button>
        </section>
      </div>

    </div>
  );
}