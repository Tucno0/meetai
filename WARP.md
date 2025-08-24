# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository: meetai (Next.js 15, TypeScript, Tailwind CSS v4, shadcn/radix UI components)

- Package manager: No lockfile committed; use npm by default (or pnpm/yarn/bun if you prefer).
- App type: Next.js App Router (src/app)
- Styling: Tailwind CSS v4 (imported via CSS), custom CSS variables, dark mode via .dark class
- UI: shadcn-style components built on radix-ui with class-variance-authority and tailwind-merge

Common commands
- Install dependencies
  - npm install
- Develop (Turbopack dev server)
  - npm run dev
  - Default URL: http://localhost:3000
- Build
  - npm run build
- Start production server (after build)
  - npm run start
- Lint
  - Project lint: npm run lint
  - Lint a specific path (uses eslint flat config): npx eslint src/components/ui/button.tsx

Testing
- There is no test tooling configured in this repository (no jest/vitest/playwright config or scripts).

High-level architecture
- App Router structure (src/app)
  - src/app/layout.tsx
    - Applies global Geist fonts (next/font), loads global CSS, defines <html> and <body> wrapper.
  - src/app/page.tsx
    - Home route (/) with a simple Tailwind-styled component.
  - src/app/globals.css
    - Tailwind v4 imports (@import "tailwindcss").
    - Defines design tokens via CSS variables (oklch-based palette, radius, chart colors, sidebar vars) with a dark variant under .dark.
    - Uses @theme inline and @custom-variant for dark to drive Tailwind utilities.
- Components (src/components/ui)
  - A comprehensive set of shadcn-style primitives built on radix-ui (e.g., button, form, dialog, dropdown-menu, table, tabs, tooltip, etc.).
  - Patterns:
    - Styling via class-variance-authority (cva) to define variants and sizes.
    - Utilities composed using cn from src/lib/utils.ts (clsx + tailwind-merge) to merge classes safely.
    - Accessibility attributes and data-slot markers for consistent styling.
- Utilities
  - src/lib/utils.ts
    - Exposes cn(...classes) to compose Tailwind classes using clsx and tailwind-merge.
- Hooks
  - src/hooks/use-mobile.ts (mobile detection or related logic).
- Public assets
  - public/*.svg for icons/illustrations.

Configuration and conventions
- TypeScript (tsconfig.json)
  - Strict mode, bundler moduleResolution, JSX preserve.
  - Path alias: "@/*" -> "./src/*". Use absolute imports like "@/components/ui/button".
- Next config (next.config.ts)
  - Minimal placeholder, no special options enabled.
- ESLint (eslint.config.mjs)
  - Flat config via @eslint/eslintrc FlatCompat.
  - Extends next/core-web-vitals and next/typescript.
- Tailwind CSS v4
  - No tailwind.config.* file; configured via CSS using @import and @theme.
  - Theme tokens declared in globals.css power utility classes and variants.

Development notes specific to this repo
- Use the App Router conventions (layout.tsx, page.tsx, server/client components) under src/app.
- Theming and tokens are centralized in src/app/globals.css. Update CSS variables there when changing design system colors/radius.
- When adding UI elements, prefer existing components in src/components/ui. They are already wired to the design tokens and accessibility patterns.
- For linting beyond next lint, run eslint directly via npx eslint <path> to target specific files or directories.

