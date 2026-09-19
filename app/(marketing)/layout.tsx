import { SiteFooter } from "@/components/brand/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// Annotated explicitly rather than with LayoutProps<"/">: route groups are
// stripped from the generated route literals, so both group layouts would claim
// the same key.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mk-site flex min-h-full flex-1 flex-col">
      {/* The header carries no rule and no ground of its own — see the
          component. It applies to the guides and the legal pages too, which is
          deliberate: one public site, one way in. */}
      <SiteHeader />

      <main className="flex flex-1 flex-col">{children}</main>

      <SiteFooter />
    </div>
  );
}
