import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent } from "react";

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
  /** "small" for tight spots like comments */
  size?: "default" | "small";
}

const GAP = 4; // space between the button and the menu
const EDGE = 8; // minimum space between the menu and the edge of the screen

/*
  "⋮" button that opens a small menu of actions.

  The menu is rendered at the end of <body> (a React portal) with position: fixed
  and a high z-index, so it always shows on top: it can't be clipped by a
  scrolling area (like a comment list) or covered by the next post. It lines up
  with its button, opens upward when there's no room below, and follows the
  button when the page scrolls or resizes.

  Closes on: choosing an item, clicking outside, Escape, or Tab.
  Keyboard: arrow up/down move between items, Home/End jump to first/last.
*/
export default function DropdownMenu({ items, label, size = "default" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Place the menu next to its button, inside the screen
  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;

    const rect = button.getBoundingClientRect();
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < height + GAP + EDGE && spaceAbove > spaceBelow;

    setPosition({
      top: openUp ? rect.top - GAP - height : rect.bottom + GAP,
      // Right edge lines up with the button's right edge, but never off screen
      left: Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE)),
    });
  }, []);

  // Position before the menu is painted, then keep it attached while scrolling / resizing
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true); // true: scrolling inside any element too
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Close when clicking anywhere outside the button and the menu
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
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
      close();
    } else if (e.key === "ArrowDown") focusAt(current + 1);
    else if (e.key === "ArrowUp") focusAt(current - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(buttons.length - 1);
    // Tab: close and put focus back on the ⋮ button, so Tab carries on from there
    else if (e.key === "Tab") close();
  }

  if (items.length === 0) return null;

  return (
    <div className={`dropdown${size === "small" ? " dropdown-small" : ""}`}>
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

      {open &&
        createPortal(
          <div
            id={menuId}
            ref={menuRef}
            className="dropdown-menu"
            style={position}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
          >
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
                  close();
                  item.onSelect();
                }}
              >
                <i className={`fa-${item.iconStyle ?? "solid"} ${item.icon}`} aria-hidden="true"></i>
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
