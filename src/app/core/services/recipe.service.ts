import { Injectable, inject, signal } from '@angular/core';
import {
  Recipe,
  RecipeFilters,
  RecipeInsert,
  RecipeType,
  RecipeUpdate,
} from '../models/recipe.model';
import { compressImage, recipeImagePath } from '../utils/image-compressor.util';
import { HouseholdService } from './household.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly supabase = inject(SupabaseService);
  private readonly householdService = inject(HouseholdService);

  private readonly recipesSignal = signal<Recipe[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

  readonly recipes = this.recipesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  async list(filters: RecipeFilters = {}): Promise<Recipe[]> {
    const householdId = this.householdService.household()?.id;
    if (!householdId) {
      this.recipesSignal.set([]);
      return [];
    }

    this.loadingSignal.set(true);
    try {
      let query = this.supabase.client
        .from('recipes')
        .select(
          'id, household_id, created_by, title, type, prep_time_min, servings, tags, ingredients, notes, markdown_body, image_path, created_at, updated_at',
        )
        .eq('household_id', householdId)
        .order('title', { ascending: true });

      if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      if (filters.tags?.length) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters.query?.trim()) {
        // Prefer full-text when available; fallback to ilike on title.
        query = query.or(
          `title.ilike.%${filters.query.trim()}%,notes.ilike.%${filters.query.trim()}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const recipes = (data ?? []) as Recipe[];
      this.recipesSignal.set(recipes);
      return recipes;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async getById(id: string): Promise<Recipe | null> {
    const { data, error } = await this.supabase.client
      .from('recipes')
      .select(
        'id, household_id, created_by, title, type, prep_time_min, servings, tags, ingredients, notes, markdown_body, image_path, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data as Recipe | null) ?? null;
  }

  async create(input: Omit<RecipeInsert, 'household_id' | 'created_by'>): Promise<Recipe> {
    const user = this.supabase.user();
    const household = this.householdService.household();
    if (!user || !household) throw new Error('Sesión u hogar no disponibles.');

    const payload: RecipeInsert = {
      ...input,
      household_id: household.id,
      created_by: user.id,
      tags: input.tags ?? [],
      ingredients: input.ingredients ?? [],
    };

    const { data, error } = await this.supabase.client
      .from('recipes')
      .insert(payload)
      .select(
        'id, household_id, created_by, title, type, prep_time_min, servings, tags, ingredients, notes, markdown_body, image_path, created_at, updated_at',
      )
      .single();

    if (error) throw error;
    return data as Recipe;
  }

  async update(id: string, patch: RecipeUpdate): Promise<Recipe> {
    const { data, error } = await this.supabase.client
      .from('recipes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, household_id, created_by, title, type, prep_time_min, servings, tags, ingredients, notes, markdown_body, image_path, created_at, updated_at',
      )
      .single();

    if (error) throw error;
    return data as Recipe;
  }

  async remove(id: string): Promise<void> {
    const recipe = await this.getById(id);
    const { error } = await this.supabase.client.from('recipes').delete().eq('id', id);
    if (error) throw error;

    if (recipe?.image_path) {
      await this.supabase.client.storage.from('recipe-images').remove([recipe.image_path]);
      this.signedUrlCache.delete(recipe.image_path);
    }
  }

  async uploadImage(recipeId: string, file: File): Promise<string> {
    const household = this.householdService.household();
    if (!household) throw new Error('Hogar no disponible.');

    const path = recipeImagePath(household.id, recipeId);
    const compressed = await compressImage(file, {
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.82,
      mimeType: 'image/jpeg',
    });

    const { error: uploadError } = await this.supabase.client.storage
      .from('recipe-images')
      .upload(path, compressed, {
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    await this.update(recipeId, { image_path: path });
    this.signedUrlCache.delete(path);
    return path;
  }

  async getSignedImageUrl(imagePath: string | null | undefined): Promise<string | null> {
    if (!imagePath) return null;

    const cached = this.signedUrlCache.get(imagePath);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 60_000) {
      return cached.url;
    }

    const ttlSeconds = 60 * 60; // 1h
    const { data, error } = await this.supabase.client.storage
      .from('recipe-images')
      .createSignedUrl(imagePath, ttlSeconds);

    if (error) throw error;

    this.signedUrlCache.set(imagePath, {
      url: data.signedUrl,
      expiresAt: now + ttlSeconds * 1000,
    });

    return data.signedUrl;
  }

  async listTags(): Promise<string[]> {
    const recipes = this.recipesSignal().length
      ? this.recipesSignal()
      : await this.list({ type: 'all' });

    return [...new Set(recipes.flatMap((r) => r.tags ?? []))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  }

  emptyDraft(type: RecipeType = 'manual'): Omit<RecipeInsert, 'household_id' | 'created_by'> {
    return {
      title: '',
      type,
      prep_time_min: null,
      servings: null,
      tags: [],
      ingredients: [],
      notes: null,
      markdown_body: type === 'basica' ? null : '',
      image_path: null,
    };
  }
}
