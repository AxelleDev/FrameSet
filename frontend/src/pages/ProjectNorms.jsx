import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useParams } from 'react-router-dom';

export default function ProjectNorms() {
  const { id } = useParams();
  const { setActiveProjectId, activeProject, addProjectNorm } = useData();
  
  const [isAddingNorm, setIsAddingNorm] = useState(false);
  const categories = ['Trait', 'Format', 'Typographie', 'Layout', 'Couleur'];
  
  const [newCategory, setNewCategory] = useState('Trait');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('px');
  const [newBrushName, setNewBrushName] = useState('');

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const onCategoryChange = (cat) => {
    setNewCategory(cat);
    if (cat === 'Trait') {
      setNewUnit('px');
    } else {
      setNewUnit('');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewValue('');
    setNewUnit(newCategory === 'Trait' ? 'px' : '');
    setNewBrushName('');
  };

  const handleAddNorm = () => {
    if (!id || !newName || !newValue) return;
    
    const norm = {
      id: `n${Date.now()}`,
      category: newCategory,
      name: newName,
      value: newValue,
      unit: newUnit,
      brushName: newCategory === 'Trait' ? newBrushName : undefined
    };

    addProjectNorm(id, norm);
    setIsAddingNorm(false);
    resetForm();
  };

  return (
    <>
      <div className="flex justify-between items-end mb-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-light text-primary">Normes Graphiques</h2>
          <p className="text-primary mt-2 max-w-xl">Ensemble des règles techniques qui garantissent la cohérence visuelle.</p>
        </div>
        <button onClick={() => { resetForm(); setIsAddingNorm(true); }} className="px-5 py-2.5 bg-blue/10 text-primary rounded-xl text-sm font-medium hover:bg-blue/20 transition shadow-lg shadow-blue">
          + Ajouter une règle
        </button>
      </div>

      {activeProject && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProject.norms.map((norm) => (
              <div key={norm.id} className="glass-card p-6 rounded-2xl relative group hover:bg-white/80 transition-all hover:-translate-y-1 duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white border border-primary shadow-sm ${
                    (norm.category === 'Typographie' || norm.category === 'Typography') ? 'text-pink' :
                    norm.category === 'Layout' ? 'text-blue' :
                    (norm.category === 'Trait' || norm.category === 'Lineart') ? 'text-primary' : ''
                  }`}>
                    {norm.category}
                  </span>
                </div>
                
                <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{norm.name}</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-light text-primary mr-1">{norm.value}</span>
                  <span className="text-lg text-blue font-medium">{norm.unit}</span>
                </div>
                
                <div className="h-16 bg-blue/10 rounded-xl flex items-center justify-center border border-primary relative overflow-hidden group-hover:border-blue transition-colors">
                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-20"></div>
                   
                   {(norm.category === 'Typographie' || norm.category === 'Typography') ? (
                     <span className="text-primary text-xl font-medium tracking-tight" style={{fontFamily: norm.value}}>AaBbCc</span>
                   ) : (norm.category === 'Trait' || norm.category === 'Lineart') ? (
                     <div className="flex flex-col items-center justify-center w-full px-4">
                        <div className="w-16 bg-primary rounded-full mb-1" style={{ height: `${norm.value}px`, minHeight: '1px' }}></div>
                        <span className="text-[10px] text-blue font-bold uppercase tracking-wider">{norm.brushName || 'Brush'}</span>
                     </div>
                   ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-blue"></div>
                   )}
                </div>
              </div>
            ))}
          </div>

          {activeProject.norms.length === 0 && (
            <div className="text-center py-24 glass-panel rounded-3xl border-dashed border-blue">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue/10 text-blue mb-4">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-primary">Aucune norme définie</h3>
              <p className="text-blue">Commencez par ajouter des règles pour construire votre bible de style.</p>
            </div>
          )}
        </>
      )}

      {isAddingNorm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue/20 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-blue relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>

             <h3 className="text-xl font-light text-primary mb-6 relative z-10">Nouvelle Norme</h3>

             <div className="space-y-4 relative z-10">
                <div>
                   <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Catégorie</label>
                   <select value={newCategory} onChange={(e) => onCategoryChange(e.target.value)} className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary appearance-none font-medium">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                   </select>
                </div>

                {newCategory === 'Trait' ? (
                  <>
                    <div>
                       <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Usage du Brush</label>
                       <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Hair Lineart" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom du Brush</label>
                      <input type="text" value={newBrushName} onChange={e => setNewBrushName(e.target.value)} placeholder="ex: G-Pen" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Taille (px)</label>
                      <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="ex: 8" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                       <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom de la règle</label>
                       <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Taille Large" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                    </div>

                    <div className="flex gap-3">
                       <div className="flex-1">
                          <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Valeur</label>
                          <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="ex: 112" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                       </div>
                       <div className="w-1/3">
                          <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Unité</label>
                          <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="px" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                       </div>
                    </div>
                  </>
                )}
             </div>

             <div className="flex gap-3 mt-8 relative z-10">
               <button onClick={() => setIsAddingNorm(false)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
                 Annuler
               </button>
               <button onClick={handleAddNorm} disabled={!newName || !newValue}
                       className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-blue hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                 Ajouter
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}