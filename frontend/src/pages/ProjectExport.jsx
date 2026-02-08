import React, { useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function ProjectExport() {
  const { id } = useParams();
  const { setActiveProjectId, activeProject } = useData();

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const projectJson = useMemo(() => {
    return activeProject ? JSON.stringify(activeProject, null, 2) : '';
  }, [activeProject]);

  const downloadJson = () => {
    if (!activeProject) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(projectJson);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeProject.name.replace(/\s+/g, '_').toLowerCase()}_standards.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadPdf = () => {
    if (!activeProject) return;

    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(activeProject.name, 20, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Version générée le ${new Date().toLocaleDateString()}`, 20, y);
    y += 20;
    
    doc.setDrawColor(200);
    doc.line(20, y - 10, 190, y - 10);

    if (activeProject.norms.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      activeProject.norms.forEach(norm => {
        if (y > 270) { doc.addPage(); y = 20; }
        const line = `• [${norm.category}] ${norm.name}: ${norm.value}${norm.unit || ''}`;
        doc.text(line, 25, y);
        y += 8;
      });
      y += 10;
    }

    if (activeProject.palette.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50);
      doc.text('Palette de Couleurs', 20, y);
      y += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);

      activeProject.palette.forEach(color => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFillColor(color.hex);
        doc.rect(25, y - 4, 6, 6, 'F');
        doc.setDrawColor(200);
        doc.rect(25, y - 4, 6, 6, 'S');
        doc.text(`${color.name} (${color.hex})`, 35, y);
        y += 8;
      });
      y += 10;
    }

    doc.save(`${activeProject.name.replace(/\s+/g, '_')}_StyleGuide.pdf`);
  };

  return (
    <>
      <div className="mb-8 animate-fade-in">
        <h2 className="text-3xl font-light text-primary">Exporter les Standards</h2>
        <p className="text-primary mt-2">Générez une documentation ou des données brutes pour votre pipeline.</p>
      </div>

      {activeProject ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            <div className="bg-white p-8 rounded-xl border border-blue shadow-sm flex flex-col items-center text-center hover:border-pink transition">
              <div className="h-16 w-16 bg-pink/10 text-pink rounded-full flex items-center justify-center mb-6">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-primary mb-2">Guide de Style PDF</h3>
              <p className="text-sm text-primary mb-6">Un document PDF formaté professionnellement contenant toutes les normes actives et les palettes. Idéal pour l'impression.</p>
              <button onClick={downloadPdf} className="w-full py-3 border border-pink text-pink font-medium rounded-lg hover:bg-pink/10 transition">
                 Télécharger le PDF
              </button>
            </div>

            <div className="bg-white p-8 rounded-xl border border-blue shadow-sm flex flex-col items-center text-center hover:border-pink transition">
              <div className="h-16 w-16 bg-blue/10 text-blue rounded-full flex items-center justify-center mb-6">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
              <h3 className="text-lg font-medium text-primary mb-2">Pipeline JSON</h3>
              <p className="text-sm text-primary mb-6">Structure de données brute contenant tous les ID et valeurs. Utilisez ceci pour intégrer les normes directement dans vos logiciels créatifs.</p>
              <button onClick={downloadJson} className="w-full py-3 border border-blue text-blue font-medium rounded-lg hover:bg-blue/10 transition">
                 Télécharger le JSON
              </button>
            </div>
          </div>

          <div className="mt-12 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h4 className="text-sm font-bold text-blue uppercase tracking-wider mb-4">Aperçu de la sortie JSON</h4>
            <div className="bg-primary/90 rounded-lg p-6 overflow-x-auto shadow-inner">
              <pre className="text-xs text-blue font-mono leading-relaxed">{projectJson}</pre>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <div className="spinner border-4 border-blue border-t-pink rounded-full w-10 h-10 mx-auto animate-spin"></div>
          <p className="mt-4 text-blue">Chargement du projet...</p>
        </div>
      )}
    </>
  );
}