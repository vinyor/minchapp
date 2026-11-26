import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HouseholdService } from '../../core/services/household.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-household-settings',
  template: `
    <div class="flex flex-1 flex-col px-4 pb-8 pt-6">
      <header class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-sage">MinchApp</p>
        <h1 class="font-display text-3xl text-ink">Hogar</h1>
      </header>

      @if (household(); as h) {
        <section class="mb-5 rounded-2xl border border-line bg-surface p-4">
          <h2 class="font-display text-xl text-ink">{{ h.name }}</h2>
          <p class="mt-1 text-sm text-ink-muted">Tu rol: {{ h.role === 'owner' ? 'Propietario' : 'Miembro' }}</p>

          <div class="mt-4 rounded-xl bg-sage-soft/70 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-sage-deep">
              Código de invitación
            </p>
            <p class="mt-1 font-mono text-2xl tracking-[0.35em] text-ink">{{ h.invite_code }}</p>
            <button type="button" class="mt-2 text-sm font-semibold text-sage" (click)="copyCode()">
              {{ copied() ? 'Copiado' : 'Copiar código' }}
            </button>
          </div>
        </section>

        <section class="mb-8 rounded-2xl border border-line bg-surface p-4">
          <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Miembros ({{ members().length }})
          </h3>
          <ul class="flex flex-col gap-2">
            @for (m of members(); track m.user_id) {
              <li class="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm">
                <span class="truncate font-mono text-xs text-ink">{{ shortId(m.user_id) }}</span>
                <span class="chip">{{ m.role }}</span>
              </li>
            }
          </ul>
        </section>
      } @else {
        <p class="text-ink-muted">No hay hogar cargado.</p>
      }

      <button type="button" class="btn-secondary text-danger" (click)="signOut()">
        Cerrar sesión
      </button>
    </div>
  `,
})
export class HouseholdSettingsComponent implements OnInit {
  private readonly households = inject(HouseholdService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly household = this.households.household;
  readonly members = this.households.members;
  readonly copied = signal(false);

  ngOnInit(): void {
    void this.households.loadCurrentHousehold();
  }

  shortId(id: string): string {
    return id.slice(0, 8) + '…';
  }

  async copyCode(): Promise<void> {
    const code = this.household()?.invite_code;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1600);
  }

  async signOut(): Promise<void> {
    this.households.clearLocalState();
    await this.supabase.signOut();
    await this.router.navigateByUrl('/login');
  }
}
