import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";

export default async function MyProfile() {
  const { profile } = await requireViewer("/profile");
  redirect(`/u/${profile.username}`);
}
