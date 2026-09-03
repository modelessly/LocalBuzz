import { AlertTriangle, Check, ExternalLink, ShieldQuestion, X } from "lucide-react";
import { ModelessButton } from "@modeless/design-system";
import type { DiscoveryLead } from "../domain/types";
import { formatDateTimeRange, formatDateTimeRangeAccessible, priceLabel } from "../lib/format";
import { discoveryLeadLink } from "../lib/timelineLinks";

type Props = { leads: DiscoveryLead[]; timeZone: string; onAccept: (id: string) => void; onReject: (id: string) => void; onKeepCustom: (id: string) => void };
const leadName = (lead: DiscoveryLead) => lead.leadType === "event" ? lead.fields.title : lead.fields.name;

export function DiscoveryReview({ leads, timeZone, onAccept, onReject, onKeepCustom }: Props) {
  const options = leads.filter((lead) => !lead.reviewOutcome);
  if (!options.length) return null;
  return <section id="discovery-review" className="discovery-review" aria-labelledby="discovery-review-title">
    <header><h2 id="discovery-review-title">Options</h2></header>
    <div className="discovery-review__grid">{options.map((lead) => {
      const link = discoveryLeadLink(lead);
      return <article key={lead.id} className="discovery-lead">
        <div className="discovery-lead__topline"><span>{lead.leadType === "event" ? "Event" : "Place"}</span></div>
        <h3>{leadName(lead) || "Unnamed proposal"}</h3>
        {lead.leadType === "event" && lead.fields.description ? <p>{lead.fields.description}</p> : null}
        {link ? <p className="discovery-lead__source"><a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.accessibleLabel}>{link.label} <ExternalLink aria-hidden="true" size={12} /></a></p> : null}
        <dl className="discovery-lead__facts">{lead.leadType === "event" ? <><div><dt>When</dt><dd>{lead.fields.timing?.start ? <time dateTime={lead.fields.timing.start} aria-label={formatDateTimeRangeAccessible(lead.fields.timing.start, lead.fields.timing.end, timeZone)}>{formatDateTimeRange(lead.fields.timing.start, lead.fields.timing.end, timeZone)}</time> : "Time to be confirmed"}</dd></div><div><dt>Where</dt><dd>{lead.fields.venue?.name ?? "Location to be confirmed"}{lead.fields.venue?.neighborhood ? ` · ${lead.fields.venue.neighborhood}` : lead.fields.venue?.address ? ` · ${lead.fields.venue.address}` : ""}</dd></div><div><dt>Category</dt><dd>{lead.fields.category?.replaceAll("_", " ") ?? "Other"}</dd></div>{lead.fields.commerce?.currency ? <div><dt>Price</dt><dd>{priceLabel(lead.fields.commerce.priceMin, lead.fields.commerce.currency)}</dd></div> : null}</> : <><div><dt>Kind</dt><dd>{lead.fields.kind?.replaceAll("_", " ") ?? "Place"}</dd></div><div><dt>Where</dt><dd>{lead.fields.location?.neighborhood ? `${lead.fields.location.neighborhood}${lead.fields.location.address ? ` · ${lead.fields.location.address}` : ""}` : lead.fields.location?.address ?? "Location to be confirmed"}</dd></div>{lead.fields.priceRange ? <div><dt>Price</dt><dd>{priceLabel(lead.fields.priceRange.min, lead.fields.priceRange.currency)}</dd></div> : null}</>}</dl>
        {lead.missingRequiredFields.length ? <div className="discovery-lead__warning"><AlertTriangle aria-hidden="true" size={14} /><span><strong>More details needed</strong>{lead.missingRequiredFields.map((field) => field.replaceAll(".", " ")).join(", ")}</span></div> : null}
        {lead.possibleDuplicateMatches.length ? <div className="discovery-lead__warning"><ShieldQuestion size={14} /><span><strong>Possible duplicates</strong>{lead.possibleDuplicateMatches.map((item) => item.name).join(", ")}</span></div> : null}
        <div className="discovery-lead__actions"><ModelessButton size="sm" onClick={() => onAccept(lead.id)}><Check aria-hidden="true" size={14} /> Add to {lead.leadType === "event" ? "events" : "places"}</ModelessButton>{lead.leadType === "place" ? <ModelessButton size="sm" variant="outline" onClick={() => onKeepCustom(lead.id)}>Add to Your Night</ModelessButton> : null}<button type="button" onClick={() => onReject(lead.id)}><X aria-hidden="true" size={14} /> Remove</button></div>
      </article>;
    })}</div>
  </section>;
}
