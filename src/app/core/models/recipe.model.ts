export type RecipeType = 'basica' | 'manual' | 'thermomix';

export interface RecipeIngredient {
  name: string;
  qty: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  type: RecipeType;
  prep_time_min: number | null;
  servings: number | null;
  tags: string[];
  ingredients: RecipeIngredient[];
  notes: string | null;
  markdown_body: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

export type RecipeInsert = Omit<Recipe, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type RecipeUpdate = Partial<
  Pick<
    Recipe,
    | 'title'
    | 'type'
    | 'prep_time_min'
    | 'servings'
    | 'tags'
    | 'ingredients'
    | 'notes'
    | 'markdown_body'
    | 'image_path'
  >
>;

export interface RecipeFilters {
  query?: string;
  type?: RecipeType | 'all';
  tags?: string[];
}

export const RECIPE_TYPE_LABELS: Record<RecipeType, string> = {
  basica: 'Básica',
  manual: 'Manual',
  thermomix: 'Thermomix',
};
