import { BRAND } from "@/lib/brand";

/**
 * The rows beside the Newsroom title: where a reader goes next. A row whose
 * value is empty (no support address in brand.json) is not drawn.
 */
export type NewsroomLink = {
  label: string;
  text: string;
  href: string;
  icon: "mail" | "book" | "tag";
};

export function newsroomLinks(): NewsroomLink[] {
  const email = BRAND.contact.supportEmail;

  const links: (NewsroomLink | null)[] = [
    email ? { label: "Questions", text: email, href: `mailto:${email}`, icon: "mail" } : null,
    { label: "Getting started", text: "Read the documentation", href: "/docs", icon: "book" },
    { label: "Plans", text: "See pricing", href: "/pricing", icon: "tag" },
  ];

  return links.filter((link): link is NewsroomLink => link !== null);
}
