import { PASSWORD_RULES, isPasswordValid, isValidEmail } from '../../src/utils/passwordRules';

describe('passwordRules', () => {
  describe('isPasswordValid', () => {
    it('accepte un mot de passe respectant toute la politique', () => {
      expect(isPasswordValid('Pass1234')).toBe(true);
    });

    it('refuse un mot de passe trop court', () => {
      expect(isPasswordValid('Pa1')).toBe(false);
    });

    it('refuse sans majuscule', () => {
      expect(isPasswordValid('password1')).toBe(false);
    });

    it('refuse sans minuscule', () => {
      expect(isPasswordValid('PASSWORD1')).toBe(false);
    });

    it('refuse sans chiffre', () => {
      expect(isPasswordValid('PasswordOnly')).toBe(false);
    });

    it('gère les valeurs vides/nulles sans planter', () => {
      expect(isPasswordValid('')).toBe(false);
      expect(isPasswordValid(null)).toBe(false);
      expect(isPasswordValid(undefined)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it.each([
      'axelle@example.com',
      'a.b+tag@sub.domain.fr',
    ])('accepte un email valide: %s', (email) => {
      expect(isValidEmail(email)).toBe(true);
    });

    it.each([
      'no-at',
      'missing@domain',
      'spaces in@mail.com',
      '@nolocal.com',
      '',
      null,
    ])('refuse un email invalide: %s', (email) => {
      expect(isValidEmail(email)).toBe(false);
    });

    it('ignore les espaces autour', () => {
      expect(isValidEmail('  axelle@example.com  ')).toBe(true);
    });
  });

  describe('PASSWORD_RULES', () => {
    it('expose les quatre règles attendues', () => {
      expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'lowercase', 'uppercase', 'digit']);
    });

    it('chaque règle valide correctement un cas conforme', () => {
      expect(PASSWORD_RULES.find((r) => r.id === 'length').test('abcdefgh')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'lowercase').test('a')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'uppercase').test('A')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'digit').test('1')).toBe(true);
    });
  });
});
