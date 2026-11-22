import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PresetHoverPreview } from "./PresetHoverPreview";

/**
 * Custom dropdown select supporting a top "⭐ Favorit" group (while keeping
 * favorited items in their original categories below), an interactive
 * star toggle button on the far right of every option row, persistent
 * scroll position memory, and optional floating live hover preview.
 */
export function FavoriteSelect({
  value,
  onChange,
  categories = [],
  itemsById = {},
  favoriteIds = [],
  onToggleFavorite,
  ariaLabel = "Pilih opsi",
  className = "",
  previewMode = null, // "animation" | "effect" | null
  previewOptions = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [hoveredPreview, setHoveredPreview] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const lastScrollTopRef = useRef(null);

  const favoriteSet = new Set(Array.isArray(favoriteIds) ? favoriteIds : []);
  const favoriteItems = (Array.isArray(favoriteIds) ? favoriteIds : [])
    .map((id) => itemsById[id])
    .filter(Boolean);

  const selectedItem = itemsById[value] || Object.values(itemsById)[0] || null;
  const allItems = Object.values(itemsById);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(340, openUpward ? spaceAbove : spaceBelow));

    setMenuStyle({
      position: "fixed",
      left: `${Math.max(8, rect.left)}px`,
      width: `${Math.min(rect.width, window.innerWidth - 16)}px`,
      maxHeight: `${maxHeight}px`,
      ...(openUpward
        ? { bottom: `${window.innerHeight - rect.top + 4}px`, top: "auto" }
        : { top: `${rect.bottom + 4}px`, bottom: "auto" })
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen]);

  // Restore last scroll position immediately when dropdown opens (no jump to top)
  const isMenuMounted = isOpen && Boolean(menuStyle);
  useLayoutEffect(() => {
    if (!isMenuMounted || !menuRef.current) return;
    if (lastScrollTopRef.current !== null) {
      menuRef.current.scrollTop = lastScrollTopRef.current;
    } else {
      const selectedEl = menuRef.current.querySelector(".fav-select-item.selected");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "center" });
        lastScrollTopRef.current = menuRef.current.scrollTop;
      }
    }
  }, [isMenuMounted]);

  useEffect(() => {
    if (!isOpen) {
      setHoveredPreview(null);
      return undefined;
    }

    const handleOutsideMouseDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleReposition = (e) => {
      if (e && e.type === "scroll" && menuRef.current && e.target === menuRef.current) {
        return;
      }
      updateMenuPosition();
    };

    document.addEventListener("mousedown", handleOutsideMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  const handleSelect = (id) => {
    setHoveredPreview(null);
    if (onChange) onChange(id);
    setIsOpen(false);
  };

  const handleRowMouseEnter = (item, e) => {
    if (!previewMode || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const rowRect = e.currentTarget.getBoundingClientRect();
    setHoveredPreview({
      item,
      anchorRect: {
        menuLeft: menuRect.left,
        menuRight: menuRect.right,
        rowTop: rowRect.top,
        rowHeight: rowRect.height
      }
    });
  };

  const renderRow = (item, keyPrefix) => {
    const isSelected = item.id === value;
    const isFav = favoriteSet.has(item.id);

    return (
      <div
        key={`${keyPrefix}-${item.id}`}
        role="option"
        aria-selected={isSelected}
        className={`fav-select-item ${isSelected ? "selected" : ""}`}
        onMouseEnter={(e) => handleRowMouseEnter(item, e)}
      >
        <button
          type="button"
          className="fav-select-item-label"
          onClick={() => handleSelect(item.id)}
          title={previewMode ? undefined : item.name}
        >
          <span className="fav-select-item-text">{item.name}</span>
        </button>
        {onToggleFavorite && (
          <button
            type="button"
            className={`fav-select-item-star ${isFav ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            title={isFav ? "Hapus dari Favorit" : "Tambah ke Favorit"}
            aria-label={isFav ? `Hapus ${item.name} dari Favorit` : `Tambah ${item.name} ke Favorit`}
            aria-pressed={isFav}
          >
            {isFav ? "★" : "☆"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`fav-select-wrap ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`fav-select-trigger ${isOpen ? "open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="fav-select-trigger-text">
          {selectedItem ? selectedItem.name : "Pilih..."}
        </span>
        <span className="fav-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fav-select-menu"
            style={menuStyle}
            onScroll={(e) => {
              lastScrollTopRef.current = e.currentTarget.scrollTop;
            }}
            onMouseLeave={() => setHoveredPreview(null)}
          >
            {favoriteItems.length > 0 && (
              <div className="fav-select-group">
                <div className="fav-select-group-label">⭐ Favorit</div>
                {favoriteItems.map((item) => renderRow(item, "fav"))}
              </div>
            )}

            {categories.map((cat) => {
              const catItems = allItems.filter((item) => item.category === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} className="fav-select-group">
                  <div className="fav-select-group-label">{cat.label}</div>
                  {catItems.map((item) => renderRow(item, cat.id))}
                </div>
              );
            })}
          </div>,
          document.body
        )}

      {isOpen && previewMode && hoveredPreview && (
        <PresetHoverPreview
          mode={previewMode}
          item={hoveredPreview.item}
          anchorRect={hoveredPreview.anchorRect}
          options={previewOptions || {}}
        />
      )}
    </div>
  );
}
