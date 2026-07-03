// Project export page (/app/project/:id/export): download the style guide as a
// jsPDF-built PDF or raw JSON, with a live JSON preview.
import React, { useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useParams } from 'react-router-dom';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Seo from '../components/Seo';
import Button from '../components/Button';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';
import useActiveProject from '../hooks/useActiveProject';

export default function ProjectExport() {
  const { id } = useParams();
  const { activeProject, projectsLoading, activeProjectId } = useProjects();

  // Sync the active project with the route id (shared hook).
  useActiveProject(id);

  // Pretty-printed JSON, used for both the preview and the download.
  const projectJson = useMemo(() => {
    return activeProject ? JSON.stringify(activeProject, null, 2) : '';
  }, [activeProject]);

  // Trigger a JSON file download via a transient data-URI anchor.
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

  // Build and download the style-guide PDF. Drawn imperatively with jsPDF: `y`
  // is the running vertical cursor (mm), advanced per line, with a page break
  // whenever it nears the page bottom.
  const downloadPdf = async () => {
    if (!activeProject) return;

    // Load jsPDF on demand to keep its ~hundreds of KB out of the initial bundle.
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 20;

    // Normalize both norm types into a common { category, name, value, details }
    // shape so one loop can render them.
    const norms = [
      ...(activeProject.brushNorms || []).map(n => ({
        category: 'Brush',
        name: n.name,
        value: `${n.value}${n.unit || ''}`,
        details: [
          n.brushName ? `Brush: ${n.brushName}` : null,
          n.opacity !== undefined && n.opacity !== null ? `Opacity: ${n.opacity}` : null
        ].filter(Boolean).join(' | ')
      })),
      ...(activeProject.typographyNorms || []).map(n => ({
        category: 'Typography',
        name: n.fontUsage || n.fontFamily,
        value: n.fontFamily,
        details: [
          n.fontWeight ? `Weight: ${n.fontWeight}` : null,
          n.fontStyle ? `Style: ${n.fontStyle}` : null
        ].filter(Boolean).join(' | ')
      }))
    ];

    // Header: project name + generation date, then a divider rule.
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(activeProject.name, 20, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, y);
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
      doc.text('Graphic standards', 20, y);
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
      doc.text('Color palette', 20, y);
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
    doc.save(`${activeProject.name.replace(/\s+/g, '_')}_style_guide.pdf`);
  };

  return (
    <>
      <Seo title="Export standards" noindex />
      <PageHeader
        title="Export standards"
        subtitle="Export the essentials of your art direction."
      />

      {activeProject ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8 flex flex-col items-start text-left">
                <div className="h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-6">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
              <h2 className="text-lg font-medium text-primary mb-2">PDF style guide</h2>
              <p className="text-sm text-primary mb-6">A structured PDF document bringing together all of the project's active standards and palettes. Ideal for printing or sharing.</p>
                <Button onClick={downloadPdf} variant="primary">
                  Download PDF
                </Button>
            </Card>

            <Card className="p-8 flex flex-col items-start text-left">
                <div className="h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-6">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
              <h2 className="text-lg font-medium text-primary mb-2">JSON data</h2>
              <p className="text-sm text-primary mb-6">Raw data structure covering the entire project: standards, palettes, identifiers and settings. Ready to plug into your own tools.</p>
                <Button onClick={downloadJson} variant="primary">
                  Download JSON
                </Button>
            </Card>
          </div>

          <div className="mt-12">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">JSON output preview</h2>
            <div className="bg-primary/5 rounded-2xl p-6 overflow-x-auto">
              <pre className="text-xs text-primary font-mono leading-relaxed whitespace-pre-wrap break-words">{projectJson}</pre>
            </div>
          </div>
        </>
      ) : (
        <ProjectStatePlaceholder loading={projectsLoading || String(activeProjectId) !== String(id)} />
      )}
    </>
  );
}