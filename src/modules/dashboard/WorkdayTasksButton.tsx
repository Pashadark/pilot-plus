'use client';
import { useState, type ReactNode } from 'react';
import { FiCheckSquare, FiX } from 'react-icons/fi';
import { Modal, IconButton } from '@/shared/ui';
export function WorkdayTasksButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <FiCheckSquare aria-hidden="true" />
        Задачи
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Задачи и заметки"
        className="workday-tasks-panel"
        backdropClassName="workday-tasks-backdrop"
      >
        <div className="absolute top-3 right-3">
          <IconButton label="Закрыть задачи" variant="ghost" onClick={() => setOpen(false)}>
            <FiX aria-hidden="true" />
          </IconButton>
        </div>
        <div className="grid gap-6">{children}</div>
      </Modal>
    </>
  );
}
