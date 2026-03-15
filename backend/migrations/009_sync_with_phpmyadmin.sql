ALTER TABLE project_brush_norms ENGINE=InnoDB;
-- Ajout du champ opacité (opacity) pour les pinceaux
ALTER TABLE project_brush_norms ADD COLUMN IF NOT EXISTS opacity FLOAT NULL AFTER unit;
ALTER TABLE project_palette ENGINE=InnoDB;
ALTER TABLE project_typography_norms ENGINE=InnoDB;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE project_brush_norms
  ADD CONSTRAINT fk_project_brush_norms_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE project_palette
  ADD CONSTRAINT fk_project_palette_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE project_typography_norms
  ADD CONSTRAINT fk_project_typography_norms_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE revoked_tokens
  ADD CONSTRAINT fk_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
