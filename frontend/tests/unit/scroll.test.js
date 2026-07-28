import scrollToTop from '../../src/utils/scroll';

describe('scrollToTop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('smooth-scrolls to the top by default', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    scrollToTop();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrolls instantly when the user prefers reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    scrollToTop();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
