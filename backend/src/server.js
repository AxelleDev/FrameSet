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

// --- AUTHENTICATION ---

// Route pour obtenir le nombre d'utilisateurs
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
  const { name, email, password, role } = req.body;

  // Initials generator
  const getInitials = (n) => n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const initials = getInitials(name);

  // Génère un code à 6 chiffres et une date d'expiration (10 min)
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, avatar_initials, is_verified, verification_code, verification_code_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'Creative', initials, false, verificationCode, expires]
    );

    // Envoi du mail
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
      role: role || 'Creative',
      avatarInitials: initials,
      is_verified: false
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

// Route pour la connexion (login)
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
      role: userDb.role,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials
    };
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour valider le code de confirmation
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
    // Vérifie l'expiration
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

// Route pour renvoyer un nouveau code de vérification
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
    // Génère un nouveau code et une nouvelle expiration
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.query('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE email = ?', [newCode, expires, email]);
    // Envoi du mail
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

// --- ROUTES USER ---

app.put('/api/user', async (req, res) => {
  const { id, name, role, email } = req.body; // Expect ID in body for now
  try {
    await db.query('UPDATE users SET name = ?, role = ?, email = ? WHERE id = ?', [name, role, email, id]);
    res.json({ success: true, name, role, email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- ROUTES PROJECTS ---

app.get('/api/projects', async (req, res) => {
  const userId = req.query.userId; // Filter by User ID
  
  if (!userId) return res.json([]); // Return empty if no user logged in

  try {
    const [projectsData] = await db.query(
      'SELECT *, DATE_FORMAT(last_edited, "%d/%m %H:%i") as lastEditedFormatted FROM projects WHERE user_id = ? ORDER BY created_at DESC', 
      [userId]
    );
    
    const fullProjects = await Promise.all(projectsData.map(async (p) => {
      const [norms] = await db.query('SELECT * FROM project_norms WHERE project_id = ?', [p.id]);
      const [palette] = await db.query('SELECT * FROM project_palette WHERE project_id = ?', [p.id]);
      
      return {
        id: p.id,
        name: p.name,
        client: p.client,
        progress: p.progress,
        lastEdited: p.lastEditedFormatted || 'À l\'instant',
        normsCount: norms.length,
        norms: norms.map(n => ({
          id: n.id,
          category: n.category,
          name: n.name,
          value: n.value,
          unit: n.unit,
          brushName: n.brush_name
        })),
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

// --- ROUTES NORMS & PALETTE (UNCHANGED LOGIC) ---

app.post('/api/projects/:id/norms', async (req, res) => {
  const { id } = req.params;
  const { category, name, value, unit, brushName } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO project_norms (project_id, category, name, value, unit, brush_name) VALUES (?, ?, ?, ?, ?, ?)',
      [id, category, name, value, unit, brushName]
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
    // Insère ou remplace chaque couleur pour ce projet
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

// Suppression d'une norme par son id
app.delete('/api/projects/:projectId/norms/:normId', async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    console.log('Suppression norme:', { projectId, normId });
    const [result] = await db.query('DELETE FROM project_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
    console.log('Résultat suppression:', result);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Connected to MySQL database: frameset_db');
});