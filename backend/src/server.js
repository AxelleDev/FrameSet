const express = require('express');
const cors = require('cors');

const db = require('./database');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


app.get('/api/users/count', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  const getInitials = (n) => n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
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

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Confirmation de votre inscription',
      text: `Votre code de confirmation est : ${verificationCode}\nCe code expire dans 10 minutes.`
    });

    const newUser = {
      id: result.insertId,
      name,
      email,
      avatarInitials: initials,
      is_verified: false,
      passwordUpdatedAt: now
    };
    res.json(newUser);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/auth/login', async (req, res) => {
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
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
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
});

app.post('/api/auth/resend-code', async (req, res) => {
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
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Nouveau code de vérification',
      text: `Votre nouveau code de vérification est : ${newCode}\nCe code expire dans 10 minutes.`
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


app.put('/api/user', async (req, res) => {
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

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.MAIL_USER,
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
});

app.post('/api/user/email/verify', async (req, res) => {
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
});

app.post('/api/user/email/resend', async (req, res) => {
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

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Nouveau code de confirmation',
      text: `Votre nouveau code de confirmation est : ${newCode}\nCe code expire dans 10 minutes.`
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/user/password', async (req, res) => {
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
});


app.get('/api/projects', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json([]);
  try {
    const [projectsData] = await db.query(
      'SELECT *, DATE_FORMAT(last_edited, "%d/%m %H:%i") as lastEditedFormatted FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    const fullProjects = await Promise.all(projectsData.map(async (p) => {
      const [brushNorms] = await db.query('SELECT * FROM project_brush_norms WHERE project_id = ?', [p.id]);
      const [typographyNorms] = await db.query('SELECT * FROM project_typography_norms WHERE project_id = ?', [p.id]);
      const [palette] = await db.query('SELECT * FROM project_palette WHERE project_id = ?', [p.id]);
      return {
        id: p.id,
        name: p.name,
        client: p.client,
        progress: p.progress,
        lastEdited: p.lastEditedFormatted || 'À l\'instant',
        brushNorms: brushNorms.map(n => ({
          id: n.id,
          name: n.name,
          value: n.value,
          unit: n.unit,
          brushName: n.brush_name
        })),
        typographyNorms: typographyNorms.map(n => ({
          id: n.id,
          fontFamily: n.font_family,
          fontWeight: n.font_weight,
          fontUsage: n.font_usage,
          fontStyle: n.font_style
        })),
        normsCount: brushNorms.length + typographyNorms.length,
        palette: palette.map(c => ({
          name: c.name,
          hex: c.hex
        })),
        characters: []
      };
    }));
    res.json(fullProjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/projects', async (req, res) => {
  const { userId, name } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO projects (user_id, name, progress) VALUES (?, ?, 0)', 
      [userId, name]
    );
    const newId = result.insertId;
    
    const newProject = {
      id: newId,
      name,
      progress: 0,
      lastEdited: 'À l\'instant',
      normsCount: 0,
      norms: [],
      palette: [],
      characters: []
    };
    res.json(newProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

const updateProjectName = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom du projet requis.' });
  }
  try {
    await db.query('UPDATE projects SET name = ?, last_edited = NOW() WHERE id = ?', [name.trim(), id]);
    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
};

app.patch('/api/projects/:id', updateProjectName);
app.put('/api/projects/:id', updateProjectName);

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});


// Add brush norm
app.post('/api/projects/:id/brush-norms', async (req, res) => {
  const { id } = req.params;
  const { name, value, unit, brushName } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name) VALUES (?, ?, ?, ?, ?)',
      [id, name, value, unit, brushName]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add typography norm
app.post('/api/projects/:id/typography-norms', async (req, res) => {
  const { id } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO project_typography_norms (project_id, font_family, font_weight, font_usage, font_style) VALUES (?, ?, ?, ?, ?)',
      [id, fontFamily, fontWeight, fontUsage, fontStyle]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/projects/:id/palette', async (req, res) => {
  const { id } = req.params;
  const colors = req.body;
  try {
    for (const color of colors) {
      await db.query(
        'REPLACE INTO project_palette (project_id, name, hex) VALUES (?, ?, ?)',
        [id, color.name, color.hex]
      );
    }
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/projects/:projectId/brush-norms/:normId', async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    const [result] = await db.query('DELETE FROM project_brush_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/projects/:projectId/typography-norms/:normId', async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    const [result] = await db.query('DELETE FROM project_typography_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/projects/:id/palette', async (req, res) => {
  const { id } = req.params;
  const { hex } = req.body;
  try {
    await db.query('DELETE FROM project_palette WHERE project_id = ? AND hex = ?', [id, hex]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/projects/:id/palette', async (req, res) => {
  const { id } = req.params;
  const { oldHex, newName, newHex } = req.body;
  try {
    await db.query(
      'UPDATE project_palette SET name = ?, hex = ? WHERE project_id = ? AND hex = ?',
      [newName, newHex, id, oldHex]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/projects/:projectId/brush-norms/:normId', async (req, res) => {
  const { projectId, normId } = req.params;
  const { name, value, unit, brushName } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE project_brush_norms SET name = ?, value = ?, unit = ?, brush_name = ? WHERE id = ? AND project_id = ?',
      [name, value, unit, brushName, normId, projectId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/projects/:projectId/typography-norms/:normId', async (req, res) => {
  const { projectId, normId } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE project_typography_norms SET font_family = ?, font_weight = ?, font_usage = ?, font_style = ? WHERE id = ? AND project_id = ?',
      [fontFamily, fontWeight, fontUsage, fontStyle, normId, projectId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
});