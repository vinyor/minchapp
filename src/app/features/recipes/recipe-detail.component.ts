import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RECIPE_TYPE_LABELS, Recipe } from '../../core/models/recipe.model';
import { RecipeService } from '../../core/services/recipe.service';
import { RecipeMarkdownPipe } from '../../shared/pipes/recipe-markdown.pipe';

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, RecipeMarkdownPipe],
  template: `
    <div class="flex flex-1 flex-col px-4 pb-8 pt-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <a routerLink="/recipes" class="text-sm font-semibold text-sage">← Recetas</a>
        @if (recipe()) {
          <a [routerLink]="['/recipes', recipe()!.id, 'edit']" class="btn-secondary px-3 text-sm"
            >Editar</a
          >
        }
      </div>

      @if (loading()) {
        <p class="py-16 text-center text-ink-muted">Cargando…</p>
      } @else if (!recipe()) {
        <p class="py-16 text-center text-ink-muted">Receta no encontrada.</p>
      } @else {
        @if (imageUrl()) {
          <img
            [src]="imageUrl()!"
            [alt]="recipe()!.title"
            class="mb-5 aspect-[4/3] w-full rounded-2xl object-cover"
          />
        }

        <header class="mb-5">
          <span class="chip">{{ typeLabel }}</span>
          <h1 class="mt-2 font-display text-3xl leading-tight text-ink">{{ recipe()!.title }}</h1>
          <div class="mt-3 flex flex-wrap gap-3 text-sm text-ink-muted">
            @if (recipe()!.prep_time_min) {
              <span>{{ recipe()!.prep_time_min }} min</span>
            }
            @if (recipe()!.servings) {
              <span>{{ recipe()!.servings }} raciones</span>
            }
          </div>
        </header>

        @if (recipe()!.ingredients.length) {
          <section class="mb-6">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Ingredientes
            </h2>
            <ul class="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              @for (ing of recipe()!.ingredients; track ing.name + $index) {
                <li class="flex justify-between gap-3 text-sm">
                  <span>{{ ing.name }}</span>
                  <span class="shrink-0 text-ink-muted">
                    @if (ing.qty != null) {
                      {{ ing.qty }}{{ ing.unit ? ' ' + ing.unit : '' }}
                    }
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        @if (recipe()!.type !== 'basica' && recipe()!.markdown_body) {
          <section class="mb-6">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Preparación
            </h2>
            <div
              class="recipe-md prose-sm rounded-2xl border border-line bg-surface p-4 leading-relaxed text-ink"
              [innerHTML]="recipe()!.markdown_body | recipeMarkdown"
            ></div>
          </section>
        }

        @if (recipe()!.notes) {
          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Notas</h2>
            <p class="rounded-2xl bg-sage-soft/50 px-4 py-3 text-sm text-ink">
              {{ recipe()!.notes }}
            </p>
          </section>
        }
      }
    </div>
  `,
})
export class RecipeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);

  readonly recipe = signal<Recipe | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly loading = signal(true);

  get typeLabel(): string {
    const type = this.recipe()?.type;
    return type ? RECIPE_TYPE_LABELS[type] : '';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/recipes');
      return;
    }
    void this.load(id);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const recipe = await this.recipeService.getById(id);
      this.recipe.set(recipe);
      if (recipe?.image_path) {
        this.imageUrl.set(await this.recipeService.getSignedImageUrl(recipe.image_path));
      }
    } finally {
      this.loading.set(false);
    }
  }
}
