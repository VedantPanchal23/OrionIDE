/**
 * Orion IDE — Theme Context
 * 
 * React context for theme management (dark/light).
 * Will be implemented in a future task.
 */

import React, { createContext } from 'react';

export const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // TODO: Implement theme state management
  return (
    <ThemeContext.Provider value={{}}>
      {children}
    </ThemeContext.Provider>
  );
};
