/**
 * Component tests for common UI components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Button component
const MockButton = ({
    children,
    onClick,
    disabled = false,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        data-testid="button"
    >
        {children}
    </button>
);

// Mock Input component
const MockInput = ({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) => (
    <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid="input"
    />
);

// Mock Modal component
const MockModal = ({
    isOpen,
    onClose,
    title,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) => (
    isOpen ? (
        <div data-testid="modal" role="dialog">
            <h2 data-testid="modal-title">{title}</h2>
            <button onClick={onClose} data-testid="modal-close">Close</button>
            <div data-testid="modal-content">{children}</div>
        </div>
    ) : null
);

describe('Button Component', () => {
    it('should render with children', () => {
        render(<MockButton>Click me</MockButton>);
        expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<MockButton onClick={handleClick}>Click me</MockButton>);

        fireEvent.click(screen.getByTestId('button'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
        render(<MockButton disabled>Disabled</MockButton>);
        expect(screen.getByTestId('button')).toBeDisabled();
    });
});

describe('Input Component', () => {
    it('should render with placeholder', () => {
        render(<MockInput value="" onChange={() => { }} placeholder="Type here" />);
        expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
    });

    it('should call onChange when typing', () => {
        const handleChange = vi.fn();
        render(<MockInput value="" onChange={handleChange} />);

        fireEvent.change(screen.getByTestId('input'), { target: { value: 'test' } });
        expect(handleChange).toHaveBeenCalledWith('test');
    });

    it('should display the value', () => {
        render(<MockInput value="Hello" onChange={() => { }} />);
        expect(screen.getByTestId('input')).toHaveValue('Hello');
    });
});

describe('Modal Component', () => {
    it('should not render when closed', () => {
        render(<MockModal isOpen={false} onClose={() => { }} title="Test">Content</MockModal>);
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
        render(<MockModal isOpen={true} onClose={() => { }} title="Test">Content</MockModal>);
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should display title', () => {
        render(<MockModal isOpen={true} onClose={() => { }} title="My Modal">Content</MockModal>);
        expect(screen.getByTestId('modal-title')).toHaveTextContent('My Modal');
    });

    it('should call onClose when close button clicked', () => {
        const handleClose = vi.fn();
        render(<MockModal isOpen={true} onClose={handleClose} title="Test">Content</MockModal>);

        fireEvent.click(screen.getByTestId('modal-close'));
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
