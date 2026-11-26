import { Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Household, HouseholdMember, HouseholdWithRole } from '../models/household.model';
import {
  MealSlot,
  WeeklyPlanEntry,
  WeeklyPlanEntryWithRecipe,
  WeeklyPlanUpsert,
} from '../models/weekly-plan.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly supabase = inject(SupabaseService);

  private readonly householdSignal = signal<HouseholdWithRole | null>(null);
  private readonly membersSignal = signal<HouseholdMember[]>([]);
  private readonly planSignal = signal<WeeklyPlanEntryWithRecipe[]>([]);
  private readonly loadingSignal = signal(false);

  private planChannel: RealtimeChannel | null = null;

  readonly household = this.householdSignal.asReadonly();
  readonly members = this.membersSignal.asReadonly();
  readonly weeklyPlan = this.planSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly hasHousehold = computed(() => !!this.householdSignal());

  async loadCurrentHousehold(): Promise<HouseholdWithRole | null> {
    const user = this.supabase.user();
    if (!user) {
      this.householdSignal.set(null);
      this.membersSignal.set([]);
      return null;
    }

    this.loadingSignal.set(true);
    try {
      const { data: membership, error: membershipError } = await this.supabase.client
        .from('household_members')
        .select('household_id, role, joined_at, user_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        this.householdSignal.set(null);
        this.membersSignal.set([]);
        return null;
      }

      const { data: household, error: householdError } = await this.supabase.client
        .from('households')
        .select('*')
        .eq('id', membership.household_id)
        .single();

      if (householdError) throw householdError;

      const withRole: HouseholdWithRole = {
        ...(household as Household),
        role: membership.role,
      };

      this.householdSignal.set(withRole);
      await this.refreshMembers(withRole.id);
      return withRole;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async createHousehold(name: string): Promise<HouseholdWithRole> {
    const user = this.supabase.user();
    if (!user) throw new Error('Debes iniciar sesión.');

    // SECURITY DEFINER RPC: inserts household + trigger adds owner membership.
    // Avoids RLS chicken-and-egg on INSERT...RETURNING / household_members.
    const { data: household, error } = await this.supabase.client.rpc('create_household', {
      p_name: name.trim(),
    });

    if (error) throw error;
    if (!household) throw new Error('No se pudo crear el hogar.');

    const withRole: HouseholdWithRole = { ...(household as Household), role: 'owner' };
    this.householdSignal.set(withRole);
    await this.refreshMembers(withRole.id);
    return withRole;
  }

  async joinByCode(code: string): Promise<string> {
    const normalized = code.trim().toUpperCase();
    const { data, error } = await this.supabase.client.rpc('join_household_by_code', {
      code: normalized,
    });

    if (error) throw error;

    const householdId = data as string;
    await this.loadCurrentHousehold();
    return householdId;
  }

  async refreshMembers(householdId = this.householdSignal()?.id): Promise<void> {
    if (!householdId) {
      this.membersSignal.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('household_members')
      .select('household_id, user_id, role, joined_at')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    this.membersSignal.set((data ?? []) as HouseholdMember[]);
  }

  async loadWeeklyPlan(fromDate: string, toDate: string): Promise<WeeklyPlanEntryWithRecipe[]> {
    const householdId = this.householdSignal()?.id;
    if (!householdId) {
      this.planSignal.set([]);
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('weekly_plan')
      .select('*, recipes(title, type)')
      .eq('household_id', householdId)
      .gte('plan_date', fromDate)
      .lte('plan_date', toDate)
      .order('plan_date', { ascending: true })
      .order('meal_slot', { ascending: true });

    if (error) throw error;

    const mapped = ((data ?? []) as Array<
      WeeklyPlanEntry & { recipes: { title: string; type: string } | null }
    >).map((row) => ({
      id: row.id,
      household_id: row.household_id,
      plan_date: row.plan_date,
      meal_slot: row.meal_slot,
      recipe_id: row.recipe_id,
      custom_text: row.custom_text,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
      recipe_title: row.recipes?.title ?? null,
      recipe_type: row.recipes?.type ?? null,
    }));

    this.planSignal.set(mapped);
    return mapped;
  }

  async upsertPlanSlot(payload: WeeklyPlanUpsert): Promise<void> {
    const { error } = await this.supabase.client.from('weekly_plan').upsert(
      {
        household_id: payload.household_id,
        plan_date: payload.plan_date,
        meal_slot: payload.meal_slot,
        recipe_id: payload.recipe_id ?? null,
        custom_text: payload.custom_text ?? null,
        updated_by: payload.updated_by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,plan_date,meal_slot' },
    );

    if (error) throw error;
  }

  async clearPlanSlot(planDate: string, mealSlot: MealSlot): Promise<void> {
    const householdId = this.householdSignal()?.id;
    if (!householdId) return;

    const { error } = await this.supabase.client
      .from('weekly_plan')
      .delete()
      .eq('household_id', householdId)
      .eq('plan_date', planDate)
      .eq('meal_slot', mealSlot);

    if (error) throw error;
  }

  subscribeWeeklyPlan(fromDate: string, toDate: string): void {
    const householdId = this.householdSignal()?.id;
    if (!householdId) return;

    void this.unsubscribeWeeklyPlan();

    this.planChannel = this.supabase
      .channel(`weekly_plan:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_plan',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void this.loadWeeklyPlan(fromDate, toDate);
        },
      )
      .subscribe();
  }

  async unsubscribeWeeklyPlan(): Promise<void> {
    if (!this.planChannel) return;
    await this.supabase.removeChannel(this.planChannel);
    this.planChannel = null;
  }

  clearLocalState(): void {
    void this.unsubscribeWeeklyPlan();
    this.householdSignal.set(null);
    this.membersSignal.set([]);
    this.planSignal.set([]);
  }
}
