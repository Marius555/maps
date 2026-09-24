import { PropertyFold } from "@/components/ui/properties/property-fold";
import { PropertyFolds } from "@/components/ui/properties/property-folds";
import type { AccountSession } from "@/lib/auth/sessions";
import { SessionRow } from "./session-row";

/**
 * This device, then every other one behind a fold.
 *
 * **Folded because the list is the one thing on the page whose length depends
 * on data.** An account signed in on ten browsers drew ten rows and pushed
 * Delete account 300px down the moment the page arrived, and no skeleton could
 * know the count in advance. So the section is the same height for every
 * account, one row and one fold heading, and the rows only take room when
 * somebody opens the fold to look. Folds start shut (CLAUDE.md §8), through
 * `PropertyFolds` like every other fold in the app.
 *
 * Rendered with the page rather than fetched after it, and refreshed by
 * `router.refresh()` after a sign-out.
 */
export function SessionList({ sessions }: { sessions: AccountSession[] }) {
  const current = sessions.find((session) => session.current);
  const others = sessions.filter((session) => !session.current);

  return (
    <div className="divide-y divide-separator">
      {current ? (
        <div className="pb-3">
          <SessionRow session={current} />
        </div>
      ) : null}

      <div className="pt-1">
        {others.length > 0 ? (
          <PropertyFolds>
            <PropertyFold id="other-devices" title={`Other devices (${String(others.length)})`}>
              <div className="divide-y divide-separator pb-2">
                {others.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            </PropertyFold>
          </PropertyFolds>
        ) : (
          // The fold heading's own height, so an account with no other device
          // lays out exactly like one with twenty.
          <p className="flex h-10 items-center text-sm text-muted">
            No other devices are signed in.
          </p>
        )}
      </div>
    </div>
  );
}
