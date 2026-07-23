import { PASSWORD_RULES, isPasswordValid, isValidEmail } from '../../src/utils/passwordRules';

describe('passwordRules', () => {
  describe('isPasswordValid', () => {
    it('accepts a password that meets the full policy', () => {
      expect(isPasswordValid('Pass1234')).toBe(true);
    });

    it('rejects a password that is too short', () => {
      expect(isPasswordValid('Pa1')).toBe(false);
    });

    it('rejects one without an uppercase letter', () => {
      expect(isPasswordValid('password1')).toBe(false);
    });

    it('rejects one without a lowercase letter', () => {
      expect(isPasswordValid('PASSWORD1')).toBe(false);
    });

    it('rejects one without a digit', () => {
      expect(isPasswordValid('PasswordOnly')).toBe(false);
    });

    it('handles empty/null values without crashing', () => {
      expect(isPasswordValid('')).toBe(false);
      expect(isPasswordValid(null)).toBe(false);
      expect(isPasswordValid(undefined)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it.each(['axelle@example.com', 'a.b+tag@sub.domain.fr'])(
      'accepts a valid email: %s',
      (email) => {
        expect(isValidEmail(email)).toBe(true);
      },
    );

    it.each(['no-at', 'missing@domain', 'spaces in@mail.com', '@nolocal.com', '', null])(
      'rejects an invalid email: %s',
      (email) => {
        expect(isValidEmail(email)).toBe(false);
      },
    );

    it('ignores surrounding whitespace', () => {
      expect(isValidEmail('  axelle@example.com  ')).toBe(true);
    });
  });

  describe('PASSWORD_RULES', () => {
    it('exposes the four expected rules', () => {
      expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
        'length',
        'lowercase',
        'uppercase',
        'digit',
      ]);
    });

    it('each rule correctly validates a compliant case', () => {
      expect(PASSWORD_RULES.find((r) => r.id === 'length').test('abcdefgh')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'lowercase').test('a')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'uppercase').test('A')).toBe(true);
      expect(PASSWORD_RULES.find((r) => r.id === 'digit').test('1')).toBe(true);
    });
  });
});
