/**
 * The projects service's input validators — every rejection branch is a
 * user-facing 400 and a DB-integrity guarantee (nothing over-long, no alpha
 * hex channels the exporters can't handle, no forged ids).
 */
const projectsService = require('../../src/services/projects.service');

jest.mock('../../src/database');

describe('validateProjectName', () => {
  it('trims and accepts a normal name', () => {
    expect(projectsService.validateProjectName('  Alyse  ')).toBe('Alyse');
  });

  it('rejects a missing/blank name with missing_name', () => {
    for (const bad of [undefined, null, '', '   ']) {
      expect(() => projectsService.validateProjectName(bad)).toThrow(
        expect.objectContaining({ code: 'missing_name' }),
      );
    }
  });

  it('treats a non-string as missing, and rejects out-of-bounds lengths as invalid', () => {
    expect(() => projectsService.validateProjectName(42)).toThrow(
      expect.objectContaining({ code: 'missing_name' }),
    );
    // 2-50 chars: a single char and 51 chars both fail.
    expect(() => projectsService.validateProjectName('x')).toThrow(
      expect.objectContaining({ code: 'invalid_name' }),
    );
    expect(() => projectsService.validateProjectName('x'.repeat(51))).toThrow(
      expect.objectContaining({ code: 'invalid_name' }),
    );
  });
});

describe('validatePalettePayload', () => {
  it('normalizes valid colors (ids kept, names trimmed, hex preserved)', () => {
    const validated = projectsService.validatePalettePayload([
      { id: 7, name: '  Ink  ', hex: '#112233' },
      { name: '', hex: '#abc' },
    ]);

    expect(validated).toEqual([
      { id: 7, name: 'Ink', hex: '#112233' },
      { id: null, name: null, hex: '#abc' },
    ]);
  });

  it('rejects a non-array payload', () => {
    expect(() => projectsService.validatePalettePayload({ hex: '#112233' })).toThrow(
      /must be an array/,
    );
  });

  it('rejects a palette over the 50-color cap', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      hex: `#${String(100000 + i).slice(0, 6)}`,
    }));
    expect(() => projectsService.validatePalettePayload(tooMany)).toThrow(/cannot exceed 50/);
  });

  it('rejects alpha-channel and malformed hex values', () => {
    for (const hex of ['#11223344', '112233', '#11223g', 'red', null]) {
      expect(() => projectsService.validatePalettePayload([{ hex }])).toThrow(/Invalid color/);
    }
  });

  it('rejects forged color ids (non-integer or non-positive)', () => {
    for (const id of ['abc', -1, 0, 1.5]) {
      expect(() => projectsService.validatePalettePayload([{ id, hex: '#112233' }])).toThrow(
        /Invalid color identifier/,
      );
    }
  });

  it('rejects an over-long color usage', () => {
    expect(() =>
      projectsService.validatePalettePayload([{ hex: '#112233', name: 'x'.repeat(256) }]),
    ).toThrow(/color usage is invalid/);
  });
});

describe('addBrushNormToProject validation branches', () => {
  const db = require('../../src/database');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const expectRejected = async (payload, pattern) => {
    await expect(projectsService.addBrushNormToProject(1, payload)).rejects.toThrow(pattern);
    expect(db.query).not.toHaveBeenCalled();
  };

  it('rejects a missing or blank usage name', async () => {
    await expectRejected({ value: '8' }, /brush usage/);
    await expectRejected({ name: '   ', value: '8' }, /brush usage/);
  });

  it('rejects a non-positive, non-numeric or oversized size', async () => {
    await expectRejected({ name: 'Line', value: '0' }, /positive number/);
    await expectRejected({ name: 'Line', value: 'huge' }, /positive number/);
    await expectRejected({ name: 'Line', value: '1001' }, /positive number/);
    await expectRejected({ name: 'Line', value: {} }, /positive number/);
  });

  it('rejects a unit with digits or over 20 chars', async () => {
    await expectRejected({ name: 'Line', value: '8', unit: 'px2' }, /unit is invalid/);
    await expectRejected({ name: 'Line', value: '8', unit: 'a'.repeat(21) }, /unit is invalid/);
  });

  it('rejects an out-of-range or non-numeric opacity', async () => {
    await expectRejected({ name: 'Line', value: '8', opacity: '1.5' }, /between 0 and 1/);
    await expectRejected({ name: 'Line', value: '8', opacity: [] }, /between 0 and 1/);
  });

  it('accepts the minimal valid payload, defaulting the unit to px', async () => {
    db.query
      .mockResolvedValueOnce([{ insertId: 9 }]) // INSERT
      .mockResolvedValueOnce([{}]); // last_edited touch

    const result = await projectsService.addBrushNormToProject(1, { name: 'Line', value: '8' });

    expect(result).toEqual({ success: true, id: 9 });
    expect(db.query.mock.calls[0][1]).toEqual(expect.arrayContaining(['px']));
  });
});
