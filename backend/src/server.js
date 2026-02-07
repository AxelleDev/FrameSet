const express = require('express');
const cors = require('cors');

const db = require('./database');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- AUTHENTICATION ---

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // Initials generator
  const getInitials = (n) => n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const initials = getInitials(name);

  try {
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, avatar_initials, license) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'Creative', initials, 'Standard']
    );

    const newUser = {
      id: result.insertId,
      name,
      email,
      role: role || 'Creative',
      avatarInitials: initials,
      license: 'Standard'
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
    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    const user = {
      id: userDb.id,
      name: userDb.name,
      role: userDb.role,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials,
      license: userDb.license
    };
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
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
  const { userId, name, client } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO projects (user_id, name, client, progress) VALUES (?, ?, ?, 0)', 
      [userId, name, client || 'Interne']
    );
    const newId = result.insertId;
    
    const newProject = {
      id: newId,
      name,
      client: client || 'Interne',
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
    await db.query(
      'INSERT INTO project_norms (project_id, category, name, value, unit, brush_name) VALUES (?, ?, ?, ?, ?, ?)',
      [id, category, name, value, unit, brushName]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true });
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
        'INSERT INTO project_palette (project_id, name, hex) VALUES (?, ?, ?)',
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Connected to MySQL database: frameset_db');
});