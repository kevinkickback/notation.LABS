import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NotationGuide } from '@/components/header/NotationGuide';
import type { Game } from '@/lib/types';

const mockSettings = vi.hoisted(() => ({ motionIconStyle: 'joystick' }));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({
    notationColors: { direction: '#ffffff', separator: '#cccccc' },
    comboScale: 1,
    iconStyle: 'round',
    motionIconStyle: mockSettings.motionIconStyle,
  }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  mockSettings.motionIconStyle = 'joystick';
});

const tekkenGame: Game = {
  id: 'tekken-8',
  name: 'Tekken 8',
  notationProfile: 'tekken',
  buttonLayout: ['1', '2', '3', '4'],
  createdAt: 1,
  updatedAt: 1,
};

describe('NotationGuide', () => {
  it('defaults to the active game and documents Tekken semantics', () => {
    render(
      <NotationGuide
        open
        showTrigger={false}
        activeGame={tekkenGame}
      />,
    );

    expect(
      screen.getByRole('tab', { name: 'Tekken' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByRole('list', { name: 'Tekken direction notation' }),
    ).not.toBeNull();
    expect(screen.getByRole('listitem', { name: 'Back: b' })).not.toBeNull();
    expect(
      screen.getByRole('listitem', { name: 'Down-forward: d/f' }),
    ).not.toBeNull();
    expect(screen.getByRole('listitem', { name: 'Neutral: N' }).textContent).toContain(
      '★',
    );
    expect(
      screen.getByText('f / d/f / d / d/b / b / u/b / u / u/f'),
    ).not.toBeNull();
    expect(screen.getByText('df / db / uf / ub')).not.toBeNull();
    expect(screen.getByText('DF / DB / UF / UB')).not.toBeNull();
    expect(screen.getByText('Return to neutral; visible in icon mode')).not.toBeNull();

    expect(screen.getByText('Just-frame input')).not.toBeNull();
    expect(screen.getByText('Hold the preceding button')).not.toBeNull();
    expect(screen.queryByText('[X]')).toBeNull();
    expect(screen.queryByText(']X[')).toBeNull();
    expect(
      screen.getByText('Hold the preceding button to maximum level'),
    ).not.toBeNull();
    expect(
      screen.getByText(/Tekken 8-style move boundary/i),
    ).not.toBeNull();
    expect(screen.getByText('► / > / → / »')).not.toBeNull();
    expect(
      screen.getByText(/Tekken 7-style move boundary/i),
    ).not.toBeNull();
    expect(screen.getByText('WS / FC / BT / WR')).not.toBeNull();
    expect(screen.getByText('iWS / iWR')).not.toBeNull();
    expect(screen.getByText('F! / FBl! / BB! / S!')).not.toBeNull();
    expect(
      screen.getByText('WGF / TGF / EWGF / OTGF / ETGF'),
    ).not.toBeNull();
    expect(
      screen.getByText('FD/FT / FD/FA / FU/FT / FU/FA'),
    ).not.toBeNull();
    expect(screen.getByText('{1+2}')).not.toBeNull();
    expect(screen.getByText('CH')).not.toBeNull();

    expect(
      screen.getByText('WS,1,3 ► Negativa,3+4 ► f,3,4'),
    ).not.toBeNull();
    expect(screen.getByText(/Intermediate:.*held Forward/i)).not.toBeNull();
    expect(screen.getByText(/Advanced:.*held Forward/i)).not.toBeNull();
    const communityExamples = screen
      .getByText('Community Examples')
      .closest('[data-slot="card"]');
    expect(communityExamples?.querySelectorAll('dt')).toHaveLength(3);
    expect(
      (screen.getByRole('textbox', { name: 'Notation' }) as HTMLInputElement)
        .value,
    ).toBe('WS,1,3 ► Negativa,3+4 ► f,3,4');
  });

  it('switches profiles and includes NRS directions and examples', async () => {
    const user = userEvent.setup();
    render(<NotationGuide open showTrigger={false} />);

    await user.click(screen.getByRole('tab', { name: 'NRS' }));

    expect(
      screen.getByRole('list', { name: 'NRS direction notation' }),
    ).not.toBeNull();
    expect(screen.getByRole('listitem', { name: 'Back: b' })).not.toBeNull();
    expect(
      screen.getByRole('listitem', { name: 'Down-forward: d/f' }),
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Cardinal directions use letters; combine them with / for diagonals.',
      ),
    ).not.toBeNull();
    expect(screen.queryByText('Button Mappings')).toBeNull();
    expect(screen.queryByText('[X]')).toBeNull();
    expect(screen.queryByText(']X[')).toBeNull();
    expect(screen.getByText('DF1')).not.toBeNull();
    expect(screen.getByText('U/F / U/B / D/F / D/B')).not.toBeNull();
    expect(
      screen.getByText('Down, then Forward, then button 1—not a diagonal'),
    ).not.toBeNull();
    expect(screen.getByText('NRS Supported Syntax')).not.toBeNull();
    expect(screen.queryByText('[X]')).toBeNull();
    expect(screen.queryByText(']X[')).toBeNull();
    expect(screen.getByText('TH / BL / FL / S / K')).not.toBeNull();
    expect(screen.getByText('(hold) / (swap side)')).not.toBeNull();
    expect(screen.getByText('J / JF / JB / AIR / (AIR)')).not.toBeNull();
    expect(screen.getByText('Block / Grab / Throw')).not.toBeNull();
    expect(screen.getByText('CH')).not.toBeNull();

    expect(screen.getByText(/Simple:.*held Back/i)).not.toBeNull();
    expect(screen.getByText(/Intermediate:.*held attack/i)).not.toBeNull();
    expect(screen.getByText(/Advanced:.*held Kameo/i)).not.toBeNull();
    const communityExamples = screen
      .getByText('Community Examples')
      .closest('[data-slot="card"]');
    expect(communityExamples?.querySelectorAll('dt')).toHaveLength(3);
  });

  it('uses self-contained scrolling sections and places motion settings last', () => {
    render(<NotationGuide open showTrigger={false} />);

    expect(screen.queryByText('Shared Basics')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Notation style' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Standard / Numpad' })).not.toBeNull();
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(
      screen.getByRole('listitem', { name: 'Back: 4' }),
    ).not.toBeNull();
    expect(screen.queryByText('Button Mappings')).toBeNull();
    const directionsCard = screen
      .getByRole('list', { name: 'Standard direction notation' })
      .closest('[data-slot="card"]');
    expect(directionsCard).not.toBeNull();
    expect(directionsCard?.textContent).toContain('Directional Reference');
    expect(directionsCard?.textContent).toContain('Parsing Rules');
    expect(screen.getByText('421 / rdp')).not.toBeNull();
    expect(screen.getByText('236236 / 2qcf')).not.toBeNull();
    expect(screen.getByText('214214 / 2qcb')).not.toBeNull();
    expect(screen.getByText('360 / spd')).not.toBeNull();
    expect(screen.getByText('720 / 1080')).not.toBeNull();

    expect(screen.getByText('Standard Supported Syntax')).not.toBeNull();
    expect(screen.getByText('[X]')).not.toBeNull();
    expect(screen.getByText(']X[')).not.toBeNull();
    expect(screen.getByText('Release input X')).not.toBeNull();
    expect(screen.getByText('XxN / (sequence)xN')).not.toBeNull();
    expect(screen.getByText('(N)')).not.toBeNull();
    expect(screen.getByText('j. / sj. / dj. / nj.')).not.toBeNull();
    expect(screen.getByText('cr. / st. / cl. / f.')).not.toBeNull();

    const communityExamples = screen
      .getByText('Community Examples')
      .closest('[data-slot="card"]');
    expect(communityExamples?.querySelectorAll('dt')).toHaveLength(3);
    const livePreview = screen.getByText('Live Preview');
    const arrowCallout = screen.getByText('Want arrow inputs?');
    expect(
      livePreview.compareDocumentPosition(arrowCallout) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText(/Settings → Notation → Motion Style/i)).not.toBeNull();
    expect(screen.queryByText('Joystick')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Tap Forward example' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Hold Forward example' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Quarter Circle example, step 1' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Dragon Punch example, step 1' }),
    ).not.toBeNull();
    expect(screen.queryByRole('img', { name: /Neutral example/i })).toBeNull();
    expect(
      screen.queryByRole('img', { name: /Down Forward example/i }),
    ).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Notation' })).not.toBeNull();
    expect(screen.getByText('Text')).not.toBeNull();
    expect(screen.getByText('Icons')).not.toBeNull();
  });

  it('offers joystick inputs when arrow inputs are already enabled', () => {
    mockSettings.motionIconStyle = 'arrows';
    render(<NotationGuide open showTrigger={false} />);

    expect(screen.getByText('Want joystick inputs?')).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Tap Forward example' }),
    ).not.toBeNull();
    expect(screen.queryByText('Want arrow inputs?')).toBeNull();
    expect(
      screen.getByText(/Motion Style and choose Joystick/i),
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Quarter Circle example' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'Dragon Punch example' }),
    ).not.toBeNull();
    expect(
      screen
        .getByRole('img', { name: 'Hold Forward example' })
        .getAttribute('class'),
    ).toContain('motion-icon--hold');
    expect(screen.queryByRole('img', { name: 'Tap example' })).toBeNull();
  });

  it('keeps common syntax enclosed and deduplicated within every profile', async () => {
    const user = userEvent.setup();
    render(<NotationGuide open showTrigger={false} />);

    for (const [profile, title] of [
      ['Standard / Numpad', 'Standard Supported Syntax'],
      ['NRS', 'NRS Supported Syntax'],
      ['Tekken', 'Tekken Supported Syntax'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: profile }));

      const syntaxCard = screen
        .getByText(title)
        .closest('[data-slot="card"]');
      expect(syntaxCard).not.toBeNull();
      const terms = Array.from(syntaxCard?.querySelectorAll('dt') ?? []).map(
        (term) => term.textContent,
      );

      expect(new Set(terms).size).toBe(terms.length);
      expect(syntaxCard?.textContent).toContain('CH');
      expect(syntaxCard?.textContent).toContain('XxN / (sequence)xN');
      expect(syntaxCard?.textContent).toContain('> / → / »');
    }
  });
});
