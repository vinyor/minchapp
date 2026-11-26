import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RecipeIngredient, RecipeType } from '../models/recipe.model';
import { compressRecipeImage } from '../utils/image-compressor.util';

export interface ParsedRecipeResponse {
  title: string;
  type: RecipeType;
  prep_time_min: number | null;
  servings: number | null;
  tags: string[];
  ingredients: RecipeIngredient[];
  notes: string | null;
  markdown_body: string | null;
}

const REQUEST_TIMEOUT_MS = 35_000;

@Injectable({ providedIn: 'root' })
export class AiRecipeService {
  private readonly http = inject(HttpClient);

  async parseFromText(text: string): Promise<ParsedRecipeResponse> {
    return firstValueFrom(
      this.http
        .post<ParsedRecipeResponse>('/api/parse-recipe', { text })
        .pipe(timeout({ first: REQUEST_TIMEOUT_MS })),
    );
  }

  async parseFromImage(file: File): Promise<ParsedRecipeResponse> {
    // Reutilizamos el compresor (1200px para que el texto de la foto se lea nítido)
    const compressedBlob = await compressRecipeImage(file, 1200, 0.85);
    const base64 = await this.blobToBase64(compressedBlob);

    return firstValueFrom(
      this.http
        .post<ParsedRecipeResponse>('/api/parse-recipe', {
          imageBase64: base64,
          mimeType: 'image/jpeg',
        })
        .pipe(timeout({ first: REQUEST_TIMEOUT_MS })),
    );
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Elimina el prefijo "data:image/jpeg;base64,"
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}