import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HouseholdService } from '../services/household.service';
import { SupabaseService } from '../services/supabase.service';

export const householdGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const households = inject(HouseholdService);
  const router = inject(Router);

  while (!supabase.authReady()) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  if (!supabase.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const current = households.household() ?? (await households.loadCurrentHousehold());
  if (current) {
    return true;
  }

  return router.createUrlTree(['/onboarding']);
};
