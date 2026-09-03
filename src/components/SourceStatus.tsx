import type { EventInventoryState } from "../domain/types";

const countLabel = (value: number, noun: string) => `${value} ${noun}`;

export function SourceStatus({ inventory }: { inventory: EventInventoryState }) {
  return (
    <details className="source-status">
      <summary>Event sources</summary>
      <div className="source-status__list">
        {inventory.sources.map((source) => (
          <article key={source.sourceId}>
            <div>
              <strong>{source.publisher}</strong>
              <span className={`source-status__badge is-${source.status}`}>{source.status}</span>
            </div>
            <p>
              {[
                countLabel(source.acceptedCount, "accepted"),
                countLabel(source.retainedCount, "retained"),
                countLabel(source.rejectedCount, "rejected"),
                countLabel(source.expiredCount, "expired"),
              ].join(" · ")}
            </p>
            {source.candidateCount !== undefined ? (
              <p>
                {[
                  countLabel(source.candidateCount, "candidates"),
                  countLabel(source.marginalUniqueCount ?? source.acceptedCount, "unique after dedupe"),
                  countLabel(source.uniqueVenueCount ?? 0, "venues"),
                  countLabel(source.todayCount ?? 0, "today"),
                  countLabel(source.tonightCount ?? 0, "tonight"),
                  countLabel(source.next24HoursCount ?? 0, "next 24h"),
                ].join(" · ")}
              </p>
            ) : null}
            {source.rejectionReasons && Object.keys(source.rejectionReasons).length ? (
              <small>{Object.entries(source.rejectionReasons).map(([reason, count]) => `${reason}: ${count}`).join(" · ")}</small>
            ) : null}
            {source.message ? <small>{source.message}</small> : null}
            <time dateTime={source.attemptedAt}>Attempted {new Date(source.attemptedAt).toLocaleString()}</time>
            {source.lastSuccessfulRefresh ? <time dateTime={source.lastSuccessfulRefresh}>Last success {new Date(source.lastSuccessfulRefresh).toLocaleString()}</time> : null}
          </article>
        ))}
      </div>
    </details>
  );
}
