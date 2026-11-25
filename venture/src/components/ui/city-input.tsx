"use client";
import { useId } from "react";
import { CITIES } from "@/lib/cities";
import { Input } from "./field";

/** Free text with suggestions from the built-in city list (no external geocoding). */
export function CityInput({ name, id, defaultValue, value, onChange, placeholder = "Ex. : Lyon" }: { name?: string; id?: string; defaultValue?: string | null; value?: string; onChange?: (v: string) => void; placeholder?: string }) {
  const listId = useId();
  return (
    <>
      <Input id={id} name={name} list={listId} defaultValue={value === undefined ? (defaultValue ?? "") : undefined} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} placeholder={placeholder} maxLength={80} autoComplete="off" />
      <datalist id={listId}>
        {CITIES.map((c) => (
          <option key={c.name} value={c.name}>
            {c.country}
          </option>
        ))}
      </datalist>
    </>
  );
}
