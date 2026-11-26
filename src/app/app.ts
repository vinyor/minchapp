import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { BottomNavComponent } from './shared/components/bottom-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNavComponent],
  template: `
    <div class="app-shell">
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <router-outlet />
      </main>
      @if (showNav()) {
        <app-bottom-nav />
      }
    </div>
  `,
})
export class App {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showNav = computed(() => {
    const path = this.url().split('?')[0];
    return !path.startsWith('/login') && !path.startsWith('/onboarding');
  });
}
