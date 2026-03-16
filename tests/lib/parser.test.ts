import { describe, it, expect } from 'vitest';
import { parseComboNotation, getTokenColor, getMotionName } from '@/lib/parser';

describe('parseComboNotation', () => {
	describe('directions', () => {
		it('parses single numpad directions', () => {
			const tokens = parseComboNotation('2');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'direction', value: '2' });
		});

		it('parses all numpad directions 1-9', () => {
			for (const dir of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
				const tokens = parseComboNotation(dir);
				expect(tokens).toHaveLength(1);
				expect(tokens[0].type).toBe('direction');
				expect(tokens[0].value).toBe(dir);
			}
		});
	});

	describe('motions', () => {
		it('parses quarter circle forward (236)', () => {
			const tokens = parseComboNotation('236');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236' });
		});

		it('parses quarter circle back (214)', () => {
			const tokens = parseComboNotation('214');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '214' });
		});

		it('parses dragon punch (623)', () => {
			const tokens = parseComboNotation('623');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '623' });
		});

		it('parses half circle forward (41236)', () => {
			const tokens = parseComboNotation('41236');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '41236' });
		});

		it('parses half circle back (63214)', () => {
			const tokens = parseComboNotation('63214');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '63214' });
		});

		it('parses double quarter circle forward (236236)', () => {
			const tokens = parseComboNotation('236236');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236236' });
		});

		it('parses full circle (360)', () => {
			const tokens = parseComboNotation('360');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '360' });
		});

		it('parses down down (22)', () => {
			const tokens = parseComboNotation('22');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '22' });
		});

		it('parses forward dash (66)', () => {
			const tokens = parseComboNotation('66');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '66' });
		});

		it('parses back dash (44)', () => {
			const tokens = parseComboNotation('44');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '44' });
		});

		it('parses reverse dragon punch (421)', () => {
			const tokens = parseComboNotation('421');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '421' });
		});

		it('parses double circle (720)', () => {
			const tokens = parseComboNotation('720');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '720' });
		});

		it('parses triple circle (1080)', () => {
			const tokens = parseComboNotation('1080');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '1080' });
		});

		it('parses double quarter circle back (214214)', () => {
			const tokens = parseComboNotation('214214');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '214214' });
		});

		it('parses tiger knee as modifier (special modifier takes priority)', () => {
			const tokens = parseComboNotation('tiger knee');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'tk.' });
		});

		it('parses up-up (88)', () => {
			const tokens = parseComboNotation('88');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '88' });
		});
	});

	describe('motion aliases', () => {
		it('parses "qcf" as 236', () => {
			const tokens = parseComboNotation('qcf');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236' });
		});

		it('parses "qcb" as 214', () => {
			const tokens = parseComboNotation('qcb');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '214' });
		});

		it('parses "dp" as 623', () => {
			const tokens = parseComboNotation('dp');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '623' });
		});

		it('preserves rawValue for motion aliases', () => {
			const tokens = parseComboNotation('dp');
			expect(tokens[0]).toMatchObject({
				type: 'motion',
				value: '623',
				rawValue: 'dp',
			});
			const qcfTokens = parseComboNotation('qcf');
			expect(qcfTokens[0]).toMatchObject({
				type: 'motion',
				value: '236',
				rawValue: 'qcf',
			});
		});

		it('parses "srk" as 623', () => {
			const tokens = parseComboNotation('srk');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '623' });
		});

		it('parses "hcf" as 41236', () => {
			const tokens = parseComboNotation('hcf');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '41236' });
		});

		it('parses "hcb" as 63214', () => {
			const tokens = parseComboNotation('hcb');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '63214' });
		});

		it('parses "spd" as 360', () => {
			const tokens = parseComboNotation('spd');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '360' });
		});

		it('is case-insensitive for aliases', () => {
			const tokens = parseComboNotation('QCF');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236' });
		});

		it('parses dot-suffixed motion aliases (dp.HP)', () => {
			const tokens = parseComboNotation('dp.HP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({
				type: 'motion',
				value: '623',
				rawValue: 'dp.',
			});
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'HP' });
		});

		it('parses dot-suffixed qcf. alias', () => {
			const tokens = parseComboNotation('qcf.MP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({
				type: 'motion',
				value: '236',
				rawValue: 'qcf.',
			});
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'MP' });
		});

		it('parses uu as 88 (double up)', () => {
			const tokens = parseComboNotation('uu');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '88' });
		});

		it('parses 88 as double up motion', () => {
			const tokens = parseComboNotation('88');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '88' });
		});

		it('parses "rdp" as 421 (reverse dragon punch)', () => {
			const tokens = parseComboNotation('rdp');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '421' });
		});

		it('parses "2qcf" as 236236', () => {
			const tokens = parseComboNotation('2qcf');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236236' });
		});

		it('parses "2qcb" as 214214', () => {
			const tokens = parseComboNotation('2qcb');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '214214' });
		});

		it('parses "dd" as 22', () => {
			const tokens = parseComboNotation('dd');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '22' });
		});

		it('parses "ff" as 66', () => {
			const tokens = parseComboNotation('ff');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '66' });
		});

		it('parses "bb" as 44', () => {
			const tokens = parseComboNotation('bb');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '44' });
		});

		it('parses "tk" as 2369 (tiger knee)', () => {
			const tokens = parseComboNotation('tk');
			expect(tokens).toHaveLength(1);
		});

		it('parses "double circle" as 720', () => {
			const tokens = parseComboNotation('double circle');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '720' });
		});

		it('parses "full circle" as 360', () => {
			const tokens = parseComboNotation('full circle');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '360' });
		});
	});

	describe('buttons', () => {
		it('parses common buttons', () => {
			for (const btn of ['L', 'M', 'H', 'S', 'P', 'K']) {
				const tokens = parseComboNotation(btn);
				expect(tokens).toHaveLength(1);
				expect(tokens[0]).toMatchObject({
					type: 'button',
					value: btn.toUpperCase(),
				});
			}
		});

		it('parses two-character buttons', () => {
			for (const btn of ['LP', 'MP', 'HP', 'LK', 'MK', 'HK']) {
				const tokens = parseComboNotation(btn);
				expect(tokens).toHaveLength(1);
				expect(tokens[0]).toMatchObject({ type: 'button', value: btn });
			}
		});

		it('is case-insensitive for buttons', () => {
			const tokens = parseComboNotation('lp');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'button', value: 'LP' });
		});

		it('supports custom buttons', () => {
			const tokens = parseComboNotation('EX', ['EX']);
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'button', value: 'EX' });
		});

		it('supports multiple custom buttons simultaneously', () => {
			const tokens = parseComboNotation('EX > SUPER', ['EX', 'SUPER']);
			expect(tokens).toHaveLength(3);
			expect(tokens[0]).toMatchObject({ type: 'button', value: 'EX' });
			expect(tokens[2]).toMatchObject({ type: 'button', value: 'SUPER' });
		});

		it('parses additional common buttons (A, B, C, D, X, Y)', () => {
			for (const btn of ['A', 'B', 'C', 'D', 'X', 'Y']) {
				const tokens = parseComboNotation(btn);
				expect(tokens).toHaveLength(1);
				expect(tokens[0]).toMatchObject({ type: 'button', value: btn });
			}
		});
	});

	describe('separators', () => {
		it('parses > separator', () => {
			const tokens = parseComboNotation('L > M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '>' });
		});

		it('parses + separator', () => {
			const tokens = parseComboNotation('L+M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '+' });
		});

		it('parses ~ separator (link)', () => {
			const tokens = parseComboNotation('L~M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '~' });
		});

		it('parses , separator', () => {
			const tokens = parseComboNotation('L,M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: ',' });
		});

		it('parses |> (land) separator', () => {
			const tokens = parseComboNotation('L |> M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '|>' });
		});

		it('parses → separator', () => {
			const tokens = parseComboNotation('L → M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '→' });
		});

		it('parses » separator', () => {
			const tokens = parseComboNotation('L » M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '»' });
		});

		it('parses link separator', () => {
			const tokens = parseComboNotation('L link M');
			expect(tokens).toHaveLength(3);
			expect(tokens[1]).toMatchObject({ type: 'separator', value: 'link' });
		});

		it('parses / separator (alternative)', () => {
			const tokens = parseComboNotation('214HK / 236LP');
			expect(tokens).toHaveLength(5);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '214' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'HK' });
			expect(tokens[2]).toMatchObject({ type: 'separator', value: '/' });
			expect(tokens[3]).toMatchObject({ type: 'motion', value: '236' });
			expect(tokens[4]).toMatchObject({ type: 'button', value: 'LP' });
		});
	});

	describe('modifiers', () => {
		it('parses stance modifiers', () => {
			const tokens = parseComboNotation('cr.M');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'cr.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'M' });
		});

		it('parses jumping modifier', () => {
			const tokens = parseComboNotation('j.H');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'j.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses standing modifier', () => {
			const tokens = parseComboNotation('st.L');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'st.' });
		});

		it('parses counter hit modifier', () => {
			const tokens = parseComboNotation('CH');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'CH' });
		});

		it('parses back stance modifier (b.MP)', () => {
			const tokens = parseComboNotation('b.MP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'b.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'MP' });
		});

		it('parses direction modifiers (db., df., ub., uf.)', () => {
			const cases = [
				['db.', 'db.'],
				['df.', 'df.'],
				['ub.', 'ub.'],
				['uf.', 'uf.'],
				['u.', 'u.'],
			] as const;
			for (const [input, expected] of cases) {
				const tokens = parseComboNotation(`${input}HP`);
				expect(tokens).toHaveLength(2);
				expect(tokens[0]).toMatchObject({ type: 'modifier', value: expected });
				expect(tokens[1]).toMatchObject({ type: 'button', value: 'HP' });
			}
		});

		it('does not let back modifier eat back dash', () => {
			const tokens = parseComboNotation('back dash');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '44' });
		});

		it('parses special modifiers like xx (cancel)', () => {
			const tokens = parseComboNotation('L xx 236H');
			expect(tokens).toHaveLength(4);
			expect(tokens[0]).toMatchObject({ type: 'button', value: 'L' });
			expect(tokens[1]).toMatchObject({ type: 'separator', value: 'xx' });
			expect(tokens[2]).toMatchObject({ type: 'motion', value: '236' });
			expect(tokens[3]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses super jump modifier (sj.)', () => {
			const tokens = parseComboNotation('sj.H');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'sj.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses double jump modifier (dj.)', () => {
			const tokens = parseComboNotation('dj.H');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'dj.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses neutral jump modifier (nj.)', () => {
			const tokens = parseComboNotation('nj.H');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'nj.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses close modifier (cl.)', () => {
			const tokens = parseComboNotation('cl.HP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'cl.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'HP' });
		});

		it('parses delay modifier (dl.)', () => {
			const tokens = parseComboNotation('dl.HP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'dl.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'HP' });
		});

		it('parses jump cancel modifier (jc.)', () => {
			const tokens = parseComboNotation('jc.H');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'jc.' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'H' });
		});

		it('parses charge modifier', () => {
			const tokens = parseComboNotation('charge');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: '[charge]' });
		});

		it('parses whiff modifier', () => {
			const tokens = parseComboNotation('whiff');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: '(whiff)' });
		});

		it('parses hold and release modifiers', () => {
			const holdTokens = parseComboNotation('hold');
			expect(holdTokens).toHaveLength(1);
			expect(holdTokens[0]).toMatchObject({
				type: 'modifier',
				value: '[hold]',
			});

			const releaseTokens = parseComboNotation('release');
			expect(releaseTokens).toHaveLength(1);
			expect(releaseTokens[0]).toMatchObject({
				type: 'modifier',
				value: '[release]',
			});
		});

		it('parses iad (instant air dash) modifier', () => {
			const tokens = parseComboNotation('iad');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'modifier', value: 'iad' });
		});
	});

	describe('repeat notation', () => {
		it('parses (L M)x3 repeat notation', () => {
			const tokens = parseComboNotation('(L M)x3');
			expect(tokens[0]).toMatchObject({ type: 'repeat-start', value: '(' });
			const endToken = tokens.find((t) => t.type === 'repeat-end');
			expect(endToken).toBeDefined();
			expect(endToken?.repeatCount).toBe(3);
		});

		it('handles repeat with * notation', () => {
			const tokens = parseComboNotation('(L M)*2');
			const endToken = tokens.find((t) => t.type === 'repeat-end');
			expect(endToken).toBeDefined();
			expect(endToken?.repeatCount).toBe(2);
		});
	});

	describe('parenthesized annotations', () => {
		it('treats (wallsplat) as a single modifier token', () => {
			const tokens = parseComboNotation('(wallsplat)');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({
				type: 'modifier',
				value: '(wallsplat)',
			});
		});

		it('parses DI (wallsplat), 2HP correctly with custom buttons', () => {
			const buttons = ['DI', 'DR'];
			const tokens = parseComboNotation('DI (wallsplat), 2HP', buttons);
			expect(tokens[0]).toMatchObject({ type: 'button', value: 'DI' });
			expect(tokens[1]).toMatchObject({
				type: 'modifier',
				value: '(wallsplat)',
			});
			expect(tokens[2]).toMatchObject({ type: 'separator', value: ',' });
		});

		it('still parses (L > M)x3 as repeat group', () => {
			const tokens = parseComboNotation('(L > M)x3');
			expect(tokens[0]).toMatchObject({ type: 'repeat-start', value: '(' });
			const endToken = tokens.find((t) => t.type === 'repeat-end');
			expect(endToken?.repeatCount).toBe(3);
		});

		it('treats (whiff) in parens as a single modifier', () => {
			const tokens = parseComboNotation('(whiff)');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({
				type: 'modifier',
				value: '(whiff)',
			});
		});
	});

	describe('complex combos', () => {
		it('parses a full fighting game combo', () => {
			const tokens = parseComboNotation('2L > 2M > 236L > L > M > H > 236236H');
			const types = tokens.map((t) => t.type);
			expect(types).toContain('direction');
			expect(types).toContain('button');
			expect(types).toContain('separator');
			expect(types).toContain('motion');
		});

		it('parses motion + button combo', () => {
			const tokens = parseComboNotation('236+HP');
			expect(tokens).toHaveLength(3);
			expect(tokens[0]).toMatchObject({ type: 'motion', value: '236' });
			expect(tokens[1]).toMatchObject({ type: 'separator', value: '+' });
			expect(tokens[2]).toMatchObject({ type: 'button', value: 'HP' });
		});

		it('returns empty array for empty string', () => {
			const tokens = parseComboNotation('');
			expect(tokens).toEqual([]);
		});

		it('returns empty array for whitespace only', () => {
			const tokens = parseComboNotation('   ');
			expect(tokens).toEqual([]);
		});

		it('marks unrecognized characters as unknown', () => {
			const tokens = parseComboNotation('$');
			expect(tokens).toHaveLength(1);
			expect(tokens[0]).toMatchObject({ type: 'unknown', value: '$' });
		});

		it('preserves raw values', () => {
			const tokens = parseComboNotation('qcf');
			expect(tokens[0].rawValue).toBe('qcf');
			expect(tokens[0].value).toBe('236');
		});

		it('parses a Guilty Gear style corner combo', () => {
			const tokens = parseComboNotation(
				'c.S > 2H > 236K > 5K > j.S > j.H > 236236H',
			);
			const types = tokens.map((t) => t.type);
			expect(types).toContain('modifier');
			expect(types).toContain('button');
			expect(types).toContain('separator');
			expect(types).toContain('direction');
			expect(types).toContain('motion');
		});

		it('parses numpad direction followed by button (5LP)', () => {
			const tokens = parseComboNotation('5LP');
			expect(tokens).toHaveLength(2);
			expect(tokens[0]).toMatchObject({ type: 'direction', value: '5' });
			expect(tokens[1]).toMatchObject({ type: 'button', value: 'LP' });
		});

		it('parses dash cancel notation', () => {
			const tokens = parseComboNotation('H > dash > L');
			const types = tokens.map((t) => t.type);
			expect(types).toContain('button');
			expect(types).toContain('separator');
		});

		it('handles many tokens in a long combo', () => {
			const tokens = parseComboNotation(
				'cr.LP > cr.LP > cr.MP > cr.MK xx 236LP > 236236HP',
			);
			expect(tokens.length).toBeGreaterThan(10);
		});
	});
});

