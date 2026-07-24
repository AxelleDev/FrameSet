-- Avatar initials are now always a single letter (see getInitials in
-- auth.utils.js — usernames are a single pseudo/handle, not a "First Last"
-- name), so the demo account's seeded initials follow the same rule.
UPDATE `users` SET `avatar_initials` = 'D' WHERE `is_demo` = 1;
