/**
 * Shadcn-styled Switch / Toggle component
 * Follows Radix UI Switch specification with solid high-contrast colors (no gradients)
 */
export function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  id,
  className = "",
  "aria-label": ariaLabel = "Toggle",
  title
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (disabled) return;
    onCheckedChange?.(!checked);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      title={title}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`shadcn-switch-root ${checked ? "checked" : "unchecked"} ${disabled ? "disabled" : ""} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="shadcn-switch-thumb" />
    </button>
  );
}
