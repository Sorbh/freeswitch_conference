import { PageShell, CONTACT_EMAIL } from "./site";

const UPDATED = "June 11, 2026";

const TEAM = [
  {
    name: "Luis E. Woolley",
    role: "Founder & CEO",
    exp: "35+ years",
    photo: "/team/luis.jpg",
    bio: "Economist and former World Bank consultant. Leads strategy, partnerships, and product direction.",
  },
  {
    name: "Adriano Fernandez de Soto",
    role: "Global Sales Manager",
    exp: "30+ years",
    photo: "/team/adriano.jpg",
    bio: "Industrial engineer specializing in the automotive and auto-parts industries. Drives growth through strategic sales.",
  },
  {
    name: "Saurabh K. Sharma",
    role: "Project Manager",
    exp: "16+ years",
    photo: "/team/saurabh.jpg",
    bio: "Mobile apps, server security, SIP networks, and AI — the engineering behind the hotline.",
  },
  {
    name: "Gaurav K. Sharma",
    role: "Development Manager",
    exp: "16+ years",
    photo: "/team/gaurav.jpg",
    bio: "CRM architecture, integration, business intelligence, and strategic SEO.",
  },
];

/* ------------------------------------------------------------------ */
/*  About                                                              */
/* ------------------------------------------------------------------ */

