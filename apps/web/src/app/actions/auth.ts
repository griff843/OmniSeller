'use server';

import { signOutUser } from '@/lib/auth';

export async function logout() { await signOutUser(); }
