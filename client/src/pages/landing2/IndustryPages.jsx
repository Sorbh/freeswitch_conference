import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";

const SIGNUP_URL = "/client/signup";
const CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=Industry%20Inquiry`;

const INDUSTRY_NAV = [
  { label: "Heavy Equipment", to: "/use-case/heavy-equipment-parts-hotline" },
  { label: "Farm Equipment", to: "/use-case/farm-equipment-parts-hotline" },
  { label: "Aviation / AOG", to: "/use-case/aviation-parts-hotline" },
  { label: "Mining Equipment", to: "/use-case/mining-equipment-parts" },
  { label: "Marine / Boat", to: "/use-case/marine-boat-parts" },
  { label: "Railroad", to: "/use-case/railroad-parts-hotline" },
];

function IndustryLinks({ current }) {
  return (
    <p className="fp-cta-alt">
      {INDUSTRY_NAV.filter(i => i.to !== current).map((ind, i) => (
        <span key={ind.to}>{i > 0 && ' · '}<Link to={ind.to}>{ind.label}</Link></span>
      ))}
    </p>
  );
}

function ProofBar() {
  return (
    <div className="fp-proof-bar">
      <div className="fp-proof-item"><strong>15,000+</strong><span>parts located in auto</span></div>
      <div className="fp-proof-item"><strong>500+</strong><span>member yards</span></div>
      <div className="fp-proof-item"><strong>2s</strong><span>avg response</span></div>
      <div className="fp-proof-item"><strong>~97</strong><span>hear each request</span></div>
    </div>
  );
}

/* ================================================================== */
/*  /use-case/heavy-equipment-parts-hotline                                     */
/* ================================================================== */

export function HeavyEquipmentPage() {
  const FAQS = [
    { q: "How does a heavy equipment parts hotline work?", a: "You join a shared voice conference line with other equipment dealers and salvage operations. When you need a part — a hydraulic cylinder for a CAT 320, a transmission for a Deere 650K — you key up and describe it. Every dealer on the line hears your request simultaneously and responds live if they have it. Average response time on our auto parts network: 2 seconds." },
    { q: "What types of heavy equipment parts can I find?", a: "Engines, transmissions, hydraulic pumps and cylinders, final drives, undercarriage components, cab parts, electrical systems, and more. Common makes: Caterpillar, John Deere, Komatsu, Volvo, Case, Hitachi, Liebherr, and Bobcat. The network handles everything from a $200 solenoid to a $50,000 engine core." },
    { q: "How is this different from searching MachineryTrader or IronPlanet?", a: "Online listings show what was available when someone posted them — inventory changes daily. A live voice network asks real dealers who can verify the part right now. One broadcast reaches every dealer on the line simultaneously, replacing hours of phone calls. And you can describe what you need in plain language, not search filters." },
    { q: "How much does equipment downtime really cost?", a: "Industry estimates put heavy equipment downtime at $1,000 to $5,000 per hour depending on the machine and project. A crawler excavator sitting idle on a highway project can cost the contractor $2,000-$3,000/hour in lost productivity and potential liquidated damages. Finding the part in 2 seconds vs. 2 days changes the math entirely." },
    { q: "Is this available for heavy equipment now?", a: "We're building the heavy equipment network now. The technology is proven — 500+ salvage yards and 15,000+ part requests in our auto parts network. We're actively onboarding heavy equipment dealers, salvage yards, and rebuilders. Join the waitlist to get early access and help shape the network for your region." },
    { q: "What does it cost?", a: "Flat monthly membership, same model as our auto parts network. No per-search fees, no commissions on sales, no listing fees. A preconfigured desk phone is included with membership. Find one part faster and the membership pays for itself — at heavy equipment part values, that happens on day one." },
    { q: "Can I sell parts on the hotline too?", a: "Yes. You hear every request on the line. When someone asks for a part you have — a final drive for a D6, a bucket for a 330 — you key up and respond. The buyer contacts you directly. No middleman, no commission. You sell parts you haven't listed and catch demand you'd never find through traditional channels." },
    { q: "Who else is on the network?", a: "Equipment dealers, salvage and dismantling operations, rebuild shops, rental companies with aging fleets, and independent mechanics who source parts for customers. Anyone who buys or sells used heavy equipment components. The network gets more valuable as more participants join — more ears means faster answers." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Heavy Equipment Parts Hotline — Find CAT, Deere, Komatsu Parts Fast"
        description="Find used heavy equipment parts in seconds. Broadcast to every dealer at once — CAT, Deere, Komatsu, Volvo. Cut downtime from days to minutes. No listing fees."
        keywords="heavy equipment parts, used heavy equipment parts, CAT parts used, heavy equipment parts locator, construction equipment parts, excavator parts used, heavy equipment salvage, Caterpillar parts, Komatsu parts, heavy equipment parts near me"
        path="/use-case/heavy-equipment-parts-hotline"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Heavy Equipment Parts Hotline — Hotline HQ",
              serviceType: "Heavy Equipment Parts Locating Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for finding used heavy equipment parts. Broadcast what you need to every dealer simultaneously. CAT, Deere, Komatsu, Volvo — 2-second response time.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "HowTo",
              name: "How to Find Heavy Equipment Parts on a Voice Hotline",
              description: "Join the network, broadcast what you need, and get live answers from equipment dealers in seconds.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Join the heavy equipment hotline", text: "Sign up and connect via desk phone or web client. You're placed on a live conference line with equipment dealers, salvage operations, and rebuild shops." },
                { "@type": "HowToStep", position: 2, name: "Broadcast your part request", text: "Key up and describe what you need — make, model, serial prefix, component. 'Need a hydraulic pump for a 2018 CAT 320F, SN prefix FBB.' Every dealer hears you simultaneously." },
                { "@type": "HowToStep", position: 3, name: "Get live responses", text: "Dealers with the part respond immediately on the line. Verify condition, pricing, and shipping in the same conversation. Average response time: 2 seconds." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/heavy-equipment.webp)'}}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">HEAVY EQUIPMENT</p>
          <h1>Find heavy equipment parts <em>before downtime costs you thousands</em></h1>
          <p className="ind-hero-sub">
            Equipment downtime costs $1,000-$5,000/hour. Calling dealers one by one takes days.
            A parts hotline broadcasts your request to every dealer at once — CAT, Deere, Komatsu, Volvo — and gets answers in seconds.
          </p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE PROBLEM</p>
          <h2>How do you find heavy equipment parts today?</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Call dealers one by one", copy: "You need a hydraulic pump for a CAT 320. You call 5 dealers. Three don't answer. One puts you on hold. The fifth says 'let me check and call you back.' Two hours later, you've talked to two people and still don't have the part." },
            { title: "Search online listings", copy: "MachineryTrader, IronPlanet, EquipmentWatch — you search, find a listing, call the dealer, and hear 'we sold that last week.' Listings go stale. Inventory moves fast in this industry, and databases can't keep up." },
            { title: "Wait for the dealer network to find it", copy: "You call your regular supplier. They call their contacts. Their contacts call their contacts. Three days later, someone locates a pump in Arkansas. Meanwhile, your excavator sits idle at $2,500/hour." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>One broadcast. Every dealer hears it. 2-second response.</h2>
          <p className="ind-lede">
            The same voice network that's located 15,000+ auto parts — now for heavy equipment. Join the conference line,
            describe what you need, and every dealer on the line responds live.
          </p>
        </div>
        <div className="ind-grid">
          {[
            { title: "Broadcast to all dealers at once", copy: "Instead of calling 20 dealers sequentially, you broadcast once. 'Need a hydraulic pump for a 2018 CAT 320F, serial number prefix FBB.' Every dealer on the line hears you simultaneously. The one with the part speaks up." },
            { title: "Get verified answers in real time", copy: "When a dealer responds on the hotline, they're looking at the part. It's not a listing that might be outdated — it's a live person confirming availability right now. You deal directly. No middleman, no markup from a broker." },
            { title: "No listing required to sell", copy: "If you're a dealer with a yard full of equipment, you don't need to catalog every component online. Just listen for requests. When someone asks for a part you have, you respond. The network surfaces demand for inventory you haven't listed anywhere." },
            { title: "Plain language, not part numbers", copy: "'I need the whole front end off a D6T — push arms, blade, cylinders, everything.' Try typing that into a search box. On a voice network, the dealers who can help understand exactly what you mean, including the context a database can't capture." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">PARTS IN DEMAND</p>
          <h2>Most-searched heavy equipment parts</h2>
        </div>
        <div className="ind-parts-grid">
          {[
            "Hydraulic pumps & cylinders", "Final drives", "Engines & engine cores",
            "Transmissions", "Undercarriage (tracks, rollers, sprockets)", "Cab components",
            "Electrical harnesses", "Bucket teeth & cutting edges", "Turbochargers", "Control valves",
          ].map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
        </div>
        <p className="ind-footnote">
          Top makes: Caterpillar, John Deere, Komatsu, Volvo, Case, Hitachi, Bobcat, Liebherr, Kubota.
        </p>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>Why a hotline pays for itself on the first call</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Downtime costs dwarf membership", copy: "$1K-$5K/hr downtime vs flat monthly fee. One excavator part found in 2 seconds vs 2 days = savings that cover years of membership." },
            { title: "No broker markup", copy: "Deal directly with the dealer who has the part. Brokers add 15-30% markup plus days of delay. On the hotline, you negotiate direct." },
            { title: "Sell surplus without listing it", copy: "Decommissioning a fleet? Don't catalog 500 components. Listen for requests and respond when someone needs what you have." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why construction needs voice, not search</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Machines don't have standard part numbers", copy: "A CAT 320 from 2015 uses different components than a 2018. Serial number prefixes matter. Voice handles nuance search boxes can't." },
            { title: "Field conditions require judgment calls", copy: "'Will a remanufactured pump hold up in 120°F ambient?' That's a conversation, not a search query." },
            { title: "Urgency is measured in hours, not days", copy: "A grounded excavator on a highway project costs the contractor in liquidated damages. Two seconds vs two days isn't convenience — it's survival." },
            { title: "Cross-brand compatibility needs expertise", copy: "Can a Komatsu hydraulic cylinder substitute for a Deere? Dealers who've done the swap know. A database won't tell you." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="ind-section-head" style={{textAlign:'left', maxWidth:'none', marginLeft:0, marginRight:0}}>
            <p className="ind-kicker">FAQ</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ind-faq-list">
            {FAQS.map((f, i) => (
              <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p>
          <h2>The heavy equipment parts hotline</h2>
          <p>Proven in auto parts (500+ yards, 15,000+ requests). Now expanding to heavy equipment. Join the waitlist to get early access.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          <IndustryLinks current="/use-case/heavy-equipment-parts-hotline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /use-case/farm-equipment-parts-hotline                                      */
/* ================================================================== */

export function FarmEquipmentPage() {
  const FAQS = [
    { q: "How does a farm equipment parts hotline work?", a: "You join a live voice conference with equipment dealers and salvage operations across the country. When you need a part — a hydraulic motor for a John Deere 9770, a PTO shaft for a Case IH Magnum — you key up and describe it. Every dealer on the line hears your request at once. The first dealer with the part responds. Average response time on our proven auto parts network: 2 seconds." },
    { q: "Why is this better than calling the dealer or searching online?", a: "Three reasons: speed, reach, and accuracy. Speed — one broadcast vs. 20 individual calls. Reach — every dealer on the line hears you, not just the ones you thought to call. Accuracy — when a dealer responds, they're verifying the part in real time, not reading a listing that might be outdated." },
    { q: "What farm equipment makes are covered?", a: "John Deere, Case IH, New Holland, AGCO (Massey Ferguson, Fendt, Gleaner), Kubota, Claas, Kinze, and more. The network handles everything from compact utility tractors to Class 9 combines. Both OEM replacement and used/salvage components." },
    { q: "Is this available during harvest season?", a: "The line runs 24/7, year-round. During harvest season (Sep-Oct for grain, varies by crop), a broken combine or header can cost thousands per day in delayed harvest and crop loss. That's when the network is most valuable — finding a combine part in 2 seconds vs. 2 days can save a season." },
    { q: "Do I need to list my inventory?", a: "No. There's no database, no catalog, no parts to photograph. You listen for requests and respond when you have what someone needs. This is especially valuable for farm equipment salvage yards that may have hundreds of machines but limited online inventory." },
    { q: "Is the farm equipment network live now?", a: "We're building it now. The technology is proven in auto parts — 500+ yards, 15,000+ requests, 2-second response time. We're actively onboarding farm equipment dealers, salvage yards, and independent repair shops. Join the waitlist for early access." },
    { q: "What does membership cost?", a: "Flat monthly fee. No commissions, no per-search fees, no listing fees. A preconfigured desk phone is included. At farm equipment part values — combine headers, tractor transmissions, hydraulic systems — one sale covers months of membership." },
    { q: "How does this compare to Allied Information Networks (AIN)?", a: "AIN has operated parts locating hotlines for decades — they proved the model works. Their system uses a callback approach: you call in, leave a request, and wait for dealers to call you back. Hotline HQ is real-time: you broadcast live on a conference line and get answers in seconds, not hours. Same concept, next-generation technology." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Farm Equipment Parts Hotline — Find Tractor & Combine Parts Fast"
        description="Find used farm equipment parts in seconds. Broadcast to every dealer at once — John Deere, Case IH, New Holland. Don't lose harvest time waiting for parts."
        keywords="farm equipment parts, used farm equipment parts, tractor parts, combine parts, John Deere parts used, Case IH parts, farm equipment parts locator, agricultural equipment parts, used tractor parts, farm equipment salvage"
        path="/use-case/farm-equipment-parts-hotline"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Farm Equipment Parts Hotline — Hotline HQ",
              serviceType: "Agricultural Equipment Parts Locating Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for finding used farm equipment parts. John Deere, Case IH, New Holland, AGCO. Broadcast once, every dealer hears you.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "HowTo",
              name: "How to Find Farm Equipment Parts on a Voice Hotline",
              description: "Join the network, broadcast what you need, and get live answers from farm equipment dealers and salvage yards.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Join the farm equipment hotline", text: "Sign up and connect via desk phone or web client. You join a live conference line with tractor dealers, combine salvage yards, and implement specialists across the country." },
                { "@type": "HowToStep", position: 2, name: "Broadcast your part request", text: "Key up and describe the part — make, model, year, component. 'Need a feeder house chain for a 2015 Deere S680, the 40-series.' Every dealer on the line hears you at once." },
                { "@type": "HowToStep", position: 3, name: "Get live responses during harvest", text: "Dealers respond immediately if they have the part. Verify fit, condition, and shipping in the same call. The line runs 24/7 — broadcast at 5 AM and have a part shipping by sunrise." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/farm-equipment.webp)'}}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">FARM EQUIPMENT</p>
          <h1>Find farm equipment parts <em>before harvest waits for no one</em></h1>
          <p className="ind-hero-sub">
            A broken combine during harvest costs thousands per day. Calling dealers one by one takes hours.
            A parts hotline broadcasts your request to every dealer at once and gets answers in seconds.
          </p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE PROBLEM</p>
          <h2>Finding farm equipment parts shouldn't take days</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "The dealer says 'backordered 6 weeks'", copy: "OEM parts through the dealer network are reliable but slow. Lead times of 2-6 weeks aren't unusual for less common components. During planting or harvest, you can't wait that long. A used or salvage part that ships tomorrow beats a factory part that ships in August." },
            { title: "Calling salvage yards is a full-time job", copy: "There are hundreds of farm equipment salvage operations across the Midwest and Great Plains. Finding the right one means calling around — and most specialize in specific brands or eras. You might call 15 yards before finding someone with your Deere 7200 planter parts." },
            { title: "Online inventory is incomplete", copy: "Sites like TractorHouse, Fastline, and dealer websites show listed inventory. But farm equipment salvage yards — the places most likely to have your oddball part — often have minimal web presence. Their inventory is in the field, not in a database." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>One broadcast. Every dealer hears it. Real-time answers.</h2>
          <p className="ind-lede">
            Proven in auto parts with 15,000+ requests and 500+ member yards. The same live voice technology — now for tractors, combines, planters, and headers.
          </p>
        </div>
        <div className="ind-grid">
          {[
            { title: "Describe the part in plain language", copy: "'I need the feeder house chain for a 2015 Deere S680 — the 40-series, not the 50.' On a voice network, the dealer who has it understands exactly what you mean. No part numbers needed. No filtering through search results that might not match your specific model." },
            { title: "Reach dealers you didn't know existed", copy: "That salvage yard in rural Nebraska with 200 combines in the field? They're not on TractorHouse. They don't have a website. But they're on the hotline. When you broadcast a request, they hear it, walk out to the yard, and respond." },
            { title: "Sell what's sitting in your field", copy: "If you're a salvage operation, you hear every request in your region without anyone having to find your website. A combine that's been sitting for 3 years suddenly has value when someone broadcasts 'need a threshing rotor for a 2012 Case 8230.'" },
            { title: "Harvest-season urgency, handled", copy: "During harvest, every hour counts. The hotline runs 24/7. Broadcast at 5 AM before the crew arrives. A dealer three states away might have the part ready to ship by the time the sun is up." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">PARTS IN DEMAND</p>
          <h2>Most-searched farm equipment parts</h2>
        </div>
        <div className="ind-parts-grid">
          {[
            "Combine headers & feeder houses", "Tractor transmissions", "Hydraulic pumps & motors",
            "PTO shafts & clutches", "Planter units & row units", "Cab glass & panels",
            "Engine cores & short blocks", "Electrical harnesses", "Grain drills & air seeder parts", "Loader buckets & grapples",
          ].map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
        </div>
        <p className="ind-footnote">
          Top makes: John Deere, Case IH, New Holland, AGCO (Massey Ferguson, Fendt, Gleaner), Kubota, Claas.
        </p>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>Harvest season math: what a broken combine really costs</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Crop loss per hour of downtime", copy: "During harvest, a stopped combine means grain sitting in the field. Weather doesn't wait. Finding a part in 2 seconds vs 2 weeks can save an entire crop." },
            { title: "OEM vs salvage pricing", copy: "A new OEM combine header can cost $15K-$30K. A used one from a salvage operation: $3K-$8K. The hotline connects you to salvage dealers most farmers don't know exist." },
            { title: "Parts you didn't know were available", copy: "Farm equipment salvage yards in rural Nebraska, Iowa, and Kansas have inventory that's never been listed online. The hotline reaches them all." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why voice finds farm parts that databases miss</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Farm equipment is regional", copy: "The Deere 9770 is common in the Midwest but rare in the Southeast. The hotline connects you across regions to find what's available locally elsewhere." },
            { title: "Model-year specifics are verbal", copy: "'Is it the 40-series or the 50-series chain?' 'Does it have the factory reverser?' These questions need a conversation, not a checkbox filter." },
            { title: "Seasonal urgency is absolute", copy: "During planting and harvest, every hour counts. The hotline runs 24/7. Broadcast at 5 AM and have a part shipping by sunrise." },
            { title: "Salvage yards don't have websites", copy: "The best farm equipment salvage operations are in rural areas with minimal internet presence. They have the parts — they just aren't online." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="ind-section-head" style={{textAlign:'left', maxWidth:'none', marginLeft:0, marginRight:0}}>
            <p className="ind-kicker">FAQ</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ind-faq-list">
            {FAQS.map((f, i) => (
              <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p>
          <h2>The farm equipment parts hotline</h2>
          <p>Proven in auto parts. Now expanding to farm equipment. Join the waitlist to get early access before harvest season.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          <IndustryLinks current="/use-case/farm-equipment-parts-hotline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /use-case/aviation-parts-hotline                                            */
/* ================================================================== */

export function AviationPartsPage() {
  const FAQS = [
    { q: "What is an AOG parts hotline?", a: "AOG stands for Aircraft On Ground — an aircraft that can't fly until a part is sourced and installed. An AOG parts hotline is a live voice network where maintenance teams broadcast urgent parts needs to every supplier simultaneously. Instead of calling vendors one by one (the current AOG desk model), you broadcast once and get answers in seconds." },
    { q: "How much does AOG downtime cost?", a: "Depending on the aircraft and operator, AOG downtime costs $10,000 to $150,000 per hour in lost revenue, crew costs, passenger compensation, and scheduling disruption. Even a $5,000 part that takes 48 hours to locate can cost an airline $500,000+ in downstream impact. Faster sourcing directly reduces AOG duration." },
    { q: "How is this different from ILS or PartsBase?", a: "ILS (Inventory Locator Service) and PartsBase are database searches — you look up a part number and see who has it listed. The listing might be outdated. An AOG hotline is live voice: you describe what you need and every vendor on the line confirms availability in real time. For AOG situations, live verification beats database search every time." },
    { q: "What about FAA traceability requirements?", a: "All aviation parts require proper documentation — 8130-3 Authorized Release Certificates, trace-to-birth records, and conformity statements. The hotline helps you find the part faster; the paperwork and compliance process remains the same. You deal directly with the vendor, who provides all required FAA documentation as part of the sale." },
    { q: "What types of aircraft parts are in scope?", a: "Rotable components, avionics, landing gear assemblies, engine LRUs (Line Replaceable Units), APU components, flight control actuators, and structural parts. Both commercial (Boeing, Airbus) and general aviation (Cessna, Beechcraft, Piper). The network is most valuable for less-common parts where standard supply chains are slow." },
    { q: "Is the aviation parts network live now?", a: "We're building it. The core technology is proven — 500+ participants, 15,000+ broadcast requests, 2-second response time in our auto parts network. Aviation requires additional compliance structure (8130-3 verification, FAA PMA/DER classification), which we're building into the platform. Join the waitlist for early access." },
    { q: "Who would be on the network?", a: "MROs (Maintenance, Repair, Overhaul shops), parts distributors, airline surplus departments, rotable pool operators, teardown specialists, and independent parts brokers. Anyone who sells used, overhauled, or serviceable aircraft components." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Aviation Parts Hotline — AOG Parts Sourcing in Seconds, Not Hours"
        description="AOG parts hotline for aircraft maintenance. Broadcast to every vendor at once — find rotables, avionics, LRUs in seconds. Cut AOG downtime. FAA-compliant sourcing."
        keywords="aviation parts hotline, AOG parts, aircraft parts locator, used aircraft parts, AOG desk, aviation parts supplier, airplane parts, aircraft parts broker, AOG sourcing, aircraft parts search"
        path="/use-case/aviation-parts-hotline"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Aviation Parts Hotline — Hotline HQ",
              serviceType: "AOG Aircraft Parts Locating Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for urgent aircraft parts sourcing. AOG parts located in seconds by broadcasting to every vendor simultaneously.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "HowTo",
              name: "How to Source AOG Aircraft Parts via Voice Hotline",
              description: "Broadcast your AOG requirement to every vendor simultaneously and get verified, documented parts in seconds.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Connect to the aviation parts line", text: "Join the live conference with MROs, distributors, teardown shops, and surplus dealers. Connect via desk phone or web client — same tools your AOG desk already uses." },
                { "@type": "HowToStep", position: 2, name: "Broadcast the AOG requirement", text: "Key up with full detail: part number, condition (SV/AR/NE), trace requirements, 8130-3 needed, destination airport and timeline. Every vendor hears you at once — parallel, not sequential." },
                { "@type": "HowToStep", position: 3, name: "Verify and close in one conversation", text: "Vendors respond live with availability, certification status, and shipping timeline. Confirm 8130-3 documentation, negotiate pricing, and arrange logistics in the same call." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/aviation.webp)'}}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">AVIATION / AOG</p>
          <h1>AOG parts sourcing in <em>seconds, not hours</em></h1>
          <p className="ind-hero-sub">
            Aircraft on ground costs $10K-$150K per hour. AOG desks call vendors one by one.
            A parts hotline broadcasts to every vendor simultaneously — first with the part wins.
          </p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE AOG PROBLEM</p>
          <h2>Why AOG sourcing is still sequential in 2026</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "AOG desks call vendors one by one", copy: "An aircraft is grounded. The AOG desk starts calling: Vendor A — no answer. Vendor B — checking inventory, will call back. Vendor C — has it but can't ship until Thursday. Meanwhile, the aircraft sits at $50,000/hour. The process is sequential when it should be parallel." },
            { title: "Database searches show stale inventory", copy: "ILS, PartsBase, and StockMarket.aero aggregate listed inventory. But a part listed as 'available' might be reserved, in overhaul, or already sold. For AOG situations, you need real-time confirmation — not a listing that was updated last Tuesday." },
            { title: "Brokers add time and markup", copy: "Parts brokers serve a purpose, but they add a layer between you and the part. They call the same vendors you could call, take a margin, and add hours to the process. For non-urgent sourcing, that's fine. For AOG, those hours cost more than the margin." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>Broadcast once. Every vendor hears it. Live verification.</h2>
          <p className="ind-lede">
            The technology behind 15,000+ auto parts requests — applied to aviation's highest-urgency problem.
            Replace the AOG phone tree with a single broadcast to every vendor on the network.
          </p>
        </div>
        <div className="ind-grid">
          {[
            { title: "Parallel, not sequential", copy: "One broadcast reaches every vendor on the line simultaneously. The first vendor with a serviceable, documented part responds. Instead of 20 sequential calls over 4 hours, you make one broadcast and have an answer in seconds. For a $50,000/hour AOG, the math is obvious." },
            { title: "Live voice verification", copy: "When a vendor responds on the hotline, you're talking to a real person who can confirm: part number, condition, 8130-3 status, ship date, and price — all in the same conversation. No waiting for a callback, no email chains, no 'let me check with the warehouse.'" },
            { title: "Beyond part numbers", copy: "'I need a serviceable flight control actuator for a 737-800, P/N 65-44780-31 or equivalent, preferably with back-to-birth trace, and I need it in MIA by tomorrow morning.' That level of specificity works on a voice network. It doesn't work in a search box." },
            { title: "The network effect for AOG", copy: "Every MRO, distributor, and teardown shop on the line is a potential source. The network gets more valuable as more vendors join. What starts as a faster way to source one AOG part becomes a permanent advantage in parts availability." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>AOG math: why seconds matter at $50,000/hour</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "AOG costs dwarf part costs", copy: "A grounded 737 costs $50K-$150K/hour in lost revenue, crew repositioning, and passenger compensation. Finding a part 4 hours faster saves more than most annual parts budgets." },
            { title: "Eliminate broker margins", copy: "Aviation parts brokers typically add 15-40% markup. On the hotline, you deal directly with the MRO, distributor, or teardown shop. Same part, lower cost, faster." },
            { title: "8130-3 verification in the conversation", copy: "When a vendor responds on the line, you ask about trace documentation, serviceable tags, and certification in the same breath. No separate verification step." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why AOG desks need voice networks, not databases</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "ILS/PartsBase listings go stale", copy: "A part listed as 'available' may be reserved, in overhaul, or sold. For AOG, you need real-time confirmation from the person holding the part." },
            { title: "Complex specs need conversation", copy: "'Serviceable P/N 65-44780-31, need back-to-birth trace, FAA 8130-3, ship to MIA by tomorrow.' That's a voice request, not a search query." },
            { title: "Parallel sourcing saves hours", copy: "AOG desks call vendors one by one. The hotline broadcasts to all vendors simultaneously. The first with a qualified part speaks up." },
            { title: "Relationship-based market", copy: "Aviation parts trading is built on trust and relationships. Voice builds rapport that email and databases never can." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head" style={{textAlign:'left'}}>
          <p className="ind-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="ind-faq-list">
          {FAQS.map((f, i) => (
            <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </div>
      </section>

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p>
          <h2>The AOG parts hotline</h2>
          <p>Proven in auto parts with 500+ members. Aviation-grade compliance in development. Join the waitlist for early access.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          <IndustryLinks current="/use-case/aviation-parts-hotline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /use-case/mining-equipment-parts                                            */
/* ================================================================== */

export function MiningEquipmentPage() {
  const FAQS = [
    { q: "What mining equipment parts can I find?", a: "Engines, transmissions, hydraulic pumps and cylinders, haul truck components (bed liners, suspension, tires), drill rig parts, crusher wear parts (jaw plates, mantles, concaves), conveyor components (idlers, pulleys, belting), and electrical systems. Common makes: Caterpillar, Komatsu, Hitachi, Liebherr, Sandvik, Epiroc, Volvo, and Metso." },
    { q: "How much does mining equipment downtime cost?", a: "A haul truck sitting idle costs $10,000-$50,000 per hour depending on the operation and commodity price. Crusher or mill downtime can halt an entire processing plant, cascading losses across the operation. At these rates, even a premium-priced part is economical if it arrives days sooner than the OEM supply chain. Speed of sourcing directly impacts production output." },
    { q: "How is this different from contacting OEM dealers?", a: "OEM channels are reliable but slow — lead times of 4-12 weeks aren't unusual for less common components. A voice hotline reaches independent dealers, rebuilders, and surplus operations simultaneously. Many carry rebuilt or surplus OEM parts that ship in days, not months. The hotline doesn't replace OEM relationships — it adds a parallel channel for urgency." },
    { q: "What about rebuilt and remanufactured parts?", a: "The network includes rebuild shops and remanufacturers alongside salvage and surplus dealers. When you broadcast a request, you might hear from a dealer with a surplus OEM part, a rebuilder with a remanufactured unit, and a mine site decommissioning equipment — all in the same broadcast. You choose the best option for your timeline and budget." },
    { q: "Can I sell surplus mining equipment parts?", a: "Yes. Mines decommission equipment, close sites, and swap out components constantly. Instead of listing surplus inventory on multiple platforms, you listen for requests on the hotline and respond when someone needs what you have. No listing fees, no photos, no catalog management. The network surfaces demand for your surplus automatically." },
    { q: "Is the mining equipment network available now?", a: "We're building it. The voice hotline technology is proven — 500+ members, 15,000+ requests, 2-second average response time in auto parts. Mining equipment is a natural extension: same urgency, same fragmented dealer network, higher part values. Join the waitlist to get early access and help shape the network." },
    { q: "What regions would the mining network cover?", a: "Initially focused on major US mining states: Nevada, Arizona, Utah, Wyoming, Montana, West Virginia, Kentucky, and Minnesota (iron range). The network can expand to any region where mining operations and parts dealers exist. The voice conference model works regardless of geography — dealers 2,000 miles away can respond just as fast." },
    { q: "How does the hotline handle specs and part numbers?", a: "By voice. 'I need a final drive for a CAT 793F, left side, serial number prefix MEX, need it serviceable with warranty.' That level of detail — serial prefix, condition requirements, warranty expectations — translates perfectly to voice. A database search can't capture context like 'I'll take a rebuild if someone can turn it in 72 hours.'" },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Mining Equipment Parts — Find Haul Truck, Crusher & Drill Parts Fast"
        description="Find used mining equipment parts in seconds. CAT, Komatsu, Hitachi — haul trucks, crushers, drills. Broadcast to every dealer at once. Downtime costs $10K-$50K/hr — don't wait."
        keywords="mining equipment parts, used mining equipment parts, haul truck parts, crusher parts, mining parts supplier, Caterpillar mining parts, Komatsu mining parts, drill rig parts, conveyor parts mining, mining equipment salvage, used mining parts near me"
        path="/use-case/mining-equipment-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Service", name: "Mining Equipment Parts — Hotline HQ", serviceType: "Mining Equipment Parts Locating", provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") }, areaServed: { "@type": "Country", name: "US" }, description: "Live voice network for finding used mining equipment parts. CAT, Komatsu, Hitachi haul trucks, crushers, and drills. Broadcast to every dealer at once." },
            { "@type": "FAQPage", mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
            {
              "@type": "HowTo",
              name: "How to Find Mining Equipment Parts on a Voice Hotline",
              description: "Broadcast your requirement to every mining parts dealer at once and get verified answers in seconds.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Join the mining parts hotline", text: "Connect via desk phone or web client. You join a live conference with haul truck specialists, crusher parts dealers, rebuild shops, and surplus operations across every major mining state." },
                { "@type": "HowToStep", position: 2, name: "Broadcast the part you need", text: "Key up and describe it: 'Need a final drive for a CAT 793F, left side, serial prefix MEX, serviceable with warranty.' Every dealer on the line hears you simultaneously." },
                { "@type": "HowToStep", position: 3, name: "Compare options and close", text: "Multiple dealers may respond — surplus OEM, rebuilt with warranty, or used serviceable. Compare pricing, condition, and ship dates in one conversation. Average response: 2 seconds." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/mining.webp)'}}><div className="ind-hero-scrim" /><div className="ind-hero-inner">
        <p className="ind-kicker">MINING EQUIPMENT</p>
        <h1>Mining equipment parts — <em>cut downtime from days to hours</em></h1>
        <p className="ind-hero-sub">
          Haul truck downtime costs $10,000-$50,000 per hour. OEM lead times stretch to weeks. A parts hotline broadcasts your request
          to every dealer, rebuilder, and surplus operation at once — first with the part wins.
        </p>
        <div className="ind-hero-ctas"><a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a><Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Call</Link></div>
      </div></section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE PROBLEM</p>
          <h2>Why sourcing mining parts takes too long</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "OEM lead times don't match mine-site urgency", copy: "A crusher mantle wears through at 2 AM. The OEM quotes 6-8 weeks for a replacement. Meanwhile, the entire processing circuit is down. You need a part that exists somewhere in the dealer network right now — you just don't know where." },
            { title: "Fragmented dealer networks", copy: "Mining equipment parts are spread across OEM dealers, independent rebuilders, surplus brokers, and other mine sites decommissioning equipment. No single platform connects them all. Finding the right part means knowing who to call — and calling them one by one." },
            { title: "High-value parts need conversation", copy: "A $75,000 remanufactured engine core isn't a click-to-buy transaction. You need to discuss condition, warranty terms, serial compatibility, shipping logistics, and core exchange. Database listings can't handle that complexity. Voice can." },
            { title: "Remote locations compound delays", copy: "Mines operate in remote areas where logistics are already slow. A 3-day sourcing delay becomes a 5-day delay by the time the part ships to a remote Nevada pit. Cutting sourcing from days to seconds matters more when the last mile is already long." },
          ].map((b, i) => <div className="ind-card" key={i}><h3>{b.title}</h3><p>{b.copy}</p></div>)}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>One broadcast replaces 20 phone calls</h2>
          <p className="ind-lede">The same voice network that's located 15,000+ auto parts — applied to mining's highest-value components. Every dealer on the line hears your request simultaneously.</p>
        </div>
        <div className="ind-grid">
          {[
            { title: "CAT, Komatsu, Hitachi — all on one line", copy: "Dealers specializing in different OEMs hear your request simultaneously. You don't need to know who carries what brand or which rebuilder does which components. Describe the part, and the right dealer responds. The network does the matching." },
            { title: "Parts worth $5K-$200K justify speed", copy: "At these values, a 2-second response vs. a 2-day search isn't just convenience — it's operational necessity. The cost of a single hour of haul truck downtime exceeds the annual cost of network membership." },
            { title: "Rebuilt, surplus, and OEM alternatives surface together", copy: "One broadcast might return three options: a surplus OEM part from a decommissioned mine, a remanufactured unit with warranty from a rebuild shop, and a used component from a dealer. You compare live and choose what fits your timeline and budget." },
            { title: "Sell decommissioned equipment parts effortlessly", copy: "Shutting down a site or swapping out a fleet? Instead of listing 500 components across multiple platforms, listen for requests and respond when someone needs what you have. The network converts your surplus into revenue without the overhead of listings." },
          ].map((b, i) => <div className="ind-card" key={i}><h3>{b.title}</h3><p>{b.copy}</p></div>)}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">PARTS IN DEMAND</p>
          <h2>Most-sourced mining equipment components</h2>
        </div>
        <div className="ind-parts-grid">
          {[
            "Haul truck engines", "Final drives", "Hydraulic pumps & cylinders", "Crusher jaw plates & mantles",
            "Traction motors", "Drill rig components", "Conveyor idlers & pulleys", "Transmission assemblies",
            "Suspension cylinders", "Electrical control modules",
          ].map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
        </div>
        <p className="ind-footnote">
          Top makes: Caterpillar (793, 797, D10, D11), Komatsu (PC, HD, WA series), Hitachi (EX, ZX series), Liebherr, Sandvik, Epiroc.
        </p>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>Mine-site math: what idle equipment costs per shift</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Haul truck downtime: $10K-$50K/hour", copy: "A 400-ton haul truck moving 6,000 tons/day generates enormous revenue. Every hour of downtime is lost ore, missed quotas, and potential contract penalties." },
            { title: "Rebuilt vs new: 40-60% savings", copy: "A rebuilt final drive for a CAT 793 costs $80K-$120K vs $200K+ new. The hotline connects you to rebuild shops and surplus dealers you didn't know existed." },
            { title: "Remote site logistics multiply delays", copy: "A 3-day sourcing delay becomes 5-7 days by the time the part reaches a remote mine site. Cutting sourcing from days to seconds matters more when last-mile delivery is already slow." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why mining can't wait for databases</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Component values justify any sourcing speed", copy: "At $5K-$200K per part, the cost of faster sourcing is negligible. A $50K engine found in 2 seconds vs 5 days saves far more than the membership cost." },
            { title: "Serial compatibility is critical", copy: "Mining equipment has frequent revisions. 'Does this torque converter fit a D11T with the C32 ACERT, SN prefix JEL?' That requires a dealer conversation." },
            { title: "Surplus from decommissioned sites", copy: "When a mine closes, components scatter to dealers nationwide. The hotline aggregates that fragmented supply into one broadcast reach." },
            { title: "24/7 operations need 24/7 sourcing", copy: "Mines run three shifts. The hotline runs 24/7. A crusher failure at 2 AM gets the same sourcing speed as one at 2 PM." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="ind-section-head" style={{textAlign:'left', maxWidth:'none', marginLeft:0, marginRight:0}}><p className="ind-kicker">FAQ</p><h2>Frequently Asked Questions</h2></div>
          <div className="ind-faq-list">{FAQS.map((f, i) => <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>

      <section className="ind-cta"><div className="ind-cta-inner">
        <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p><h2>The mining equipment parts hotline</h2>
        <p>Proven in auto parts with 500+ members. Mining is next — same urgency, higher stakes. Join the waitlist for early access.</p>
        <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
        <p className="ind-cta-alt">See it working: <Link to="/#top">listen to a live call</Link> · <Link to="/used-auto-parts-hotline">how the hotline works</Link> · <Link to="/use-case/heavy-equipment-parts-hotline">heavy equipment hotline</Link></p>
        <p className="ind-cta-alt">
          <Link to="/features/desk-phone">The desk phone</Link>
          {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
          {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
        </p>
        <IndustryLinks current="/use-case/mining-equipment-parts" />
      </div></section>
      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /use-case/marine-boat-parts                                                 */
/* ================================================================== */

export function MarinePartsPage() {
  const FAQS = [
    { q: "What used boat parts can I find on the marine parts hotline?", a: "Outboard motors and powerheads, sterndrive and outdrive assemblies, inboard marine engines, lower units, trim and tilt systems, marine electronics (fishfinders, GPS, radar), gauges and instrument clusters, propellers, fuel systems, hull hardware, and deck fittings. Common makes include Mercury, Yamaha, Volvo Penta, Evinrude, Johnson, MerCruiser, OMC, Crusader, Honda Marine, and Suzuki Marine. The network handles everything from a $150 water pump impeller to a $15,000 used outboard motor." },
    { q: "How does a marine parts hotline work?", a: "You join a shared voice conference line with marine salvage yards, boat dismantlers, and marine parts dealers. When you need a part — a lower unit for a Mercury 150, a Mercruiser sterndrive Alpha One Gen II — you key up and describe it in plain language. Every dealer on the line hears your request at the same time. The first salvage yard with the part responds live. Average response time on our proven auto parts network: 2 seconds." },
    { q: "How much does the marine parts hotline cost?", a: "Flat monthly membership. No per-search fees, no commissions on sales, no listing fees. A preconfigured desk phone is included with membership. At used marine engine parts prices — outboard motors, sterndrives, inboard powerplants — a single part sale covers months of membership. The network pays for itself the first time you find a boat engine part in 2 seconds instead of 2 days." },
    { q: "How quickly can I find used boat parts near me?", a: "On the hotline, geographic distance matters less than you think. You broadcast once and every marine salvage operation on the network hears you — whether they're at a coastal yard in Florida, a lake marina in Minnesota, or a boat dismantler in Texas. Parts ship nationwide. But for buyers who need local pickup, the network includes salvage yards in every major boating region: Gulf Coast, Atlantic seaboard, Great Lakes, and Pacific Coast." },
    { q: "Are used marine parts safe and reliable?", a: "Used marine salvage parts are widely used across the boating industry. Outboard motors, sterndrives, and inboard engines are built to withstand harsh saltwater and freshwater environments, so quality used components have significant life remaining. On the hotline, you talk directly to the salvage yard — ask about hours on the motor, freshwater vs. saltwater use, compression numbers, and condition. That live conversation gives you more information than any online listing ever could." },
    { q: "How is this different from buying used boat parts on eBay or Craigslist?", a: "Three differences. First, reach: one broadcast hits every marine salvage yard on the network simultaneously, not just whoever happened to list something. Second, verification: when a dealer responds, they're looking at the part and can answer your questions in real time — hours on the motor, saltwater exposure, whether the lower unit has been submerged. Third, expertise: you're talking to marine salvage professionals who know interchange and compatibility, not random sellers. They'll tell you if a Mercury 200 EFI powerhead fits your 175 block." },
    { q: "What boat and marine engine makes are most common on the network?", a: "The most frequently sourced makes are Mercury (including Mercruiser sterndrive), Yamaha, Volvo Penta, Evinrude, and Johnson (OMC). Also well-represented: Crusader, Honda Marine, Suzuki Marine, and Mercruiser inboard/outboard systems. These cover the vast majority of powerboats on US waterways. Whether you need used outboard motor parts for a 1990s Johnson or a late-model Yamaha four-stroke, the network has salvage yards that specialize in each brand." },
    { q: "Is the marine parts network live now?", a: "We're building the marine and boat parts network now. The core technology is proven — 500+ salvage yards, 15,000+ part requests, and 2-second response time in our auto parts network. There are roughly 200-500 marine salvage operations across the US, a smaller but severely underserved market with no dominant parts locator platform. Join the waitlist to get early access and help shape the network for your region." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Used Boat Parts & Marine Salvage — Find Engine, Outdrive & Hull Parts Fast"
        description="Find used boat parts and marine salvage parts in seconds. Mercury, Yamaha, Volvo Penta, MerCruiser. No listing platform exists for marine — broadcast to every salvage yard at once."
        keywords="used boat parts, marine parts salvage, boat parts near me, used marine engine parts, marine salvage parts, boat parts locator, used outboard motor parts, marine parts online, boat engine parts used, used boat parts near me, Mercruiser sterndrive parts"
        path="/use-case/marine-boat-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Marine & Boat Parts Hotline — Hotline HQ",
              serviceType: "Marine Parts Locating Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for finding used boat parts and marine salvage parts. Broadcast what you need to every marine salvage yard simultaneously. Mercury, Yamaha, Volvo Penta, MerCruiser — 2-second response time.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "HowTo",
              name: "How to Find Used Boat Parts on a Voice Hotline",
              description: "Broadcast what marine part you need and get live answers from salvage yards — the boat parts locator that doesn't exist anywhere else.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Join the marine parts hotline", text: "Connect via desk phone or web client. You join a live conference with marine salvage yards, outboard motor specialists, and sterndrive rebuilders across the US." },
                { "@type": "HowToStep", position: 2, name: "Describe the part you need", text: "Key up and talk: 'Need a lower unit for a 2016 Yamaha F150 four-stroke, 25-inch shaft.' No part numbers needed — the salvage yard who has it understands the platform, the year, and the fit." },
                { "@type": "HowToStep", position: 3, name: "Get answers no database can give", text: "The responding yard can tell you freshwater vs saltwater history, hours on the unit, and whether it fits your specific application. Deal direct — no broker, no markup, no stale listing." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/marine.webp)'}}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">MARINE & BOAT</p>
          <h1>Used boat parts — <em>the market nobody digitized</em></h1>
          <p className="ind-hero-sub">
            There is no Car-Part.com for boats. No MachineryTrader. No central database for marine salvage parts.
            Finding a used outboard motor or Mercruiser sterndrive still means calling salvage yards one by one.
            A boat parts hotline changes that — broadcast once, every marine salvage yard hears you at once.
          </p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE PROBLEM</p>
          <h2>Finding used boat parts shouldn't take all summer</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "No search platform exists for marine salvage", copy: "Auto dismantlers have Car-Part.com. Heavy equipment has MachineryTrader. Marine salvage has nothing. No centralized boat parts locator, no standardized interchange database, no universal part numbers. Finding a used MerCruiser Alpha One outdrive means cold-calling marinas and salvage yards until you get lucky. Marine parts sourcing has the widest digital gap of any parts industry in the US." },
            { title: "Boat season waits for nobody", copy: "The boating window is May through September. A broken engine in June means missing the entire summer if the part takes weeks to track down. Unlike a car — where you can take the bus — a dead boat just sits at the dock. That seasonal urgency makes fast marine parts sourcing worth real money to every boat owner and marine repair shop." },
            { title: "Only 200-500 marine salvage yards in the entire US", copy: "The marine salvage market is small and scattered. Yards specialize — one does Mercury outboards, another focuses on Volvo Penta sterndrives, a third strips Yamaha four-strokes. Finding the right yard for your specific part means knowing who specializes in what, and that tribal knowledge doesn't scale." },
            { title: "No standardized interchange for marine parts", copy: "In auto parts, interchange databases tell you which parts fit which vehicles. Marine has no equivalent. Will a 2008 Mercury 150 OptiMax powerhead fit your 2005? The only way to know is to ask someone who's done it. That expertise lives in salvage yards — not in any database." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>One broadcast. Every marine salvage yard hears it. Answers in seconds.</h2>
          <p className="ind-lede">
            The same voice network that's located 15,000+ auto parts — now for boats. Join the conference line,
            describe your marine part in plain language, and every salvage yard on the line responds live.
          </p>
        </div>
        <div className="ind-grid">
          {[
            { title: "Broadcast to every marine salvage yard at once", copy: "Instead of calling 15 yards sequentially, you broadcast once. 'Need a lower unit for a 2016 Yamaha F150 four-stroke — the 25-inch shaft.' Every marine salvage operation on the line hears you simultaneously. The yard with the part speaks up. One request reaches the entire boat parts network in seconds." },
            { title: "Get live verification, not stale listings", copy: "When a salvage yard responds on the hotline, they're looking at the part. They can tell you the hours, whether it's from a freshwater or saltwater boat, and whether it'll fit your application. You deal directly — no middleman markup, no broker, no outdated online listing that turns out to be sold." },
            { title: "No listing required to sell marine parts", copy: "If you run a marine salvage operation, you don't need to photograph and catalog every outboard motor, sterndrive, and lower unit in your yard. Just listen. When someone broadcasts 'need used outboard motor parts for an Evinrude E-TEC 200,' you respond if you have it. The hotline surfaces demand for inventory you've never listed anywhere." },
            { title: "Plain language beats part numbers", copy: "'I need the complete outdrive off a 1998 Volvo Penta 5.0 GXi — the SX drive, not the DP.' Try typing that into a search box. On a voice network, the marine salvage professional who has it understands exactly what you need, including the model-year quirks and compatibility details no database captures." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">PARTS IN DEMAND</p>
          <h2>Most-searched used boat and marine parts</h2>
        </div>
        <div className="ind-parts-grid">
          {[
            "Outboard motors & powerheads", "Sterndrives & outdrives", "Inboard marine engines",
            "Lower units & gearcases", "Trim & tilt assemblies", "Marine electronics & GPS",
            "Propellers & prop shafts", "Fuel systems & fuel tanks", "Gauges & instrument clusters", "Hull hardware & deck fittings",
          ].map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
        </div>
        <p className="ind-footnote">
          Top makes: Mercury, Yamaha, Volvo Penta, Evinrude, Johnson, MerCruiser, OMC, Crusader, Honda Marine, Suzuki Marine, Mercruiser sterndrive.
        </p>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>Why marine salvage needs a network — not another listing site</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "No central platform exists", copy: "Auto has Car-Part.com. Heavy equipment has MachineryTrader. Marine salvage has nothing. The hotline fills a gap that's existed for decades." },
            { title: "Boat season creates urgency", copy: "The window is May-September. A broken engine in June means missing the entire summer. Finding a lower unit in 2 seconds vs 2 weeks changes someone's season." },
            { title: "Only 200-500 marine salvage yards nationwide", copy: "The market is small and scattered. Each yard specializes in different brands. The hotline connects the entire fragmented network in one call." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why marine parts can't be searched — only asked</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "No standardized interchange database", copy: "Will a 2008 Mercury 150 OptiMax powerhead fit a 2005? There's no interchange guide. The answer lives in a salvage yard owner's head." },
            { title: "Freshwater vs saltwater matters", copy: "A sterndrive from a freshwater lake boat is worth 2x more than one from a saltwater marina. That distinction doesn't exist in any online listing." },
            { title: "Model-year quirks need expertise", copy: "'Is it the SX drive or the DP?' 'Alpha One Gen I or Gen II?' Marine parts compatibility requires conversation with someone who knows the platform." },
            { title: "Marine mechanics want relationships", copy: "Boat repair shops build relationships with reliable parts sources. Voice networks create the trust that email can't." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="ind-section-head" style={{textAlign:'left', maxWidth:'none', marginLeft:0, marginRight:0}}>
            <p className="ind-kicker">FAQ</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ind-faq-list">
            {FAQS.map((f, i) => (
              <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p>
          <h2>The marine parts hotline</h2>
          <p>Proven in auto parts (500+ yards, 15,000+ requests). Now expanding to marine salvage. Join the waitlist to get early access.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          <IndustryLinks current="/use-case/marine-boat-parts" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /use-case/railroad-parts-hotline                                            */
/* ================================================================== */

export function RailroadPartsPage() {
  const FAQS = [
    { q: "What railroad parts can I find on the hotline?", a: "Locomotive engine parts (EMD 645/710 series, GE FDL/GEVO power assemblies, turbochargers, fuel injectors), traction motors and generators, dynamic brake grids and blowers, air compressors (Gardner Denver, Westinghouse WABCO), HEP generators, truck assemblies, traction motor wheelsets, couplers, air brake valves, electronic control modules, and cab components. The network handles used locomotive parts for sale from decommissioned Class I power as well as rebuilt and remanufactured railroad equipment parts." },
    { q: "How does a railroad parts hotline work?", a: "You join a live voice conference with locomotive parts dealers, railroad surplus operations, and rebuilders. When you need a part — a traction motor for an EMD SD70, a turbocharger for a GE Dash 9 — you key up and describe it. Every rail parts supplier on the line hears your request simultaneously. The dealer with the part responds live. Average response time on our proven auto parts network: 2 seconds. No callbacks, no waiting for emails." },
    { q: "What does it cost to join the railroad parts network?", a: "Flat monthly membership. No per-search fees, no commissions on sales, no listing fees. A preconfigured desk phone is included with membership. At locomotive parts values — a single traction motor can run $8,000-$25,000, a prime mover $50,000+ — one successful part locate covers months of membership." },
    { q: "How does this serve Class I railroads vs. short line operators?", a: "Class I railroads (BNSF, Union Pacific, CSX, Norfolk Southern, CN, CP) constantly decommission locomotives and equipment. That surplus enters a fragmented dealer network. Short line railroads and industrial rail operators need those exact parts but can't afford OEM prices or wait months for factory lead times. The hotline connects both sides — Class I surplus sellers hear every request from short line and industrial buyers in real time." },
    { q: "Can I find rebuilt or remanufactured locomotive parts?", a: "Yes. Many dealers on the network specialize in rebuilt traction motors, remanufactured air compressors, overhauled turbochargers, and reconditioned locomotive engine parts. When you broadcast a request, you'll hear from dealers offering serviceable, rebuilt, and remanufactured options — so you can compare condition and price before buying. Rebuilt locomotive parts are a core segment of the used railroad equipment parts market." },
    { q: "How does this address FRA compliance and safety requirements?", a: "The hotline connects you with established railroad parts dealers who understand FRA regulatory requirements. Parts sourced through the network still go through your standard inspection and qualification process. The hotline solves the sourcing problem — finding who has the part — not the compliance workflow. Dealers can confirm whether parts come with service history, test reports, or rebuild documentation during the live conversation." },
    { q: "What geographic areas does the railroad parts network cover?", a: "The network is nationwide. Railroad parts dealers and surplus operations are concentrated in rail hubs — Chicago, Omaha, Kansas City, Atlanta, Jacksonville, Houston, and the Pacific Northwest — but the voice network reaches everywhere. A short line operator in Vermont can find a traction motor from a surplus dealer in Texas in seconds. One broadcast, coast to coast." },
    { q: "Do you serve heritage railroads and railroad museum operations?", a: "Absolutely. Heritage railroads and museum operators face some of the hardest sourcing challenges — they need parts for EMD F-units, Alco RS-series, GE U-boats, and other vintage locomotive engine parts that haven't been manufactured in decades. The hotline reaches dealers who specialize in legacy railroad equipment. When you broadcast 'need a prime mover for an Alco RS-3,' the network finds the one dealer who has it sitting in a shop." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title="Railroad & Locomotive Parts Hotline — Find EMD, GE, Alco Parts Fast"
        description="Find used railroad and locomotive parts in seconds. Traction motors, diesel engines, dynamic brakes, air compressors. Broadcast to every rail parts supplier at once. EMD, GE/Wabtec, Alco."
        keywords="railroad parts, locomotive parts, used railroad equipment parts, rail parts supplier, traction motor parts, railroad parts locator, train parts used, locomotive engine parts, railroad brake parts, used locomotive parts for sale, railroad equipment supplier"
        path="/use-case/railroad-parts-hotline"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Railroad & Locomotive Parts Hotline — Hotline HQ",
              serviceType: "Railroad Parts Locating Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for finding used railroad and locomotive parts. Broadcast what you need to every rail parts supplier simultaneously. EMD, GE/Wabtec, Alco — traction motors, diesel engines, dynamic brakes, air compressors.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@type": "HowTo",
              name: "How to Find Railroad & Locomotive Parts on a Voice Hotline",
              description: "Broadcast your locomotive part requirement to every rail parts dealer at once — EMD, GE/Wabtec, Alco components found in seconds.",
              step: [
                { "@type": "HowToStep", position: 1, name: "Join the railroad parts hotline", text: "Connect via desk phone or web client. You join a live conference with locomotive parts dealers, surplus operations, rebuild shops, and Class I retirement specialists." },
                { "@type": "HowToStep", position: 2, name: "Broadcast in railroad language", text: "'Need a D77 traction motor for an SD40-2, or a 645E3B turbocharger — the Elliott, not the Schwitzer.' Every rail parts supplier on the line hears you at once. No search filters can handle this specificity." },
                { "@type": "HowToStep", position: 3, name: "Get options from across the network", text: "Dealers respond with surplus, rebuilt, or serviceable options. Discuss FRA compliance, test documentation, and shipping to your rail yard — all in one conversation. First dealer with the right part wins." },
              ],
            },
          ],
        }}
      />
      <SiteNav />

      <section className="ind-hero" style={{backgroundImage:'url(/images/industries/railroad.webp)'}}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">RAILROAD</p>
          <h1>Find railroad parts <em>before downtime derails your operation</em></h1>
          <p className="ind-hero-sub">
            A sidelined locomotive costs thousands per day. OEM lead times stretch to months.
            A railroad parts hotline broadcasts your request to every dealer at once — EMD, GE, Alco — surplus, rebuilt, and serviceable locomotive parts found in seconds.
          </p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">THE PROBLEM</p>
          <h2>How do you find used railroad equipment parts today?</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "OEM lead times measured in months", copy: "You need a traction motor for an EMD SD40-2 or a turbocharger for a GE Dash 9. The OEM quote comes back: 16-24 weeks, if the part is still in production. For legacy locomotives — Alco, early EMD, older GE units — factory parts may not exist at all. Short line railroads and industrial operators can't park a locomotive for half a year waiting on a factory order." },
            { title: "The surplus market is fragmented", copy: "Class I railroads — BNSF, Union Pacific, CSX, Norfolk Southern — decommission locomotives constantly. That surplus flows to a network of specialized dealers, rebuilders, and brokers scattered across the country. Finding who has your specific part means calling dealer after dealer. There's no central database for used locomotive parts for sale." },
            { title: "Specialized parts need specialized knowledge", copy: "Railroad parts aren't interchangeable commodities. A traction motor for an EMD GP38 won't fit a GP40. The air compressor on a GE C40-8W is different from the one on an ES44AC. You need a dealer who knows the difference — and finding that dealer by calling around wastes days that a short line operator or heritage railroad can't afford." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE HOTLINE APPROACH</p>
          <h2>One broadcast. Every rail parts supplier hears it. Seconds, not weeks.</h2>
          <p className="ind-lede">
            The same live voice network that's located 15,000+ auto parts — now for railroad and locomotive parts.
            Join the conference line, describe what you need, and every dealer responds in real time.
          </p>
        </div>
        <div className="ind-grid">
          {[
            { title: "Class I surplus meets short line demand instantly", copy: "When BNSF or Union Pacific retires a fleet of SD70ACes, the components scatter to dealers across the country. A short line operator in New England needs a traction motor from that batch. One broadcast on the railroad parts hotline reaches every surplus dealer simultaneously — the one with your part speaks up in seconds, not after days of phone tag." },
            { title: "Describe the part in railroad language", copy: "'I need an EMD 645E3B turbocharger, non-aftercooled, for a GP38-2 — the Elliott, not the Schwitzer.' Try putting that in a search filter. On a voice network, the dealer who has it understands exactly what you mean. Locomotive engine parts are too specific for search boxes. Plain language and conversation handle the nuance." },
            { title: "No inventory listing required to sell", copy: "If you're a railroad parts dealer with a yard full of decommissioned locomotive components, you don't need to catalog every traction motor and air compressor online. Just listen. When someone broadcasts 'need a D77 traction motor for an SD40-2,' you walk to the shelf and respond. The network surfaces demand for railroad parts you haven't listed anywhere." },
            { title: "Rebuilt, serviceable, and surplus — all in one call", copy: "One broadcast reaches dealers offering different conditions: a surplus traction motor pulled last month, a rebuilt unit with test documentation, a serviceable compressor ready to install. You compare options in a single conversation instead of making separate calls to surplus yards, rebuild shops, and brokers. The railroad equipment supplier who has what you need finds you." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">PARTS IN DEMAND</p>
          <h2>Most-searched railroad and locomotive parts</h2>
        </div>
        <div className="ind-parts-grid">
          {[
            "Traction motors (EMD D77/D78, GE GEB/GTA)", "Diesel engines (EMD 645/710, GE FDL/GEVO)", "Dynamic brake grids & blowers",
            "Air compressors (Gardner Denver, WABCO)", "HEP generators & alternators", "Turbochargers",
            "Truck assemblies & equalizers", "Railroad brake valves & cylinders", "Electronic control modules", "Radiator cores & cooling fans",
          ].map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
        </div>
        <p className="ind-footnote">
          Top makes: EMD (Electro-Motive), GE Transportation (Wabtec), Alco. Common models: SD40-2, SD70, GP38-2, GP40, ES44AC, Dash 9, C40-8W.
        </p>
      </section>

      <section className="ind-section ind-band">
        <div className="ind-section-head">
          <p className="ind-kicker">THE ECONOMICS</p>
          <h2>Short line economics: why used locomotive parts make sense</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "OEM lead times: 16-24 weeks", copy: "Class I railroads can wait for factory orders. Short lines and industrial operators can't park a locomotive for half a year." },
            { title: "Surplus from Class I retirements", copy: "When BNSF or UP retires a fleet, thousands of components hit the aftermarket. The hotline connects that surplus to the short lines that need it." },
            { title: "Heritage railroads need obsolete parts", copy: "Tourist and museum railroads operate Alco, old EMD, and early GE locomotives. Factory parts don't exist. Used/rebuilt is the only option." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section">
        <div className="ind-section-head">
          <p className="ind-kicker">WHY VOICE</p>
          <h2>Why railroad parts need voice, not search</h2>
        </div>
        <div className="ind-grid">
          {[
            { title: "Locomotive specs are too specific for filters", copy: "'EMD 645E3B turbocharger, non-aftercooled, for a GP38-2 — the Elliott, not the Schwitzer.' That's a voice request." },
            { title: "FRA compliance requires conversation", copy: "Federal Railroad Administration rules govern what parts can go on revenue service locomotives. Compliance questions need dealer expertise, not a search box." },
            { title: "The surplus market is fragmented", copy: "Locomotive components scatter to specialized dealers across the country after fleet retirements. No single database aggregates them." },
            { title: "Low volume, high value per part", copy: "A traction motor is $15K-$30K. At these values, the speed advantage of a 2-second hotline response vs 3-day phone search is worth serious money." },
          ].map((b, i) => (
            <div className="ind-card" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ind-section ind-band">
        <div style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="ind-section-head" style={{textAlign:'left', maxWidth:'none', marginLeft:0, marginRight:0}}>
            <p className="ind-kicker">FAQ</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ind-faq-list">
            {FAQS.map((f, i) => (
              <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{color:'var(--red)'}}>COMING SOON</p>
          <h2>The railroad parts hotline</h2>
          <p>Proven in auto parts (500+ yards, 15,000+ requests). Now expanding to railroad and locomotive parts. Join the waitlist to get early access and help shape the network.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          <IndustryLinks current="/use-case/railroad-parts-hotline" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Industry page styles                                                */
/* ------------------------------------------------------------------ */

const IND_CSS = `
.ind-hero { position: relative; padding: 160px 32px 80px; overflow: hidden; text-align: center; background: linear-gradient(170deg, #16181d 0%, #1e2024 100%); background-size: cover; background-position: center; }
.ind-hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(22,24,29,0.82) 0%, rgba(22,24,29,0.92) 60%, rgba(22,24,29,0.98) 100%); pointer-events: none; }
.ind-hero-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.ind-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--red, #d92d20); margin: 0 0 16px; }
.ind-hero h1 { font-size: clamp(36px, 5vw, 64px); font-weight: 700; color: #fff; line-height: 1.08; letter-spacing: -0.015em; margin: 0 0 22px; }
.ind-hero h1 em { font-style: normal; color: var(--red, #d92d20); }
.ind-hero-sub { font-size: 18px; line-height: 1.65; color: rgba(255,255,255,0.6); max-width: 620px; margin: 0 auto 32px; }
.ind-hero-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.ind-btn { font-weight: 600; font-size: 15.5px; padding: 14px 28px; border-radius: 11px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; cursor: pointer; border: none; }
.ind-btn:active { transform: translateY(1px); }
.ind-btn-hot { background: var(--red, #d92d20); color: #fff; box-shadow: 0 8px 24px -6px rgba(217,45,32,0.5); }
.ind-btn-hot:hover { background: #b52a23; box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.ind-btn-ghost { background: rgba(255,255,255,0.12); color: #fff !important; border: 2px solid rgba(255,255,255,0.5); backdrop-filter: blur(4px); }
.ind-btn-ghost:hover { background: rgba(255,255,255,0.22); border-color: #fff; }

/* proof bar */
.fp-proof-bar, .ind-proof-bar { display: flex; justify-content: center; gap: 0; background: #16181d; border-top: 1px solid rgba(255,255,255,0.06); }
.fp-proof-bar { display: none; }
.ind-proof-bar { display: flex; }

/* shared proof bar component */
.fp-proof-bar, .ind-section .fp-proof-bar { display: none; }

/* proof bar via component */
div:has(> .fp-proof-item) { display: flex; justify-content: center; gap: 0; background: #16181d; border-top: 1px solid rgba(255,255,255,0.06); padding: 0; }
.fp-proof-item { padding: 20px 32px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06); }
.fp-proof-item:last-child { border-right: none; }
.fp-proof-item strong { display: block; font-size: 22px; font-weight: 700; color: #fff; }
.fp-proof-item span { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.4); }

/* sections */
.ind-section { padding: 90px 32px; max-width: 1100px; margin: 0 auto; }
.ind-band { background: #f8f7f5; max-width: 100%; }
.ind-band .ind-section-head, .ind-band .ind-grid { max-width: 1100px; margin-left: auto; margin-right: auto; }
.ind-section-head { text-align: center; margin-bottom: 48px; }
.ind-section-head h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 700; line-height: 1.08; letter-spacing: -0.015em; color: #16181d; margin: 0 0 16px; }
.ind-lede { font-size: 17px; line-height: 1.65; color: #6b7075; max-width: 640px; margin: 0 auto; }
.ind-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.ind-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px 26px; }
.ind-band .ind-card { background: #fff; }
.ind-card h3 { font-size: 17px; font-weight: 700; color: #16181d; margin: 0 0 10px; }
.ind-card p { font-size: 15px; line-height: 1.65; color: #6b7075; margin: 0; }

/* parts grid */
.ind-parts-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 800px; margin: 0 auto; }
.ind-part-tag { padding: 10px 18px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-weight: 500; color: #16181d; }
.ind-footnote { text-align: center; font-size: 14px; color: #6b7075; margin-top: 24px; }

/* FAQ */
.ind-faq-list { max-width: 680px; }
.ind-faq { border-bottom: 1px solid #e5e7eb; }
.ind-faq summary { padding: 20px 0; font-size: 16px; font-weight: 600; color: #16181d; cursor: pointer; list-style: none; }
.ind-faq summary::-webkit-details-marker { display: none; }
.ind-faq summary::before { content: '+'; margin-right: 12px; font-weight: 700; color: var(--red, #d92d20); }
.ind-faq[open] summary::before { content: '−'; }
.ind-faq p { padding: 0 0 20px 24px; font-size: 15px; line-height: 1.65; color: #6b7075; margin: 0; }

/* CTA */
.ind-cta { background: #16181d; padding: 110px 32px; }
.ind-cta-inner { max-width: 560px; margin: 0 auto; text-align: center; }
.ind-cta-inner h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 700; color: #fff; margin: 0 0 16px; }
.ind-cta-inner p { font-size: 17px; line-height: 1.65; color: rgba(255,255,255,0.5); margin: 0 0 32px; }
.ind-cta-alt { margin-top: 20px; font-size: 14px; color: rgba(255,255,255,0.4); }
.ind-cta-alt a { color: rgba(255,255,255,0.7); text-decoration: underline; text-underline-offset: 2px; }
.ind-cta-alt a:hover { color: #fff; }

@media (max-width: 600px) {
  .ind-hero { padding: 120px 16px 60px; }
  .ind-section { padding: 60px 16px; }
  .ind-cta { padding: 64px 16px; }
  .ind-hero-ctas { flex-direction: column; align-items: center; }
  .ind-btn { width: 100%; max-width: 320px; text-align: center; justify-content: center; }
  .fp-proof-item { padding: 14px 16px; }
  .fp-proof-item strong { font-size: 18px; }
}
`;
