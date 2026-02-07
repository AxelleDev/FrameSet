# FrameSet - Axelle

Application professionnelle de gestion de normes graphiques.

## Nettoyage (Important)

Si vous venez de migrer le projet, vous pouvez supprimer manuellement les dossiers suivants situés à la racine pour ne garder que l'architecture propre :
- ❌ `src/` (Ancien dossier source)
- ❌ `FrameSet/` (Ancien dossier dupliqué)

## Architecture Valide

L'architecture propre ne doit contenir que :

- 📂 `backend/` : API Node.js (Express)
- 📂 `frontend/` : Application React (Vite)
- 📄 `index.html` : Point d'entrée web
- 📄 `index.tsx` : Point d'entrée React

## Installation et Lancement

### 1. Backend (API)
```bash
cd backend
npm install
npm start
# Le serveur écoute sur http://localhost:3000
```

### 2. Frontend (App)
```bash
cd frontend
npm install
npm run dev
# L'application est accessible sur http://localhost:5173
```
