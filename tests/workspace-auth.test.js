import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashWorkspaceToken,
  isWorkspaceId,
  isWorkspaceToken,
  workspaceTokenMatches
} from '../api/_lib/workspace-auth.js';

const validId = '2b6f3c72-9b25-4e2a-9b17-0e6db0f9a321';
const validToken = 'a'.repeat(43);

test('accepts only a UUIDv4 workspace identifier', () => {
  assert.equal(isWorkspaceId(validId), true);
  assert.equal(isWorkspaceId('not-a-uuid'), false);
  assert.equal(isWorkspaceId('2b6f3c72-9b25-1e2a-9b17-0e6db0f9a321'), false);
  assert.equal(isWorkspaceId(null), false);
});

test('validates workspace token shape before hashing', () => {
  assert.equal(isWorkspaceToken(validToken), true);
  assert.equal(isWorkspaceToken('short'), false);
  assert.equal(isWorkspaceToken('a'.repeat(257)), false);
  assert.equal(isWorkspaceToken(undefined), false);
});

test('matches a valid stored token hash and rejects wrong tokens or malformed hashes', () => {
  const hash = hashWorkspaceToken(validToken);
  assert.equal(workspaceTokenMatches(hash, validToken), true);
  assert.equal(workspaceTokenMatches(hash, 'b'.repeat(43)), false);
  assert.equal(workspaceTokenMatches('not-a-hash', validToken), false);
  assert.equal(workspaceTokenMatches(null, validToken), false);
  assert.equal(workspaceTokenMatches(hash, 'short'), false);
});

test('accepts a CHAR(64) hash with database padding but does not accept arbitrary characters', () => {
  const hash = hashWorkspaceToken(validToken);
  assert.equal(workspaceTokenMatches(`${hash}  `, validToken), true);
  assert.equal(workspaceTokenMatches(`${hash}z`, validToken), false);
});
