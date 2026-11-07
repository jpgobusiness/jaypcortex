import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import UsuariosClient from "./usuarios-client";

export default async function UsuariosPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/atividades");
  return <UsuariosClient email={profile.email} />;
}
