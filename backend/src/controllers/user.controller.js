const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
const db = require('../database');
const mailService = require('../services/mail.service');

const getAuthenticatedUserId = (req) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const getUserCount = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getProfile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, avatar_initials, password_updated_at, pending_email FROM users WHERE id = ?',
      [authenticatedUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const userDb = rows[0];
    return res.json({
      id: userDb.id,
      name: userDb.name,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: userDb.pending_email || null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const updateUser = async (req, res) => {
  const validator = require('validator');
  const authenticatedUserId = getAuthenticatedUserId(req);
  const { name, email } = req.body;
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  if (!name || !email) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  const trimmedName = validator.trim(name);
  const trimmedEmail = validator.trim(email);
  if (!validator.isEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    const [rows] = await db.query('SELECT email, pending_email FROM users WHERE id = ?', [authenticatedUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const currentEmail = rows[0].email;
    const isEmailChanged = trimmedEmail !== currentEmail;

    if (isEmailChanged) {
      const [existing] = await db.query(
        'SELECT id FROM users WHERE (email = ? OR pending_email = ?) AND id <> ?',
        [trimmedEmail, trimmedEmail, authenticatedUserId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
      }

      const pendingCode = randomInt(100000, 1000000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await db.query(
        'UPDATE users SET name = ?, pending_email = ?, pending_email_code = ?, pending_email_expires = ? WHERE id = ?',
        [trimmedName, trimmedEmail, pendingCode, expires, authenticatedUserId]
      );

      await mailService.sendMail({
        to: trimmedEmail,
        subject: 'Confirmation de votre nouvel email',
        text: `Votre code de confirmation est : ${pendingCode}\nCe code expire dans 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Confirmation de votre nouvel email',
          message: 'Utilisez le code ci-dessous pour valider votre nouvel email.',
          code: pendingCode
        })
      });

      return res.json({ success: true, name: trimmedName, email: currentEmail, pendingEmail: trimmedEmail });
    }

    await db.query('UPDATE users SET name = ? WHERE id = ?', [trimmedName, authenticatedUserId]);
    res.json({ success: true, name: trimmedName, email: currentEmail, pendingEmail: rows[0].pending_email || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const verifyPendingEmail = async (req, res) => {
  const { email, code } = req.body;
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND pending_email = ?', [authenticatedUserId, email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Email en attente non trouvé.' });
    }
    const userDb = rows[0];
    if (!userDb.pending_email_code || userDb.pending_email_code !== code) {
      return res.status(400).json({ error: 'Code incorrect.' });
    }
    if (!userDb.pending_email_expires || new Date() > new Date(userDb.pending_email_expires)) {
      return res.status(400).json({ error: 'Code expiré. Veuillez en demander un nouveau.' });
    }

    await db.query(
      'UPDATE users SET email = pending_email, pending_email = NULL, pending_email_code = NULL, pending_email_expires = NULL WHERE id = ?',
      [userDb.id]
    );

    const updatedUser = {
      id: userDb.id,
      name: userDb.name,
      email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: null
    };

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const resendPendingEmail = async (req, res) => {
  const { email } = req.body;
  const authenticatedUserId = getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND pending_email = ?', [authenticatedUserId, email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Email en attente non trouvé.' });
    }
    const userDb = rows[0];
    const newCode = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'UPDATE users SET pending_email_code = ?, pending_email_expires = ? WHERE id = ?',
      [newCode, expires, userDb.id]
    );

    await mailService.sendMail({
      to: email,
      subject: 'Nouveau code de confirmation',
      text: `Votre nouveau code de confirmation est : ${newCode}\nCe code expire dans 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Nouveau code de confirmation',
        message: 'Voici votre nouveau code pour confirmer votre email.',
        code: newCode
      })
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const changePassword = async (req, res) => {
  const validator = require('validator');
  const authenticatedUserId = getAuthenticatedUserId(req);
  const { currentPassword, newPassword } = req.body;
  if (!authenticatedUserId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  const trimmedNewPassword = validator.trim(newPassword);
  if (!validator.isLength(trimmedNewPassword, { min: 8 })) {
    return res.status(400).json({ error: 'Mot de passe trop court.' });
  }
  if (!validator.matches(trimmedNewPassword, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.' });
  }
  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [authenticatedUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    }
    const hashedPassword = await bcrypt.hash(trimmedNewPassword, 10);
    await db.query('UPDATE users SET password = ?, password_updated_at = NOW() WHERE id = ?', [hashedPassword, authenticatedUserId]);
    res.json({ success: true, passwordUpdatedAt: new Date() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  getUserCount,
  getProfile,
  updateUser,
  verifyPendingEmail,
  resendPendingEmail,
  changePassword
};
