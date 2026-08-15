import { createCharacter } from '@/lib/application/characterCommands';
import { createCombo } from '@/lib/application/comboCommands';
import { createGame } from '@/lib/application/gameCommands';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

export async function initializeSeedData() {
  const games = await indexedDbStorage.games.getAll();

  if (games.length > 0) {
    return;
  }

  const sf6Id = await createGame({
    name: 'Street Fighter 6',
    notationProfile: 'standard',
    buttonLayout: ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'],
    buttonColors: {
      LP: '#00b9db',
      MP: '#4fcc5b',
      HP: '#ff4c4d',
      LK: '#00b9db',
      MK: '#4fcc5b',
      HK: '#ff4c4d',
    },
    notes: 'The latest entry in the Street Fighter series',
  });

  const ggstId = await createGame({
    name: 'Guilty Gear Strive',
    notationProfile: 'standard',
    buttonLayout: ['P', 'K', 'S', 'H', 'D'],
    buttonColors: {
      P: '#00b9db',
      K: '#00b9db',
      S: '#4fcc5b',
      H: '#ff4c4d',
      D: '#e048b8',
    },
    notes: 'Fast-paced anime fighter',
  });

  const dbfzId = await createGame({
    name: 'Dragon Ball FighterZ',
    notationProfile: 'standard',
    buttonLayout: ['L', 'M', 'H', 'S'],
    buttonColors: {
      L: '#00b9db',
      M: '#4fcc5b',
      H: '#ff4c4d',
      S: '#f59600',
    },
    notes: 'Team-based anime fighter',
  });

  const ryuId = await createCharacter({
    gameId: sf6Id,
    name: 'Ryu',
    notes: 'The iconic world warrior',
  });

  const kenId = await createCharacter({
    gameId: sf6Id,
    name: 'Ken',
    notes: 'The hot-blooded rival',
  });

  const solId = await createCharacter({
    gameId: ggstId,
    name: 'Sol Badguy',
    notes: 'The Flame of Corruption',
  });

  const gokuId = await createCharacter({
    gameId: dbfzId,
    name: 'Goku (SS)',
    notes: 'The legendary Super Saiyan',
  });

  await createCombo({
    characterId: ryuId,
    name: 'Basic BnB',
    notation: '5LP > 5LP > 5MP > 236HP',
    description: 'Basic bread and butter combo that works from most situations',
    difficulty: 2,
    damage: '3200',
    meterCost: '0',
    tags: ['BnB', 'Meterless', 'Midscreen'],
  });

  await createCombo({
    characterId: ryuId,
    name: 'Corner Punish',
    notation: '2MK > 5HP > 623HP > 236236K',
    description: 'High damage corner punish combo with super',
    difficulty: 4,
    damage: '5800',
    meterCost: '3 bars',
    tags: ['Corner', 'Punish', 'Super'],
  });

  await createCombo({
    characterId: ryuId,
    name: 'Anti-Air Conversion',
    notation: '623MP > 5HP > 236MP',
    description: 'Anti-air dragon punch conversion',
    difficulty: 3,
    damage: '4100',
    meterCost: '0',
    tags: ['Anti-Air', 'Meterless'],
  });

  await createCombo({
    characterId: kenId,
    name: 'Optimal Midscreen',
    notation: '5MP > 5HP > 214MK > dash > 5LP > 623HP',
    description: 'Optimal midscreen combo with run cancel',
    difficulty: 4,
    damage: '4600',
    meterCost: '0',
    tags: ['Optimal', 'Midscreen', 'Advanced'],
  });

  await createCombo({
    characterId: kenId,
    name: 'Jab String Pressure',
    notation: '(5LP) x5 > 5MP > 236HP',
    description:
      'Long jab string into special, great for pressure and confirms',
    difficulty: 2,
    damage: '2800',
    meterCost: '0',
    tags: ['BnB', 'Pressure', 'Meterless'],
  });

  await createCombo({
    characterId: solId,
    name: 'Volcanic Viper Loop',
    notation: '5K > c.S > 2H > 236K > 623P > dash > 5K > 623H',
    description: 'Classic Sol combo with Volcanic Viper loops',
    difficulty: 5,
    damage: '240',
    meterCost: '0',
    tags: ['BnB', 'Advanced', 'Meterless'],
  });

  await createCombo({
    characterId: solId,
    name: 'Simple Corner Combo',
    notation: 'c.S > 2H > 236236H',
    description: 'Easy corner combo into Tyrant Rave',
    difficulty: 2,
    damage: '195',
    meterCost: '50 tension',
    tags: ['Corner', 'Super', 'Easy'],
  });

  await createCombo({
    characterId: gokuId,
    name: 'Universal BnB',
    notation: '2M > 5M > j.M > j.M > j.2H > SD > j.M > j.L > j.2H > j.LLL',
    description: 'Universal combo that works with any team',
    difficulty: 3,
    damage: '4800',
    meterCost: '0',
    tags: ['BnB', 'Universal', 'Meterless'],
  });

  await createCombo({
    characterId: gokuId,
    name: 'Auto Combo Confirm',
    notation: '(5L) x3 > 2M > 5M > 236M',
    description: 'Simple confirm from mash into special',
    difficulty: 1,
    damage: '3200',
    meterCost: '0',
    tags: ['BnB', 'Easy', 'Meterless'],
  });

  await createCombo({
    characterId: gokuId,
    name: 'Corner TOD',
    notation:
      '2M > 5M > 2H > SD > j.M > j.L > j.2H > j.LLL > 236L+M > 214H+S > 236L+M',
    description: 'Touch of Death combo with assists and supers',
    difficulty: 5,
    damage: '10000',
    meterCost: '5 bars + 2 assists',
    tags: ['TOD', 'Corner', 'Team'],
  });
}
