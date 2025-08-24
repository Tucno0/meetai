# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

**Start development server with Turbopack:**
```bash
bun dev
```
Default URL: http://localhost:3000

**Build for production:**
```bash
bun run build
```

**Start production server:**
```bash
bun start
```

**Linting:**
```bash
bun run lint
```

**Database operations:**
```bash
# Push schema changes to database
bun run db:push

# Open Drizzle Studio (database GUI)
bun run db:studio
```

## Architecture Overview

This is a modern Next.js 15 application using the App Router with a full-stack authentication system and PostgreSQL database.

### Key Technologies
- **Framework:** Next.js 15 with App Router and Turbopack
- **Runtime:** Bun as package manager and runtime
- **Styling:** Tailwind CSS v4 with shadcn/ui components
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Better Auth with email/password authentication
- **UI Components:** shadcn/ui (New York style) with Radix UI primitives
- **Icons:** Lucide React
- **Forms:** React Hook Form with Zod validation

### Project Structure
```
src/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx      # Root layout with Geist fonts
│   └── page.tsx        # Home page with auth form
├── components/ui/      # shadcn/ui component library
├── db/                 # Database layer
│   ├── index.ts        # Drizzle database connection (Neon)
│   └── schema.ts       # Database schema (users, sessions, accounts, verification)
├── hooks/              # Custom React hooks
└── lib/                # Utilities and configurations
    ├── auth.ts         # Better Auth server configuration
    ├── auth-client.ts  # Better Auth client configuration
    └── utils.ts        # Utility functions (tailwind-merge, clsx)
```

### Database Schema
The application uses Better Auth's standard schema with:
- **user**: Core user information (id, name, email, emailVerified, image, timestamps)
- **session**: User sessions with IP and user agent tracking
- **account**: OAuth and credential provider accounts
- **verification**: Email verification tokens

### Authentication Flow
- Better Auth handles email/password authentication
- Database adapter connects to PostgreSQL via Drizzle ORM
- Client-side authentication state managed with React hooks
- Session management with automatic token refresh

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string (Neon database)
- `BETTER_AUTH_SECRET`: Secret key for Better Auth
- `BETTER_AUTH_URL`: Base URL of the application (http://localhost:3000 for dev)

## Better Auth Integration

This project uses Better Auth for authentication. For comprehensive documentation, refer to: https://www.better-auth.com/llms.txt

The auth configuration enables:
- Email/password authentication
- PostgreSQL database adapter via Drizzle
- Automatic session management
- Built-in security features

## shadcn/ui Configuration

The project uses shadcn/ui with:
- **Style:** New York
- **Base color:** Neutral
- **CSS Variables:** Enabled
- **Icon library:** Lucide React
- **Path aliases:** Configured for @/components, @/lib, @/hooks, etc.

All shadcn/ui components are pre-installed and available in `src/components/ui/`.

## Development Notes

- Uses Bun for package management and development
- Turbopack enabled for faster development builds
- ESLint configured with Next.js core web vitals and TypeScript rules
- TypeScript configured with strict mode and path aliases
- Database operations use Drizzle ORM with PostgreSQL dialect
- All UI components follow shadcn/ui patterns and design system
