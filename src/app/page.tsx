'use client';

import { useState } from 'react';

import { authClient } from '@/lib/auth-client'; //import the auth client

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2Icon } from 'lucide-react';

export default function Home() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data: session, isPending, error } = authClient.useSession();

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault(); // Prevenir el envío del formulario HTML

    const { data, error } = await authClient.signUp.email(
      { name, email, password },
      {
        onError: (err) => {
          console.error('Registration error:', err.error);
        },
        onSuccess: () => {
          window.alert('Registration successful!');
        },
      }
    );

    console.log(data);
    console.log(error);
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2Icon className="animate-spin h-5 w-5 text-gray-900" />
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-6">
        <h1 className="text-2xl font-bold">Welcome, {session.user?.name}!</h1>
        <Button onClick={() => authClient.signOut()}>Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <form className="flex flex-col space-y-4 mt-4 w-80" onSubmit={onSubmit}>
        <Input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit">Register</Button>
      </form>
    </div>
  );
}
