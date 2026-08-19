const jsonLimitHandler = (message) => (req, res) => {
  res.status(429).json({ error: message });
};

module.exports = { jsonLimitHandler };
