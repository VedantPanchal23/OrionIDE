import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuBar from './MenuBar';

describe('MenuBar', () => {
  it('runs a menu item action', () => {
    const run = vi.fn();
    render(
      <MenuBar
        menus={[
          {
            key: 'file',
            label: 'File',
            items: [{ id: 'save', label: 'Save', run }],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Save/i }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
