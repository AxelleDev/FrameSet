import React from 'react';

export default function GlobalErrorAlert({ message, onClose }) {
  if (!message) return null;
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
      {message}
      {onClose && (
        <button style={{ marginLeft: 16, background: 'transparent', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }} onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
