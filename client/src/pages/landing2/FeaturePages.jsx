import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";
import BlogLayout from "./BlogLayout";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";

/* ================================================================== */
/*  /find-used-auto-parts — buyer intent SEO page                      */
/*  Targets: "find used auto parts", "used car parts near me",         */
/*  "used auto parts online", "salvage auto parts"                     */
/* ================================================================== */

export function FindPartsPage() {
  const STEPS = [
    { n: "1", title: "Join the network", copy: "Sign up free and pick your regional room — California, Texas, Florida, or any of our 12 active markets." },
    { n: "2", title: "Broadcast what you need", copy: "Key up and describe the part: year, make, model, and what you're looking for. Your request goes out live to every yard in the room." },
    { n: "3", title: "Get answers in seconds", copy: "Yards that have your part respond immediately on the line. No hold music, no voicemail — just a direct answer." },
  ];

  const ADVANTAGES = [
    { title: "Faster than calling around", copy: "One broadcast reaches 100+ yards simultaneously. What used to take an hour of phone calls takes 10 seconds." },
    { title: "Fresher than inventory databases", copy: "Databases go stale. On Hotline HQ, you're asking real people who can walk the yard and check right now." },
    { title: "More reliable than Facebook groups", copy: "No scrolling through feeds. No waiting for someone to see your post. Live voice means live answers." },
    { title: "12 regional rooms", copy: "Find used auto parts in California, Texas, Florida, Arizona, Ohio, New York, Georgia, Indiana, Michigan, Carolinas, and more." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Find Used Auto Parts — Search 500+ Yards Instantly | Hotline HQ"
        description="Find used auto parts from 500+ dismantler yards in seconds. Broadcast what you need on the Hotline HQ voice network and get live answers — no databases, no waiting."
        keywords="find used auto parts, used auto parts near me, used car parts, salvage auto parts, junkyard parts, cheap used auto parts, auto parts search, dismantler parts"
        path="/find-used-auto-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Hotline HQ — Find Used Auto Parts",
              serviceType: "Used Auto Parts Search Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network connecting auto dismantlers. Broadcast what part you need and get answers from 500+ yards in seconds.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "What is an auto parts hotline?", acceptedAnswer: { "@type": "Answer", text: "An auto parts hotline is a live voice network that connects salvage yards and auto dismantlers. Instead of calling yards one by one, you broadcast what you need to every yard in your region simultaneously and get answers in seconds. Hotline HQ operates the largest voice-based parts network in the US with 500+ member yards across 12 regional rooms." } },
                { "@type": "Question", name: "How do I find a used auto part on Hotline HQ?", acceptedAnswer: { "@type": "Answer", text: "Sign up free and select your regional room — California, Texas, Florida, Arizona, or any of our 12 markets. Key up on your desk phone or web client and describe the part you need: year, make, model, and what you're looking for. Your request goes out live to every yard in the room. Yards that have your part respond immediately." } },
                { "@type": "Question", name: "How fast do yards respond?", acceptedAnswer: { "@type": "Answer", text: "The average response time on Hotline HQ is approximately 2 seconds. Because every yard in your regional room hears your request live, the first yard that has the part simply keys up and responds. No hold music, no voicemail, no waiting for someone to check a database." } },
                { "@type": "Question", name: "Is Hotline HQ free to use?", acceptedAnswer: { "@type": "Answer", text: "Joining the network is free. Hotline HQ charges a flat monthly membership fee with no per-call costs and no commissions on sales. A preconfigured desk phone is included with membership and shipped directly to your location." } },
                { "@type": "Question", name: "What parts can I find on Hotline HQ?", acceptedAnswer: { "@type": "Answer", text: "Any used auto part that dismantler yards carry. The most-requested parts on the network are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan, spanning model years from the 1990s through 2025." } },
                { "@type": "Question", name: "How is this different from online parts databases?", acceptedAnswer: { "@type": "Answer", text: "Online parts databases go stale — inventory changes daily. On Hotline HQ, you are asking real people who can walk the yard and check right now. One broadcast reaches 100+ yards simultaneously, replacing what used to take an hour of phone calls." } },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">FIND PARTS FASTER</p>
          <h1>Find used auto parts from <em>500+ yards</em> in seconds</h1>
          <p className="fp-hero-sub">
            Stop calling yard after yard. Broadcast what you need on Hotline HQ and every dismantler in your region hears it live.
            Average answer time: <strong>2 seconds</strong>.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Start Finding Parts — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">Browse Open Requests</Link>
          </div>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">HOW IT WORKS</p>
          <h2>Three steps to the part you need</h2>
        </div>
        <div className="fp-steps">
          {STEPS.map(s => (
            <div className="fp-step" key={s.n}>
              <span className="fp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">WHY HOTLINE HQ</p>
          <h2>The fastest way to find used auto parts</h2>
        </div>
        <div className="fp-advantages">
          {ADVANTAGES.map((a, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{a.title}</h3>
              <p>{a.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {[
            { q: "What is an auto parts hotline?", a: "An auto parts hotline is a live voice network that connects salvage yards and auto dismantlers. Instead of calling yards one by one, you broadcast what you need to every yard in your region simultaneously and get answers in seconds. Hotline HQ operates the largest voice-based parts network in the US with 500+ member yards across 12 regional rooms." },
            { q: "How do I find a used auto part on Hotline HQ?", a: "Sign up free and select your regional room — California, Texas, Florida, Arizona, or any of our 12 markets. Key up on your desk phone or web client and describe the part you need: year, make, model, and what you're looking for. Your request goes out live to every yard in the room. Yards that have your part respond immediately." },
            { q: "How fast do yards respond?", a: "The average response time on Hotline HQ is approximately 2 seconds. Because every yard in your regional room hears your request live, the first yard that has the part simply keys up and responds. No hold music, no voicemail, no waiting for someone to check a database." },
            { q: "Is Hotline HQ free to use?", a: "Joining the network is free. Hotline HQ charges a flat monthly membership fee with no per-call costs and no commissions on sales. A preconfigured desk phone is included with membership and shipped directly to your location." },
            { q: "What parts can I find on Hotline HQ?", a: "Any used auto part that dismantler yards carry. The most-requested parts on the network are bumpers, transmissions, fenders, motors, doors, headlights, and AC compressors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan, spanning model years from the 1990s through 2025." },
            { q: "How is this different from online parts databases?", a: "Online parts databases go stale — inventory changes daily. On Hotline HQ, you are asking real people who can walk the yard and check right now. One broadcast reaches 100+ yards simultaneously, replacing what used to take an hour of phone calls." },
          ].map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>READY TO FIND PARTS?</p>
          <h2>Join 500+ yards on the network</h2>
          <p>Free to join. No credit card. Start hearing live requests in under 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /sell-used-auto-parts — seller/dismantler intent SEO page          */
/*  Targets: "sell used auto parts", "auto parts buyer network",       */
/*  "dismantler sales channel", "how to sell salvage parts"            */
/* ================================================================== */

export function SellPartsPage() {
  const BENEFITS = [
    { title: "Hear every request live", copy: "When someone needs a part in your region, you hear it immediately — no notifications to check, no feeds to scroll." },
    { title: "Respond before anyone else", copy: "First to answer wins the sale. Average response time on the network is 2 seconds." },
    { title: "No listing fees or commissions", copy: "Flat monthly membership. Sell as many parts as you can — Hotline HQ never takes a cut." },
    { title: "Move inventory that sits", copy: "Parts you didn't even know someone wanted. The network surfaces demand you'd never find on your own." },
  ];

  const STATS = [
    { value: "500+", label: "Yards on network" },
    { value: "12", label: "Regional rooms" },
    { value: "~115", label: "Listeners per call" },
    { value: "24/7", label: "Always on" },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Sell Used Auto Parts — Reach 500+ Yards Instantly | Hotline HQ"
        description="Sell used auto parts faster on Hotline HQ. Hear live part requests from dismantlers in your region and respond in seconds. No listing fees, no commissions."
        keywords="sell used auto parts, auto parts buyer, dismantler network, sell salvage parts, auto parts sales channel, junkyard sales, sell car parts online"
        path="/sell-used-auto-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Hotline HQ — Sell Used Auto Parts",
              serviceType: "Used Auto Parts Sales Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for auto dismantlers to hear and respond to part requests in real-time. No listing fees or commissions.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "How do I sell used auto parts on Hotline HQ?", acceptedAnswer: { "@type": "Answer", text: "Join the network and select your regional room. When someone needs a part, you hear their request live through your desk phone or web client. If you have the part, you key up and respond. The requester contacts you directly to close the deal — no middleman, no commission." } },
                { "@type": "Question", name: "Do I need to list my inventory?", acceptedAnswer: { "@type": "Answer", text: "No. Hotline HQ is not an inventory database. You listen for requests and respond when you have what someone needs. This means you can sell parts you haven't cataloged yet — the network surfaces demand you'd never find on your own." } },
                { "@type": "Question", name: "How many part requests happen per day?", acceptedAnswer: { "@type": "Answer", text: "The California room alone has processed over 2,500 part requests. Active rooms see dozens of broadcasts per day covering everything from Honda Civic bumpers to Ford F-150 transmissions. The network operates 24/7." } },
                { "@type": "Question", name: "What does Hotline HQ cost for sellers?", acceptedAnswer: { "@type": "Answer", text: "Hotline HQ charges a flat monthly membership fee. There are no listing fees, no per-call charges, and no commissions on sales you make through the network. A preconfigured desk phone is included and shipped to your yard." } },
                { "@type": "Question", name: "What regions does Hotline HQ cover?", acceptedAnswer: { "@type": "Answer", text: "Hotline HQ operates 12 regional rooms covering California, Texas, Florida, Arizona, and other US markets. Each room connects the yards in that region. The California room is the largest with 200+ active yards." } },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">SELL PARTS FASTER</p>
          <h1>Sell used auto parts the moment <em>someone needs them</em></h1>
          <p className="fp-hero-sub">
            Stop waiting for customers to find you. On Hotline HQ, you hear every part request in your region the instant it's broadcast.
            If you have it, you answer. Sale made.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Join the Network — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">See What's Being Requested</Link>
          </div>

          <div className="fp-hero-stats">
            {STATS.map((s, i) => (
              <div className="fp-hero-stat" key={i}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">FOR DISMANTLERS & YARDS</p>
          <h2>Why yards sell more parts on Hotline HQ</h2>
        </div>
        <div className="fp-advantages">
          {BENEFITS.map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">PARTS MARKETPLACE</p>
          <h2>Can't be on the line 24/7?</h2>
          <p className="fp-lede">
            Unanswered requests land on the Hotline HQ Marketplace — an open board where anyone can respond.
            Browse what's needed right now and connect with the requester.
          </p>
        </div>
        <div style={{textAlign:'center', marginTop:'32px'}}>
          <Link to="/marketplace" className="fp-btn fp-btn-hot">Browse the Marketplace</Link>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {[
            { q: "How do I sell used auto parts on Hotline HQ?", a: "Join the network and select your regional room. When someone needs a part, you hear their request live through your desk phone or web client. If you have the part, you key up and respond. The requester contacts you directly to close the deal — no middleman, no commission." },
            { q: "Do I need to list my inventory?", a: "No. Hotline HQ is not an inventory database. You listen for requests and respond when you have what someone needs. This means you can sell parts you haven't cataloged yet — the network surfaces demand you'd never find on your own." },
            { q: "How many part requests happen per day?", a: "The California room alone has processed over 2,500 part requests. Active rooms see dozens of broadcasts per day covering everything from Honda Civic bumpers to Ford F-150 transmissions. The network operates 24/7." },
            { q: "What does Hotline HQ cost for sellers?", a: "Hotline HQ charges a flat monthly membership fee. There are no listing fees, no per-call charges, and no commissions on sales you make through the network. A preconfigured desk phone is included and shipped to your yard." },
            { q: "What regions does Hotline HQ cover?", a: "Hotline HQ operates 12 regional rooms covering California, Texas, Florida, Arizona, and other US markets. Each room connects the yards in that region. The California room is the largest with 200+ active yards." },
          ].map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>READY TO SELL MORE PARTS?</p>
          <h2>Get on the hotline</h2>
          <p>Free to join. No credit card. No commission on sales. Start hearing requests in under 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /used-auto-parts/:state — regional SEO pages                       */
/*  Targets: "used auto parts California", "used car parts Texas"      */
/* ================================================================== */

const REGION_DATA = {
  california: {
    name: "California", abbr: "CA", roomId: 123456701, active: true,
    content: {
      intro: "California's auto dismantler industry is one of the largest in the nation, with hundreds of licensed yards from San Diego to Sacramento. Hotline HQ's California room is the most active on the network — over 2,500 part requests broadcast and counting.",
      geography: "The CA room covers yards across the Central Valley, Greater Los Angeles, the Bay Area, Inland Empire, and San Diego County. Whether you're sourcing a transmission in Fresno or a bumper in Long Beach, every yard in the state hears your request live.",
      popular: "The most-requested makes on the California hotline are Ford, Toyota, and Honda, with bumpers, transmissions, and fenders leading part categories. High-demand vehicles include Honda Civic, Toyota Camry, Ford F-150, and Nissan Altima.",
    },
  },
  texas: {
    name: "Texas", abbr: "TX", roomId: 123456703, active: true,
    content: {
      intro: "Texas is home to a growing network of dismantler yards joining Hotline HQ. The Texas room connects yards across Dallas–Fort Worth, Houston, San Antonio, Austin, and the Gulf Coast — putting your part request in front of every TX yard simultaneously.",
      geography: "From East Texas salvage operations to the sprawling yards along I-35 and I-10, the Texas room covers the state's major auto recycling corridors. Yards in the DFW metroplex, Houston ship channel area, and South Texas border region are all on the line.",
      popular: "Texas yards see heavy demand for Ford and Chevrolet truck parts — F-150s, Silverados, and Ram pickups dominate requests. Transmissions, motors, and body panels are the top part categories across the state.",
    },
  },
  florida: {
    name: "Florida", abbr: "FL", roomId: 123456705, active: true,
    content: {
      intro: "Florida's auto dismantler network spans from Jacksonville to Miami, with a concentration of licensed yards in Central Florida and along the I-4 and I-95 corridors. The FL room connects you to yards across the Sunshine State instantly.",
      geography: "From the panhandle salvage yards near Pensacola to the South Florida recyclers in Miami-Dade and Broward, the Florida room covers the entire state. Tampa Bay, Orlando, and the Space Coast have significant yard clusters.",
      popular: "Florida requests trend toward Honda, Toyota, and Nissan passenger vehicles. Bumpers, headlights, and AC compressors are top part categories — AC components are especially in demand given Florida's year-round heat.",
    },
  },
  arizona: {
    name: "Arizona", abbr: "AZ", roomId: 123456712, active: true,
    content: {
      intro: "Arizona's dry climate makes it a prime market for used auto parts — vehicles here rust less, keeping parts in better condition longer. The AZ room is the second-most active on Hotline HQ with over 500 part requests broadcast.",
      geography: "The Arizona room connects yards across the Phoenix metro area, Tucson, Mesa, and the I-10 and I-17 corridors. Desert-stored inventory from Scottsdale to Yuma means cleaner parts and better selection for body panels, glass, and exterior components.",
      popular: "Arizona's most-requested makes include Toyota, Honda, and Ford. The dry climate drives strong demand for body panels, fenders, and doors that are typically rust-free — a major advantage over parts sourced from humid or salt-belt states.",
    },
  },
  ohio: { name: "Ohio", abbr: "OH", roomId: null, active: false },
  "new-york": { name: "New York", abbr: "NY", roomId: null, active: false },
  georgia: { name: "Georgia", abbr: "GA", roomId: 123456718, active: false },
  indiana: { name: "Indiana", abbr: "IN", roomId: null, active: false },
  michigan: { name: "Michigan", abbr: "MI", roomId: null, active: false },
  carolinas: { name: "Carolinas", abbr: "NC/SC", roomId: null, active: false },
  mexico: { name: "Mexico", abbr: "MX", roomId: 123456706, active: false },
  "new-jersey": { name: "New Jersey", abbr: "NJ", roomId: 123456704, active: false },
  "san-diego": { name: "San Diego", abbr: "SD", roomId: 123456711, active: false },
  iowa: { name: "Iowa", abbr: "IA", roomId: 123456716, active: false },
  kentucky: { name: "Kentucky", abbr: "KY", roomId: 123456717, active: false },
  alberta: { name: "Alberta", abbr: "AB", roomId: 123456714, active: false },
  canada: { name: "Canada", abbr: "CA", roomId: 123456715, active: false },
  egypt: { name: "Egypt", abbr: "EG", roomId: 123456707, active: false },
  spain: { name: "Spain", abbr: "ES", roomId: 123456708, active: false },
  ghana: { name: "Ghana", abbr: "GH", roomId: 123456709, active: false },
};

function makeSlug(row) {
  const parts = typeof row.part_details === 'object' ? row.part_details : JSON.parse(row.part_details || '{}');
  const isReal = v => v && v !== 'null' && String(v).trim() !== '';
  const segments = [parts.year, parts.make, parts.model, parts.part]
    .filter(isReal)
    .map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  segments.push(String(row.id));
  return segments.join('-');
}

function formatTimeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RegionalPartsPage({ state }) {
  const region = REGION_DATA[state];
  const [stats, setStats] = useState(null);
  const [recentListings, setRecentListings] = useState([]);

  useEffect(() => {
    if (!region?.roomId) return;
    fetch(`/api/v1/marketplace/room-stats/${region.roomId}`)
      .then(r => r.json())
      .then(json => { if (json.status) setStats(json.data || null); })
      .catch(() => {});
  }, [state, region?.roomId]);

  useEffect(() => {
    if (!region?.roomId) return;
    fetch(`/api/v1/marketplace/listings?page=1&pageSize=6&room=${region.roomId}`)
      .then(r => r.json())
      .then(json => { if (json.status) setRecentListings(json.data || []); })
      .catch(() => {});
  }, [state, region?.roomId]);

  if (!region) return null;

  const title = `Used Auto Parts in ${region.name} — ${region.abbr} Dismantler Network | Hotline HQ`;
  const description = `Find and sell used auto parts in ${region.name}. Hotline HQ connects ${region.name} dismantler yards on a live voice network — broadcast what you need and get answers in seconds.`;

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title={title}
        description={description}
        keywords={`used auto parts ${region.name}, ${region.abbr} auto parts, ${region.name} dismantler, junkyard parts ${region.name}, salvage auto parts ${region.abbr}, used car parts ${region.name}`}
        path={`/used-auto-parts/${state}`}
        {...(!region.active ? { robots: "noindex, follow" } : {})}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `Hotline HQ — Used Auto Parts in ${region.name}`,
          serviceType: "Used Auto Parts Network",
          provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
          areaServed: { "@type": "AdministrativeArea", name: region.name },
          description: description,
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">{region.abbr} NETWORK</p>
          <h1>Used auto parts in <em>{region.name}</em></h1>
          <p className="fp-hero-sub">
            Hotline HQ's {region.name} room connects dismantler yards across the state on a live voice hotline.
            Broadcast what you need — every yard in {region.name} hears it instantly.
          </p>
          <div className="fp-hero-ctas">
            <a href={`${SIGNUP_URL}?room=${encodeURIComponent(region.name)}`} className="fp-btn fp-btn-hot">
              Join {region.name} Room — Free
            </a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">Browse {region.name} Requests</Link>
          </div>

          {stats && (
            <div className="fp-stats-bar">
              {stats.yardCount != null && (
                <div className="fp-stat-item">
                  <div className="fp-stat-val">{stats.yardCount}</div>
                  <div className="fp-stat-label">Yards on network</div>
                </div>
              )}
              {stats.totalBroadcasts != null && (
                <div className="fp-stat-item">
                  <div className="fp-stat-val">{stats.totalBroadcasts.toLocaleString()}</div>
                  <div className="fp-stat-label">Total broadcasts</div>
                </div>
              )}
              {stats.activeBroadcasts != null && (
                <div className="fp-stat-item">
                  <div className="fp-stat-val">{stats.activeBroadcasts}</div>
                  <div className="fp-stat-label">Active this week</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {region.active && region.content && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">{region.abbr} DISMANTLER NETWORK</p>
            <h2>Used Auto Parts in {region.name} — How It Works</h2>
          </div>
          <div className="fp-content-text">
            <p>{region.content.intro}</p>
            <h3>{region.name} Coverage Area</h3>
            <p>{region.content.geography}</p>
            <h3>Most-Requested Parts in {region.abbr}</h3>
            <p>{region.content.popular}</p>
          </div>
        </section>
      )}

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">HOW IT WORKS IN {region.abbr}</p>
          <h2>Find or sell parts in {region.name}</h2>
          <p className="fp-lede">
            Whether you're looking for a part or sitting on inventory someone else needs — the {region.name} room
            puts you in direct voice contact with every dismantler in the state.
          </p>
        </div>
        <div className="fp-steps">
          <div className="fp-step">
            <span className="fp-step-n">1</span>
            <h3>Join the {region.name} room</h3>
            <p>Sign up and select {region.name} as your region. You'll be connected to the live hotline immediately.</p>
          </div>
          <div className="fp-step">
            <span className="fp-step-n">2</span>
            <h3>Hear and make requests</h3>
            <p>Every part request from {region.name} yards comes through your phone. Need something? Broadcast it yourself.</p>
          </div>
          <div className="fp-step">
            <span className="fp-step-n">3</span>
            <h3>Close the deal</h3>
            <p>First to respond wins. No middleman, no commission — just a direct connection between buyer and seller.</p>
          </div>
        </div>
      </section>

      {region.roomId && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">RECENT REQUESTS</p>
            <h2>Recent Part Requests in {region.name}</h2>
          </div>
          {recentListings.length > 0 ? (
            <div className="fp-listings">
              {recentListings.map(item => {
                const pd = typeof item.part_details === 'object' ? item.part_details : JSON.parse(item.part_details || '{}');
                const isReal = v => v && v !== 'null' && String(v).trim() !== '';
                return (
                  <Link to={`/parts/${makeSlug(item)}`} className="fp-listing-card" key={item.id}>
                    {isReal(pd.year) && <span className="fp-listing-year">{pd.year}</span>}
                    <span className="fp-listing-vehicle">
                      {[pd.make, pd.model].filter(isReal).join(' ') || 'Vehicle'}
                    </span>
                    {isReal(pd.part) && <span className="fp-listing-part">{pd.part}</span>}
                    <span className="fp-listing-meta">{formatTimeAgo(item.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="fp-no-listings">
              No active requests right now — join to be first to hear new ones.
            </div>
          )}
        </section>
      )}

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">ALL REGIONS</p>
          <h2>Hotline HQ active regions</h2>
        </div>
        <div className="fp-regions">
          {Object.entries(REGION_DATA).filter(([, r]) => r.active).map(([slug, r]) => (
            <Link
              to={`/used-auto-parts/${slug}`}
              className={`fp-region ${slug === state ? 'fp-region--active' : ''}`}
              key={slug}
            >
              <span className="fp-region-abbr">{r.abbr}</span>
              <span className="fp-region-name">{r.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>JOIN THE {region.abbr} ROOM</p>
          <h2>Start finding parts in {region.name} today</h2>
          <p>Free to join. No credit card. Hear every part request in {region.name} the moment it's broadcast.</p>
          <a href={`${SIGNUP_URL}?room=${encodeURIComponent(region.name)}`} className="fp-btn fp-btn-hot">Sign Up Free</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /how-auto-parts-hotlines-work — pillar content for AI citations     */
/*  Targets: "how auto parts hotlines work", "salvage yard network",   */
/*  "used auto parts network", "voice hotline", "parts locating"       */
/* ================================================================== */

export function HowItWorksPage() {
  return (
    <BlogLayout
      breadcrumbs={[
        { label: "Home", to: "/" },
        { label: "Blog", to: "/blog" },
        { label: "Industry Guides", to: "/blog/guides" },
        { label: "How Auto Parts Hotlines Work" },
      ]}
      kicker="INDUSTRY GUIDE"
      title="How auto parts hotlines work"
      description="A complete guide to voice-based parts networks — how salvage yards find and sell used auto parts faster than phone calls, databases, or online marketplaces."
      date="2026-07-09"
      readTime="8 min read"
      author={{ name: "Hotline HQ Team", role: "The team behind the largest voice parts network in the US" }}
      toc={[
        { id: "what-is", label: "What is an auto parts hotline?" },
        { id: "how-it-works", label: "How the voice network works" },
        { id: "comparison", label: "Voice hotlines vs alternatives" },
        { id: "effective", label: "What makes a hotline effective" },
        { id: "who-uses", label: "Who uses auto parts hotlines" },
        { id: "coverage", label: "Network coverage" },
        { id: "get-started", label: "How to get started" },
      ]}
      seoProps={{
        title: "How Auto Parts Hotlines Work — Voice Networks for Salvage Yards | Hotline HQ",
        description: "Learn how auto parts hotlines connect salvage yards on live voice networks. Compare voice hotlines vs phone calls, databases, and online marketplaces for finding used auto parts.",
        keywords: "auto parts hotline, how parts hotlines work, salvage yard network, used auto parts network, voice hotline, parts locating service, dismantler network",
        path: "/blog/guides/how-auto-parts-hotlines-work",
        jsonLd: {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: "How Auto Parts Hotlines Work — A Complete Guide",
              description: "Learn how auto parts hotlines connect salvage yards on live voice networks for instant parts locating.",
              url: buildSiteUrl("/blog/guides/how-auto-parts-hotlines-work"),
              publisher: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              datePublished: "2026-07-09",
              dateModified: "2026-07-09",
              mainEntityOfPage: buildSiteUrl("/blog/guides/how-auto-parts-hotlines-work"),
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "What is an auto parts hotline?", acceptedAnswer: { "@type": "Answer", text: "An auto parts hotline is a live voice network that connects salvage yards and auto dismantlers. Members join an always-on conference room for their region. When someone needs a part, they broadcast the request — every yard in the room hears it live and responds in seconds if they have it." } },
                { "@type": "Question", name: "How is a voice hotline different from calling yards?", acceptedAnswer: { "@type": "Answer", text: "Calling yards one by one, a dismantler might spend an hour reaching 10-15 yards. On a voice hotline, one broadcast reaches 100+ yards simultaneously. The first yard with the part responds in about 2 seconds. It replaces serial phone calls with parallel live communication." } },
                { "@type": "Question", name: "How much does a parts hotline cost?", acceptedAnswer: { "@type": "Answer", text: "Hotline HQ charges a flat monthly membership fee. There are no per-call charges, no listing fees, and no commissions on sales made through the network. A preconfigured desk phone is included with membership." } },
              ]
            }
          ]
        },
      }}
    >
        <section id="what-is">
          <h2>What is an auto parts hotline?</h2>
          <p>
            An auto parts hotline is a live voice network that connects auto dismantler and salvage yards in the same region.
            Members join an always-on conference room through a desk phone or web client. When a yard needs a specific part — say
            a 2019 Honda Civic front bumper — they key up and describe what they need. Every other yard in the room hears the
            request instantly and responds if they have it in stock.
          </p>
          <p>
            The concept dates back to the 1990s when yards used radio networks and phone trees to locate parts for each other.
            Modern hotlines replaced unreliable radio with internet-connected SIP phones that deliver clear audio over dedicated
            conference bridges. The always-on model means yards do not need to call anyone — they just listen. When a request
            matches something in their inventory, they answer.
          </p>
          <p>
            Hotline HQ operates the largest voice-based parts hotline in the United States, connecting over 500 dismantler yards
            across 12 regional rooms. The average response time on the network is approximately 2 seconds.
          </p>
        </section>

        <section id="how-it-works">
          <h2>How the voice network works</h2>
          <p>
            The mechanics are straightforward. A yard joins a regional room — California, Texas, Florida, Arizona, or one of
            eight other markets. Their desk phone connects to a conference bridge that runs 24 hours a day, 7 days a week.
            When a dismantler needs a part, the process takes three steps:
          </p>

          {/* Inline SVG diagram */}
          <div className="bl-diagram">
            <svg viewBox="0 0 760 220" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="How a parts broadcast works: one request reaches all yards in the room simultaneously">
              {/* Step 1: Broadcaster */}
              <rect x="10" y="60" width="160" height="100" rx="12" fill="var(--surface, #fff)" stroke="var(--red, #d92d20)" strokeWidth="2"/>
              <text x="90" y="90" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="0.08em" fill="var(--red, #d92d20)">STEP 1</text>
              <text x="90" y="112" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink, #16181d)">Yard broadcasts</text>
              <text x="90" y="130" textAnchor="middle" fontSize="11" fill="var(--muted, #71717a)">"Need a 2019 Civic</text>
              <text x="90" y="144" textAnchor="middle" fontSize="11" fill="var(--muted, #71717a)">front bumper"</text>

              {/* Arrow */}
              <line x1="175" y1="110" x2="280" y2="110" stroke="var(--red, #d92d20)" strokeWidth="2" strokeDasharray="6,4"/>
              <polygon points="278,104 290,110 278,116" fill="var(--red, #d92d20)"/>

              {/* Step 2: Conference bridge */}
              <rect x="290" y="40" width="180" height="140" rx="12" fill="var(--surface, #fff)" stroke="var(--line, #e7e4dd)" strokeWidth="2"/>
              <text x="380" y="70" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="0.08em" fill="var(--red, #d92d20)">STEP 2</text>
              <text x="380" y="92" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink, #16181d)">Conference bridge</text>
              <text x="380" y="112" textAnchor="middle" fontSize="11" fill="var(--muted, #71717a)">Broadcasts to every</text>
              <text x="380" y="126" textAnchor="middle" fontSize="11" fill="var(--muted, #71717a)">yard in the room</text>
              <text x="380" y="150" textAnchor="middle" fontSize="20" fill="var(--red, #d92d20)">&#128225;</text>
              <text x="380" y="170" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--muted, #71717a)">~100+ YARDS HEAR IT</text>

              {/* Arrows to yards */}
              <line x1="475" y1="80" x2="570" y2="50" stroke="var(--line, #e7e4dd)" strokeWidth="1.5"/>
              <line x1="475" y1="110" x2="570" y2="110" stroke="var(--line, #e7e4dd)" strokeWidth="1.5"/>
              <line x1="475" y1="140" x2="570" y2="170" stroke="var(--line, #e7e4dd)" strokeWidth="1.5"/>

              {/* Step 3: Responding yards */}
              <rect x="575" y="20" width="170" height="56" rx="10" fill="var(--surface, #fff)" stroke="var(--line, #e7e4dd)" strokeWidth="1.5"/>
              <text x="660" y="42" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted, #71717a)">Yard A — no stock</text>
              <text x="660" y="58" textAnchor="middle" fontSize="10" fill="var(--muted, #71717a)">(stays silent)</text>

              <rect x="575" y="84" width="170" height="56" rx="10" fill="#fef3f2" stroke="var(--red, #d92d20)" strokeWidth="2"/>
              <text x="660" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--red, #d92d20)">STEP 3</text>
              <text x="660" y="122" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink, #16181d)">Yard B — "I have it!"</text>

              <rect x="575" y="148" width="170" height="56" rx="10" fill="var(--surface, #fff)" stroke="var(--line, #e7e4dd)" strokeWidth="1.5"/>
              <text x="660" y="170" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted, #71717a)">Yard C — no stock</text>
              <text x="660" y="186" textAnchor="middle" fontSize="10" fill="var(--muted, #71717a)">(stays silent)</text>
            </svg>
          </div>

          <ol className="bl-steps">
            <li><strong>Broadcast.</strong> The requesting yard keys up and describes the part: year, make, model, and what they need. The message goes out live to every connected phone in the room.</li>
            <li><strong>Listen.</strong> Every yard in the regional room hears the request through their desk phone speaker. Yards that do not have the part stay silent.</li>
            <li><strong>Respond.</strong> The first yard with the part keys up and responds. The two yards connect directly to arrange the sale — price, shipping, and pickup happen between them with no middleman.</li>
          </ol>
          <p>
            The entire cycle — from broadcast to answer — takes about 2 seconds on the Hotline HQ network. Compare that to
            the traditional approach of calling yards one by one, which can take 30 minutes to an hour to reach 10-15 yards.
          </p>
        </section>

        <section id="comparison">
          <h2>Voice hotlines vs other parts-finding methods</h2>
          <p>
            Salvage yards have several options for locating and selling used auto parts. Each has trade-offs in speed,
            reach, cost, and data freshness. Here is how they compare:
          </p>
          <div className="bl-table-wrap">
            <table className="bl-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Speed</th>
                  <th>Reach</th>
                  <th>Data freshness</th>
                  <th>Cost model</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Voice hotline (Hotline HQ)</strong></td>
                  <td>~2 seconds</td>
                  <td>100+ yards per broadcast</td>
                  <td>Real-time (live voice)</td>
                  <td>Flat monthly</td>
                </tr>
                <tr>
                  <td>Calling yards individually</td>
                  <td>30-60 minutes</td>
                  <td>10-15 yards per hour</td>
                  <td>Real-time (if they answer)</td>
                  <td>Time cost</td>
                </tr>
                <tr>
                  <td>Online inventory databases</td>
                  <td>Minutes</td>
                  <td>Varies by database</td>
                  <td>Stale (updated weekly/monthly)</td>
                  <td>Per-listing or subscription</td>
                </tr>
                <tr>
                  <td>Facebook groups / forums</td>
                  <td>Hours to days</td>
                  <td>Group size dependent</td>
                  <td>Post-dependent</td>
                  <td>Free</td>
                </tr>
                <tr>
                  <td>Parts locating services</td>
                  <td>Hours</td>
                  <td>Service network</td>
                  <td>Depends on service</td>
                  <td>Per-request or commission</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The key advantage of a voice hotline is that it combines the speed and accuracy of real-time communication with the
            reach of broadcasting to an entire network simultaneously. Online databases can search more yards, but their data
            goes stale — inventory at a salvage yard changes daily as vehicles arrive and parts are sold. A voice request asks
            a real person who can walk the yard and confirm availability right now.
          </p>
        </section>

        <section id="effective">
          <h2>What makes a parts hotline effective</h2>
          <p>
            Not all hotline networks deliver equal results. The factors that determine whether a voice hotline actually
            helps yards find and sell parts faster:
          </p>
          <ul>
            <li><strong>Density of members per room.</strong> A room with 20 yards produces fewer matches than one with 200. Hotline HQ's California room has over 200 active yards — the highest density in any US parts network.</li>
            <li><strong>Always-on availability.</strong> If yards have to dial in for scheduled call windows, they miss requests. An always-on conference bridge means every request reaches every connected yard, 24 hours a day.</li>
            <li><strong>Regional organization.</strong> Parts sourcing is often regional — shipping a bumper from California to Florida is expensive. Grouping yards by geography ensures requests match yards that can realistically fulfill them.</li>
            <li><strong>Low friction to respond.</strong> If responding requires logging into a website or typing a message, speed drops. Voice is the fastest medium — a yard hears the request and keys up to say "I have it" in the same second.</li>
            <li><strong>No commission on sales.</strong> Networks that take a percentage of each sale create a disincentive to use the hotline for high-value parts. Flat monthly pricing aligns the network's interests with its members.</li>
          </ul>
        </section>

        <section id="who-uses">
          <h2>Who uses auto parts hotlines</h2>
          <p>
            The primary users are auto dismantlers, salvage yards, and auto recyclers — businesses that buy end-of-life
            vehicles, dismantle them, and sell the usable parts. These businesses need two things from a network:
          </p>
          <p>
            <strong>As buyers:</strong> When a customer calls a yard asking for a specific part the yard does not carry,
            the yard broadcasts the request on the hotline. If another yard in the region has it, they arrange a yard-to-yard
            sale. The original yard fulfills their customer's order without losing the sale.
          </p>
          <p>
            <strong>As sellers:</strong> By listening to the hotline, a yard hears every part request in their region. Parts
            that would otherwise sit on shelves get matched with buyers who need them. The hotline surfaces demand a yard
            would never discover through passive channels like their website or walk-in traffic.
          </p>
          <p>
            The model works because salvage yards carry overlapping but different inventory. A yard in Los Angeles
            might have three Honda Civic transmissions while a yard in Sacramento has none — and vice versa for Toyota
            Camry doors. The hotline turns a fragmented market of thousands of individual yards into a single connected network.
          </p>
        </section>

        <section id="coverage">
          <h2>Hotline HQ network coverage</h2>
          <p>
            Hotline HQ operates 12 regional rooms across the United States. The four most active rooms —
            California, Arizona, Texas, and Florida — account for the majority of daily broadcast activity.
          </p>
          <div>
            <div className="bl-grid">
              {[
                { abbr: 'CA', name: 'California', yards: '200+', status: 'active' },
                { abbr: 'AZ', name: 'Arizona', yards: '30+', status: 'active' },
                { abbr: 'TX', name: 'Texas', yards: '40+', status: 'active' },
                { abbr: 'FL', name: 'Florida', yards: '19+', status: 'active' },
                { abbr: 'OH', name: 'Ohio', yards: '—', status: 'building' },
                { abbr: 'NY', name: 'New York', yards: '—', status: 'building' },
                { abbr: 'GA', name: 'Georgia', yards: '—', status: 'building' },
                { abbr: 'IN', name: 'Indiana', yards: '—', status: 'building' },
                { abbr: 'MI', name: 'Michigan', yards: '—', status: 'building' },
                { abbr: 'NJ', name: 'New Jersey', yards: '—', status: 'building' },
                { abbr: 'IA', name: 'Iowa', yards: '—', status: 'building' },
                { abbr: 'KY', name: 'Kentucky', yards: '—', status: 'building' },
              ].map(r => (
                <div className={`bl-grid-card ${r.status}`} key={r.abbr}>
                  <span className="abbr">{r.abbr}</span>
                  <span className="name">{r.name}</span>
                  <span className="detail">{r.yards} yards</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="get-started">
          <h2>How to get started on a parts hotline</h2>
          <p>
            Joining Hotline HQ takes less than two minutes. Sign up online, select your regional room, and a preconfigured
            desk phone ships to your yard. Plug it in, and you are immediately connected to the live room — hearing every
            part request in your region the moment it is broadcast. There is no software to install, no inventory to upload,
            and no training required. If your team can use a phone, they can use the hotline.
          </p>
        </section>

    </BlogLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared feature page styles                                          */
/* ------------------------------------------------------------------ */

const FEATURE_CSS = `
.fp-hero {
  position: relative;
  padding: 160px 32px 80px;
  overflow: hidden;
}
.fp-hero-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 30%, rgba(251,250,248,0.95) 30%, rgba(251,250,248,0.6) 65%, transparent 100%),
    radial-gradient(ellipse 50% 40% at 50% 45%, rgba(217,45,32,0.04), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.fp-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}
.fp-kicker {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 18px;
}
.fp-hero h1 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.06;
  letter-spacing: -0.015em;
  margin: 0 0 22px;
}
.fp-hero h1 em {
  font-style: normal;
  color: var(--red);
  background: linear-gradient(transparent 68%, #fef3f2 68%);
}
.fp-hero-sub {
  font-size: 18px;
  line-height: 1.65;
  color: var(--muted);
  max-width: 620px;
  margin: 0 auto 32px;
  font-weight: 500;
}
.fp-hero-sub strong { color: var(--ink); }
.fp-hero-ctas {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.fp-btn {
  font-family: var(--body);
  font-weight: 600;
  font-size: 15.5px;
  padding: 14px 28px;
  border-radius: 11px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-block;
  transition: transform .15s, background .2s, box-shadow .2s, border-color .2s;
}
.fp-btn:active { transform: translateY(1px); }
.fp-btn-hot {
  background: var(--red);
  color: #fff !important;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
}
.fp-btn-hot:hover { background: var(--red-deep); box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.fp-btn-ghost {
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink) !important;
}
.fp-btn-ghost:hover { border-color: #c9c4ba; }
.fp-hero-stats {
  display: flex;
  gap: clamp(28px, 5vw, 64px);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 48px;
  padding-top: 36px;
  border-top: 1px dashed var(--line);
}
.fp-hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.fp-hero-stat strong {
  font-family: var(--display);
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
}
.fp-hero-stat span {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Sections */
.fp-section {
  padding: 110px 32px;
  max-width: 1280px;
  margin: 0 auto;
}
.fp-band {
  max-width: none;
  background: var(--band);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.fp-band > * { max-width: 1216px; margin-left: auto; margin-right: auto; }
.fp-section-head {
  margin-bottom: 56px;
}
.fp-section-head h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(28px, 3.5vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  margin: 0;
}
.fp-lede {
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
  max-width: 600px;
  margin-top: 16px;
}

/* Steps */
.fp-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 22px;
}
.fp-step {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 30px 28px 34px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}
.fp-step-n {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--red);
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.fp-step h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  margin: 0 0 10px;
  line-height: 1.08;
}
.fp-step p {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.65;
  margin: 0;
}

/* Advantages */
.fp-advantages {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 22px;
}
.fp-advantage {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 26px 32px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}
.fp-advantage h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 20px;
  margin: 0 0 10px;
  line-height: 1.12;
}
.fp-advantage p {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.65;
  margin: 0;
}

/* Regions grid */
.fp-regions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.fp-region {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px 18px;
  transition: border-color 0.2s, transform 0.15s;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 8px 24px -8px rgba(22,24,29,0.1);
}
.fp-region:hover { border-color: var(--red); transform: translateY(-2px); }
.fp-region--active { border-color: var(--red); background: #fef3f2; }
.fp-region-abbr {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--red);
  background: #fef3f2;
  padding: 6px 10px;
  border-radius: 6px;
}
.fp-region--active .fp-region-abbr { background: #fff; }
.fp-region-name {
  font-family: var(--body);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

/* Bottom CTA */
.fp-cta-section {
  background: var(--ink);
  padding: 110px 32px;
}
.fp-cta-inner {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.fp-cta-inner h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: #fff;
  margin: 0 0 16px;
}
.fp-cta-inner p {
  font-size: 17px;
  line-height: 1.65;
  color: rgba(255,255,255,0.5);
  margin: 0 0 32px;
}

/* Stats bar */
.fp-stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  max-width: 600px;
  margin: 48px auto 0;
}
.fp-stat-item {
  text-align: center;
}
.fp-stat-val {
  font-family: var(--display);
  font-weight: 700;
  font-size: 32px;
  color: var(--ink);
  line-height: 1;
}
.fp-stat-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 6px;
}

/* Content paragraphs */
.fp-content-text {
  color: var(--muted);
  font-size: 16px;
  line-height: 1.7;
  max-width: 720px;
}
.fp-content-text p { margin-bottom: 16px; }
.fp-content-text p:last-child { margin-bottom: 0; }
.fp-content-text h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 20px;
  color: var(--ink);
  margin: 28px 0 10px;
  line-height: 1.15;
}

/* Recent listings grid */
.fp-listings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.fp-listing-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s, transform 0.15s;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 8px 24px -8px rgba(22,24,29,0.1);
}
.fp-listing-card:hover { border-color: var(--red); transform: translateY(-2px); }
.fp-listing-year {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.fp-listing-vehicle {
  font-family: var(--display);
  font-weight: 700;
  font-size: 18px;
  color: var(--ink);
  line-height: 1.15;
}
.fp-listing-part {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: var(--red);
  background: #fef3f2;
  padding: 3px 10px;
  border-radius: 6px;
  margin-top: 2px;
  align-self: flex-start;
  text-transform: capitalize;
}
.fp-listing-meta {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  margin-top: auto;
  padding-top: 8px;
}
.fp-no-listings {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
  font-size: 15px;
}

/* FAQ */
.fp-faq-list {
  max-width: 720px;
}
.fp-faq {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}
.fp-faq[open] {
  border-color: var(--red);
}
.fp-faq-q {
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  line-height: 1.3;
  padding: 22px 28px;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.fp-faq-q::-webkit-details-marker { display: none; }
.fp-faq-q::after {
  content: '+';
  font-size: 22px;
  font-weight: 300;
  color: var(--red);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.fp-faq[open] .fp-faq-q::after {
  transform: rotate(45deg);
}
.fp-faq-a {
  font-size: 15px;
  line-height: 1.7;
  color: var(--muted);
  padding: 0 28px 24px;
  margin: 0;
}

/* Pillar article */
.hw-article {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px 80px;
}
.hw-section {
  padding: 40px 0;
  border-bottom: 1px solid var(--line);
}
.hw-section:last-child { border-bottom: none; }
.hw-section h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.12;
  letter-spacing: -0.015em;
  margin: 0 0 18px;
}
.hw-section p {
  font-size: 16px;
  line-height: 1.75;
  color: var(--muted);
  margin: 0 0 16px;
}
.hw-section p:last-child { margin-bottom: 0; }
.hw-section p strong { color: var(--ink); }
.hw-section ul, .hw-section ol {
  padding-left: 22px;
  margin: 0 0 16px;
}
.hw-section li {
  font-size: 16px;
  line-height: 1.75;
  color: var(--muted);
  margin-bottom: 12px;
}
.hw-section li strong { color: var(--ink); }
.hw-diagram {
  margin: 28px 0;
  overflow-x: auto;
}
.hw-diagram svg {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}
.hw-steps {
  list-style: none;
  padding: 0;
  margin: 24px 0;
  counter-reset: step;
}
.hw-steps li {
  counter-increment: step;
  padding-left: 36px;
  position: relative;
  margin-bottom: 16px;
}
.hw-steps li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 2px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: #fef3f2;
  color: var(--red);
  font-family: var(--display);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hw-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin: 20px 0;
}
.hw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.hw-table th {
  text-align: left;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 14px 18px;
  background: var(--band);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.hw-table td {
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  line-height: 1.5;
}
.hw-table tr:last-child td { border-bottom: none; }
.hw-table td strong { color: var(--ink); }
.hw-coverage { margin: 24px 0; }
.hw-coverage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.hw-room {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.hw-room.active {
  border-color: var(--red);
  background: #fef3f2;
}
.hw-room-abbr {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--red);
}
.hw-room-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--ink);
}
.hw-room-yards {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}
.hw-room.building .hw-room-abbr { color: var(--muted); }
.hw-room.building .hw-room-name { color: var(--muted); }

/* Mobile */
@media (max-width: 640px) {
  .fp-hero { padding: 120px 16px 48px; }
  .fp-hero h1 { font-size: 32px; }
  .fp-hero-sub { font-size: 16px; }
  .fp-section { padding: 64px 16px; }
  .fp-cta-section { padding: 64px 16px; }
  .fp-hero-ctas { flex-direction: column; align-items: center; }
  .fp-btn { width: 100%; max-width: 320px; text-align: center; }
}
`;
