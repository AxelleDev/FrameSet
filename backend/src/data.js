const user = {
  name: 'Prénom Nom',
  email: 'axelle.nom@gmail.com',
  avatarInitials: 'AT'
};

const projects = [
  {
    id: 'p1',
    name: 'Alyse - Emotes Twitch',
    progress: 15,
    lastEdited: '\u00c0 l\'instant',
    normsCount: 4,
    norms: [
      { id: 'n1', category: 'Typographie', name: 'Police Principale', value: 'Figtree', unit: 'Bold' },
      { id: 'n2', category: 'Format', name: 'Taille Large', value: '112', unit: 'px' },
      { id: 'n3', category: 'Format', name: 'Taille Petite', value: '28', unit: 'px' },
      { id: 'n4', category: 'Trait', name: 'Contour des cheveux', value: '8', unit: 'px', brushName: 'Plume G souple' },
      { id: 'n5', category: 'Trait', name: 'Détails et yeux', value: '4', unit: 'px', brushName: 'Crayon technique' }
    ],
    palette: [
      { name: 'Couleur de base des cheveux', hex: '#DBE7E5' },
      { name: 'Couleur de base des yeux', hex: '#558AA3' },
      { name: 'Couleur de base de la peau', hex: '#FFEDE8' },
      { name: 'Couleur de blush', hex: '#FCBFC4' }
    ],
    characters: [
      { id: 'c1', name: 'Alyse', role: 'Avatar de stream', description: 'Version chibi expressive.' }
    ]
  }
];

module.exports = { user, projects };