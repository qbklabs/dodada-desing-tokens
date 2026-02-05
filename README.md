# Dodada Design System — Design Tokens

Design System multiplataforma (iOS, Android, KMP, Web) basado en Design Tokens (W3C). Fuente de verdad en JSON; listo para transformación a código nativo.

**Versión**: 1.1.0 · **Estado**: Producción

---

## Uso como Git Submodule

Este repositorio está pensado para usarse como **submódulo** en apps iOS, Android, Web o monorepos, de modo que los tokens y assets sean la única fuente de verdad compartida.

### Añadir el submodule

Desde la raíz del proyecto que consumirá los tokens:

```bash
git submodule add <URL_DEL_REPO> dodada-tokens
git submodule update --init --recursive
```

Sustituye `<URL_DEL_REPO>` por la URL del repo (HTTPS o SSH), por ejemplo:  
`https://github.com/tu-org/dodada-tokens.git`

### Rutas típicas tras clonar

Tras `git clone` o `git submodule update` tendrás:

- **Tokens (JSON)**: `dodada-tokens/tokens/` — core, semantic, themes.
- **Assets**: `dodada-tokens/assets/fonts/`, `dodada-tokens/assets/icons/`.

En tu app o pipeline de build:

- Lee los JSON desde `dodada-tokens/tokens/` (o copia/transforma desde ahí).
- Copia o referencia `dodada-tokens/assets/fonts/` e `dodada-tokens/assets/icons/` según la plataforma.

### Actualizar el submodule

```bash
cd dodada-tokens
git fetch origin
git checkout main
git pull origin main
cd ..
git add dodada-tokens
git commit -m "chore: update dodada-tokens submodule"
```

### Clonar un repo que ya usa el submodule

```bash
git clone --recurse-submodules <URL_DE_TU_PROYECTO>
# o, si ya clonaste sin submodules:
git submodule update --init --recursive
```

### Qué está en el repo (y qué no)

- **Incluido**: `tokens/`, `assets/`, `README.md`, `package.json`, `.gitignore`.
- **Ignorado** (ver `.gitignore`): `node_modules/`, `dist/`, `build/`, `.env`, archivos de IDE y OS. No se versionan artefactos generados ni dependencias.

---

## Estructura del repositorio

```
dodada-tokens/
├── README.md                 ← Esta documentación (única)
├── package.json
├── .gitignore
│
├── tokens/
│   ├── core/                 # Tokens primitivos
│   │   ├── color.json        # 7 paletas (primary, secondary, success, warning, error, info, neutral)
│   │   ├── spacing.json      # Escala 0, 2xs–5xl (2px–64px)
│   │   ├── radius.json       # none, xs–3xl, full
│   │   ├── sizing.json       # icon, button, input, touchTarget, container
│   │   ├── elevation.json    # level 0–4, blur, offset
│   │   ├── font.json         # Quicksand (family, weight, file)
│   │   ├── icons.json        # 126 iconos SVG por categoría
│   │   └── index.json        # Índice de tokens core
│   │
│   ├── semantic/             # Tokens semánticos (referencias a core)
│   │   ├── layout.json       # screen, section, grid, stack
│   │   ├── component.json   # button, card, input, chip, avatar, modal, etc.
│   │   └── typography.json   # Quicksand: 11 niveles × 3 variantes (33 estilos)
│   │
│   └── themes/
│       └── main.json         # Tema principal (light)
│
└── assets/
    ├── fonts/                # Quicksand: Light, Regular, Medium, SemiBold, Bold (.ttf)
    └── icons/                # 126 iconos .svg
```

---

## Jerarquía de tokens

```
Theme (main.json)     →  Semantic (layout, component, typography)  →  Core (color, spacing, radius, …)
     referencias {}              referencias {}                           valores primitivos
```

- **Core**: valores base (px, números, hex, nombres de assets).
- **Semantic**: significado de negocio; solo referencian core con `{token.path}`.
- **Theme**: capa de UI (surface, text, border, button, card, input, layout); referencian semantic y core.

**Ejemplo**: `theme.main.button.primary.padding.horizontal` → `{component.button.padding.horizontal.md}` → `{spacing.lg}` → `16px`.

---

## Core tokens

### Color (`tokens/core/color.json`)

**Paleta Primary (actual)**  
100 `#FEE0D2` · 200 `#FDBBA6` · 300 `#F98D78` · 400 `#F46256` · **500 `#ED2124`** · 600 `#CB182A` · 700 `#AA102D` · 800 `#890A2D` · 900 `#71062D`

**Otras paletas** (100–900 cada una): Secondary, Success, Warning, Error, Info.  
**Neutral**: 0–1000 (blanco a negro).

**Semánticos de color** (referencias): `color.text.*`, `color.surface.*`, `color.border.*`, `color.button.*` (primary, secondary, ghost, success, error), `color.feedback.*`.

### Spacing (`tokens/core/spacing.json`)

0, 2xs (2px), xs (4), sm (8), md (12), lg (16), xl (24), 2xl (32), 3xl (40), 4xl (48), 5xl (64).  
Uso: padding, margin, gap.

