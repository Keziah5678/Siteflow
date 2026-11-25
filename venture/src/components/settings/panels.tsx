"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, LogOut, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar, Notice } from "@/components/ui/primitives";
import { becomeBusinessAction, savePrivacyAction, setAvatarAction } from "@/lib/actions/social";
import { signOutAction } from "@/lib/actions/auth";
import { uploadPublicImage } from "@/lib/upload";

export function AvatarUploader({ userId, name, src }: { userId: string; name: string; src: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const up = await uploadPublicImage("avatars", userId, file, 2 * 1048576);
    if (up.error) setErr(up.error);
    else {
      const r = await setAvatarAction(up.url!);
      if (r?.error) setErr(r.error);
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={src} size={64} />
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-[13px] hover:bg-card">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Changer la photo
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {src && <button type="button" className="ml-3 text-[13px] text-subtle hover:text-danger" onClick={async () => { await setAvatarAction(null); router.refresh(); }}>Retirer</button>}
        {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
        <p className="mt-1 text-[12px] text-subtle">PNG, JPEG ou WebP, 2 Mo max.</p>
      </div>
    </div>
  );
}

export function PrivacyPanel({ initial }: { initial: { visibility: "public" | "members"; is_discoverable: boolean; show_joined_projects: boolean; share_location: boolean; email_notifications: boolean } }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Checkbox checked={v.visibility === "public"} onChange={(e) => setV({ ...v, visibility: e.target.checked ? "public" : "members" })} label="Profil visible publiquement" description="Si désactivé, seuls les membres connectés de VENTURE peuvent voir ton profil." />
      <Checkbox checked={v.is_discoverable} onChange={(e) => setV({ ...v, is_discoverable: e.target.checked })} label="Apparaître dans les recommandations" description="Permet aux créateurs de projets de te découvrir via le matching." />
      <Checkbox checked={v.show_joined_projects} onChange={(e) => setV({ ...v, show_joined_projects: e.target.checked })} label="Afficher les projets que j'ai rejoints" />
      <Checkbox checked={v.share_location} onChange={(e) => setV({ ...v, share_location: e.target.checked })} label="Utiliser ma ville pour « À proximité »" description="Position approximative (centre de ta ville), jamais affichée." />
      <Checkbox checked={v.email_notifications} onChange={(e) => setV({ ...v, email_notifications: e.target.checked })} label="Recevoir des emails de notification" description="Préférence enregistrée ; l'envoi d'emails transactionnels nécessite la configuration d'un serveur SMTP." />
      {msg && <Notice tone={msg.ok ? "success" : "danger"}>{msg.text}</Notice>}
      <Button disabled={pending} onClick={() => start(async () => { const r = await savePrivacyAction(v); setMsg(r?.error ? { ok: false, text: r.error } : { ok: true, text: r?.message ?? "Enregistré." }); })}>Enregistrer</Button>
    </div>
  );
}

export function BusinessPanel({ isBusiness, company }: { isBusiness: boolean; company: string | null }) {
  const [state, action] = useActionState(becomeBusinessAction, null);
  if (isBusiness || state?.ok) return <Notice tone="success" title="Compte professionnel actif">{company ?? ""} — accède à l'espace pro depuis le menu.</Notice>;
  return (
    <form action={action} className="space-y-3">
      <p className="text-[13px] text-muted">Les comptes professionnels peuvent découvrir les besoins de la communauté, publier des opportunités (offre Business) et soutenir des projets.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom de l'entreprise" htmlFor="company"><Input id="company" name="company" required minLength={2} maxLength={80} /></Field>
        <Field label="Site web (facultatif)" htmlFor="website"><Input id="website" name="website" type="url" placeholder="https://" /></Field>
      </div>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton variant="secondary">Activer le compte pro</SubmitButton>
    </form>
  );
}

export function DataPanel() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (res.ok) window.location.replace("/login?deleted=1");
    else {
      setErr((await res.json().catch(() => ({}))).error ?? "Suppression impossible.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <a href="/api/account/export" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-card-hover"><Download className="size-4" /> Exporter mes données (JSON)</a>
        <form action={signOutAction}><Button type="submit" variant="ghost"><LogOut /> Se déconnecter</Button></form>
      </div>
      <div className="rounded-2xl border border-danger/30 p-4">
        <p className="text-sm font-medium">Supprimer mon compte</p>
        <p className="mt-1 text-[13px] text-muted">Supprime définitivement ton compte, ton profil, tes projets créés, tes messages et tes fichiers. Action irréversible.</p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setOpen(true)}><Trash2 /> Supprimer mon compte</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Supprimer définitivement ton compte ?" description="Tape SUPPRIMER MON COMPTE pour confirmer.">
        <div className="space-y-4">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmation" />
          {err && <Notice tone="danger">{err}</Notice>}
          <Button variant="danger" className="w-full" disabled={confirm !== "SUPPRIMER MON COMPTE" || busy} onClick={del}>{busy && <Loader2 className="animate-spin" />} Supprimer</Button>
        </div>
      </Dialog>
    </div>
  );
}
