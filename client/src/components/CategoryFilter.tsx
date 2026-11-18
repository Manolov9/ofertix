import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { catalogCategories, type CatalogCategoryFilter } from "@shared/catalog-categories";

type CategoryFilterProps = {
  value: CatalogCategoryFilter;
  onChange: (value: CatalogCategoryFilter) => void;
};

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = catalogCategories.find(category => category.id === value);
  const visibleCategories = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("bg-BG");
    return term
      ? catalogCategories.filter(category => category.label.toLocaleLowerCase("bg-BG").includes(term))
      : catalogCategories;
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch("");
  }, [open]);

  const choose = (category: CatalogCategoryFilter) => {
    onChange(category);
    setOpen(false);
  };

  return (
    <div className="category-filter" ref={rootRef}>
      <div className={`category-filter-control${selected ? " has-value" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="category-filter-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={selected ? `Категория: ${selected.label}` : "По Категория"}
          onClick={() => setOpen(current => !current)}
        >
          <span className="category-filter-label">{selected?.label ?? "По Категория"}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {selected && (
          <button
            type="button"
            className="category-filter-clear"
            aria-label="Изчисти категорията"
            onClick={() => choose("all")}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div className="category-filter-menu">
          <label className="category-filter-search">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Търси категория"
              autoComplete="off"
            />
            <Search size={17} aria-hidden="true" />
          </label>
          <div className="category-filter-options" role="listbox" aria-label="Категории">
            {visibleCategories.map(category => (
              <button
                type="button"
                role="option"
                aria-selected={category.id === value}
                className={`category-filter-option${category.id === value ? " selected" : ""}`}
                key={category.id}
                onClick={() => choose(category.id)}
              >
                <span>{category.label}</span>
                {category.id === value && <Check size={15} aria-hidden="true" />}
              </button>
            ))}
            {visibleCategories.length === 0 && <div className="category-filter-empty">Няма такава категория</div>}
          </div>
        </div>
      )}
    </div>
  );
}
