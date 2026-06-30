/**
 * Profile page (route: /app/profile).
 *
 * Lets the user view and edit their personal info (name/email), change their
 * password, log out, and delete their account. Editing the email triggers a
 * pending-email verification flow surfaced via a link to the verify page.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import AppModal from '../components/AppModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Alert from '../components/Alert';
import PasswordInput from '../components/PasswordInput';

export default function Profile() {
  const { user, updateUserProfile, logout, changePassword, deleteAccount } = useAuth();
  const { showToast } = useToast();
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
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  // Controls the logout confirmation dialog.
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Keep the edit form fields in sync with the current user.
  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name,
        email: user.email
      });
    }
  }, [user]);

  // Single button toggles between view and edit: when leaving edit mode it
  // persists the form; when entering it, it seeds the form from the user.
  const toggleEdit = () => {
    if (isEditing) {
      return updateUserProfile(editForm).then((result) => {
        setIsEditing(false);
        if (result?.success === false) {
          if (result.message) showToast(result.message, 'danger');
        } else {
          showToast('Profil mis à jour.');
        }
      });
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

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    // Block closing while a save is in flight.
    if (isPasswordSaving) return;
    setIsPasswordModalOpen(false);
  };

  // Validate the password form locally (all fields + matching confirmation),
  // then submit; success/error feedback is shown inside the modal.
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Client-side validation stays inline (a small hint inside the modal).
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Renseignez tous les champs.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsPasswordSaving(true);
    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      // The action result (success or business error) is surfaced as a toast,
      // like every other in-app action.
      if (!result.success) {
        if (result.message) showToast(result.message, 'danger');
        return;
      }

      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Votre mot de passe a été modifié.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (!user) return null;

  /**
   * Formats a date into a French relative-time string (e.g. "il y a 3 jours").
   * Returns "Jamais modifié" for missing/invalid dates. Used for the password's
   * last-changed label.
   * @param {string|number|Date} dateValue
   * @returns {string}
   */
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
      
      <Card className="p-8 mb-8 flex flex-col md:flex-row items-center gap-8">
        <Avatar initials={user.avatarInitials} className="w-28 h-28 text-4xl " />

        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
          <h1 className="text-3xl font-light tracking-tight text-primary">{user.name}</h1>
          <p className="text-sm text-primary/60 mt-1 mb-5">{user.email}</p>

          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <Button onClick={toggleEdit} variant="primary" className="min-w-[150px]">
              {isEditing ? 'Enregistrer' : 'Éditer le profil'}
            </Button>

            <Button onClick={handleLogout} variant="ghost" className="min-w-[150px]">
              Se déconnecter
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <Card className="p-8">
          <h3 className="text-lg font-medium text-primary mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Informations Personnelles
          </h3>
          
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Nom complet">
                  <TextInput
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </FormField>
                <FormField label="Adresse Email">
                  <TextInput
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    disabled={!isEditing}
                  />
                  {user.pendingEmail && user.pendingEmail !== user.email && (
                    <p className="text-xs text-primary/60 mt-2">
                      Email en attente de vérification : {user.pendingEmail}
                      {' '}·{' '}
                      <Link to={`/verify?email=${encodeURIComponent(user.pendingEmail)}&type=pending-email`} className="underline hover:text-primary">
                        Vérifier
                      </Link>
                    </p>
                  )}
                </FormField>
              </div>
          </div>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-medium text-primary mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Sécurité & Connexion
          </h3>
          <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Mot de passe</p>
                <p className="text-xs text-primary/60">Dernière modification : {formatRelativeTime(user.passwordUpdatedAt)}</p>
              </div>
              <Button onClick={openPasswordModal} variant="ghost" className="text-sm font-medium">Modifier le mot de passe</Button>
          </div>
        </Card>

          <Card className="p-8">
            <h3 className="text-lg font-medium text-primary mb-2">Zone de danger</h3>
            <p className="text-sm text-primary mb-6">La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
           
            <Button onClick={() => setIsDeleteAccountOpen(true)} variant="danger" className="text-sm">
              Supprimer mon compte
            </Button>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Se déconnecter ?"
        message="Vous devrez vous reconnecter pour accéder à vos projets."
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        confirmClassName="bg-blue text-white"
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
          <FormField label="Ancien mot de passe">
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label="Nouveau mot de passe">
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirmation du nouveau mot de passe">
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          </FormField>

          {passwordError && <Alert variant="danger">{passwordError}</Alert>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={closePasswordModal} variant="ghost" className="text-sm">
              Annuler
            </Button>
            <Button type="submit" disabled={isPasswordSaving} loading={isPasswordSaving} variant="primary" className="text-sm">
              {isPasswordSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </AppModal>

      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        title="Supprimer votre compte ?"
        message="Toutes vos données seront définitivement perdues. Cette action est irréversible. Pour confirmer, saisissez « Suppression » ci-dessous."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
       
        confirmationWord="Suppression"
        confirmationInputLabel="Écrivez le mot de confirmation"
        confirmationInputPlaceholder="Suppression"
        onCancel={() => setIsDeleteAccountOpen(false)}
        onConfirm={async () => {
          setIsDeleteAccountOpen(false);
          const result = await deleteAccount();
          if (result.success) {
            navigate('/login');
          }
        }}
      />

    </div>
  );
}