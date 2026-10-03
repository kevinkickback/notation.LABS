import {
  ensureCurrentNotation,
  type ReparseLifecycle,
} from '@/lib/storage/notationMaintenance';
import { settingsRepository } from '@/lib/storage/settingsRepository';

export async function initializeApplication(
  lifecycle?: ReparseLifecycle,
): Promise<void> {
  await settingsRepository.init();
  await ensureCurrentNotation(lifecycle);
}
