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
import { isValidEmail } from '../utils/passwordRules';

export default function Profile() {
  const { user, updateUserProfile, logout, changePassword, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
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

  // Trimmed field values and whether anything actually changed vs. the saved
  // user — used to disable "Save" and to avoid a pointless "updated" toast.
  const trimmedName = editForm.name.trim();
  const trimmedEmail = editForm.email.trim();
  const hasChanges = trimmedName !== (user?.name ?? '') || trimmedEmail !== (user?.email ?? '');

  // Enter edit mode, seeding the form from the current user.
  const startEdit = () => {
    setEditForm({ name: user.name, email: user.email });
    setEditError('');
    setIsEditing(true);
  };

  // Leave edit mode without saving, discarding any changes.
  const cancelEdit = () => {
    setEditForm({ name: user.name, email: user.email });
    setEditError('');
    setIsEditing(false);
  };

  // Validate then persist the profile. Nothing changed → just close (no toast).
  // On a changed email, the backend stages it as a pending email to confirm.
  const saveProfile = async () => {
    setEditError('');

    if (!trimmedName) {
      setEditError('Your name cannot be empty.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setEditError('Please enter a valid email address.');
      return;
    }
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    const emailChanged = trimmedEmail !== (user.email ?? '');
    setIsSaving(true);
    try {
      const result = await updateUserProfile({ name: trimmedName, email: trimmedEmail });
      // Keep the user in edit mode on a business error so they can fix it inline.
      if (result?.success === false) {
        setEditError(result.message || 'Something went wrong updating your profile.');
        return;
      }
      setIsEditing(false);
      showToast(
        emailChanged
          ? 'Profile saved. Check your inbox to confirm your new email.'
          : 'Profile updated.'
      );
    } finally {
      setIsSaving(false);
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
      setPasswordError('Fill in all fields.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords don't match.");
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
      showToast('Your password has been changed.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (!user) return null;

  /**
   * Formats a date into an English relative-time string (e.g. "3 days ago").
   * Returns "Never changed" for missing/invalid dates. Used for the password's
   * last-changed label.
   * @param {string|number|Date} dateValue
   * @returns {string}
   */
  const formatRelativeTime = (dateValue) => {
    if (!dateValue) return 'Never changed';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Never changed';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12 text-primary">
      
      <Card className="p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        <Avatar initials={user.avatarInitials} className="w-24 h-24 text-3xl sm:w-28 sm:h-28 sm:text-4xl shrink-0" />

        <div className="flex flex-col items-center sm:items-start text-center sm:text-left flex-1 min-w-0 w-full">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-primary break-words max-w-full">{user.name}</h1>
          <p className="text-sm text-primary/60 mt-1 break-all max-w-full">{user.email}</p>
        </div>

        <Button onClick={handleLogout} variant="ghost" className="text-sm font-medium whitespace-nowrap shrink-0">
          <svg className="inline-block w-4 h-4 mr-2 align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </Button>
      </Card>

      <div className="space-y-8">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 mb-6 min-h-10">
            <h2 className="text-lg font-medium text-primary flex items-center min-w-0">
              <svg className="w-5 h-5 mr-2 text-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="truncate">Personal information</span>
            </h2>
            {!isEditing && (
              <Button onClick={startEdit} variant="ghost" className="text-sm font-medium whitespace-nowrap shrink-0">
                Edit
              </Button>
            )}
          </div>

          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full name">
                  <TextInput
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    disabled={!isEditing}
                    autoComplete="name"
                  />
                </FormField>
                <FormField label="Email address">
                  <TextInput
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    disabled={!isEditing}
                    autoComplete="email"
                  />
                  {user.pendingEmail && user.pendingEmail !== user.email && (
                    <p className="text-xs text-primary/60 mt-2">
                      Email pending verification: {user.pendingEmail}
                      {' '}·{' '}
                      <Link to={`/verify?email=${encodeURIComponent(user.pendingEmail)}&type=pending-email`} className="underline hover:text-primary">
                        Verify
                      </Link>
                    </p>
                  )}
                </FormField>
              </div>

              {isEditing && (
                <div className="space-y-4 animate-fade-in">
                  {editError && <Alert variant="danger">{editError}</Alert>}
                  <p className="text-xs text-primary/60">
                    Changing your email sends a confirmation code to the new address; it takes effect once verified.
                  </p>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button type="button" onClick={cancelEdit} variant="ghost" className="text-sm" disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={saveProfile} variant="primary" className="text-sm" disabled={isSaving || !hasChanges} loading={isSaving}>
                      Save changes
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-medium text-primary mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Security &amp; sign-in
          </h2>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Password</p>
                <p className="text-xs text-primary/60">Last changed: {formatRelativeTime(user.passwordUpdatedAt)}</p>
              </div>
              <Button onClick={openPasswordModal} variant="ghost" className="text-sm font-medium whitespace-nowrap shrink-0">Change password</Button>
          </div>
        </Card>

          <Card className="p-6 sm:p-8">
            <h2 className="text-lg font-medium text-primary mb-2">Danger zone</h2>
            <p className="text-sm text-primary mb-6">Deleting your account is irreversible. All your data will be lost.</p>

            <Button onClick={() => setIsDeleteAccountOpen(true)} variant="danger" className="text-sm w-full sm:w-auto">
              Delete my account
            </Button>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Sign out?"
        message="You'll need to sign in again to access your projects."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        confirmClassName="bg-blue text-white"
      />

      <AppModal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title="Change password"
        subtitle="Enter your current password to confirm."
        showClose={false}
        panelClassName="max-w-lg"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <FormField label="Current password">
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label="New password">
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm new password">
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          </FormField>

          {passwordError && <Alert variant="danger">{passwordError}</Alert>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" onClick={closePasswordModal} variant="ghost" className="text-sm">
              Cancel
            </Button>
            <Button type="submit" disabled={isPasswordSaving} loading={isPasswordSaving} variant="primary" className="text-sm">
              {isPasswordSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </AppModal>

      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        title="Delete your account?"
        message={'All your data will be permanently lost. This action is irreversible. To confirm, type "DELETE" below.'}
        confirmLabel="Delete"
        cancelLabel="Cancel"

        confirmationWord="DELETE"
        confirmationInputLabel="Type the confirmation word"
        confirmationInputPlaceholder="DELETE"
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