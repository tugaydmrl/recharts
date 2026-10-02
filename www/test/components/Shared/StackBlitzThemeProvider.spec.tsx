import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CartesianGrid,
  darkTheme,
  lightTheme,
  Line,
  LineChart,
  RechartsTheme,
  RechartsThemeProvider,
  XAxis,
} from 'recharts';
import {
  getStackBlitzColorMode,
  StackBlitzThemeProvider,
} from '../../../src/components/Shared/StackBlitzThemeProvider';

const stackBlitzOrigin = 'https://stackblitz.com';
const lightMessage = { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: 'hsl(0 0% 95%)' } };
const darkMessage = { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: 'hsl(220 10% 14%)' } };

describe('getStackBlitzColorMode', () => {
  it.each([
    { data: lightMessage, expected: 'light' },
    { data: darkMessage, expected: 'dark' },
  ])('recognizes the $expected preview background from StackBlitz', ({ data, expected }) => {
    expect(getStackBlitzColorMode({ origin: stackBlitzOrigin, data })).toBe(expected);
  });

  it.each(['', 'http://stackblitz.com', 'https://example.com', 'https://stackblitz.com.example.com'])(
    'ignores a recognized message from %j',
    origin => {
      expect(getStackBlitzColorMode({ origin, data: darkMessage })).toBeUndefined();
    },
  );

  it.each([
    undefined,
    null,
    false,
    14,
    'STACKBLITZ_LOCALSERVICE_OPTIONS',
    [],
    {},
    { type: 'unrelated', style: darkMessage.style },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS' },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: null },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: false },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: 'hsl(220 10% 14%)' },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: {} },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: null } },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: 14 } },
    { type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: '#000' } },
  ])('ignores malformed or unsupported data: %j', data => {
    expect(getStackBlitzColorMode({ origin: stackBlitzOrigin, data })).toBeUndefined();
  });
});

const chartData = [
  { name: 'A', value: 10 },
  { name: 'B', value: 20 },
  { name: 'C', value: 15 },
];

function ExampleChart() {
  return (
    <LineChart width={400} height={300} data={chartData}>
      <CartesianGrid />
      <XAxis dataKey="name" />
      <Line dataKey="value" isAnimationActive={false} />
    </LineChart>
  );
}

function expectChartTheme(container: HTMLElement, theme: RechartsTheme): void {
  expect(container.querySelector('.recharts-cartesian-axis-line')?.getAttribute('stroke')).toBe(theme.axis?.stroke);
  expect(container.querySelector('.recharts-cartesian-axis-tick-value')?.getAttribute('fill')).toBe(theme.axis?.stroke);
  expect(container.querySelector('.recharts-cartesian-grid line')?.getAttribute('stroke')).toBe(theme.grid?.stroke);
  expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke')).toBe(theme.graphicalItems[0]?.stroke);
}

function sendMessage(data: unknown, origin = stackBlitzOrigin): void {
  act(() => {
    window.dispatchEvent(new MessageEvent<unknown>('message', { data, origin }));
  });
}

describe('StackBlitzThemeProvider', () => {
  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.mode;
  });

  it.each([
    { mode: 'light', theme: lightTheme },
    { mode: 'dark', theme: darkTheme },
  ])('applies the exported $mode mode to the chart on first render', async ({ mode, theme }) => {
    document.documentElement.dataset.mode = mode;

    const { container } = render(
      <StackBlitzThemeProvider>
        <ExampleChart />
      </StackBlitzThemeProvider>,
    );

    await waitFor(() => expectChartTheme(container, theme));
    expect(document.documentElement.dataset.mode).toBe(mode);
  });

  it('keeps the page and chart in sync through light, dark, and light editor changes', async () => {
    document.documentElement.dataset.mode = 'light';
    const { container } = render(
      <StackBlitzThemeProvider>
        <ExampleChart />
      </StackBlitzThemeProvider>,
    );

    await waitFor(() => expectChartTheme(container, lightTheme));

    sendMessage(darkMessage);
    await waitFor(() => expectChartTheme(container, darkTheme));
    expect(document.documentElement.dataset.mode).toBe('dark');

    sendMessage(lightMessage);
    await waitFor(() => expectChartTheme(container, lightTheme));
    expect(document.documentElement.dataset.mode).toBe('light');
  });

  it('preserves the current page and chart theme for untrusted or unsupported messages', async () => {
    document.documentElement.dataset.mode = 'dark';
    const { container } = render(
      <StackBlitzThemeProvider>
        <ExampleChart />
      </StackBlitzThemeProvider>,
    );

    await waitFor(() => expectChartTheme(container, darkTheme));

    sendMessage(lightMessage, 'https://example.com');
    sendMessage({ type: 'STACKBLITZ_LOCALSERVICE_OPTIONS', style: { background: 'white' } });
    sendMessage(null);

    expect(document.documentElement.dataset.mode).toBe('dark');
    expectChartTheme(container, darkTheme);
  });

  it('preserves an example-specific theme when the editor changes theme', async () => {
    document.documentElement.dataset.mode = 'light';
    const { container } = render(
      <StackBlitzThemeProvider>
        <RechartsThemeProvider value={lightTheme}>
          <ExampleChart />
        </RechartsThemeProvider>
      </StackBlitzThemeProvider>,
    );

    await waitFor(() => expectChartTheme(container, lightTheme));

    sendMessage(darkMessage);

    expect(document.documentElement.dataset.mode).toBe('dark');
    expectChartTheme(container, lightTheme);
  });

  it('removes its message listener after unmounting', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    document.documentElement.dataset.mode = 'light';
    const { unmount } = render(<StackBlitzThemeProvider>Example</StackBlitzThemeProvider>);
    const subscription = addEventListener.mock.calls.find(([type]) => type === 'message');

    expect(subscription).toBeDefined();

    unmount();
    sendMessage(darkMessage);

    expect(removeEventListener).toHaveBeenCalledWith('message', subscription?.[1]);
    expect(document.documentElement.dataset.mode).toBe('light');
  });
});
