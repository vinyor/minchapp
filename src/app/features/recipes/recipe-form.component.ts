import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  RECIPE_TYPE_LABELS,
  RecipeIngredient,
  RecipeType,
} from '../../core/models/recipe.model';
import {
  AiRecipeService,
  ParsedRecipeResponse,
} from '../../core/services/ai-recipe.service';
import { RecipeService } from '../../core/services/recipe.service';

@Component({
  selector: 'app-recipe-form',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex flex-1 flex-col px-4 pb-10 pt-4">
      <div class="mb-4 flex items-center justify-between">
        <a routerLink="/recipes" class="text-sm font-semibold text-sage">Cancelar</a>
        <h1 class="font-display text-xl text-ink">
          {{ isEdit() ? 'Editar receta' : 'Nueva receta' }}
        </h1>
        <span class="w-14"></span>
      </div>

      @if (!isEdit()) {
        <button
          type="button"
          class="mb-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-copper px-4 text-base font-semibold text-white transition active:scale-[0.98]"
          (click)="openAiImporter()"
        >
          Importar con IA (Texto o Foto)
        </button>
      }

      <form class="flex flex-col gap-5" (ngSubmit)="save()">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Título</span>
          <input class="field" name="title" required [(ngModel)]="title" />
        </label>

        <fieldset>
          <legend class="mb-2 text-sm font-medium">Tipo</legend>
          <div class="grid grid-cols-3 gap-2">
            @for (t of types; track t) {
              <button
                type="button"
                class="min-h-11 rounded-xl border text-sm font-semibold transition"
                [class.border-sage]="type === t"
                [class.bg-sage-soft]="type === t"
                [class.border-line]="type !== t"
                [class.bg-surface]="type !== t"
                (click)="type = t"
              >
                {{ labels[t] }}
              </button>
            }
          </div>
        </fieldset>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Tiempo (min)</span>
            <input class="field" type="number" name="prep" min="0" [(ngModel)]="prepTime" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Raciones</span>
            <input class="field" type="number" name="servings" min="1" [(ngModel)]="servings" />
          </label>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Tags (separados por coma)</span>
          <input
            class="field"
            name="tags"
            placeholder="verdura, rápida, batch"
            [(ngModel)]="tagsRaw"
          />
        </label>

        <section>
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-medium">Ingredientes</h2>
            <button type="button" class="text-sm font-semibold text-sage" (click)="addIngredient()">
              + Añadir
            </button>
          </div>
          <div class="flex flex-col gap-2">
            @for (ing of ingredients; track $index; let i = $index) {
              <div class="grid grid-cols-[1fr_4.5rem_4.5rem_auto] gap-2">
                <input class="field" placeholder="Nombre" [(ngModel)]="ing.name" [name]="'n' + i" />
                <input
                  class="field"
                  type="number"
                  placeholder="Cant."
                  [(ngModel)]="ing.qty"
                  [name]="'q' + i"
                />
                <input class="field" placeholder="Ud." [(ngModel)]="ing.unit" [name]="'u' + i" />
                <button
                  type="button"
                  class="min-h-12 px-2 text-danger"
                  (click)="removeIngredient(i)"
                  aria-label="Eliminar ingrediente"
                >
                  ×
                </button>
              </div>
            }
          </div>
        </section>

        @if (type !== 'basica') {
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">
              Instrucciones (Markdown)
              @if (type === 'thermomix') {
                <span class="font-normal text-ink-muted"> — usa [tiempo / temp / vel]</span>
              }
            </span>
            <textarea
              class="field min-h-40 font-mono text-sm"
              name="body"
              [(ngModel)]="markdownBody"
              [placeholder]="
                type === 'thermomix'
                  ? '1. Sofreír cebolla [3 min / 120°C / vel 1]\\n2. ...'
                  : '1. Paso uno\\n2. Paso dos'
              "
            ></textarea>
          </label>
        }

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Notas</span>
          <textarea class="field min-h-24" name="notes" [(ngModel)]="notes"></textarea>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Imagen del plato</span>
          <input class="field" type="file" accept="image/*" (change)="onFile($event)" />
        </label>

        @if (error()) {
          <p class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {{ error() }}
          </p>
        }

        <button class="btn-primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Guardar receta' }}
        </button>

        @if (isEdit()) {
          <button
            type="button"
            class="btn-secondary text-danger"
            [disabled]="busy()"
            (click)="remove()"
          >
            Eliminar
          </button>
        }
      </form>
    </div>

    @if (aiOpen()) {
      <div
        class="fixed inset-0 z-40 flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-import-title"
        (click)="closeAiImporter()"
      >
        <div
          class="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-4 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="ai-import-title" class="font-display text-xl text-ink">Importar con IA</h2>
              <p class="mt-1 text-sm text-ink-muted">
                Pega texto, escribe un plato o sube una foto de la receta.
              </p>
            </div>
            <button
              type="button"
              class="min-h-10 min-w-10 rounded-xl text-ink-muted"
              (click)="closeAiImporter()"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div class="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-sage-soft/60 p-1">
            <button
              type="button"
              class="min-h-11 rounded-lg text-sm font-semibold transition"
              [class.bg-surface]="aiTab() === 'text'"
              [class.text-ink]="aiTab() === 'text'"
              [class.text-ink-muted]="aiTab() !== 'text'"
              [disabled]="aiBusy()"
              (click)="aiTab.set('text')"
            >
              Pegar texto
            </button>
            <button
              type="button"
              class="min-h-11 rounded-lg text-sm font-semibold transition"
              [class.bg-surface]="aiTab() === 'image'"
              [class.text-ink]="aiTab() === 'image'"
              [class.text-ink-muted]="aiTab() !== 'image'"
              [disabled]="aiBusy()"
              (click)="aiTab.set('image')"
            >
              Desde imagen
            </button>
          </div>

          @if (aiBusy()) {
            <div
              class="mb-4 rounded-xl border border-sage/20 bg-sage-soft/40 px-4 py-5 text-center"
              role="status"
              aria-live="polite"
            >
              <p class="font-medium text-sage-deep">Analizando receta con IA...</p>
              <p class="mt-1 text-sm text-ink-muted">Puede tardar unos segundos.</p>
            </div>
          }

          @if (aiError()) {
            <p class="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {{ aiError() }}
            </p>
          }

          @switch (aiTab()) {
            @case ('text') {
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium">Texto o idea rápida</span>
                <textarea
                  class="field min-h-36"
                  [(ngModel)]="aiText"
                  name="aiText"
                  [disabled]="aiBusy()"
                  placeholder="Pega una receta completa o escribe algo corto como «Judías verdes con patata»"
                ></textarea>
              </label>
              <button
                type="button"
                class="btn-primary mt-4 w-full"
                [disabled]="aiBusy() || !aiText.trim()"
                (click)="generateFromText()"
              >
                Generar receta
              </button>
            }
            @case ('image') {
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium">Foto o captura de pantalla</span>
                <input
                  class="field"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  [disabled]="aiBusy()"
                  (change)="onAiImage($event)"
                />
              </label>
              @if (aiImageName()) {
                <p class="mt-2 truncate text-sm text-ink-muted">{{ aiImageName() }}</p>
              }
              <button
                type="button"
                class="btn-primary mt-4 w-full"
                [disabled]="aiBusy() || !aiImageFile"
                (click)="generateFromImage()"
              >
                Generar receta
              </button>
            }
          }
        </div>
      </div>
    }
  `,
})
export class RecipeFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly aiRecipe = inject(AiRecipeService);

  readonly labels = RECIPE_TYPE_LABELS;
  readonly types: RecipeType[] = ['basica', 'manual', 'thermomix'];
  readonly isEdit = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly aiOpen = signal(false);
  readonly aiTab = signal<'text' | 'image'>('text');
  readonly aiBusy = signal(false);
  readonly aiError = signal<string | null>(null);
  readonly aiImageName = signal<string | null>(null);

  private recipeId: string | null = null;
  private imageFile: File | null = null;
  aiImageFile: File | null = null;
  aiText = '';

  title = '';
  type: RecipeType = 'manual';
  prepTime: number | null = null;
  servings: number | null = null;
  tagsRaw = '';
  notes = '';
  markdownBody = '';
  ingredients: RecipeIngredient[] = [{ name: '', qty: null, unit: null }];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.recipeId = id;
      this.isEdit.set(true);
      void this.load(id);
    }
  }

  openAiImporter(): void {
    this.aiError.set(null);
    this.aiOpen.set(true);
  }

  closeAiImporter(): void {
    if (this.aiBusy()) return;
    this.aiOpen.set(false);
  }

  onAiImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.aiImageFile = file;
    this.aiImageName.set(file?.name ?? null);
    this.aiError.set(null);
  }

  async generateFromText(): Promise<void> {
    const text = this.aiText.trim();
    if (!text) {
      this.aiError.set('Escribe o pega algo para generar la receta.');
      return;
    }

    this.aiBusy.set(true);
    this.aiError.set(null);
    try {
      const parsed = await this.aiRecipe.parseFromText(text);
      this.applyParsedRecipe(parsed);
      this.aiOpen.set(false);
    } catch (err) {
      this.aiError.set(this.readableAiError(err));
    } finally {
      this.aiBusy.set(false);
    }
  }

  async generateFromImage(): Promise<void> {
    if (!this.aiImageFile) {
      this.aiError.set('Elige una imagen de la receta.');
      return;
    }

    this.aiBusy.set(true);
    this.aiError.set(null);
    try {
      const parsed = await this.aiRecipe.parseFromImage(this.aiImageFile);
      this.applyParsedRecipe(parsed);
      this.aiOpen.set(false);
    } catch (err) {
      this.aiError.set(this.readableAiError(err));
    } finally {
      this.aiBusy.set(false);
    }
  }

  addIngredient(): void {
    this.ingredients = [...this.ingredients, { name: '', qty: null, unit: null }];
  }

  removeIngredient(index: number): void {
    this.ingredients = this.ingredients.filter((_, i) => i !== index);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageFile = input.files?.[0] ?? null;
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);

    try {
      const tags = this.tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const ingredients = this.ingredients
        .map((ing) => ({
          name: ing.name.trim(),
          qty: ing.qty === null || (ing.qty as unknown) === '' ? null : Number(ing.qty),
          unit: ing.unit?.trim() || null,
        }))
        .filter((ing) => ing.name);

      const payload = {
        title: this.title.trim(),
        type: this.type,
        prep_time_min: this.prepTime ? Number(this.prepTime) : null,
        servings: this.servings ? Number(this.servings) : null,
        tags,
        ingredients,
        notes: this.notes.trim() || null,
        markdown_body: this.type === 'basica' ? null : this.markdownBody.trim() || null,
      };

      let id = this.recipeId;
      if (this.isEdit() && id) {
        await this.recipeService.update(id, payload);
      } else {
        const created = await this.recipeService.create({ ...payload, image_path: null });
        id = created.id;
      }

      if (this.imageFile && id) {
        await this.recipeService.uploadImage(id, this.imageFile);
      }

      await this.router.navigate(['/recipes', id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.recipeId || !confirm('¿Eliminar esta receta?')) return;
    this.busy.set(true);
    try {
      await this.recipeService.remove(this.recipeId);
      await this.router.navigateByUrl('/recipes');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      this.busy.set(false);
    }
  }

  private applyParsedRecipe(parsed: ParsedRecipeResponse): void {
    this.title = parsed.title?.trim() || this.title;
    this.type = this.normalizeType(parsed.type);
    this.prepTime = parsed.prep_time_min ?? null;
    this.servings = parsed.servings ?? null;
    this.tagsRaw = (parsed.tags ?? []).join(', ');
    this.notes = parsed.notes ?? '';
    this.markdownBody = parsed.markdown_body ?? '';
    this.ingredients = parsed.ingredients?.length
      ? parsed.ingredients.map((i) => ({
          name: i.name ?? '',
          qty: i.qty ?? null,
          unit: i.unit ?? null,
        }))
      : [{ name: '', qty: null, unit: null }];
  }

  private normalizeType(value: string | null | undefined): RecipeType {
    if (value === 'basica' || value === 'manual' || value === 'thermomix') {
      return value;
    }
    return 'manual';
  }

  private readableAiError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string; message?: string } | string | null;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        if (body.error) return body.error;
        if (body.message) return body.message;
      }
      if (err.status === 0) {
        return 'No se pudo contactar con el servicio de IA. ¿Está `npm run start:api` en marcha?';
      }
      return `Error del importador (${err.status}). Inténtalo de nuevo.`;
    }
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'TimeoutError') {
      return 'La IA tardó demasiado. Revisa que el API local esté activo e inténtalo de nuevo.';
    }
    if (err instanceof Error && err.message) return err.message;
    return 'No se pudo analizar la receta con IA.';
  }

  private async load(id: string): Promise<void> {
    const recipe = await this.recipeService.getById(id);
    if (!recipe) {
      await this.router.navigateByUrl('/recipes');
      return;
    }

    this.title = recipe.title;
    this.type = recipe.type;
    this.prepTime = recipe.prep_time_min;
    this.servings = recipe.servings;
    this.tagsRaw = (recipe.tags ?? []).join(', ');
    this.notes = recipe.notes ?? '';
    this.markdownBody = recipe.markdown_body ?? '';
    this.ingredients = recipe.ingredients?.length
      ? recipe.ingredients.map((i) => ({ ...i }))
      : [{ name: '', qty: null, unit: null }];
  }
}
