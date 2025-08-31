# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

MeetAI is a Next.js 15 application built with React 19, TypeScript, and a modern tech stack including Drizzle ORM with PostgreSQL, Better Auth for authentication, and shadcn/ui for components.

## Development Commands

### Core Development
```bash
# Start development server with Turbopack
bun dev

# Build for production
bun build

# Start production server
bun start

# Lint code
bun lint
```

### Database Operations
```bash
# Push schema changes to database
bun db:push

# Open Drizzle Studio (database GUI)
bun db:studio
```

### Component Management
```bash
# Add new shadcn/ui components
bunx --bun shadcn@latest add [component-name]

# Add all available components
bunx --bun shadcn@latest add --all
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (New York style)
- **Database**: PostgreSQL via Neon
- **ORM**: Drizzle ORM
- **Authentication**: Better Auth
- **Package Manager**: Bun
- **Form Handling**: React Hook Form + Zod validation

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes group
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   └── ui/                # shadcn/ui components
├── db/
│   ├── index.ts           # Database connection (Neon)
│   └── schema.ts          # Drizzle schema definitions
├── hooks/                 # Custom React hooks
└── lib/
    ├── auth.ts            # Better Auth server configuration
    ├── auth-client.ts     # Better Auth client configuration
    └── utils.ts           # Utility functions
```

### Database Schema
The application uses a standard authentication schema with:
- **user**: User profiles with email verification
- **session**: User sessions with device tracking
- **account**: OAuth provider accounts
- **verification**: Email/phone verification tokens

### Authentication System
Better Auth is configured with:
- **Social Providers**: GitHub and Google OAuth
- **Email/Password**: Traditional authentication
- **Database Adapter**: Drizzle adapter for PostgreSQL
- **Session Management**: Server-side sessions with device tracking

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string (Neon)
- `BETTER_AUTH_SECRET`: Authentication secret key
- `BETTER_AUTH_URL`: Application base URL
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: GitHub OAuth
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth

## Development Guidelines

### Database Changes
1. Modify `src/db/schema.ts` for schema changes
2. Run `bun db:push` to apply changes to database
3. Use `bun db:studio` to inspect database state

### Authentication Flow
- Server auth config in `src/lib/auth.ts`
- Client auth utilities in `src/lib/auth-client.ts`
- Auth routes are grouped under `(auth)` directory

### Component Development
- UI components follow shadcn/ui patterns
- Use Tailwind CSS for styling
- Components are fully typed with TypeScript
- Form validation uses React Hook Form + Zod

### Code Quality
- ESLint configuration follows Next.js recommended rules
- TypeScript strict mode enabled
- Path aliases configured (`@/*` maps to `src/*`)

## Important Context

This project references Better Auth documentation for authentication implementation. The Spanish comments in `.github/copilot-instructions.md` indicate Better Auth integration guidance, pointing to the official Better Auth llms.txt resource for AI assistants.
