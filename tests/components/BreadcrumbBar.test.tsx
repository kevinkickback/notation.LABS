import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { BreadcrumbBar } from '@/components/header/BreadcrumbBar';
import { useAppStore } from '@/lib/store';
import type { Game } from '@/lib/types';

const game: Game = { id: 'game', name: 'Visible game', notationProfile: 'standard', buttonLayout: ['A'], createdAt: 1, updatedAt: 1 };
beforeEach(() => { useAppStore.getState().resetSelection(); });
it('describes and navigates back from the displayed page while store selection is ahead', () => {
  useAppStore.setState({ selectedGameId: 'game', selectedCharacterId: 'pending-character' });
  render(<BreadcrumbBar selectedGame={game} />);
  expect(screen.getByText('Visible game').getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(useAppStore.getState().selectedGameId).toBeNull();
});
it('keeps root navigation absent until a game page is displayed', () => {
  useAppStore.getState().setSelectedGame('pending-game');
  render(<BreadcrumbBar />);
  expect(screen.queryByRole('navigation')).toBeNull();
});
