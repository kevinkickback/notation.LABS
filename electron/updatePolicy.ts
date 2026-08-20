import { gt, prerelease, valid } from 'semver';

export function isUpdateEligible(
  candidateVersion: string,
  currentVersion: string,
): boolean {
  const candidate = valid(candidateVersion);
  const current = valid(currentVersion);

  if (!candidate || !current) {
    return false;
  }

  if (prerelease(current) === null && prerelease(candidate) !== null) {
    return false;
  }

  return gt(candidate, current);
}
