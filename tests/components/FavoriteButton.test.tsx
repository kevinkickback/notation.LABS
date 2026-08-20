import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/shared/FavoriteButton';

describe('FavoriteButton', () => {
  it('hides an inactive desktop action until its parent is hovered or focused', () => {
    render(
      <FavoriteButton
        entityName="Test Fighter"
        isFavorite={false}
        onToggle={vi.fn()}
        revealOnGroupHover
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Add to favorites: Test Fighter',
    });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover:opacity-100');
    expect(button.className).toContain('group-focus-within:opacity-100');
  });

  it('keeps an active favorite visible and togglable', () => {
    const onToggle = vi.fn();
    render(
      <FavoriteButton
        entityName="Test Fighter"
        isFavorite
        onToggle={onToggle}
        revealOnGroupHover
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Remove from favorites: Test Fighter',
    });
    expect(button.className).not.toContain('opacity-0');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('releases pointer focus after toggling a hover-disclosed favorite', () => {
    render(
      <FavoriteButton
        entityName="Pointer Fighter"
        isFavorite
        onToggle={vi.fn()}
        revealOnGroupHover
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Remove from favorites: Pointer Fighter',
    });
    button.focus();
    fireEvent.click(button, { detail: 1 });

    expect(document.activeElement).not.toBe(button);
  });

  it('preserves focus when a hover-disclosed favorite is toggled by keyboard', () => {
    render(
      <FavoriteButton
        entityName="Keyboard Fighter"
        isFavorite
        onToggle={vi.fn()}
        revealOnGroupHover
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Remove from favorites: Keyboard Fighter',
    });
    button.focus();
    fireEvent.click(button, { detail: 0 });

    expect(document.activeElement).toBe(button);
  });

  it('keeps the inactive action visible when hover-only disclosure is disabled', () => {
    render(
      <FavoriteButton
        entityName="Touch Fighter"
        isFavorite={false}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Add to favorites: Touch Fighter',
      }).className,
    ).not.toContain('opacity-0');
  });
});
