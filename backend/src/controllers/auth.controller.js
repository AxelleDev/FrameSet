const bcrypt = require('bcryptjs');
const validator = require('validator');
const { randomInt } = require('crypto');
const db = require('../database');
const mailService = require('../services/mail.service');
const jwt = require('jsonwebtoken');
const { generateRefreshToken, verifyRefreshToken } = require('../services/token.service');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET doit être défini dans les variables d’environnement');
}
const JWT_EXPIRES = '2h';
const getInitials = (name) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

const register = async (req, res) => {
  let { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  name = validator.trim(name);
  email = validator.trim(email);
  password = validator.trim(password);
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (!validator.isLength(password, { min: 8 })) {
    return res.status(400).json({ error: 'Mot de passe trop court.' });
  }
  if (!validator.matches(password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.' });
  }

  const initials = getInitials(name);
  const verificationCode = randomInt(100000, 1000000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
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
    res.json({ success: true, ...newUser });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Erreur lors de l’inscription.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const login = async (req, res) => {
  let { email, password } = req.body;
  console.log('Tentative de connexion :', { email });
  if (!email || !password) {
    console.log('Email ou mot de passe manquant');
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  email = validator.trim(email);
  password = validator.trim(password);
  if (!validator.isEmail(email)) {
    console.log('Format d\'email invalide');
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      console.log('Utilisateur non trouvé pour l\'email :', email);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    const userDb = rows[0];
    if (!userDb.is_verified) {
      console.log('Utilisateur non vérifié :', email);
      return res.status(401).json({ error: 'Veuillez vérifier votre email avant de vous connecter.' });
    }
    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) {
      console.log('Mot de passe incorrect pour l\'email :', email);
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
    console.log('Connexion réussie :', { id: user.id, email: user.email });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    res.json({ success: true, ...user, token, refreshToken });
  } catch (error) {
    console.error('Erreur de connexion :', error);
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
    const newCode = randomInt(100000, 1000000).toString();
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

module.exports = {
  register,
  login,
  verify,
  resendCode,
  refresh
};
