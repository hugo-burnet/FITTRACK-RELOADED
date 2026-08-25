import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  NOT_RESOLVED_STATES,
  isResolved,
  sameResolutionState
} from '../../tools/e5-llm/resolution-state.mjs';
import { E5_SYSTEM_PROMPT } from '../../tools/e5-llm/prompt.mjs';

const root = join(import.meta.dirname, '../..');

test('NOT_STATED and UNRESOLVED are the same decision', () => {
  // Le schema declare les deux sans jamais les definir, le prompt n en enseigne
  // qu un, et la GOLD emploie l autre 256 fois. Deux annotateurs entraines ne
  // parviennent pas a les distinguer (kappa 0,17). Ce ne sont pas deux etats, c est
  // un seul avec deux orthographes.
  assert.equal(sameResolutionState('NOT_STATED', 'UNRESOLVED'), true);
  assert.equal(sameResolutionState('UNRESOLVED', 'NOT_STATED'), true);
  assert.equal(sameResolutionState('NOT_STATED', 'NOT_STATED'), true);
  assert.equal(sameResolutionState('RESOLVED', 'RESOLVED'), true);
});

test('resolving an axis is never the same as abstaining', () => {
  // La seule distinction qui compte pour la surete : le modele a-t-il tranche ?
  assert.equal(sameResolutionState('RESOLVED', 'UNRESOLVED'), false);
  assert.equal(sameResolutionState('RESOLVED', 'NOT_STATED'), false);
  assert.equal(sameResolutionState('UNRESOLVED', 'RESOLVED'), false);
});

test('isResolved separates deciding from abstaining', () => {
  assert.equal(isResolved('RESOLVED'), true);
  for (const state of NOT_RESOLVED_STATES) assert.equal(isResolved(state), false);
  assert.equal(isResolved(undefined), false);
});

test('the prompt names every non-resolved state the GOLD actually uses', () => {
  // La cause racine : le prompt n enseignait que UNRESOLVED. Le modele obeissait,
  // et se faisait compter faux 43 fois sur un vocabulaire qu on ne lui avait pas
  // donne. Ce test empeche la specification de re-divergerer en silence.
  const gold = JSON.parse(
    readFileSync(join(root, 'golden/e5/adjudication/adjudicated.json'), 'utf8')
  ).annotations;
  const used = new Set();
  for (const annotation of gold) {
    for (const claim of annotation.expectedClaims) {
      for (const axis of Object.values(claim.axisResolution ?? {})) {
        if (axis?.state && axis.state !== 'RESOLVED') used.add(axis.state);
      }
    }
  }
  assert.ok(used.size > 0, 'la GOLD doit utiliser au moins un etat non resolu');
  for (const state of used) {
    assert.ok(
      E5_SYSTEM_PROMPT.includes(state),
      `le prompt ne mentionne jamais ${state}, que la GOLD emploie`
    );
  }
});
