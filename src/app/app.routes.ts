import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { householdGuard } from './core/guards/household.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'recipes' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/household-setup.component').then(
        (m) => m.HouseholdSetupComponent,
      ),
  },
  {
    path: 'recipes',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/recipes/recipe-list.component').then((m) => m.RecipeListComponent),
  },
  {
    path: 'recipes/new',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/recipes/recipe-form.component').then((m) => m.RecipeFormComponent),
  },
  {
    path: 'recipes/:id',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/recipes/recipe-detail.component').then((m) => m.RecipeDetailComponent),
  },
  {
    path: 'recipes/:id/edit',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/recipes/recipe-form.component').then((m) => m.RecipeFormComponent),
  },
  {
    path: 'planner',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/planner/planner.component').then((m) => m.PlannerComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard, householdGuard],
    loadComponent: () =>
      import('./features/settings/household-settings.component').then(
        (m) => m.HouseholdSettingsComponent,
      ),
  },
  { path: '**', redirectTo: 'recipes' },
];
