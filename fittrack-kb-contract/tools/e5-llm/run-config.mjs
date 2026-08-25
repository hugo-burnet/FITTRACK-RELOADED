import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const DEFAULT_RUN_CONFIG_FILE = 'config.gpt-5.json';

export const GPT5_REASONING_EFFORTS = Object.freeze(['minimal', 'low', 'medium', 'high']);

// L'effort de raisonnement était épinglé à `minimal` pour que GPT-5 et Qwen3-1.7B
// soient comparables sur un même pied — Qwen tournant sans réflexion. Cette
// comparaison n'a jamais eu lieu : seul son manifeste existe, gelé sur le prompt
// v0.3.0, deux versions en arrière.
//
// Et c'était une erreur de cadrage. GPT-5 n'est pas le produit : il fabrique le
// corpus dont Qwen3-1.7B sera l'élève, sur téléphone. Brider le professeur pour
// qu'il ressemble à l'élève ne rend pas l'élève meilleur ; ça dégrade seulement ce
// sur quoi il apprendra. L'extraction est un travail de jugement hors ligne, faite
// une fois — elle doit être la meilleure possible.
export function assertModelReasoningConfig(config) {
  if (config.model === 'openai/gpt-5' && !GPT5_REASONING_EFFORTS.includes(config.reasoningEffort)) {
    throw new Error(
      `unsupported_reasoning_effort_for_model:${config.model}:${config.reasoningEffort}`
    );
  }
  return config;
}

export function assertRunConfigFile(value) {
  if (
    typeof value !== 'string' ||
    basename(value) !== value ||
    !/^config\.[a-z0-9._-]+\.json$/u.test(value)
  ) {
    throw new Error(`invalid_run_config_file:${value}`);
  }
  return value;
}

export function loadRunConfig(benchmarkRoot, configFile = DEFAULT_RUN_CONFIG_FILE) {
  const safeFile = assertRunConfigFile(configFile);
  const config = JSON.parse(readFileSync(join(benchmarkRoot, safeFile), 'utf8'));
  if (!/^[-a-z0-9.]+$/u.test(config.runVariant ?? '')) {
    throw new Error(`invalid_run_variant:${config.runVariant}`);
  }
  assertModelReasoningConfig(config);
  return { config, configFile: safeFile };
}
