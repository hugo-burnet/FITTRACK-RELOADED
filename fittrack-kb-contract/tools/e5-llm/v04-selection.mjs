import { createHash } from 'node:crypto';

const HOLDOUT_SEED = 'e5-v04-holdout-30';
export const DEV20_BUCKET_PRIORITY = [
  'partial_rejection',
  'false_zero_claim',
  'missed_claim',
  'merged_claims',
  'wrong_epistemic_status',
  'citation_error',
  'safety_violation',
  'successful_zero_claim_witness',
  'successful_nonempty_witness',
  'residual_error_count'
];

const CITATION_ERRORS = new Set(['WRONG_CITATION', 'CITATION_BLEED', 'INVENTED_CITATION']);
const SAFETY_ERRORS = new Set([
  'SPAN_HALLUCINATION',
  'INVENTED_SOURCE',
  'EVIDENCE_INFLATION',
  'UNSUPPORTED_INFERENCE',
  'EMG_HYPERTROPHY_LEAP',
  'BIOMECHANICS_RISK_LEAP',
  'CLINICAL_OVERREACH',
  'INVENTED_DIAGNOSIS'
]);

function corpusOf(item) {
  const value = `${item.corpus ?? ''} ${item.corpusFileId ?? ''} ${item.fragmentId ?? ''}`.toLowerCase();
  if (/(?:^|[.\s])(?:e5)?f2(?:[.\s]|$)/u.test(value)) return 'F2';
  if (/(?:^|[.\s])(?:e5)?f3(?:[.\s]|$)/u.test(value)) return 'F3';
  throw new Error(`unknown_e5_corpus:${item.fragmentId ?? 'unknown'}`);
}

function sha256Utf8(parts) {
  return createHash('sha256').update(parts.join('\0'), 'utf8').digest('hex');
}

function lexical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function utf8Length(fragment) {
  return Buffer.byteLength(fragment.rawText ?? '', 'utf8');
}

function tertiles(fragments) {
  const lengths = fragments.map(utf8Length).sort((left, right) => left - right);
  if (!lengths.length) return { short: 0, medium: 0 };
  return {
    short: lengths[Math.min(lengths.length - 1, Math.ceil(lengths.length / 3) - 1)],
    medium: lengths[Math.min(lengths.length - 1, Math.ceil((lengths.length * 2) / 3) - 1)]
  };
}

function lengthTertile(fragment, cutoffs) {
  const length = utf8Length(fragment);
  if (length <= cutoffs.short) return 'short';
  if (length <= cutoffs.medium) return 'medium';
  return 'long';
}

function citationFragmentId(candidate) {
  return candidate.fragmentRef ?? candidate.fragmentId ?? candidate.fragment_id ?? null;
}

function deterministicHoldoutSelection(fragments, citationCandidates, corpusCommit) {
  const cited = new Set(citationCandidates.map(citationFragmentId).filter(Boolean));
  const cutoffs = tertiles(fragments);
  const strata = new Map();
  for (const fragment of fragments) {
    const heading = (fragment.headingPath ?? []).join(' > ');
    const citation = cited.has(fragment.fragmentId) ? 'cited' : 'uncited';
    const length = lengthTertile(fragment, cutoffs);
    const stratum = `${heading}\u0000${citation}\u0000${length}`;
    const item = {
      fragment,
      stratum: { headingPath: heading, citationPresence: citation === 'cited', utf8LengthTertile: length },
      selectionHash: sha256Utf8([HOLDOUT_SEED, corpusCommit, fragment.fragmentId])
    };
    if (!strata.has(stratum)) strata.set(stratum, []);
    strata.get(stratum).push(item);
  }
  const queues = [...strata.entries()]
    .sort(([left], [right]) => lexical(left, right))
    .map(([, items]) => items.sort((left, right) => lexical(left.selectionHash, right.selectionHash) || lexical(left.fragment.fragmentId, right.fragment.fragmentId)));
  const selected = [];
  while (selected.length < 15) {
    let advanced = false;
    for (const queue of queues) {
      if (queue.length && selected.length < 15) {
        selected.push(queue.shift());
        advanced = true;
      }
    }
    if (!advanced) throw new Error('holdout_selection_insufficient_candidates');
  }
  return selected;
}

export function selectHoldout30({ fragments, citationCandidates = [], dev100Ids = [], corpusCommit, sourceHashes = {} }) {
  if (!corpusCommit) throw new Error('holdout_corpus_commit_required');
  const excluded = new Set(dev100Ids);
  const eligible = fragments.filter((fragment) => !excluded.has(fragment.fragmentId));
  const selections = ['F2', 'F3'].flatMap((corpus) => {
    const corpusFragments = eligible.filter((fragment) => corpusOf(fragment) === corpus);
    if (corpusFragments.length < 15) throw new Error(`holdout_insufficient_${corpus}:${corpusFragments.length}`);
    return deterministicHoldoutSelection(corpusFragments, citationCandidates, corpusCommit).map((item) => ({
      fragmentId: item.fragment.fragmentId,
      corpus,
      stratum: item.stratum,
      selectionHash: `sha256:${item.selectionHash}`
    }));
  });
  return {
    schemaVersion: '1.0.0-e5-v04-holdout-30',
    dataset: 'HOLDOUT-30',
    seed: HOLDOUT_SEED,
    algorithm: 'sha256_utf8(seed\\u0000corpusCommit\\u0000fragmentId), lexical strata, round_robin_15_per_corpus',
    corpusCommit,
    sourceHashes,
    excludedDev100Ids: [...excluded].sort(),
    fragmentIds: selections.map((item) => item.fragmentId),
    selections,
    counts: {
      F2: selections.filter((item) => item.corpus === 'F2').length,
      F3: selections.filter((item) => item.corpus === 'F3').length
    }
  };
}

