"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return (
    <NextThemesProvider {...props} attribute="data-theme" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
};
