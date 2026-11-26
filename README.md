# MinchApp

PWA mobile-first para recetario compartido y planificador semanal del hogar (pareja / household), con sincronización en tiempo real vía Supabase.

## Stack

- Angular 20 (standalone, zoneless / signals-first)
- Tailwind CSS 4
- Supabase (Auth, Postgres, Storage, Realtime)
- `@angular/pwa` (instalable en móvil)
- `marked` + `dompurify` para instrucciones Markdown seguras

## Arranque

1. Copia tus credenciales de Supabase en:
   - `src/environments/environment.development.ts`
   - `src/environments/environment.ts`
2. Asegura `.dev.vars` en la raíz con `GEMINI_API_KEY=...` (ya está en `.gitignore`).
3. Instala y sirve **dos procesos**:

```bash
npm install
npm run start:api   # Cloudflare Pages Functions en :8788
npm start           # Angular en :4200 (proxy /api → :8788)
```

Abre `http://localhost:4200`. El importador IA llama a `/api/parse-recipe` vía proxy.

## Estructura

```text
src/app/
  core/       guards, models, services, utils
  features/   auth, onboarding, recipes, planner, settings
  shared/     bottom-nav, recipeMarkdown pipe
```

## Tipos de receta

| Tipo | Uso |
|------|-----|
| `basica` | Plato simple sin elaboración |
| `manual` | Pasos en Markdown |
| `thermomix` | Markdown + parámetros `[tiempo / temp / velocidad]` |

Imágenes privadas en bucket `recipe-images` con ruta `{household_id}/{recipe_id}.jpg`.
