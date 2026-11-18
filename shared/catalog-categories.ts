export const catalogCategories = [
  { id: "1", slug: "food_home", label: "Храни и Битови Стоки" },
  { id: "2", slug: "Cosmetics", label: "Козметика" },
  { id: "3", slug: "Electronics", label: "Бяла и черна техника" },
  { id: "4", slug: "Other", label: "Разни" },
  { id: "5", slug: "Mobile", label: "Мобилни" },
  { id: "6", slug: "Construction", label: "Строителство" },
  { id: "7", slug: "Furniture", label: "Мебели" },
] as const;

export type CatalogCategoryId = (typeof catalogCategories)[number]["id"];
export type CatalogCategoryFilter = CatalogCategoryId | "all";

export function isCatalogCategoryId(value: string | null | undefined): value is CatalogCategoryId {
  return catalogCategories.some(category => category.id === value);
}