### Radius (`tokens/core/radius.json`)

none (0), xs (2), sm (4), md (8), lg (12), xl (16), 2xl (24), 3xl (32), full (9999).  
Uso: cards, buttons, inputs, avatars.

### Sizing (`tokens/core/sizing.json`)

- **icon**: xs (12px) → 2xl (64px)  
- **button.height**: sm (32), md (40), lg (48), xl (56)  
- **input.height**: sm (32), md (40), lg (48), xl (56)  
- **touchTarget**: min (44), comfortable (48), spacious (56)  
- **container**: xs (320) → 2xl (1536)

### Elevation (`tokens/core/elevation.json`)

- **level**: 0–4 (numérico)  
- **blur**: none, sm (4), md (8), lg (16), xl (24)  
- **offset.y**: sm (1), md (2), lg (4), xl (8)

### Font (`tokens/core/font.json`)

- **family**: primary `Quicksand`, system, monospace  
- **weight**: light (300), regular (400), medium (500), semibold (600), bold (700)  
- **file**: referencias a `Quicksand-*.ttf` en `assets/fonts/`

### Icons (`tokens/core/icons.json`)

**126 iconos** en 19 categorías: navigation, actions, arrows, chevrons, feedback, user, communication, location, time, restaurant, services, payment, social, content, business, trending, special, utility, legal.  
Cada token es un asset (nombre de archivo `.svg` en `assets/icons/`).

---

## Semantic tokens

### Layout (`tokens/semantic/layout.json`)

- **screen.padding**: horizontal, vertical; variantes compact, comfortable  
- **section.spacing**: sm, md, lg, xl  
- **section.gap**, **grid.gap**, **grid.columns** (mobile 4, tablet 8, desktop 12), **stack.spacing**

### Component (`tokens/semantic/component.json`)

Button (height, padding, radius, gap, minWidth), Card (padding, radius, gap, elevation), Input (height, padding, radius, gap), Chip, Avatar, Modal, Divider, List.item.

### Typography (`tokens/semantic/typography.json`)

- **fontFamily**, **fontWeight** (referencias a `tokens/core/font.json`)  
- **size**: xs (10px) → 7xl (48px)  
- **lineHeight**: tight (1.2), normal (1.5), relaxed (1.75), loose (2)  
- **letterSpacing**: tighter → widest  
- **text**: jerarquía Quicksand con 3 variantes por nivel:
  - **largeTitle** (40px), **title1** (32), **title2** (28), **title3** (24), **headline** (20), **body** (16), **callout** (14), **subheadline** (12), **footnote** (10), **caption1** (12), **caption2** (10)  
  - Cada uno: `regular`, `bold`, `boldUnderline` (fontFamily, fontSize, fontWeight, lineHeight, textDecoration donde aplica).

---

## Theme main (`tokens/themes/main.json`)

Agrupa tokens listos para UI:

- **surface**: background (screen, elevated, overlay), card (default, elevated, subtle), input (default, disabled, focus)  
- **text**: primary, secondary, tertiary, disabled, inverse, onPrimary, onSecondary, error, success, warning, info  
- **border**: default, subtle, strong, interactive, focus, error, success, warning  
- **button**: primary, secondary, ghost, success, error (background, text, border por estado)  
- **card**: default, elevated (background, padding, radius, elevation, border)  
- **input**: default, disabled (background, border, text, placeholder, height, padding, radius)  
- **layout**: screen (background, padding), section (spacing)

Todas las referencias de color apuntan a `tokens/core/color.json` (incluida la paleta primary actualizada).

---

## Convenciones

- **Nombres**: `{categoria}.{subcategoria}.{propiedad}.{variante}` (ej. `component.button.height.md`).  
- **Referencias**: siempre con `{path.del.token}`.  
- **Tipos**: `dimension`, `color`, `number`, `fontFamily`, `fontWeight`, `asset` según W3C Design Tokens.  
- **Mobile first**: unidades pensadas en dp/pt; touch targets mínimos 44px.

---

## Cómo generar los tokens

Los JSON de `tokens/` se convierten en código listo para cada plataforma con **Style Dictionary**. El script une todos los tokens, normaliza referencias y genera las salidas en `dist/`.

### Requisitos

- Node.js 18+
- Dependencias del proyecto: `npm install`

