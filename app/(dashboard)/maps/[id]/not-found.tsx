import { LinkButton } from "@/components/ui/link-button";

export default function MapNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        That map isn&apos;t here
      </h1>
      <p className="text-sm text-muted">
        It may have been deleted, or the link may be wrong.
      </p>
      <LinkButton href="/maps">Back to maps</LinkButton>
    </div>
  );
}
