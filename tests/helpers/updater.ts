import type { UpdateDetails, UpdateState, UpdateStatus } from '../../src/lib/updater/ipcContract';

export function updateDetails(overrides: Partial<UpdateDetails> = {}): UpdateDetails {
  return { status: 'available', version: '2.0.0', changelog: 'Release notes', changelogLoading: false, isPortable: false, ...overrides };
}

export function updateSnapshot(state: UpdateState, revision = 1, availabilityEventId = 0): UpdateStatus {
  return { ...state, revision, availabilityEventId };
}
