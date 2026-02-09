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
      { id: 'n3', category: 'Format', name: 'Taille Small', value: '28', unit: 'px' },
      { id: 'n4', category: 'Trait', name: 'Hair Lineart', value: '8', unit: 'px', brushName: 'G-Pen Soft' },
      { id: 'n5', category: 'Trait', name: 'Details & Eyes', value: '4', unit: 'px', brushName: 'Technical Pencil' }
    ],
    palette: [
      { name: 'Hair Base Color', hex: '#DBE7E5' },
      { name: 'Eye Base Color', hex: '#558AA3' },
      { name: 'Skin Base Color', hex: '#FFEDE8' },
      { name: 'Blush Color', hex: '#FCBFC4' }
    ],
    characters: [
      { id: 'c1', name: 'Alyse', role: 'Avatar Stream', description: 'Version Chibi expressive.' }
    ]
  }
];

module.exports = { user, projects };