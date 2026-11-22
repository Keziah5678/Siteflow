"use client";
import { LocalRepository } from "./local";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let repo: Repository | null = null;

/** Hosted mode when Supabase is configured, otherwise the local (in-browser) mode. */
export function getRepository(): Repository {
  if (!repo) repo = SUPABASE_URL && SUPABASE_KEY ? new SupabaseRepository(SUPABASE_URL, SUPABASE_KEY) : new LocalRepository();
  return repo;
}

export * from "./repository";
