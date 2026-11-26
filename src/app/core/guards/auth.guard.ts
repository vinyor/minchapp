import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Wait until initial session resolution completes.
  while (!supabase.authReady()) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  if (supabase.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
