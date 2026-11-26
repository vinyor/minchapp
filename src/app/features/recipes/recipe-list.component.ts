import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RECIPE_TYPE_LABELS, Recipe, RecipeType } from '../../core/models/recipe.model';
import { RecipeService } from '../../core/services/recipe.service';

@Component({
  selector: 'app-recipe-list',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex flex-1 flex-col px-4 pb-4 pt-6">
      <header class="mb-5 flex items-end justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-sage">MinchApp</p>
          <h1 class="font-display text-3xl text-ink">Recetario</h1>
        </div>
        <a routerLink="/recipes/new" class="btn-primary px-4 text-sm">Nueva</a>
      </header>

      <div class="mb-4 flex flex-col gap-3">
        <input
          class="field"
          type="search"
          placeholder="Buscar por título o notas…"
          [(ngModel)]="query"
          (ngModelChange)="reload()"
        />

        <div class="flex gap-2 overflow-x-auto pb-1">
          @for (option of typeOptions; track option.value) {
            <button
              type="button"
              class="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition"
              [class.bg-sage]="typeFilter() === option.value"
              [class.text-white]="typeFilter() === option.value"
              [class.bg-surface]="typeFilter() !== option.value"
              [class.text-ink-muted]="typeFilter() !== option.value"
              [class.border]="typeFilter() !== option.value"
              [class.border-line]="typeFilter() !== option.value"
              (click)="setType(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <p class="py-10 text-center text-ink-muted">Cargando recetas…</p>
      } @else if (!recipes().length) {
        <div class="rounded-2xl border border-dashed border-line bg-surface/70 px-5 py-10 text-center">
          <p class="font-display text-xl text-ink">Aún no hay recetas</p>
          <p class="mt-2 text-sm text-ink-muted">Empieza con un plato básico o una Thermomix.</p>
          <a routerLink="/recipes/new" class="btn-primary mt-5 inline-flex">Añadir la primera</a>
        </div>
      } @else {
        <ul class="flex flex-col gap-3">
          @for (recipe of recipes(); track recipe.id) {
            <li>
              <a
                [routerLink]="['/recipes', recipe.id]"
                class="block rounded-2xl border border-line bg-surface px-4 py-3.5 transition active:scale-[0.99]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h2 class="truncate font-display text-xl text-ink">{{ recipe.title }}</h2>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span class="chip">{{ typeLabel(recipe.type) }}</span>
                      @if (recipe.prep_time_min) {
                        <span class="text-xs text-ink-muted">{{ recipe.prep_time_min }} min</span>
                      }
                      @if (recipe.servings) {
                        <span class="text-xs text-ink-muted">{{ recipe.servings }} raciones</span>
                      }
                    </div>
                  </div>
                  <span class="text-ink-muted" aria-hidden="true">›</span>
                </div>
                @if (recipe.tags.length) {
                  <p class="mt-2 truncate text-xs text-ink-muted">
                    {{ recipe.tags.join(' · ') }}
                  </p>
                }
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class RecipeListComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);

  query = '';
  readonly typeFilter = signal<RecipeType | 'all'>('all');
  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(false);

  readonly typeOptions: { value: RecipeType | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'basica', label: 'Básicas' },
    { value: 'manual', label: 'Manual' },
    { value: 'thermomix', label: 'Thermomix' },
  ];

  ngOnInit(): void {
    void this.reload();
  }

  typeLabel(type: RecipeType): string {
    return RECIPE_TYPE_LABELS[type];
  }

  setType(value: RecipeType | 'all'): void {
    this.typeFilter.set(value);
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.recipeService.list({
        query: this.query,
        type: this.typeFilter(),
      });
      this.recipes.set(data);
    } finally {
      this.loading.set(false);
    }
  }
}
