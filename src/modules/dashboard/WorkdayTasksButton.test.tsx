// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkdayTasksButton } from './WorkdayTasksButton';

afterEach(cleanup);
describe('workday tasks panel', () => {
  it('opens existing task content and closes using its close button', () => {
    render(
      <WorkdayTasksButton>
        <p>Задачи компании</p>
      </WorkdayTasksButton>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Задачи' }));
    expect(screen.getByRole('dialog', { name: 'Задачи и заметки' })).toBeTruthy();
    expect(screen.getByText('Задачи компании')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть задачи' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes on Escape', () => {
    render(
      <WorkdayTasksButton>
        <input aria-label="Комментарий" />
      </WorkdayTasksButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Задачи' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes when clicking outside the panel', () => {
    render(<WorkdayTasksButton><p>Список задач</p></WorkdayTasksButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Задачи' }));
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
