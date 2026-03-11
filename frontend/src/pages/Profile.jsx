import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate, Link } from 'react-router-dom';
import AppModal from '../components/AppModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Card from '../components/Card';
import Button from '../components/Button';
import PasswordInput from '../components/PasswordInput';

export default function Profile() {
  const { user, updateUserProfile, logout, changePassword } = useData();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: ''
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  // Ajout pour la modale de confirmation de déconnexion
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name,
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
        email: user.email
      });
      setIsEditing(true);
    }
  };

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
    setIsLogoutConfirmOpen(false);
  };

  const cancelLogout = () => {
    setIsLogoutConfirmOpen(false);
  };

  const deleteAccount = () => {
    setIsDeleteAccountOpen(true);
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (isPasswordSaving) return;
    setIsPasswordModalOpen(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Veuillez remplir tous les champs.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setIsPasswordSaving(true);
    const result = await changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
    setIsPasswordSaving(false);

    if (!result.success) {
      setPasswordError(result.message || 'Erreur lors de la modification.');
      return;
    }

    setPasswordSuccess('Mot de passe modifié avec succès.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (!user) return null;

  const formatRelativeTime = (dateValue) => {
    if (!dateValue) return 'Jamais modifié';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Jamais modifié';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "À l'instant";
    if (diffMinutes < 60) return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `il y a ${diffMonths} mois`;

    const diffYears = Math.floor(diffMonths / 12);
    return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12 text-primary">
      
      <Card className="p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center gap-8 border border-white">
        
        <div className="w-32 h-32 rounded-full bg-blue/10 border-4 border-primary shadow-xl flex items-center justify-center text-primary text-4xl font-bold flex-shrink-0">
           {user.avatarInitials}
        </div>
        
          <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
            <h1 className="text-3xl font-light text-primary mb-4">{user.name}</h1>

           <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <Button onClick={toggleEdit} variant="primary" className="min-w-[140px]">
                {isEditing ? 'Enregistrer' : 'Éditer le profil'}
              </Button>

              <Button onClick={handleLogout} variant="ghost" className="min-w-[140px]">
                Déconnexion
              </Button>
           </div>
        </div>
      </Card>

      <div className="space-y-8">
        <Card className="p-8 rounded-2xl">
          <h3 className="text-lg font-medium text-primary mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Informations Personnelles
          </h3>
          
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Nom complet</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} readOnly={!isEditing}
                         className={`w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none transition ${isEditing ? 'focus:border-pink' : 'opacity-70 cursor-not-allowed'}`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Adresse Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} readOnly={!isEditing}
                         className={`w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none transition ${isEditing ? 'focus:border-pink' : 'opacity-70 cursor-not-allowed'}`} />
                  {user.pendingEmail && user.pendingEmail !== user.email && (
                    <p className="text-xs text-blue mt-2">
                      Email en attente de vérification : {user.pendingEmail}
                      {' '}·{' '}
                      <Link to={`/verify?email=${encodeURIComponent(user.pendingEmail)}&type=pending-email`} className="underline hover:text-pink">
                        Vérifier
                      </Link>
                    </p>
                  )}
                </div>
              </div>
          </div>
        </Card>

        <Card className="p-8 rounded-2xl">
          <h3 className="text-lg font-medium text-primary mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Sécurité & Connexion
          </h3>
          <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium text-primary">Mot de passe</p>
                <p className="text-xs text-blue">Dernière modification : {formatRelativeTime(user.passwordUpdatedAt)}</p>
              </div>
              <Button onClick={openPasswordModal} variant="ghost" className="text-sm font-medium">Modifier</Button>
          </div>
        </Card>

          <Card className="p-8 rounded-2xl border-l-4 border-l-pink">
            <h3 className="text-lg font-medium text-primary mb-2">Zone de Danger</h3>
            <p className="text-sm text-primary mb-6">La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
           
            <Button onClick={deleteAccount} variant="secondary" className="text-sm">
              Supprimer mon compte
            </Button>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Confirmation de déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmLabel="Déconnexion"
        cancelLabel="Annuler"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        confirmClassName="bg-blue text-white hover:bg-blue/10"
      />

      <AppModal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title="Modifier le mot de passe"
        subtitle="Saisissez votre ancien mot de passe pour valider."
        showClose={false}
        panelClassName="max-w-lg"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Ancien mot de passe</label>
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              inputClassName="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:border-pink transition"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Nouveau mot de passe</label>
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              inputClassName="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:border-pink transition"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">Confirmation du nouveau mot de passe</label>
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              inputClassName="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:border-pink transition"
              autoComplete="new-password"
            />
          </div>

          {passwordError && (
            <div className="text-sm text-pink bg-pink/10 border border-pink/30 rounded-xl px-4 py-2">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="text-sm text-green-700 bg-green-100/60 border border-green-200 rounded-xl px-4 py-2">
              {passwordSuccess}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={closePasswordModal} variant="ghost" className="text-sm">
              Annuler
            </Button>
            <Button type="submit" disabled={isPasswordSaving} variant="primary" className="text-sm">
              {isPasswordSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </AppModal>

      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        title="Supprimer mon compte"
        message="Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible."
        confirmLabel="Supprimer"
        confirmClassName="bg-pink text-white hover:bg-pink/10"
        onCancel={() => setIsDeleteAccountOpen(false)}
        onConfirm={() => {
          setIsDeleteAccountOpen(false);
          handleLogout();
        }}
      />

    </div>
  );
}