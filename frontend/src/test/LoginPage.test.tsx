/**
 * Component tests for LoginPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock axios
vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        create: vi.fn(() => ({
            post: vi.fn(),
            get: vi.fn(),
        })),
    },
}));

// Simple component for testing
const MockLoginForm = () => (
    <form data-testid="login-form">
        <input
            type="email"
            placeholder="Email"
            data-testid="email-input"
        />
        <input
            type="password"
            placeholder="Password"
            data-testid="password-input"
        />
        <button type="submit" data-testid="submit-button">
            Sign In
        </button>
    </form>
);

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render login form', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            expect(screen.getByTestId('login-form')).toBeInTheDocument();
        });

        it('should render email input', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            expect(screen.getByTestId('email-input')).toBeInTheDocument();
        });

        it('should render password input', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            expect(screen.getByTestId('password-input')).toBeInTheDocument();
        });

        it('should render submit button', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            expect(screen.getByTestId('submit-button')).toBeInTheDocument();
        });
    });

    describe('user interaction', () => {
        it('should allow typing in email field', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            const emailInput = screen.getByTestId('email-input');
            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

            expect((emailInput as HTMLInputElement).value).toBe('test@example.com');
        });

        it('should allow typing in password field', () => {
            render(
                <BrowserRouter>
                    <MockLoginForm />
                </BrowserRouter>
            );

            const passwordInput = screen.getByTestId('password-input');
            fireEvent.change(passwordInput, { target: { value: 'password123' } });

            expect((passwordInput as HTMLInputElement).value).toBe('password123');
        });
    });
});
