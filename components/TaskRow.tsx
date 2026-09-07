'use client';

import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/types';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

type Props = {
  task: Task;
  failed: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpenActions: () => void;
};

/**
 * One line on the page. A tap toggles it; a long press opens edit/delete.
 *
 * The row is a checkbox rather than a plain button so assistive tech reads its
 * state, and the "..." control beside it is clipped until focused -- it exists
 * so keyboard and screen-reader users reach the same actions the long press
 * gives a thumb, without printing a control on every line.
 */
export default function TaskRow({ task, failed, disabled, onToggle, onOpenActions }: Props) {
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Set when the long press fires, so the click that follows the release does
  // not also toggle the task.
  const consumed = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    setHeld(false);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    // Right-click and secondary buttons are not a long press.
    if (event.button !== 0) return;
    consumed.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    setHeld(true);
    timer.current = setTimeout(() => {
      consumed.current = true;
      setHeld(false);
      onOpenActions();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!origin.current) return;
    // A scroll starts as a press. Past a few pixels it is a scroll, not a hold.
    const moved =
      Math.abs(event.clientX - origin.current.x) > MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - origin.current.y) > MOVE_TOLERANCE_PX;
    if (moved) cancel();
  };

  const onClick = () => {
    if (consumed.current) {
      consumed.current = false;
      return;
    }
    onToggle();
  };

  const age = task.ageDays > 0 ? `${task.ageDays}d` : null;

  return (
    <div className="taskLine" style={{ position: 'relative' }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        disabled={disabled}
        className={[
          'taskRow',
          task.done ? 'isDone' : '',
          held ? 'isHeld' : '',
          failed ? 'didFail' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="taskBox" aria-hidden="true">
          {task.done ? '✕' : ''}
        </span>
        <span className="taskText">{task.text}</span>
        {age ? (
          <span className="taskAge" title={`Carried forward ${task.ageDays} days`}>
            {age}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="rowMore"
        disabled={disabled}
        onClick={onOpenActions}
        aria-label={`Edit or delete: ${task.text}`}
      >
        &#8943;
      </button>
    </div>
  );
}
