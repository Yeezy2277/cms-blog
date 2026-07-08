export type SlashItem = { label: string; hint?: string; run: () => void };

export function SlashMenu({
  items,
  activeIndex,
  position,
  onPick,
}: {
  items: SlashItem[];
  activeIndex: number;
  position: { top: number; left: number };
  onPick: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 10,
        width: 220,
        background: "white",
        border: "1px solid #cdd5e0",
        borderRadius: 6,
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        padding: 4,
      }}
      // Keep editor selection while clicking the menu.
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          onClick={() => onPick(i)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            border: "none",
            background: i === activeIndex ? "#eef3fb" : "transparent",
            borderRadius: 4,
            padding: "6px 10px",
            fontSize: 13,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span>{item.label}</span>
          {item.hint && <span style={{ color: "#8091a5" }}>{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}
