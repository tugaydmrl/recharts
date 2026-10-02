import { ReactNode, useEffect, useState } from 'react';
import { darkTheme, lightTheme, RechartsThemeProvider } from 'recharts';

type ColorMode = 'light' | 'dark';

// StackBlitz currently sends these preview styles when its editor theme changes.
// This message is undocumented; ignore unknown colors and preserve the current mode.
export function getStackBlitzColorMode(event: Pick<MessageEvent<unknown>, 'origin' | 'data'>): ColorMode | undefined {
  const { data } = event;
  if (
    event.origin !== 'https://stackblitz.com' ||
    typeof data !== 'object' ||
    data === null ||
    !('type' in data) ||
    data.type !== 'STACKBLITZ_LOCALSERVICE_OPTIONS' ||
    !('style' in data)
  ) {
    return undefined;
  }

  const { style } = data;
  if (typeof style !== 'object' || style === null || !('background' in style)) {
    return undefined;
  }

  switch (style.background) {
    case 'hsl(0 0% 95%)':
      return 'light';
    case 'hsl(220 10% 14%)':
      return 'dark';
    default:
      return undefined;
  }
}

export function StackBlitzThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() =>
    document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>): void {
      const nextMode = getStackBlitzColorMode(event);
      if (nextMode !== undefined) {
        setMode(nextMode);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  return <RechartsThemeProvider value={mode === 'dark' ? darkTheme : lightTheme}>{children}</RechartsThemeProvider>;
}
