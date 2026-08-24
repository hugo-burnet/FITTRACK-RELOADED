import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const DEFAULT_RUN_CONFIG_FILE = 'config.gpt-5.json';

export function assertModelReasoningConfig(config) {
  if (config.model === 'openai/gpt-5' && config.reasoningEffort !== 'minimal') {
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
