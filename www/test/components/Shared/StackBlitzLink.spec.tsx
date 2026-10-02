import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import stackblitzSdk from '@stackblitz/sdk';
import { StackBlitzLink } from '../../../src/components/Shared/StackBlitzLink';
import stackBlitzThemeProviderCode from '../../../src/components/Shared/StackBlitzThemeProvider.tsx?raw';
import { STORAGE_KEY } from '../../../src/components/color-mode/defineColorModeStore';

vi.mock('@stackblitz/sdk', () => ({ default: { openProject: vi.fn() } }));
vi.mock('../../../src/components/analytics', () => ({ sendEvent: vi.fn() }));

beforeEach(() => {
  vi.mocked(stackblitzSdk.openProject).mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(STORAGE_KEY);
});

describe('StackBlitzLink', () => {
  it.each([
    { storedMode: 'light', systemMode: 'dark', expectedMode: 'light' },
    { storedMode: 'dark', systemMode: 'light', expectedMode: 'dark' },
    { storedMode: undefined, systemMode: 'light', expectedMode: 'light' },
    { storedMode: undefined, systemMode: 'dark', expectedMode: 'dark' },
  ])('exports the selected mode with $storedMode stored and a $systemMode system', async props => {
    const { storedMode, systemMode, expectedMode } = props;
    if (storedMode !== undefined) {
      localStorage.setItem(STORAGE_KEY, storedMode);
    }
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: systemMode === 'dark',
      media: query,
    }));

    render(
      <StackBlitzLink title="Chart example" code="export default function Example() { return null; }">
        Open in StackBlitz
      </StackBlitzLink>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open in StackBlitz' }));

    expect(stackblitzSdk.openProject).toHaveBeenCalledTimes(1);
    const [project, options] = vi.mocked(stackblitzSdk.openProject).mock.calls[0];
    expect(options?.theme).toBe(expectedMode);
    expect(project.files['index.html']).toContain(`data-mode="${expectedMode}"`);
    expect(project.files['src/StackBlitzThemeProvider.tsx']).toBe(stackBlitzThemeProviderCode);
    expect(project.files['src/index.tsx']).toContain(
      "import { StackBlitzThemeProvider } from './StackBlitzThemeProvider'",
    );
    expect(project.files['src/index.tsx']).toContain('<StackBlitzThemeProvider>');
  });

  it('reads the selected mode when the button is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    render(
      <StackBlitzLink title="Chart example" code="export default function Example() { return null; }">
        Open in StackBlitz
      </StackBlitzLink>,
    );

    localStorage.setItem(STORAGE_KEY, 'dark');
    await userEvent.click(screen.getByRole('button', { name: 'Open in StackBlitz' }));

    const [project, options] = vi.mocked(stackblitzSdk.openProject).mock.calls[0];
    expect(options?.theme).toBe('dark');
    expect(project.files['index.html']).toContain('data-mode="dark"');
  });
});
