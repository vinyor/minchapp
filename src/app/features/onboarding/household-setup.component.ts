import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HouseholdService } from '../../core/services/household.service';

@Component({
  selector: 'app-household-setup',
  imports: [FormsModule],
  template: `
    <div class="app-shell px-5 pb-10 pt-10">
      <header class="mb-8">
        <p class="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-sage">Onboarding</p>
        <h1 class="font-display text-3xl text-ink">Crea o únete a un hogar</h1>
        <p class="mt-2 text-ink-muted">
          Todo lo que guardéis (recetas y menú) queda sincronizado entre miembros.
        </p>
      </header>

      <div class="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-sage-soft/60 p-1">
        <button
          type="button"
          class="min-h-11 rounded-xl text-sm font-semibold transition"
          [class.bg-surface]="tab() === 'create'"
          [class.text-ink]="tab() === 'create'"
          [class.text-ink-muted]="tab() !== 'create'"
          (click)="tab.set('create')"
        >
          Crear hogar
        </button>
        <button
          type="button"
          class="min-h-11 rounded-xl text-sm font-semibold transition"
          [class.bg-surface]="tab() === 'join'"
          [class.text-ink]="tab() === 'join'"
          [class.text-ink-muted]="tab() !== 'join'"
          (click)="tab.set('join')"
        >
          Unirme
        </button>
      </div>

      @if (error()) {
        <p class="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {{ error() }}
        </p>
      }

      @switch (tab()) {
        @case ('create') {
          <form class="flex flex-col gap-4" (ngSubmit)="create()">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">Nombre del hogar</span>
              <input
                class="field"
                name="name"
                required
                maxlength="60"
                placeholder="Casa Izquierdo"
                [(ngModel)]="householdName"
              />
            </label>
            <button class="btn-primary" type="submit" [disabled]="busy()">Crear y continuar</button>
          </form>
        }
        @case ('join') {
          <form class="flex flex-col gap-4" (ngSubmit)="join()">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">Código de invitación</span>
              <input
                class="field uppercase tracking-[0.3em]"
                name="code"
                required
                maxlength="6"
                minlength="6"
                placeholder="ABC123"
                [(ngModel)]="inviteCode"
              />
            </label>
            <button class="btn-primary" type="submit" [disabled]="busy()">Unirme al hogar</button>
          </form>
        }
      }
    </div>
  `,
})
export class HouseholdSetupComponent {
  private readonly households = inject(HouseholdService);
  private readonly router = inject(Router);

  householdName = '';
  inviteCode = '';

  readonly tab = signal<'create' | 'join'>('create');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async create(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.households.createHousehold(this.householdName);
      await this.router.navigateByUrl('/recipes');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo crear el hogar.');
    } finally {
      this.busy.set(false);
    }
  }

  async join(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.households.joinByCode(this.inviteCode);
      await this.router.navigateByUrl('/recipes');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Código no válido.');
    } finally {
      this.busy.set(false);
    }
  }
}
