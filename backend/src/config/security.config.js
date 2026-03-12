const DEFAULT_BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const parsedRounds = Number(process.env.BCRYPT_SALT_ROUNDS);

const BCRYPT_SALT_ROUNDS = Number.isInteger(parsedRounds) && parsedRounds >= 4
  ? parsedRounds
  : DEFAULT_BCRYPT_SALT_ROUNDS;

module.exports = {
  BCRYPT_SALT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_COMPLEXITY_REGEX
};