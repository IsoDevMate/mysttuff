import React from "react";

const POLICIES = {
  terms: {
    title: "Terms of use",
    updated: "Draft prepared October 9, 2026",
    introduction: "Working draft for the mysttuff personal site. This is not legal advice and needs review before publication.",
    sections: [
      ["About this site", "mysttuff is a personal site for articles, visual galleries, short opinions, links, and camera moments called Instants. Some Instants are designed to disappear from the live feed after a selected time. Features and availability may change."],
      ["Using the site", "Use the site lawfully. Do not interfere with its operation, attempt to access private creator tools, or submit material that violates another person's rights. You are responsible for material you submit."],
      ["Public submissions", "Comments may appear publicly with the name you provide. The comment form also accepts an optional email address. Where visitor notes are enabled, submitted notes may be visible to other visitors. Do not include private information in public text."],
      ["Site material and external links", "Articles, photographs, and other material may be protected by intellectual-property laws. Ask the creator before reusing material unless a specific license says otherwise. External links lead to sites with their own content and practices."],
      ["Availability and moderation", "The creator may remove submissions, disable interactive features, or change the site to maintain it. This personal publishing project is provided as available."],
      ["Before publication", "Have a lawyer review this draft. Add the site operator's legal identity and contact method, and confirm governing law, venue, warranties, liability limits, and dispute terms for the relevant jurisdiction."]
    ]
  },
  privacy: {
    title: "Privacy notice",
    updated: "Draft prepared October 9, 2026",
    introduction: "Working draft based on features found in the repository. Confirm production providers, retention periods, and legal requirements before publication.",
    sections: [
      ["Information you provide", "The comment form collects a name and comment, with an optional email address. The waitlist form collects an email address and may accept a name. Comments are public. The optional comment email is stored with the comment but is excluded from public comment responses. Waitlist details are available to the site administrator."],
      ["Instants and reactions", "When enabled, Instants can store a browser-generated visitor identifier with reactions and visitor notes. The identifier is saved in browser local storage so interactions can be associated with that browser over time. It is not an account identity, but it is a persistent identifier."],
      ["Creator tools and drafts", "Signing in stores an authentication token in browser local storage. The article editor also stores recovery snapshots of drafts locally. On shared devices, sign out and clear local browser data when finished."],
      ["Media and technical records", "Uploaded article and gallery media are sent to the configured object-storage service. The backend application logger records request method, route, response status, and duration. Hosting, database, storage, and font providers may process additional technical data. The site owner must confirm the active production providers."],
      ["Fonts and external sites", "The public site requests fonts from Google Fonts. Following external links takes you to another site with its own privacy practices."],
      ["Use, retention, and choices", "Information supports comments, the waitlist, browser reactions, draft recovery, moderation, and site operation. The repository does not define a complete retention schedule or self-service deletion process. Before publishing, the site owner must state retention periods and provide a working way to request access or deletion."],
      ["Before publication", "Confirm the operator's legal identity and privacy contact, production hosting/database/storage providers, server-log and backup retention, waitlist deletion practice, and any analytics or cookies configured outside this repository. No analytics integration was found in the reviewed frontend code. Have a lawyer review this draft for the jurisdictions where visitors are served."]
    ]
  }
};

export default function LegalPage({ kind }) {
  const policy = POLICIES[kind] || POLICIES.terms;

  return (
    <article className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
      <header className="mb-10 border-b pb-8" style={{ borderColor: "var(--text-color, #292524)" + "20" }}>
        <p className="font-body text-xs uppercase tracking-[0.16em] opacity-55">Site information · draft for review</p>
        <h1 className="font-serif-display text-4xl sm:text-5xl font-semibold mt-3 mb-4">{policy.title}</h1>
        <p className="font-body text-sm opacity-55">{policy.updated}</p>
        <p className="font-body text-base leading-relaxed mt-6">{policy.introduction}</p>
      </header>
      <div className="space-y-8">
        {policy.sections.map(([heading, copy]) => (
          <section key={heading}>
            <h2 className="font-serif-display text-xl font-semibold mb-2">{heading}</h2>
            <p className="font-body text-base leading-7 opacity-80">{copy}</p>
          </section>
        ))}
      </div>
      <p className="mt-12 border-t pt-5 font-body text-sm leading-relaxed opacity-55" style={{ borderColor: "var(--text-color, #292524)" + "20" }}>
        Draft only. Not legal advice. Obtain qualified legal review before relying on this notice.
      </p>
    </article>
  );
}
