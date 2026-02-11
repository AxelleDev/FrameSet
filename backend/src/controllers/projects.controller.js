const db = require('../database');

const listProjects = async (req, res) => {
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
};

const createProject = async (req, res) => {
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
};

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

const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
};

const addBrushNorm = async (req, res) => {
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
};

const addTypographyNorm = async (req, res) => {
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
};

const updatePalette = async (req, res) => {
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
};

const deleteBrushNorm = async (req, res) => {
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
};

const deleteTypographyNorm = async (req, res) => {
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
};

const deletePaletteColor = async (req, res) => {
  const { id } = req.params;
  const { hex } = req.body;
  try {
    await db.query('DELETE FROM project_palette WHERE project_id = ? AND hex = ?', [id, hex]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
};

const updatePaletteColor = async (req, res) => {
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
};

const updateBrushNorm = async (req, res) => {
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
};

const updateTypographyNorm = async (req, res) => {
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
};

module.exports = {
  listProjects,
  createProject,
  updateProjectName,
  deleteProject,
  addBrushNorm,
  addTypographyNorm,
  updatePalette,
  deleteBrushNorm,
  deleteTypographyNorm,
  deletePaletteColor,
  updatePaletteColor,
  updateBrushNorm,
  updateTypographyNorm
};
