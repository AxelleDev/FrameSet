UPDATE revoked_tokens
SET token = SHA2(token, 256)
WHERE token IS NOT NULL
  AND token <> ''
  AND token NOT REGEXP '^[0-9a-fA-F]{64}$';
