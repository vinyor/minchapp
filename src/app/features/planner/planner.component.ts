import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Recipe } from '../../core/models/recipe.model';
import {
  MEAL_SLOT_LABELS,
  MealSlot,
  WEEKDAY_LABELS_ES,
  WeeklyPlanEntryWithRecipe,
} from '../../core/models/weekly-plan.model';
import { HouseholdService } from '../../core/services/household.service';
import { RecipeService } from '../../core/services/recipe.service';
import { SupabaseService } from '../../core/services/supabase.service';

interface DayColumn {
  date: string;
  label: string;
  dayNumber: number;
}

@Component({
  selector: 'app-planner',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="flex flex-1 flex-col px-4 pb-4 pt-6">
      <header class="mb-5">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-sage">MinchApp</p>
        <div class="mt-1 flex items-center justify-between gap-3">
          <h1 class="font-display text-3xl text-ink">Semana</h1>
          <div class="flex gap-2">
            <button type="button" class="btn-secondary px-3 text-sm" (click)="shiftWeek(-1)">
              ←
            </button>
            <button type="button" class="btn-secondary px-3 text-sm" (click)="shiftWeek(1)">
              →
            </button>
          </div>
        </div>
        <p class="mt-1 text-sm text-ink-muted">
          {{ weekStart() | date: 'd MMM' }} – {{ weekEnd() | date: 'd MMM y' }}
        </p>
      </header>

      <div class="flex flex-col gap-3">
        @for (day of days(); track day.date) {
          <section class="rounded-2xl border border-line bg-surface p-3">
            <h2 class="mb-2 flex items-baseline justify-between">
              <span class="font-display text-lg text-ink">{{ day.label }}</span>
              <span class="text-sm text-ink-muted">{{ day.dayNumber }}</span>
            </h2>

            @for (slot of slots; track slot) {
              <button
                type="button"
                class="mb-2 flex w-full items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5 text-left transition active:scale-[0.99] last:mb-0"
                (click)="openEditor(day.date, slot)"
              >
                <div class="min-w-0">
                  <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {{ slotLabels[slot] }}
                  </p>
                  <p class="mt-0.5 truncate text-sm font-medium text-ink">
                    {{ slotLabel(day.date, slot) }}
                  </p>
                </div>
                <span class="text-ink-muted" aria-hidden="true">✎</span>
              </button>
            }
          </section>
        }
      </div>

      @if (editorOpen()) {
        <div
          class="fixed inset-0 z-30 flex items-end bg-ink/40 p-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          (click)="closeEditor()"
        >
          <div
            class="w-full max-w-lg rounded-2xl bg-surface p-4 shadow-xl"
            (click)="$event.stopPropagation()"
          >
            <h3 class="font-display text-xl text-ink">Asignar comida</h3>
            <p class="mt-1 text-sm text-ink-muted">
              {{ editingDate() }} · {{ slotLabels[editingSlot()] }}
            </p>

            <label class="mt-4 flex flex-col gap-1.5">
              <span class="text-sm font-medium">Receta</span>
              <select class="field" [(ngModel)]="selectedRecipeId">
                <option [ngValue]="null">— Sin receta —</option>
                @for (r of recipes(); track r.id) {
                  <option [ngValue]="r.id">{{ r.title }}</option>
                }
              </select>
            </label>

            <label class="mt-3 flex flex-col gap-1.5">
              <span class="text-sm font-medium">O texto libre</span>
              <input
                class="field"
                [(ngModel)]="customText"
                placeholder="Ej. Sobrante / Fuera"
              />
            </label>

            @if (editorError()) {
              <p class="mt-3 text-sm text-danger">{{ editorError() }}</p>
            }

            <div class="mt-4 flex gap-2">
              <button type="button" class="btn-secondary flex-1" (click)="clearSlot()">
                Vaciar
              </button>
              <button type="button" class="btn-primary flex-1" (click)="saveSlot()">Guardar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PlannerComponent implements OnInit, OnDestroy {
  private readonly households = inject(HouseholdService);
  private readonly recipesService = inject(RecipeService);
  private readonly supabase = inject(SupabaseService);

  readonly slots: MealSlot[] = ['comida', 'cena'];
  readonly slotLabels = MEAL_SLOT_LABELS;

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  readonly days = computed(() => buildWeekDays(this.weekStart()));
  readonly plan = this.households.weeklyPlan;
  readonly recipes = signal<Recipe[]>([]);

  readonly editorOpen = signal(false);
  readonly editingDate = signal('');
  readonly editingSlot = signal<MealSlot>('comida');
  readonly editorError = signal<string | null>(null);

  selectedRecipeId: string | null = null;
  customText = '';

  ngOnInit(): void {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    void this.households.unsubscribeWeeklyPlan();
  }

  shiftWeek(delta: number): void {
    this.weekStart.set(addDays(this.weekStart(), delta * 7));
    void this.reloadPlan();
  }

  slotLabel(date: string, slot: MealSlot): string {
    const entry = this.findEntry(date, slot);
    if (!entry) return 'Sin planificar';
    return entry.recipe_title || entry.custom_text || 'Sin planificar';
  }

  openEditor(date: string, slot: MealSlot): void {
    const entry = this.findEntry(date, slot);
    this.editingDate.set(date);
    this.editingSlot.set(slot);
    this.selectedRecipeId = entry?.recipe_id ?? null;
    this.customText = entry?.custom_text ?? '';
    this.editorError.set(null);
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
  }

  async saveSlot(): Promise<void> {
    const household = this.households.household();
    const user = this.supabase.user();
    if (!household || !user) return;

    try {
      await this.households.upsertPlanSlot({
        household_id: household.id,
        plan_date: this.editingDate(),
        meal_slot: this.editingSlot(),
        recipe_id: this.selectedRecipeId,
        custom_text: this.customText.trim() || null,
        updated_by: user.id,
      });
      await this.reloadPlan();
      this.closeEditor();
    } catch (err) {
      this.editorError.set(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }

  async clearSlot(): Promise<void> {
    try {
      await this.households.clearPlanSlot(this.editingDate(), this.editingSlot());
      await this.reloadPlan();
      this.closeEditor();
    } catch (err) {
      this.editorError.set(err instanceof Error ? err.message : 'No se pudo vaciar.');
    }
  }

  private async bootstrap(): Promise<void> {
    this.recipes.set(await this.recipesService.list());
    await this.reloadPlan();
  }

  private async reloadPlan(): Promise<void> {
    const from = toIsoDate(this.weekStart());
    const to = toIsoDate(this.weekEnd());
    await this.households.loadWeeklyPlan(from, to);
    this.households.subscribeWeeklyPlan(from, to);
  }

  private findEntry(date: string, slot: MealSlot): WeeklyPlanEntryWithRecipe | undefined {
    return this.plan().find((e) => e.plan_date === date && e.meal_slot === slot);
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeekDays(weekStart: Date): DayColumn[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date: toIsoDate(date),
      label: WEEKDAY_LABELS_ES[i],
      dayNumber: date.getDate(),
    };
  });
}
