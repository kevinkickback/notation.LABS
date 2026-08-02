import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    CharacterInfoCard,
    type CharacterInfoCardRef,
} from '@/components/combo/CharacterInfoCard';
import type { CharacterLink } from '@/lib/types';
import { act, createRef } from 'react';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        characters: {
            update: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const mockLinks: CharacterLink[] = [
    { id: 'link-1', url: 'https://dustloop.com', label: 'Dustloop Wiki' },
    { id: 'link-2', url: 'https://example.com', label: 'Example' },
];

const defaultProps = {
    characterId: 'char-1',
    notes: '',
    links: [] as CharacterLink[],
    isOpen: true,
    onToggle: vi.fn(),
    onEditNote: vi.fn(),
};

describe('CharacterInfoCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when no notes, no links, and add form closed', () => {
        const { container } = render(<CharacterInfoCard {...defaultProps} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders when notes exist', () => {
        render(<CharacterInfoCard {...defaultProps} notes="Jump cancel setup" />);
        expect(screen.getByText('Character Info')).not.toBeNull();
    });

    it('renders when links exist', () => {
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        expect(screen.getByText('Character Info')).not.toBeNull();
    });

    it('shows notes content when notes exist and card is open', () => {
        render(<CharacterInfoCard {...defaultProps} notes="Jump cancel setup" />);
        expect(screen.getByText('Jump cancel setup')).not.toBeNull();
    });

    it('shows placeholder when notes are empty but card is visible', () => {
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        expect(screen.getByText(/no notes yet/i)).not.toBeNull();
    });

    it('hides content when isOpen is false', () => {
        render(
            <CharacterInfoCard {...defaultProps} notes="Hidden content" isOpen={false} />,
        );
        expect(screen.queryByText('Hidden content')).toBeNull();
        expect(screen.queryByText(/no notes yet/i)).toBeNull();
    });

    it('calls onToggle when the header button is clicked', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        render(
            <CharacterInfoCard {...defaultProps} notes="Some notes" onToggle={onToggle} />,
        );
        await user.click(screen.getByRole('button', { name: /character info/i }));
        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('calls onEditNote when Edit note button is clicked', async () => {
        const user = userEvent.setup();
        const onEditNote = vi.fn();
        render(
            <CharacterInfoCard {...defaultProps} notes="Some notes" onEditNote={onEditNote} />,
        );
        await user.click(screen.getByTitle('Edit note'));
        expect(onEditNote).toHaveBeenCalledOnce();
    });

    it('shows links when provided', () => {
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        expect(screen.getByText('Dustloop Wiki')).not.toBeNull();
        expect(screen.getByText('Example')).not.toBeNull();
    });

    it('shows add link form when Resources + button is clicked', async () => {
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" />);
        await user.click(screen.getByTitle('Add resource link'));
        expect(screen.getByPlaceholderText(/dustloop\.com/i)).not.toBeNull();
    });

    it('opens add link form via imperative ref', async () => {
        const ref = createRef<CharacterInfoCardRef>();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" ref={ref} />);
        act(() => ref.current?.openAddLinkForm());
        expect(screen.getByPlaceholderText(/dustloop\.com/i)).not.toBeNull();
    });

    it('saves a new link when Add is clicked with a valid URL', async () => {
        const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" />);
        await user.click(screen.getByTitle('Add resource link'));
        await user.type(
            screen.getByPlaceholderText(/dustloop\.com/i),
            'https://dustloop.com',
        );
        await user.click(screen.getByRole('button', { name: /^add$/i }));
        expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({
                links: expect.arrayContaining([
                    expect.objectContaining({ url: 'https://dustloop.com' }),
                ]),
            }),
        );
    });

    it('auto-prefixes https:// for URLs without a scheme', async () => {
        const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" />);
        await user.click(screen.getByTitle('Add resource link'));
        await user.type(
            screen.getByPlaceholderText(/dustloop\.com/i),
            'dustloop.com',
        );
        await user.click(screen.getByRole('button', { name: /^add$/i }));
        expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({
                links: expect.arrayContaining([
                    expect.objectContaining({ url: 'https://dustloop.com' }),
                ]),
            }),
        );
    });

    it('uses domain as label when label field is left empty', async () => {
        const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" />);
        await user.click(screen.getByTitle('Add resource link'));
        await user.type(
            screen.getByPlaceholderText(/dustloop\.com/i),
            'https://dustloop.com',
        );
        await user.click(screen.getByRole('button', { name: /^add$/i }));
        expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({
                links: expect.arrayContaining([
                    expect.objectContaining({ label: 'dustloop.com' }),
                ]),
            }),
        );
    });

    it('dismisses the add form on Cancel click', async () => {
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} notes="Some notes" />);
        await user.click(screen.getByTitle('Add resource link'));
        expect(screen.getByPlaceholderText(/dustloop\.com/i)).not.toBeNull();
        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByPlaceholderText(/dustloop\.com/i)).toBeNull();
    });

    it('shows inline edit form when Edit link button is clicked', async () => {
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        await user.click(screen.getAllByTitle('Edit link')[0]);
        expect(screen.getByDisplayValue('https://dustloop.com')).not.toBeNull();
        expect(screen.getByDisplayValue('Dustloop Wiki')).not.toBeNull();
    });

    it('saves edited link on Save click', async () => {
        const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        await user.click(screen.getAllByTitle('Edit link')[0]);
        const labelInput = screen.getByDisplayValue('Dustloop Wiki');
        await user.clear(labelInput);
        await user.type(labelInput, 'Dustloop');
        await user.click(screen.getByRole('button', { name: /^save$/i }));
        expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({
                links: expect.arrayContaining([
                    expect.objectContaining({ id: 'link-1', label: 'Dustloop' }),
                ]),
            }),
        );
    });

    it('dismisses the edit form on Cancel click', async () => {
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        await user.click(screen.getAllByTitle('Edit link')[0]);
        expect(screen.getByDisplayValue('Dustloop Wiki')).not.toBeNull();
        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByDisplayValue('Dustloop Wiki')).toBeNull();
        expect(screen.getByText('Dustloop Wiki')).not.toBeNull();
    });

    it('deletes a link when Remove link button is clicked', async () => {
        const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
        const user = userEvent.setup();
        render(<CharacterInfoCard {...defaultProps} links={mockLinks} />);
        await user.click(screen.getAllByTitle('Remove link')[0]);
        expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({
                links: [mockLinks[1]],
            }),
        );
    });
});
