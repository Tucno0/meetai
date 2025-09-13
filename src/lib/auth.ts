import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { polar, checkout, portal } from '@polar-sh/better-auth';

import { db } from '@/db'; // your drizzle instance
import * as schema from '@/db/schema'; // your drizzle schema
import { polarClient } from './polar';

export const auth = betterAuth({
  plugins: [
    polar({
      client: polarClient, // Instancia de Polar SDK
      createCustomerOnSignUp: true, // Crear cliente en Polar al registrarse un usuario
      use: [
        checkout({
          authenticatedUsersOnly: true, // Solo usuarios autenticados pueden acceder al checkout
          successUrl: '/upgrade', // URL de éxito después del checkout
        }),
        portal(), // Acceso al portal de suscripciones
      ],
    }),
  ],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: 'pg', // or "mysql", "sqlite"
    schema: {
      ...schema,
    },
  }),
});