export function AboutPage() {
  return (
    <PageShell kicker="Company" title="About Hotline HQ">
      <p className="l2-doc-lead">
        Hotline HQ is an always-on voice network that connects salvage yards
        and auto recyclers so they can locate and sell used parts for each
        other's customers — in seconds, not hours.
      </p>

      <h2>Why we exist</h2>
      <p>
        No yard can stock every part for every vehicle. Every day, customers
        walk into a yard asking for a part that isn't on the shelf — and every
        "we don't have it" is a sale walking out the door. Meanwhile, the exact
        part is usually sitting in another yard within a few hundred miles.
      </p>
      <p>
        Databases go stale, phone trees eat an hour, and social media posts get
        buried. The fastest way to find a part has always been a person saying
        it out loud to people who can answer. Hotline HQ takes that simple idea
        — the regional hotline — and keeps it running 24/7 with modern
        equipment.
      </p>

      <h2>How it works</h2>
      <p>
        Every member yard gets a dedicated line into its regional room — a
        desk phone at the counter or a browser-based line on any computer. The
        line stays connected around the clock. When a yard needs a part, they
        pick up and say it once. Every yard in the region hears it live, and
        the yard that has the part answers back — typically in about two
        seconds. The two yards close the deal, and the customer gets the part.
      </p>

      <h2>Who it's for</h2>
      <p>
        Hotline HQ is a private membership network for auto recyclers,
        dismantlers, and salvage yards. We operate twelve regional rooms
        covering every major US market, with our strongest coverage across
        California, Arizona, Texas, and Florida. One membership covers one
        yard, with a flat monthly fee and no per-call charges.
      </p>

      <h2>The team</h2>
      <p>
        Hotline HQ is built and operated by the team at{" "}
        <a href="https://globalsolutionssoftware.com" target="_blank" rel="noreferrer">
          Global Solutions Software
        </a>
        , a software development and consultancy firm founded in 2011, with
        deep roots in the automotive and auto-parts world.
      </p>
      <div className="l2-team">
        {TEAM.map((m) => (
          <div className="l2-team-card" key={m.name}>
            <img src={m.photo} alt={m.name} loading="lazy" />
            <div className="l2-team-info">
              <p className="l2-team-name">{m.name}</p>
              <p className="l2-team-role">
                {m.role} · <span>{m.exp}</span>
              </p>
              <p className="l2-team-bio">{m.bio}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>Get in touch</h2>
      <p>
        Want a line in your yard, or have a question? Email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or request a
        line from the <a href="/landing_2#join">home page</a> — a human calls
        you back within one business day.
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Privacy Policy                                                     */
/* ------------------------------------------------------------------ */

export function PrivacyPage() {
  return (
    <PageShell kicker="Legal" title="Privacy Policy" updated={UPDATED}>
      <p className="l2-doc-lead">
        This policy explains what information Hotline HQ ("we", "us")
        collects, how we use it, and the choices you have. It applies to this
        website and to the Hotline HQ voice network service.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When a yard joins the network
          we collect business details such as the yard name, contact name,
          phone number, email address, business address, and region.
        </li>
        <li>
          <strong>Call recordings and logs.</strong> Broadcasts on the network
          are recorded, and we log call activity — including which yard
          broadcast a request, which yards responded, timestamps, and room
          activity. This is a core feature of the service, used for quality,
          accountability, and dispute resolution between members.
        </li>
        <li>
          <strong>Device and technical data.</strong> We collect technical
          information needed to keep your line connected, such as device
          identifiers, network addresses, and connection status of your desk
          phone or browser client.
        </li>
        <li>
          <strong>Website inquiries.</strong> If you submit the "request a
          line" form, we collect the details you provide so we can call you
          back.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To operate the voice network and keep member lines connected.</li>
        <li>To record and log broadcasts for quality and dispute resolution.</li>
        <li>To provide members with activity reporting, such as answer rates.</li>
        <li>To bill membership fees and manage accounts.</li>
        <li>To respond to inquiries and provide support.</li>
        <li>To monitor line health and alert our team when a line goes down.</li>
      </ul>

      <h2>Call recording notice</h2>
      <p>
        By joining a Hotline HQ room, members acknowledge and consent to the
        recording of broadcasts made in that room. Members are responsible for
        ensuring that the staff who use their line are aware that room audio is
        recorded.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. Information is shared only
        with service providers who help us operate the network (such as
        hosting and telephony infrastructure), within the network itself as
        part of normal operation (for example, other members in your room hear
        your broadcasts and can see which yard responded), and when required
        by law.
      </p>

      <h2>Retention</h2>
      <p>
        Call recordings and activity logs are retained for as long as needed
        for the purposes above, after which they may be deleted or anonymized.
        Account information is kept for the life of the membership and as
        required for tax and accounting purposes.
      </p>

      <h2>Your choices</h2>
      <p>
        You may request access to, correction of, or deletion of your account
        information by emailing{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Note that some
        records (such as recordings involving other members or billing
        records) may need to be retained where we have a legitimate or legal
        basis to do so.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The "last updated" date
        at the top reflects the most recent version. Continued use of the
        service after changes take effect constitutes acceptance of the
        updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Terms & Conditions                                                 */
/* ------------------------------------------------------------------ */

export function TermsPage() {
  return (
    <PageShell kicker="Legal" title="Terms &amp; Conditions" updated={UPDATED}>
      <p className="l2-doc-lead">
        These terms govern membership in the Hotline HQ network and use of
        this website. By joining the network or using the service, you agree
        to these terms on behalf of your business.
      </p>

      <h2>1. The service</h2>
      <p>
        Hotline HQ provides an always-on voice conferencing network that lets
        member yards broadcast part requests to other members in regional
        rooms and respond to requests from other members. The service includes
        the equipment or software client used to connect, call recording and
        logging, and line monitoring.
      </p>

      <h2>2. Membership</h2>
      <ul>
        <li>One membership covers one yard (one business location and line).</li>
        <li>
          Membership is billed as a flat monthly fee. Fees are due in advance
          and are non-refundable for partial months.
        </li>
        <li>
          You may cancel at any time; cancellation takes effect at the end of
          the current billing period.
        </li>
        <li>
          We may suspend or terminate a membership for non-payment, abuse of
          the network, or conduct that harms other members.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>
          The network is for legitimate parts-locating and related business
          communication between auto recyclers.
        </li>
        <li>
          No harassment, profanity directed at other members, spam broadcasts,
          or use of the network for unrelated solicitation.
        </li>
        <li>
          Members are responsible for everyone who uses their line, including
          counter staff.
        </li>
      </ul>

      <h2>4. Deals between members</h2>
      <p>
        Hotline HQ connects buyers and sellers; it is <strong>not a party to
        any transaction</strong> between members. Prices, part condition,
        payment, shipping, returns, and warranties are agreed directly between
        the yards involved. We do not guarantee that any part request will be
        answered, that quoted prices will be honored, or the condition of any
        part sold.
      </p>

      <h2>5. Equipment</h2>
      <p>
        Desk phones supplied by Hotline HQ remain our property unless
        otherwise agreed and must be returned on cancellation. You are
        responsible for providing power and an internet connection at your
        location.
      </p>

      <h2>6. Recordings</h2>
      <p>
        Broadcasts on the network are recorded and logged. Recordings are used
        for quality assurance and resolving disputes between members, as
        described in our <a href="/privacy-policy">Privacy Policy</a>.
      </p>

      <h2>7. Availability</h2>
      <p>
        We work to keep the network available around the clock and monitor
        member lines continuously, but the service is provided "as is" and we
        do not guarantee uninterrupted availability. Scheduled maintenance and
        events outside our control (such as internet or power outages at your
        location) may affect your line.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Hotline HQ is not liable for
        indirect, incidental, or consequential damages, including lost sales
        or lost profits, arising from use of the network. Our total liability
        for any claim is limited to the membership fees paid by your yard in
        the three months preceding the claim.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms from time to time. We will notify members of
        material changes, and continued use of the service after changes take
        effect constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Disclaimer                                                         */
/* ------------------------------------------------------------------ */

export function DisclaimerPage() {
  return (
    <PageShell kicker="Legal" title="Disclaimer" updated={UPDATED}>
      <p className="l2-doc-lead">
        Please read this disclaimer carefully before relying on anything on
        this website or the Hotline HQ network.
      </p>

      <h2>No guarantee of results</h2>
      <p>
        Figures shown on this website — including response times, answer
        rates, member counts, and example prices — describe typical network
        activity and simulated demonstrations. They are illustrative and not a
        guarantee. Whether a specific part request gets answered, how fast,
        and at what price depends entirely on which members are on the air and
        what they have in stock at that moment.
      </p>

      <h2>We are not a party to member deals</h2>
      <p>
        Hotline HQ is a communication network. Parts are bought and sold
        directly between member yards. We make no representations about the
        accuracy of any member's statements on the network, the condition,
        fitness, or legality of any part, or any member's ability to pay or
        deliver. Members deal with each other at their own discretion and
        risk.
      </p>

      <h2>Demonstrations on this site</h2>
      <p>
        The animations and the interactive "try a sell call" demo on this
        website are simulations for illustration. The cities, parts, prices,
        and replies they show are generated examples, not live network
        traffic.
      </p>

      <h2>Professional advice</h2>
      <p>
        Nothing on this website constitutes legal, financial, or professional
        advice. Yards are responsible for their own compliance with the laws
        and regulations that apply to their business, including those
        governing the sale of recycled auto parts.
      </p>

      <h2>Questions</h2>
      <p>
        If anything here is unclear, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> before relying
        on the service.
      </p>
    </PageShell>
  );
}