describe('getTokenColor', () => {
	const colors = {
		direction: '#ff0000',
		separator: '#00ff00',
	};

	it('returns direction color for direction tokens', () => {
		const token = { type: 'direction' as const, value: '2', rawValue: '2' };
		expect(getTokenColor(token, colors)).toBe('#ff0000');
	});

	it('returns direction color for motion tokens', () => {
		const token = { type: 'motion' as const, value: '236', rawValue: '236' };
		expect(getTokenColor(token, colors)).toBe('#ff0000');
	});

	it('returns separator color for separator tokens', () => {
		const token = { type: 'separator' as const, value: '>', rawValue: '>' };
		expect(getTokenColor(token, colors)).toBe('#00ff00');
	});

	it('uses button-specific colors when provided', () => {
		const buttonColors = { LP: '#0000ff' };
		const token = { type: 'button' as const, value: 'LP', rawValue: 'LP' };
		expect(getTokenColor(token, colors, buttonColors)).toBe('#0000ff');
	});

	it('falls back to direction color for buttons without specific colors', () => {
		const token = { type: 'button' as const, value: 'LP', rawValue: 'LP' };
		expect(getTokenColor(token, colors)).toBe('#ff0000');
	});

	it('returns direction color for modifier tokens', () => {
		const token = { type: 'modifier' as const, value: 'cr.', rawValue: 'cr.' };
		expect(getTokenColor(token, colors)).toBe('#ff0000');
	});

	it('returns separator color for CH modifier', () => {
		const token = { type: 'modifier' as const, value: 'CH', rawValue: 'CH' };
		expect(getTokenColor(token, colors)).toBe('#00ff00');
	});

	it('uses fallback colors when none specified', () => {
		const token = { type: 'direction' as const, value: '2', rawValue: '2' };
		expect(getTokenColor(token, {})).toBe('oklch(0.85 0.05 265)');
	});
});

