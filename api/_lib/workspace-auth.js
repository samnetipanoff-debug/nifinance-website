import { createHash, timingSafeEqual } from 'node:crypto';

export const hashWorkspaceToken = (token) =>
  createHash('sha256').update(String(token)).digest('hex');

export const isWorkspaceId = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export const isWorkspaceToken = (value) =>
  typeof value === 'string' && value.length >= 32 && value.length <= 256;

export function workspaceTokenMatches(storedHash, token) {
  if (!isWorkspaceToken(token) || typeof storedHash !== 'string') return false;
  const stored = storedHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(stored)) return false;
  const expected = Buffer.from(hashWorkspaceToken(token), 'hex');
  const actual = Buffer.from(stored, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
