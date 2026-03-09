const bcrypt = require('bcryptjs');
const db = require('../database');
const mailService = require('../services/mail.service');
const jwt = require('jsonwebtoken');
const { generateRefreshToken, verifyRefreshToken } = require('../services/token.service');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRES = '2h';
const getInitials = (name) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

const register = async (req, res) => {
  const { name, email, password } = req.body;

  const initials = getInitials(name);
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar_initials, is_verified, verification_code, verification_code_expires, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, initials, false, verificationCode, expires, now]
    );

    await mailService.sendMail({
      to: email,
      subject: 'Confirmation de votre inscription',
      text: `Votre code de confirmation est : ${verificationCode}\nCe code expire dans 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Confirmation de votre inscription',
        message: 'Utilisez le code ci-dessous pour confirmer votre adresse email.',
        code: verificationCode
      })
    });

    const newUser = {
      id: result.insertId,
      name,
      email,
      avatarInitials: initials,
      is_verified: false,
      passwordUpdatedAt: now
    };
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    const refreshToken = generateRefreshToken({ id: newUser.id, email: newUser.email });
    res.json({ success: true, ...newUser, token, refreshToken });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    const userDb = rows[0];
    if (!userDb.is_verified) {
      return res.status(401).json({ error: 'Veuillez vérifier votre email avant de vous connecter.' });
    }
    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    const user = {
      id: userDb.id,
      name: userDb.name,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: userDb.pending_email
    };
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    res.json({ success: true, ...user, token, refreshToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token manquant' });
  const user = verifyRefreshToken(refreshToken);
  if (!user) return res.status(403).json({ error: 'Refresh token invalide ou expiré' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ success: true, token });
};

const verify = async (req, res) => {
  const { email, code } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Utilisateur non trouvé.' });
    }
    const userDb = rows[0];
    if (userDb.is_verified) {
      return res.status(400).json({ error: 'Utilisateur déjà vérifié.' });
    }
    if (!userDb.verification_code || userDb.verification_code !== code) {
      return res.status(400).json({ error: 'Code incorrect.' });
    }
    if (!userDb.verification_code_expires || new Date() > new Date(userDb.verification_code_expires)) {
      return res.status(400).json({ error: 'Code expiré. Veuillez en demander un nouveau.' });
    }
    await db.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE email = ?', [email]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const resendCode = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Utilisateur non trouvé.' });
    }
    const userDb = rows[0];
    if (userDb.is_verified) {
      return res.status(400).json({ error: 'Utilisateur déjà vérifié.' });
    }
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE email = ?', [newCode, expires, email]);

    await mailService.sendMail({
      to: email,
      subject: 'Nouveau code de vérification',
      text: `Votre nouveau code de vérification est : ${newCode}\nCe code expire dans 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Nouveau code de vérification',
        message: 'Voici votre nouveau code de vérification.',
        code: newCode
      })
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const logout = async (req, res) => {
  // Invalidate refresh token logic would go here if implemented (e.g., blacklist)
  res.json({ success: true });
};

module.exports = {
  register,
  login,
  verify,
  resendCode,
  refresh,
  logout
};