describe('getMotionName', () => {
	it('returns "Quarter Circle Forward" for 236', () => {
		expect(getMotionName('236')).toBe('Quarter Circle Forward');
	});

	it('returns "Quarter Circle Back" for 214', () => {
		expect(getMotionName('214')).toBe('Quarter Circle Back');
	});

	it('returns "Dragon Punch" for 623', () => {
		expect(getMotionName('623')).toBe('Dragon Punch');
	});

	it('returns "Half Circle Forward" for 41236', () => {
		expect(getMotionName('41236')).toBe('Half Circle Forward');
	});

	it('returns "Full Circle" for 360', () => {
		expect(getMotionName('360')).toBe('Full Circle');
	});

	it('returns "Double Circle" for 720', () => {
		expect(getMotionName('720')).toBe('Double Circle');
	});

	it('returns "Down Down" for 22', () => {
		expect(getMotionName('22')).toBe('Down Down');
	});

	it('returns "Forward Forward" for 66', () => {
		expect(getMotionName('66')).toBe('Forward Forward');
	});

	it('returns "Back Back" for 44', () => {
		expect(getMotionName('44')).toBe('Back Back');
	});

	it('returns "Up Up" for 88', () => {
		expect(getMotionName('88')).toBe('Up Up');
	});

	it('returns "Half Circle Back" for 63214', () => {
		expect(getMotionName('63214')).toBe('Half Circle Back');
	});

	it('returns the raw motion for unknown motions', () => {
		expect(getMotionName('999')).toBe('999');
	});
});