function errorsFor(result, errorsByFragment) {
  const combined = [...(result.errors ?? []), ...(errorsByFragment.get(result.fragmentId) ?? [])];
  const seen = new Set();
  return combined.filter((error) => {
    const key = `${error.category}:${JSON.stringify(error.details ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bucketNames(result, localErrors) {
  const categories = new Set(localErrors.map((error) => error.category));
  const selected = [];
  if (
    result.status === 'REJECTED' &&
    ((result.individuallyValidClaimCount ?? 0) > 0 || (result.partialAudit?.individuallyValidClaimCount ?? 0) > 0)
  ) selected.push('partial_rejection');
  if (categories.has('ZERO_CLAIM_FALSE_NEGATIVE')) selected.push('false_zero_claim');
  if (categories.has('MISSED_CLAIM')) selected.push('missed_claim');
  if (categories.has('MERGED_CLAIMS')) selected.push('merged_claims');
  if (categories.has('WRONG_EPISTEMIC_STATUS')) selected.push('wrong_epistemic_status');
  if ([...categories].some((category) => CITATION_ERRORS.has(category))) selected.push('citation_error');
  if (
    localErrors.some((error) => error.details?.critical === true) ||
    [...categories].some((category) => SAFETY_ERRORS.has(category))
  ) selected.push('safety_violation');
  if (!localErrors.length && result.goldenZero) selected.push('successful_zero_claim_witness');
  if (!localErrors.length && !result.goldenZero) selected.push('successful_nonempty_witness');
  selected.push('residual_error_count');
  return selected;
}

export function selectDev20({ annotations = [], fragmentResults, errors = [], sourceHashes = {} }) {
  const annotationById = new Map(annotations.map((annotation) => [annotation.fragmentId, annotation]));
  const errorsByFragment = new Map();
  for (const error of errors) {
    if (!errorsByFragment.has(error.fragmentId)) errorsByFragment.set(error.fragmentId, []);
    errorsByFragment.get(error.fragmentId).push(error);
  }
  const candidates = fragmentResults.map((result) => {
    const localErrors = errorsFor(result, errorsByFragment);
    const annotation = annotationById.get(result.fragmentId);
    return {
      ...result,
      corpus: result.corpus ?? corpusOf(result),
      goldenZero: result.goldenZero ?? annotation?.annotationStatus === 'zero_claim',
      errorCount: localErrors.length,
      buckets: bucketNames({
        ...result,
        goldenZero: result.goldenZero ?? annotation?.annotationStatus === 'zero_claim'
      }, localErrors)
    };
  });
  const selections = ['F2', 'F3'].flatMap((corpus) => {
    const byBucket = new Map(DEV20_BUCKET_PRIORITY.map((bucket) => [bucket, []]));
    for (const item of candidates.filter((candidate) => candidate.corpus === corpus)) {
      for (const bucket of item.buckets) byBucket.get(bucket).push(item);
    }
    for (const items of byBucket.values()) {
      items.sort((left, right) => right.errorCount - left.errorCount || lexical(left.fragmentId, right.fragmentId));
    }
    const cursors = new Map(DEV20_BUCKET_PRIORITY.map((bucket) => [bucket, 0]));
    const chosen = [];
    const chosenIds = new Set();
    while (chosen.length < 10) {
      let advanced = false;
      for (const bucket of DEV20_BUCKET_PRIORITY) {
        const items = byBucket.get(bucket);
        let cursor = cursors.get(bucket);
        while (cursor < items.length && chosenIds.has(items[cursor].fragmentId)) cursor += 1;
        cursors.set(bucket, cursor);
        if (cursor < items.length && chosen.length < 10) {
          const item = items[cursor];
          cursors.set(bucket, cursor + 1);
          chosenIds.add(item.fragmentId);
          chosen.push({
            fragmentId: item.fragmentId,
            corpus,
            bucket,
            errorCount: item.errorCount
          });
          advanced = true;
        }
      }
      if (!advanced) throw new Error(`dev20_insufficient_${corpus}:${chosen.length}`);
    }
    return chosen;
  });
  return {
    schemaVersion: '1.0.0-e5-v04-dev-20',
    dataset: 'DEV-20',
    algorithm: 'bucket_priority_cycle; descending_error_count_then_fragmentId; ten_per_corpus',
    sourceHashes,
    bucketPriority: DEV20_BUCKET_PRIORITY,
    fragmentIds: selections.map((item) => item.fragmentId),
    selections,
    counts: {
      F2: selections.filter((item) => item.corpus === 'F2').length,
      F3: selections.filter((item) => item.corpus === 'F3').length
    }
  };
}
