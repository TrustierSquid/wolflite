import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface MenuItem {
  label: string;
  /** Font Awesome icon class, e.g. "fa-bookmark" */
  icon: string;
  /** Font Awesome style: filled (default) or outlined */
  iconStyle?: "solid" | "regular";
  onSelect: () => void;
  /** Destructive actions (delete) are shown in red */
  danger?: boolean;
}

interface DropdownMenuProps {
  items: MenuItem[];
  /** Accessible name of the ⋮ button, e.g. "Post options" */
  label: string;
}

/*
  "⋮" button that opens a small menu of actions.
  Closes on: choosing an item, clicking outside, Escape, or tabbing away.
  Keyboard: arrow up/down move between items, Home/End jump to first/last.
*/
export default function DropdownMenu({ items, label }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Close when clicking anywhere outside the menu
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);

    const focusAt = (index: number) => {
      e.preventDefault();
      buttons[(index + buttons.length) % buttons.length]?.focus();
    };

    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") focusAt(current + 1);
    else if (e.key === "ArrowUp") focusAt(current - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(buttons.length - 1);
    else if (e.key === "Tab") close(false);
  }

  if (items.length === 0) return null;

  return (
    <div className="dropdown" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
      </button>

      {open && (
        <div id={menuId} className="dropdown-menu" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              className={`dropdown-item${item.danger ? " is-danger" : ""}`}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              <i className={`fa-${item.iconStyle ?? "solid"} ${item.icon}`} aria-hidden="true"></i>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