### Comandos

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Generar todas las salidas (CSS, SCSS, JS, iOS, Android)
npm run build
```

Equivalente: `npm run build:tokens`.

### Salidas generadas (`dist/`)

| Plataforma | Ruta | Archivo(s) | API de uso |
|------------|------|------------|------------|
| **iOS** | `dist/ios/` | `DodadaTokens.swift` | `DodadaSpacing.md.value` (CGFloat) |
| **Android** | `dist/android/` | `DodadaTokens.kt` | `DodadaSpacing.Md.value` (Dp) |
| **Web (TS)** | `dist/web/` | `tokens.ts` | `spacing.md`, `radius.lg` (iterable con `Object.values`) |
| **Web (CSS)** | `dist/css/` | `variables.css` | `var(--spacing-md)`, nombres de token preservados |

Cada categoría del JSON se emite como un tipo propio (Swift: `enum` + `CaseIterable` + extensión `value`; Kotlin: `enum class` + extensión `value: Dp` / `colorValue: Color`; Web: `const` por categoría + tipos). El paso intermedio `build/tokens.resolved.json` se crea automáticamente (está en `.gitignore`).

### Limpiar artefactos

```bash
npm run clean
```

Borra las carpetas `build/` y `dist/`.

### Deploy a rutas de proyectos

Para copiar automáticamente `dist/` a las carpetas de tus apps (iOS, Android, Web):

1. **Configurar rutas**  
   Copia el ejemplo y edita las rutas (absolutas o relativas al repo de tokens):

   ```bash
   cp deploy-paths.example.json deploy-paths.json
   ```

   Ejemplo de `deploy-paths.json`:

   ```json
   {
     "paths": {
       "ios": "../mi-app-ios/DesignSystem/Tokens",
       "android": "../mi-app-android/app/src/main/java/com/dodada/app/design/tokens",
       "web": "../mi-app-web/src/tokens",
       "css": "../mi-app-web/public/css"
     }
   }
   ```

   El archivo `deploy-paths.json` está en `.gitignore`; cada desarrollador puede tener sus propias rutas.

2. **Comandos**

   ```bash
   # Solo copiar dist/ a las rutas configuradas (dist/ debe existir; ejecutar build antes si hace falta)
   npm run deploy

   # Generar tokens y luego copiar a las rutas (build + deploy en un paso)
   npm run build:deploy
   ```

   **Variables de entorno** (opcional): puedes sobreescribir rutas con  
   `DODADA_DEPLOY_IOS`, `DODADA_DEPLOY_ANDROID`, `DODADA_DEPLOY_WEB`, `DODADA_DEPLOY_CSS`.

### Uso en tu proyecto

- **iOS (SwiftUI)**: Añade `dist/ios/DodadaTokens.swift`. Uso: `DodadaSpacing.md.value` (CGFloat), `DodadaRadius.lg.value`, `DodadaColor.primary500.value` (String hex).
- **Android (Compose)**: Copia `dist/android/DodadaTokens.kt` al paquete `com.dodada.tokens`. Uso: `DodadaSpacing.Md.value` (Dp), `DodadaRadius.Lg.value`, `DodadaColor.Primary500.colorValue` (Color).
- **Web**: Importa `dist/web/tokens.ts` (`import { spacing, radius } from './tokens'` → `spacing.md`, `radius.lg`) y/o `dist/css/variables.css` (`var(--spacing-md)`).

Si usas este repo como **submodule**, ejecuta `npm run build` dentro del submodule y luego referencia los archivos de `dist/` desde tu app.

**Nota**: Los tokens de dimensión están en `px`. Para **Web** (CSS/SCSS/JS) se usan tal cual. Para **iOS/Android**, Style Dictionary aplica por defecto conversión desde rem; si quieres 1px = 1pt/1dp, puedes añadir transforms personalizados en `config/style-dictionary.config.mjs`.

---

## Transformación a plataformas

Los JSON se transforman con **Style Dictionary** a:

- **iOS**: Swift/SwiftUI (structs con valores en pt)  
- **Android**: Kotlin/Compose (objetos con `.dp`)  
- **Web**: CSS variables, SCSS, o módulo ES6  
- **KMP**: puedes tomar `DodadaTokens.kt` como módulo común

Misma jerarquía Core → Semantic → Theme; solo cambia el formato de salida.

---

## Dark mode y multi-brand

- **Dark**: añadir `tokens/core/color-dark.json` y `tokens/themes/dark.json` que referencien `{color-dark.*}`; core/semantic sin cambios.  
- **Multi-brand**: temas adicionales que referencian los mismos semantic tokens e inyectan otras paletas en core (ej. `color-brand-b.json`).

---

## Próximos pasos

1. Configurar **Style Dictionary** (o similar) para generar iOS, Android, Web.  
2. Opcional: tema dark y temas de marca.  
3. Validación de referencias `{}` y tipos.  
4. Integrar tokens generados en apps y documentar componentes (Storybook, etc.).

---

## Resumen de contenido actualizado

| Área           | Contenido |
|----------------|-----------|
| **Colores**    | 7 paletas; primary 100–900 con valores actuales (#FEE0D2 → #71062D, base #ED2124). |
| **Tipografía** | Quicksand en core + semantic; 11 niveles × 3 variantes = 33 estilos. |
| **Iconos**     | 126 SVG en `assets/icons/`; catálogo en `tokens/core/icons.json`. |
| **Fuentes**    | 5 pesos Quicksand en `assets/fonts/`; referenciados en `tokens/core/font.json`. |
| **Componentes**| Button, Card, Input, Chip, Avatar, Modal, Divider, List; especificaciones en semantic. |

Esta documentación es la única fuente de verdad del proyecto; reemplaza README anterior, ARCHITECTURE, COLOR_SYSTEM, TYPOGRAPHY_SYSTEM, ICONS_SYSTEM, QUICK_START, USAGE_EXAMPLES, PROJECT_SUMMARY, CHANGELOG y TREE.
