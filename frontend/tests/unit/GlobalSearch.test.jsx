import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GlobalSearch from '../../src/components/GlobalSearch';

const { mockApiGet, mockNavigate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../src/services/api', () => ({ default: { get: mockApiGet } }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const EMPTY = { projects: [], colors: [], brushNorms: [], typographyNorms: [] };

const renderSearch = (props = {}) =>
  render(
    <MemoryRouter>
      <GlobalSearch isOpen onClose={props.onClose || vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockNavigate.mockReset();
  });

  it('queries the search endpoint (debounced, URL-encoded) and shows grouped results', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({
      projects: [{ id: 1, name: 'Alyse Emotes' }],
      colors: [{ id: 4, name: 'Blush', hex: '#FCBFC4', projectId: 1, projectName: 'Alyse Emotes' }],
      brushNorms: [],
      typographyNorms: [
        {
          id: 9,
          fontFamily: 'Parisienne',
          fontUsage: 'Titres',
          projectId: 1,
          projectName: 'Alyse Emotes',
        },
      ],
    });
    renderSearch();

    await user.type(screen.getByRole('searchbox'), 'a&b');

    expect(await screen.findByRole('button', { name: 'Alyse Emotes' })).toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith(
      `/projects/search?q=${encodeURIComponent('a&b')}`,
      expect.any(Object),
    );
    expect(screen.getByText('Blush')).toBeInTheDocument();
    expect(screen.getByText('Parisienne')).toBeInTheDocument();
    // Brush group heading is omitted when it has no matches.
    expect(screen.queryByText(/^Brushes$/)).toBeNull();
  });

  it('navigates a color match to its project palette and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockApiGet.mockResolvedValue({
      ...EMPTY,
      colors: [{ id: 4, name: 'Blush', hex: '#FCBFC4', projectId: 3, projectName: 'P' }],
    });
    renderSearch({ onClose });

    await user.type(screen.getByRole('searchbox'), 'blush');
    await user.click(await screen.findByRole('button', { name: /blush/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/app/project/3/palette');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates a project match to its standards page', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ ...EMPTY, projects: [{ id: 7, name: 'Poster' }] });
    renderSearch();

    await user.type(screen.getByRole('searchbox'), 'poster');
    await user.click(await screen.findByRole('button', { name: /poster/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/app/project/7/norms');
  });

  it('shows a no-match state for a query with no results', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(EMPTY);
    renderSearch();

    await user.type(screen.getByRole('searchbox'), 'zzz');

    expect(await screen.findByText(/no matches for/i)).toBeInTheDocument();
  });

  it('does not call the API for a blank query', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByRole('searchbox'), '   ');
    // Let any (wrong) debounce fire.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
