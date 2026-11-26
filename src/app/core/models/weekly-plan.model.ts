export type MealSlot = 'comida' | 'cena';

export interface WeeklyPlanEntry {
  id: string;
  household_id: string;
  plan_date: string; // YYYY-MM-DD
  meal_slot: MealSlot;
  recipe_id: string | null;
  custom_text: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface WeeklyPlanEntryWithRecipe extends WeeklyPlanEntry {
  recipe_title?: string | null;
  recipe_type?: string | null;
}

export type WeeklyPlanUpsert = {
  household_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  recipe_id?: string | null;
  custom_text?: string | null;
  updated_by: string;
};

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  comida: 'Comida',
  cena: 'Cena',
};

export const WEEKDAY_LABELS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
