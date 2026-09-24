import { redirect } from "next/navigation";

/** `/settings` is the first section, under its own name so the nav can say so. */
export default function SettingsIndex() {
  redirect("/settings/general");
}
