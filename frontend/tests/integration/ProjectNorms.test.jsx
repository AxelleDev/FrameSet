import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ProjectNorms from '../../src/pages/ProjectNorms';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

vi.mock('../../src/hooks/useActiveProject', () => ({ default: () => {} }));
vi.mock('../../src/hooks/useGoogleFonts', () => ({
  default: () => ({ fonts: [], loading: false, error: null }),
}));

const renderPage = () =>
  render(
    <HelmetProvider><MemoryRouter>
      <ProjectNorms />
    </MemoryRouter></HelmetProvider>
  );

describe('ProjectNorms', () => {
  beforeEach(() => {
    Object.assign(projectState, {
      activeProject: { id: '2', brushNorms: [], typographyNorms: [] },
      addBrushNorm: vi.fn().mockResolvedValue({}),
      addTypographyNorm: vi.fn().mockResolvedValue({}),
      deleteBrushNorm: vi.fn(),
      deleteTypographyNorm: vi.fn(),
      updateBrushNorm: vi.fn(),
      updateTypographyNorm: vi.fn(),
      projectsLoading: false,
      activeProjectId: '2',
    });
  });

  it('shows the title and the filter', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /graphic standards/i })).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('opens the add-standard modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByPlaceholderText(/hair outline/i)).toBeInTheDocument();
  });
});
