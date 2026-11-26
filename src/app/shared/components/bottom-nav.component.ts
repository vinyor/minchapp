import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav
      class="sticky bottom-0 z-20 border-t border-line/80 bg-surface/95 backdrop-blur-md"
      aria-label="Navegación principal"
    >
      <ul class="mx-auto grid max-w-lg grid-cols-3 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        @for (item of items; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="text-sage bg-sage-soft"
              [routerLinkActiveOptions]="item.exact ? { exact: true } : { exact: false }"
              class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-ink-muted transition"
            >
              <span class="text-lg leading-none" aria-hidden="true">{{ item.icon }}</span>
              <span class="text-xs font-semibold tracking-wide">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class BottomNavComponent {
  readonly items = [
    { path: '/recipes', label: 'Recetas', icon: '◎', exact: false },
    { path: '/planner', label: 'Semana', icon: '▦', exact: true },
    { path: '/settings', label: 'Hogar', icon: '⌂', exact: true },
  ] as const;
}
