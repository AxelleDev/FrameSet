const DEFAULT_BCRYPT_SALT_ROUNDS = 12;

const parsedRounds = Number(process.env.BCRYPT_SALT_ROUNDS);

const BCRYPT_SALT_ROUNDS = Number.isInteger(parsedRounds) && parsedRounds >= 4
  ? parsedRounds
  : DEFAULT_BCRYPT_SALT_ROUNDS;

module.exports = {
  BCRYPT_SALT_ROUNDS
};