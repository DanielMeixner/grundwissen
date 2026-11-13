import { SCORING_POLICY, type Snapshot } from '../domain/engine';

// A future account importer must ask for consent and deduplicate these IDs server-side.
// Browser XP is user-editable and must never be treated as trusted account scoring.
export function consentedProgressExport(snapshot: Snapshot, consent: boolean) {
  if (!consent) throw new Error('Explicit consent is required before exporting local progress');
  return {
    format: 'grundwissen-import-v1',
    trust: 'untrusted-browser-data',
    idempotencyKey: `${snapshot.profileId}:${snapshot.revision}`,
    profileId: snapshot.profileId,
    scoringPolicy: SCORING_POLICY,
    lifetimeXp: snapshot.lifetimeXp,
    latestProgress: snapshot.progress,
  } as const;
}
