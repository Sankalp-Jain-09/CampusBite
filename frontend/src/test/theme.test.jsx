import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Navbar from '../components/layout/Navbar';
import { renderWithProviders } from './renderWithProviders';

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('theme toggle', () => {
  it('restores and updates the saved theme preference', async () => {
    localStorage.setItem('campusbite_theme', 'dark');
    renderWithProviders(<Navbar />);

    const lightThemeButton = screen.getByRole('button', { name: 'Switch to light theme' });
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(lightThemeButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(lightThemeButton);

    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
    expect(localStorage.getItem('campusbite_theme')).toBe('light');
  });
});
