import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NotationGuide } from '@/components/header/NotationGuide';

describe('NotationGuide', () => {
  it('documents cancel notation, input modes, and repeat spacing', async () => {
    const user = userEvent.setup();
    render(<NotationGuide open showTrigger={false} />);

    expect(screen.getByText('xx')).not.toBeNull();
    expect(
      screen.getByText('Cancel the previous move into a special move'),
    ).not.toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Motions' }));
    expect(
      screen.getByText(/numeric directions and motions apply to standard/i),
    ).not.toBeNull();
    expect(screen.getByText(/1–4 are attack buttons/i)).not.toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Modifiers' }));
    expect(
      screen.getByText('(sequence)xN or (sequence) xN'),
    ).not.toBeNull();
  });
});
