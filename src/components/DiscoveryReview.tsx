import { AlertTriangle, Check, ExternalLink, FileSearch, ShieldQuestion, X } from "lucide-react";
import { ModelessButton, SignalBadge } from "@modeless/design-system";
import type { DiscoveryLead } from "../domain/types";

type Props = { leads: DiscoveryLead[]; onAccept: (id: string) => void; onReject: (id: string) => void; onKeepCustom: (id: string) => void };
const leadName = (lead: DiscoveryLead) => lead.leadType === "event" ? lead.fields.title : lead.fields.name;

export function DiscoveryReview({ leads, onAccept, onReject, onKeepCustom }: Props) {
  if (!leads.length) return null;
  return <section id="discovery-review" className="discovery-review" aria-labelledby="discovery-review-title">
    <header><div><span className="discovery-review__eyebrow"><FileSearch size={14} /> Agent acquisition</span><h2 id="discovery-review-title">Discovery review</h2><p>Proposals stay outside canonical search until a human accepts a complete, validated record.</p></div><SignalBadge variant="warning">{leads.filter((lead) => !lead.reviewOutcome).length} awaiting review</SignalBadge></header>
    <div className="discovery-review__grid">{leads.map((lead) => {
      const reviewed = Boolean(lead.reviewOutcome);
      return <article key={lead.id} className={`discovery-lead ${reviewed ? "is-reviewed" : "is-provisional"}`}>
        <div className="discovery-lead__topline"><span>{lead.leadType === "event" ? "Event" : "Place"} lead</span><strong>{reviewed ? lead.reviewOutcome?.replaceAll("_", " ") : "Provisional · discovery only"}</strong></div>
        <h3>{leadName(lead) || "Unnamed proposal"}</h3>
        <p className="discovery-lead__source"><a href={lead.originalSourceUrl} target="_blank" rel="noreferrer">Original source <ExternalLink size={12} /></a><span>{lead.sourceType.replaceAll("_", " ")}</span></p>
        <dl className="discovery-lead__facts">{lead.leadType === "event" ? <><div><dt>When</dt><dd>{lead.fields.timing?.start ?? "Missing"}</dd></div><div><dt>Where</dt><dd>{lead.fields.venue?.name ?? "Missing"}{lead.fields.venue?.address ? ` · ${lead.fields.venue.address}` : ""}</dd></div><div><dt>Category</dt><dd>{lead.fields.category?.replaceAll("_", " ") ?? "Unclassified"}</dd></div></> : <><div><dt>Kind</dt><dd>{lead.fields.kind?.replaceAll("_", " ") ?? "Missing"}</dd></div><div><dt>Where</dt><dd>{lead.fields.location?.address ?? "Missing"}</dd></div><div><dt>Price</dt><dd>{lead.fields.priceRange?.min ?? "Unknown"} {lead.fields.priceRange?.currency ?? ""}</dd></div></>}</dl>
        {lead.missingRequiredFields.length ? <div className="discovery-lead__warning"><AlertTriangle size={14} /><span><strong>Missing required fields</strong>{lead.missingRequiredFields.join(", ")}</span></div> : null}
        {lead.possibleDuplicateMatches.length ? <div className="discovery-lead__warning"><ShieldQuestion size={14} /><span><strong>Possible duplicates</strong>{lead.possibleDuplicateMatches.map((item) => item.name).join(", ")}</span></div> : null}
        {lead.issues.length ? <p className="discovery-lead__issues">Validation: {lead.issues.map((issue) => issue.replaceAll("_", " ")).join(" · ")}</p> : <p className="discovery-lead__ready"><Check size={13} /> Canonical fields are ready for review</p>}
        <details><summary>Evidence references ({lead.evidence.length})</summary><ul>{lead.evidence.map((item, index) => <li key={`${item.field}-${index}`}><strong>{item.field}</strong>{item.note ? ` — ${item.note}` : ""}</li>)}</ul></details>
        {!reviewed ? <div className="discovery-lead__actions"><ModelessButton size="sm" onClick={() => onAccept(lead.id)}><Check size={14} /> Accept canonical</ModelessButton>{lead.leadType === "place" ? <ModelessButton size="sm" variant="outline" onClick={() => onKeepCustom(lead.id)}>Keep as custom</ModelessButton> : null}<button type="button" onClick={() => onReject(lead.id)}><X size={14} /> Reject</button></div> : null}
      </article>;
    })}</div>
  </section>;
}
