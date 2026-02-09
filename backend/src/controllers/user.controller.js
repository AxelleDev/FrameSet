const bcrypt = require('bcryptjs');
const db = require('../database');
const mailService = require('../services/mail.service');

const getUserCount = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const updateUser = async (req, res) => {
  const { id, name, email } = req.body;
  try {
    const [rows] = await db.query('SELECT email, pending_email FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const currentEmail = rows[0].email;
    const isEmailChanged = email && email !== currentEmail;

    if (isEmailChanged) {
      const [existing] = await db.query(
        'SELECT id FROM users WHERE (email = ? OR pending_email = ?) AND id <> ?',
        [email, email, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
      }

      const pendingCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await db.query(
        'UPDATE users SET name = ?, pending_email = ?, pending_email_code = ?, pending_email_expires = ? WHERE id = ?',
        [name, email, pendingCode, expires, id]
      );

      await mailService.sendMail({
        to: email,
        subject: 'Confirmation de votre nouvel email',
        text: `Votre code de confirmation est : ${pendingCode}\nCe code expire dans 10 minutes.`
      });

      return res.json({ success: true, name, email: currentEmail, pendingEmail: email });
    }

    await db.query('UPDATE users SET name = ? WHERE id = ?', [name, id]);
    res.json({ success: true, name, email: currentEmail, pendingEmail: rows[0].pending_email || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
};

const verifyPendingEmail = async (req, res) => {
  const { email, code } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE pending_email = ?', [email]);
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
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE pending_email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Email en attente non trouvé.' });
    }
    const userDb = rows[0];
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'UPDATE users SET pending_email_code = ?, pending_email_expires = ? WHERE id = ?',
      [newCode, expires, userDb.id]
    );

    await mailService.sendMail({
      to: email,
      subject: 'Nouveau code de confirmation',
      text: `Votre nouveau code de confirmation est : ${newCode}\nCe code expire dans 10 minutes.`
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const changePassword = async (req, res) => {
  const { id, currentPassword, newPassword } = req.body;
  if (!id || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ?, password_updated_at = NOW() WHERE id = ?', [hashedPassword, id]);
    res.json({ success: true, passwordUpdatedAt: new Date() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  getUserCount,
  updateUser,
  verifyPendingEmail,
  resendPendingEmail,
  changePassword
};
