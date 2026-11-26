import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HouseholdService } from '../../core/services/household.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="app-shell px-5 pb-10 pt-12">
      <header class="mb-10">
        <p class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sage">MinchApp</p>
        <h1 class="font-display text-4xl leading-tight text-ink">Tu cocina,<br />en pareja.</h1>
        <p class="mt-3 max-w-sm text-base text-ink-muted">
          Recetario compartido y plan semanal sincronizado para el hogar.
        </p>
      </header>

      <form class="flex flex-col gap-4" (ngSubmit)="submit()">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-ink">Email</span>
          <input
            class="field"
            type="email"
            name="email"
            autocomplete="email"
            required
            [(ngModel)]="email"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-ink">Contraseña</span>
          <input
            class="field"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            minlength="6"
            [(ngModel)]="password"
          />
        </label>

        @if (error()) {
          <p class="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {{ error() }}
          </p>
        }

        <div class="mt-2 flex flex-col gap-3">
          <button class="btn-primary" type="submit" [disabled]="busy()">
            {{ mode() === 'login' ? 'Entrar' : 'Crear cuenta' }}
          </button>
          <button class="btn-secondary" type="button" (click)="toggleMode()" [disabled]="busy()">
            {{
              mode() === 'login' ? '¿Nueva cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'
            }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly households = inject(HouseholdService);
  private readonly router = inject(Router);

  email = '';
  password = '';

  readonly mode = signal<'login' | 'signup'>('login');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  toggleMode(): void {
    this.mode.update((m) => (m === 'login' ? 'signup' : 'login'));
    this.error.set(null);
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);

    try {
      if (this.mode() === 'login') {
        await this.supabase.signInWithPassword(this.email.trim(), this.password);
      } else {
        await this.supabase.signUp(this.email.trim(), this.password);
      }

      const household = await this.households.loadCurrentHousehold();
      await this.router.navigateByUrl(household ? '/recipes' : '/onboarding');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo autenticar.');
    } finally {
      this.busy.set(false);
    }
  }
}
