/**
 * Project export page (route: /app/project/:id/export).
 *
 * Lets the user download the active project's style guide as a structured PDF
 * (built with jsPDF) or as raw JSON, and shows a live preview of the JSON
 * output. The PDF lists brush and typography norms followed by the color palette.
 */
import React, { useEffect, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useParams } from 'react-router-dom';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';

export default function ProjectExport() {
  const { id } = useParams();
  const { setActiveProjectId, activeProject, projectsLoading, activeProjectId } = useProjects();

  // Sync the active project with the route id.
  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  // Pretty-printed JSON of the project, used for both the preview and download.
  const projectJson = useMemo(() => {
    return activeProject ? JSON.stringify(activeProject, null, 2) : '';
  }, [activeProject]);

  // Trigger a JSON file download via a transient data-URI anchor.
  const downloadJson = () => {
    if (!activeProject) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(projectJson);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeProject.name.replace(/\s+/g, '_').toLowerCase()}_normes.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Build and download the style-guide PDF. The layout is drawn imperatively
  // with jsPDF: `y` is the running vertical cursor (in mm), advanced after each
  // line, and we add a new page whenever it approaches the page bottom.
  const downloadPdf = async () => {
    if (!activeProject) return;

    // Load jsPDF on demand so its ~hundreds of KB are not in the initial bundle.
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 20;

    // Normalize both norm types into a common { category, name, value, details }
    // shape so they can be rendered with one loop below.
    const norms = [
      ...(activeProject.brushNorms || []).map(n => ({
        category: 'Trait',
        name: n.name,
        value: `${n.value}${n.unit || ''}`,
        details: [
          n.brushName ? `Pinceau: ${n.brushName}` : null,
          n.opacity !== undefined && n.opacity !== null ? `Opacité: ${n.opacity}` : null
        ].filter(Boolean).join(' | ')
      })),
      ...(activeProject.typographyNorms || []).map(n => ({
        category: 'Typographie',
        name: n.fontUsage || n.fontFamily,
        value: n.fontFamily,
        details: [
          n.fontWeight ? `Graisse: ${n.fontWeight}` : null,
          n.fontStyle ? `Style: ${n.fontStyle}` : null
        ].filter(Boolean).join(' | ')
      }))
    ];

    // Document header: project name + generation date, then a divider rule.
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

    // Section: graphic norms (brush + typography).
    if (norms.length > 0) {
      // Page-break guard before the section title.
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50);
      doc.text('Normes Graphiques', 20, y);
      y += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      norms.forEach(norm => {
        // Start a new page if the next line would overflow.
        if (y > 270) { doc.addPage(); y = 20; }
        let line = `• [${norm.category}] ${norm.name}: ${norm.value}`;
        doc.text(line, 25, y);
        y += 6;
        // Optional secondary line (smaller, grey) for extra details.
        if (norm.details) {
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(`   ${norm.details}`, 28, y);
          doc.setFontSize(11);
          doc.setTextColor(0);
          y += 6;
        }
        y += 2;
      });
      y += 10;
    }

    // Section: color palette, each entry drawn as a swatch + name + hex.
    if (activeProject.palette.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50);
      doc.text('Palette de couleurs', 20, y);
      y += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);

      activeProject.palette.forEach(color => {
        if (y > 270) { doc.addPage(); y = 20; }
        // Filled swatch with a light border, then the color name and hex.
        doc.setFillColor(color.hex);
        doc.rect(25, y - 4, 6, 6, 'F');
        doc.setDrawColor(200);
        doc.rect(25, y - 4, 6, 6, 'S');
        doc.text(`${color.name} (${color.hex})`, 35, y);
        y += 8;
      });
      y += 10;
    }

    // Save with a filesystem-safe filename derived from the project name.
    doc.save(`${activeProject.name.replace(/\s+/g, '_')}_guide_de_style.pdf`);
  };

  return (
    <>
      <PageHeader
        title="Exporter les normes"
        subtitle="Exportez l’essentiel de votre direction artistique."
      />

      {activeProject ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8 flex flex-col items-start text-left">
                <div className="h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-6">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
              <h3 className="text-lg font-medium text-primary mb-2">Guide de style PDF</h3>
              <p className="text-sm text-primary mb-6">Un document PDF structuré regroupant l’ensemble des normes actives et des palettes du projet. Idéal pour l’impression ou le partage.</p>
                <Button onClick={downloadPdf} variant="primary">
                  Télécharger le PDF
                </Button>
            </Card>

            <Card className="p-8 flex flex-col items-start text-left">
                <div className="h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-6">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
              <h3 className="text-lg font-medium text-primary mb-2">Données JSON</h3>
              <p className="text-sm text-primary mb-6">Structure de données brute regroupant l’ensemble du projet : normes, palettes, identifiants et paramètres. Prête à être intégrée dans vos outils.</p>
                <Button onClick={downloadJson} variant="primary">
                  Télécharger le JSON
                </Button>
            </Card>
          </div>

          <div className="mt-12">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Aperçu de la sortie JSON</h4>
            <div className="bg-primary/5 rounded-2xl p-6 overflow-x-auto ">
              <pre className="text-xs text-primary font-mono leading-relaxed">{projectJson}</pre>
            </div>
          </div>
        </>
      ) : (
        <ProjectStatePlaceholder loading={projectsLoading || String(activeProjectId) !== String(id)} />
      )}
    </>
  );
}