import React from 'react';

function getFriendlyMessage(message) {
  if (!message) return null;
  if (typeof message === 'string') {
    if (message.match(/not found|404/i)) {
      return "Le service demandé est indisponible ou n'existe pas. Veuillez vérifier l'URL ou réessayer plus tard.";
    }
    if (message.match(/internal server error|500/i)) {
      return "Une erreur interne est survenue sur le serveur. Merci de réessayer plus tard ou de contacter le support si le problème persiste.";
    }
    if (message.match(/network|failed to fetch|fetch/i)) {
      return "Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.";
    }
    if (message.match(/unauthorized|401/i)) {
      return "Vous n'êtes pas autorisé à effectuer cette action. Veuillez vous reconnecter.";
    }
    if (message.match(/forbidden|403/i)) {
      return "Accès refusé. Vous n'avez pas les droits nécessaires.";
    }
    if (message.match(/timeout|timed out/i)) {
      return "Le serveur met trop de temps à répondre. Veuillez réessayer plus tard.";
    }
    if (message.trim() === 'Not Found') {
      return "Le service demandé est indisponible ou n'existe pas. Veuillez vérifier l'URL ou réessayer plus tard.";
    }
    // Ajout d'un fallback pour les messages techniques trop courts
    if (message.trim().length < 5) {
      return "Une erreur est survenue. Merci de réessayer.";
    }
    return message;
  }
  return 'Une erreur est survenue.';
}

export default function GlobalErrorAlert({ message, onClose }) {
  const friendly = getFriendlyMessage(message);
  if (!friendly) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      zIndex: 9999,
      background: '#FF9292',
      color: '#fff',
      padding: '1rem',
      textAlign: 'center',
      fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {friendly}
      {onClose && (
        <button style={{ marginLeft: 16, background: 'transparent', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }} onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
