import type { ComboEditableInput } from '@/lib/application/comboCommands';
import { uniqueTags } from '@/lib/tags';
import type { Combo } from '@/lib/types';

export interface ComboDraft {
  name: string;
  notation: string;
  description: string;
  difficulty: string;
  damage: string;
  meterCost: string;
  tags: string[];
  demoUrl: string;
  demoFileName: string;
  demoVideoTitle: string;
  outdated: boolean;
}

export function createComboDraft(combo?: Combo | null): ComboDraft {
  return {
    name: combo?.name ?? '',
    notation: combo?.notation ?? '',
    description: combo?.description ?? '',
    difficulty: combo?.difficulty?.toString() ?? '',
    damage: combo?.damage ?? '',
    meterCost: combo?.meterCost ?? '',
    tags: uniqueTags(combo?.tags ?? []),
    demoUrl: combo?.demoUrl ?? '',
    demoFileName: combo?.demoFileName ?? '',
    demoVideoTitle: combo?.demoVideoTitle ?? '',
    outdated: combo?.outdated ?? false,
  };
}

export function buildComboPayload(draft: ComboDraft): ComboEditableInput {
  return {
    name: draft.name.trim(),
    notation: draft.notation.trim(),
    description: draft.description.trim(),
    difficulty: draft.difficulty
      ? Number.parseInt(draft.difficulty, 10)
      : undefined,
    damage: draft.damage.trim(),
    meterCost: draft.meterCost.trim(),
    tags: uniqueTags(draft.tags),
    demoUrl: draft.demoUrl.trim() || undefined,
    demoFileName: draft.demoFileName || undefined,
    demoVideoTitle: draft.demoVideoTitle || undefined,
    outdated: draft.outdated || undefined,
  };
}
