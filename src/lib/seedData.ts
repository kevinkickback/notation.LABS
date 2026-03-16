import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { parseComboNotation } from '@/lib/parser';

export async function initializeSeedData() {
	const games = await indexedDbStorage.games.getAll();

	if (games.length > 0) {
		return;
	}

	const sf6Id = await indexedDbStorage.games.add({
		name: 'Street Fighter 6',
		buttonLayout: ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'],
		buttonColors: {
			LP: 'oklch(0.70 0.18 210)',
			MP: 'oklch(0.75 0.19 145)',
			HP: 'oklch(0.68 0.22 25)',
			LK: 'oklch(0.70 0.18 210)',
			MK: 'oklch(0.75 0.19 145)',
			HK: 'oklch(0.68 0.22 25)',
		},
		notes: 'The latest entry in the Street Fighter series',
	});

	const ggstId = await indexedDbStorage.games.add({
		name: 'Guilty Gear Strive',
		buttonLayout: ['P', 'K', 'S', 'H', 'D'],
		buttonColors: {
			P: 'oklch(0.70 0.18 210)',
			K: 'oklch(0.70 0.18 210)',
			S: 'oklch(0.75 0.19 145)',
			H: 'oklch(0.68 0.22 25)',
			D: 'oklch(0.65 0.22 340)',
		},
		notes: 'Fast-paced anime fighter',
	});

	const dbfzId = await indexedDbStorage.games.add({
		name: 'Dragon Ball FighterZ',
		buttonLayout: ['L', 'M', 'H', 'S'],
		buttonColors: {
			L: 'oklch(0.70 0.18 210)',
			M: 'oklch(0.75 0.19 145)',
			H: 'oklch(0.68 0.22 25)',
			S: 'oklch(0.75 0.20 75)',
		},
		notes: 'Team-based anime fighter',
	});

	const ryuId = await indexedDbStorage.characters.add({
		gameId: sf6Id,
		name: 'Ryu',
		notes: 'The iconic world warrior',
	});

	const kenId = await indexedDbStorage.characters.add({
		gameId: sf6Id,
		name: 'Ken',
		notes: 'The hot-blooded rival',
	});

	const solId = await indexedDbStorage.characters.add({
		gameId: ggstId,
		name: 'Sol Badguy',
		notes: 'The Flame of Corruption',
	});

	const gokuId = await indexedDbStorage.characters.add({
		gameId: dbfzId,
		name: 'Goku (SS)',
		notes: 'The legendary Super Saiyan',
	});

	const sf6Buttons = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'];
	const ggstButtons = ['P', 'K', 'S', 'H', 'D'];
	const dbfzButtons = ['L', 'M', 'H', 'S'];

	await indexedDbStorage.combos.add({
		characterId: ryuId,
		name: 'Basic BnB',
		notation: '5LP > 5LP > 5MP > 236HP',
		parsedNotation: parseComboNotation('5LP > 5LP > 5MP > 236HP', sf6Buttons),
		description: 'Basic bread and butter combo that works from most situations',
		difficulty: 2,
		damage: '3200',
		meterCost: '0',
		tags: ['BnB', 'Meterless', 'Midscreen'],
	});

	await indexedDbStorage.combos.add({
		characterId: ryuId,
		name: 'Corner Punish',
		notation: '2MK > 5HP > 623HP > 236236K',
		parsedNotation: parseComboNotation(
			'2MK > 5HP > 623HP > 236236K',
			sf6Buttons,
		),
		description: 'High damage corner punish combo with super',
		difficulty: 4,
		damage: '5800',
		meterCost: '3 bars',
		tags: ['Corner', 'Punish', 'Super'],
	});

	await indexedDbStorage.combos.add({
		characterId: ryuId,
		name: 'Anti-Air Conversion',
		notation: '623MP > 5HP > 236MP',
		parsedNotation: parseComboNotation('623MP > 5HP > 236MP', sf6Buttons),
		description: 'Anti-air dragon punch conversion',
		difficulty: 3,
		damage: '4100',
		meterCost: '0',
		tags: ['Anti-Air', 'Meterless'],
	});

	await indexedDbStorage.combos.add({
		characterId: kenId,
		name: 'Optimal Midscreen',
		notation: '5MP > 5HP > 214MK > dash > 5LP > 623HP',
		parsedNotation: parseComboNotation(
			'5MP > 5HP > 214MK > dash > 5LP > 623HP',
			sf6Buttons,
		),
		description: 'Optimal midscreen combo with run cancel',
		difficulty: 4,
		damage: '4600',
		meterCost: '0',
		tags: ['Optimal', 'Midscreen', 'Advanced'],
	});

	await indexedDbStorage.combos.add({
		characterId: kenId,
		name: 'Jab String Pressure',
		notation: '(5LP) x5 > 5MP > 236HP',
		parsedNotation: parseComboNotation('(5LP) x5 > 5MP > 236HP', sf6Buttons),
		description:
			'Long jab string into special, great for pressure and confirms',
		difficulty: 2,
		damage: '2800',
		meterCost: '0',
		tags: ['BnB', 'Pressure', 'Meterless'],
	});

	await indexedDbStorage.combos.add({
		characterId: solId,
		name: 'Volcanic Viper Loop',
		notation: '5K > c.S > 2H > 236K > 623P > dash > 5K > 623H',
		parsedNotation: parseComboNotation(
			'5K > c.S > 2H > 236K > 623P > dash > 5K > 623H',
			ggstButtons,
		),
		description: 'Classic Sol combo with Volcanic Viper loops',
		difficulty: 5,
		damage: '240',
		meterCost: '0',
		tags: ['BnB', 'Advanced', 'Meterless'],
	});

	await indexedDbStorage.combos.add({
		characterId: solId,
		name: 'Simple Corner Combo',
		notation: 'c.S > 2H > 236236H',
		parsedNotation: parseComboNotation('c.S > 2H > 236236H', ggstButtons),
		description: 'Easy corner combo into Tyrant Rave',
		difficulty: 2,
		damage: '195',
		meterCost: '50 tension',
		tags: ['Corner', 'Super', 'Easy'],
	});

	await indexedDbStorage.combos.add({
		characterId: gokuId,
		name: 'Universal BnB',
		notation: '2M > 5M > j.M > j.M > j.2H > SD > j.M > j.L > j.2H > j.LLL',
		parsedNotation: parseComboNotation(
			'2M > 5M > j.M > j.M > j.2H > SD > j.M > j.L > j.2H > j.LLL',
			dbfzButtons,
		),
		description: 'Universal combo that works with any team',
		difficulty: 3,
		damage: '4800',
		meterCost: '0',
		tags: ['BnB', 'Universal', 'Meterless'],
	});

	await indexedDbStorage.combos.add({
		characterId: gokuId,
		name: 'Auto Combo Confirm',
		notation: '(5L) x3 > 2M > 5M > 236M',
		parsedNotation: parseComboNotation('(5L) x3 > 2M > 5M > 236M', dbfzButtons),
		description: 'Simple confirm from mash into special',
		difficulty: 1,
		damage: '3200',
		meterCost: '0',
		tags: ['BnB', 'Easy', 'Meterless'],
	});

	await indexedDbStorage.combos.add({
		characterId: gokuId,
		name: 'Corner TOD',
		notation:
			'2M > 5M > 2H > SD > j.M > j.L > j.2H > j.LLL > 236L+M > 214H+S > 236L+M',
		parsedNotation: parseComboNotation(
			'2M > 5M > 2H > SD > j.M > j.L > j.2H > j.LLL > 236L+M > 214H+S > 236L+M',
			dbfzButtons,
		),
		description: 'Touch of Death combo with assists and supers',
		difficulty: 5,
		damage: '10000',
		meterCost: '5 bars + 2 assists',
		tags: ['TOD', 'Corner', 'Team'],
	});
}
