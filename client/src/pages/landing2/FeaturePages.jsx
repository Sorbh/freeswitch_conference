import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";
import BlogLayout from "./BlogLayout";
import REGION_CONTENT from "../../../../data/regions-ssr-data.json";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";

/* ================================================================== */
/*  /find-used-auto-parts — buyer intent SEO page                      */
/*  Targets: "find used auto parts", "used car parts near me",         */
/*  "used auto parts online", "salvage auto parts"                     */
/* ================================================================== */

export function FindPartsPage() {
  const STEPS = [
    { n: "1", title: "Join and pick your room", copy: "Sign up free and choose your regional room — California, Texas, Florida, Arizona, or any of our 15 active markets. Connect through a preconfigured desk phone (shipped to you) or the web client on any computer." },
    { n: "2", title: "Broadcast what you need", copy: "Key up and describe the part: year, make, model, and what you're looking for. Your request goes out live to every yard in the room — roughly 97 yards hear it simultaneously. No typing, no forms, no search filters." },
    { n: "3", title: "Get answers in 2 seconds", copy: "Yards that have your part respond immediately on the line. Average response time across 15,000+ requests: under 2 seconds. 60% of broadcasts get answered live. Unanswered requests post to the Marketplace for later responses." },
  ];

  const CHANNELS = [
    { name: "Calling yards one by one", speed: "45–90 min", cost: "Free (your time)", effort: "Dial, wait, describe, repeat — for each yard", flaw: "You might call 20 yards before finding the part. Most of those calls end in voicemail or 'let me check and call you back.' An hour later, you've talked to 3 people." },
    { name: "Car-Part.com / Hollander", speed: "Minutes to hours", cost: "Free search / paid listing", effort: "Search, filter, call the yard, hope it's still there", flaw: "Inventory goes stale — parts get pulled daily. You find a listing, call the yard, and hear 'we sold that yesterday.' The database says yes; the yard says no." },
    { name: "Facebook / Craigslist", speed: "Hours to days", cost: "Free", effort: "Post, wait, scroll, message, negotiate", flaw: "You're competing with 50 other posts. Response time depends on who's scrolling. No way to verify the seller has the part until you drive there. Tire kickers go both ways." },
    { name: "Hotline HQ", speed: "2 seconds", cost: "Flat monthly — no per-search fee", effort: "Speak what you need. Done.", flaw: "97 yards hear your request the instant you say it. First yard with the part keys up and responds. You deal directly — no platform in the middle. 60% of requests answered live.", hot: true },
  ];

  const FAQS = [
    { q: "What is an auto parts hotline?", a: "A live voice conference network that connects salvage yards and dismantlers in the same region. Instead of calling yards one by one, you join a shared conference line and broadcast what you need. Every yard on the line hears your request simultaneously and responds by voice. Hotline HQ operates the largest network of its kind in the US with 500+ member yards across 15 rooms." },
    { q: "How do I find a used auto part on Hotline HQ?", a: "Sign up free, pick your regional room, and connect through the desk phone or web client. When you need a part, key up and describe it — '2018 Honda Civic, need the rack and pinion.' Every yard in the room hears you live. If someone has it, they respond in seconds. You contact them directly to close the deal." },
    { q: "How fast do yards actually respond?", a: "The network average is under 2 seconds. That's not a marketing number — it's measured across 15,000+ broadcasts. Because every yard hears the request simultaneously, the first yard with the part simply speaks up. There's no queue, no hold time, and no voicemail. 60% of all requests get answered live on the first broadcast." },
    { q: "Is Hotline HQ free?", a: "Joining the network costs a flat monthly membership fee. No per-call charges, no per-search fees, no commissions. Search for 1 part or 50 parts a day — the price doesn't change. A preconfigured Yealink desk phone is included and shipped to your location at no extra cost." },
    { q: "What parts can I find?", a: "Anything salvage yards carry. The most-requested parts on the network are bumpers (398 requests), transmissions (282), fenders (204), doors (147), motors and engines (273), headlights (131), and taillights (110). Top makes: Ford, Toyota, Honda, Chevrolet, Nissan, and Dodge. Model years from the 1990s through 2025." },
    { q: "What if nobody has my part?", a: "If your request goes unanswered on the live line, it automatically posts to the Hotline HQ Marketplace — a public board where any yard can respond later. You can also switch rooms and broadcast to a different region. Some yards monitor multiple rooms throughout the day to catch requests from neighboring states." },
    { q: "How is this different from an online parts database?", a: "Databases show you what was in stock when someone last updated the listing — which might've been last week. On Hotline HQ, you're asking real people who can walk the yard and check right now. One broadcast reaches 97 yards at once, replacing what used to take an hour of phone calls. The answer is live and current." },
    { q: "Do I need special equipment?", a: "Every membership includes a preconfigured Yealink T31P desk phone — plug in the ethernet cable and you're on the network in 60 seconds. You can also use the web client from any computer or laptop. Most members keep the desk phone on the counter for all-day listening and use the web client when they're away." },
    { q: "What regions are covered?", a: "15 regional rooms: California (the largest, 200+ yards), Texas, Florida, Arizona, Ohio, Michigan, Indiana, Georgia, New York, Carolinas, Mexico, and more. You can join any room and switch between them instantly. If your state doesn't have a room yet, you can request one." },
    { q: "Can I use this for wreck opinions and other non-parts requests?", a: "Yes. The network handles all kinds of requests — wreck opinions, hard-to-find assemblies, bulk orders, and parts that don't fit neatly into a database search. You describe what you need in plain language, and the yards who can help will respond. 'Wreck opinion' is one of the most common request types on the network." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Find Used Auto Parts — Search 500+ Yards in 2 Seconds | Hotline HQ"
        description="Find used auto parts instantly. One broadcast reaches 97 yards at once. 15,000+ parts located. 2-second avg response. No database — live voice answers."
        keywords="find used auto parts, used auto parts near me, used car parts, salvage auto parts, junkyard parts, cheap used auto parts, auto parts search, used auto parts online, where to find used auto parts, auto parts hotline"
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
              description: "Live voice network connecting auto dismantlers. Broadcast what part you need and get answers from 97 yards simultaneously in under 2 seconds. 15,000+ part requests processed.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
            {
              "@type": "HowTo",
              name: "How to Find Used Auto Parts on Hotline HQ",
              description: "Join the voice network, broadcast what you need, and get live answers from salvage yards in seconds.",
              step: STEPS.map((s, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: s.title,
                text: s.copy,
              })),
            },
          ],
        }}
      />
      <SiteNav />

      {/* ──── Hero ──── */}
      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">FIND PARTS FASTER</p>
          <h1>Find used auto parts from <em>500+ yards</em> in 2 seconds</h1>
          <p className="fp-hero-sub">
            Over 15,000 part requests have been broadcast on Hotline HQ. Each one reaches ~97 salvage yards simultaneously.
            Average response time: <strong>2 seconds</strong>. Stop calling around — broadcast once and get live answers.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Start Finding Parts — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">Browse Open Requests</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>
        </div>
      </section>

      {/* ──── How It Works ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">HOW IT WORKS</p>
          <h2>Three steps to the part you need</h2>
          <p className="fp-lede">
            No search forms. No filters. No scrolling through listings.
            You describe the part out loud and 97 yards hear you at once. Learn more about <Link to="/used-auto-parts-hotline">how the hotline works</Link>.
          </p>
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

      {/* ──── Why It Beats Other Methods ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">COMPARE METHODS</p>
          <h2>How do you find used auto parts today?</h2>
          <p className="fp-lede">
            Every parts buyer has a routine — call around, check databases, post on Facebook.
            Each method has trade-offs. Here's how they compare to a live voice network.
          </p>
        </div>
        <div className="fp-compare">
          {CHANNELS.map((c, i) => (
            <div className={`fp-compare-card${c.hot ? ' hot' : ''}`} key={i}>
              <p className="fp-compare-label">{c.name}</p>
              <div className={`fp-compare-time${c.hot ? ' good' : ''}`}>
                <span>Time to answer</span>
                <strong>{c.speed}</strong>
              </div>
              <div className="fp-compare-meta">
                <span><strong>Cost:</strong> {c.cost}</span>
                <span><strong>Effort:</strong> {c.effort}</span>
              </div>
              <p className="fp-compare-copy">{c.flaw}</p>
              {c.hot && <span className="fp-compare-badge">Fastest method</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ──── What You Can Find ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">NETWORK DATA</p>
          <h2>What parts are people finding on the network?</h2>
          <p className="fp-lede">
            These are the most-requested parts across 15,000+ live broadcasts.
            If you need any of these, the network already has yards responding daily.
          </p>
        </div>
        <div className="fp-parts-grid">
          {[
            { part: "Bumpers", count: "398" },
            { part: "Transmissions", count: "282" },
            { part: "Fenders", count: "204" },
            { part: "Doors", count: "147" },
            { part: "Motors / Engines", count: "273" },
            { part: "Headlights", count: "131" },
            { part: "Taillights", count: "110" },
            { part: "AC Compressors", count: "85" },
          ].map((p, i) => (
            <div className="fp-part-card" key={i}>
              <strong className="fp-part-name">{p.part}</strong>
              <span className="fp-part-count">{p.count} found</span>
            </div>
          ))}
        </div>
        <p className="fp-section-footnote">
          Top makes: Ford (900+), Toyota (830+), Honda (635+), Chevrolet (525+), Nissan (280+).
          Wreck opinions, assemblies, and <Link to="/hard-to-find-auto-parts" style={{color:'var(--red)'}}>hard-to-find parts</Link> are also common requests.
          Looking for <Link to="/ev-hybrid-auto-parts" style={{color:'var(--red)'}}>EV or hybrid parts</Link>? The network has growing Tesla, Prius, and Leaf inventory.
        </p>
      </section>

      {/* ──── Why Voice Beats Search ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">WHY VOICE</p>
          <h2>Why a live voice network finds parts faster than any database</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Real-time inventory verification", copy: "When a yard responds on the line, you know the part is there right now. Not last week, not 'in stock per our database' — right now. The person talking to you can see the part from where they're standing. That's verification no database can match." },
            { title: "One request, 97 yards", copy: "Calling yards one by one, you might reach 5 in an hour. On Hotline HQ, 97 yards hear your request the instant you say it. The math is simple: more ears, faster answers. The network's 2-second response time isn't luck — it's scale." },
            { title: "Plain language, not search filters", copy: "Try typing 'wreck opinion on an 06 Silverado 2500, need to know if the transfer case is good' into a parts database. On a voice network, you just say it. The yards who can help understand exactly what you need — including context a search box can't capture." },
            { title: "No stale listings", copy: "Parts databases show what was available when someone last updated the record. Inventory changes every day — parts get pulled, vehicles get crushed, new stock arrives. A live voice network has no listings to go stale. You ask, someone answers, and the answer is current." },
          ].map((a, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{a.title}</h3>
              <p>{a.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── The Search Timeline ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">THE SEARCH TIMELINE</p>
          <h2>How long does it actually take to find a used auto part?</h2>
          <p className="fp-lede">
            Every method has a speed. Here's what real search time looks like
            across the three most common channels.
          </p>
        </div>
        <div className="fp-math-grid">
          <div className="fp-math-card">
            <strong>45 min</strong>
            <span>Average time calling 5 yards one by one</span>
            <em>Phone tag + voicemail</em>
          </div>
          <div className="fp-math-card">
            <strong>15 min</strong>
            <span>Search Car-Part.com, find listing, call, verify</span>
            <em>If the listing is current</em>
          </div>
          <div className="fp-math-card">
            <strong>2s</strong>
            <span>Broadcast on Hotline HQ, get a live answer</span>
            <em>Verified in real time</em>
          </div>
        </div>

        <div className="fp-guide-section" style={{marginTop:48}}>
          <h3>What happens when you can't find the part</h3>
          <p>
            About 60% of broadcasts on Hotline HQ get answered live on the line — someone keys up within
            seconds and confirms they have the part. The other 40% go to the <strong>Marketplace</strong>,
            an open board where yards can respond later at their own pace. Your request doesn't disappear;
            it stays visible until someone fills it.
          </p>
          <p>
            For hard-to-find parts — discontinued models, rare foreign makes, unlisted backyard inventory —
            the voice network reaches yards that never catalog online. If nobody has it in your home room,
            switch rooms and try a different region. For dedicated help
            with <Link to="/hard-to-find-auto-parts" style={{color:'var(--red)'}}>hard-to-find auto parts</Link>,
            we built a guide on how the network handles the toughest searches.
          </p>
        </div>
      </section>

      {/* ──── Regional Coverage ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">REGIONAL COVERAGE</p>
          <h2>Where the network operates</h2>
          <p className="fp-lede">
            Hotline HQ runs 15 regional rooms across the United States. Each room connects the
            dismantlers and shops in that market. Here are the four most active.
          </p>
        </div>
        <div className="fp-channel-stack">
          <div className="fp-channel-card">
            <p className="fp-channel-label">MOST ACTIVE</p>
            <h4>California</h4>
            <p>
              200+ yards on the line. The largest room on the network and the most active by broadcast
              volume. Import parts move fast — Honda, Toyota, and Nissan dominate requests. If you're
              searching for a part from a Japanese or Korean make, start here.
            </p>
          </div>
          <div className="fp-channel-card">
            <p className="fp-channel-label">GROWING FAST</p>
            <h4>Texas</h4>
            <p>
              Ford and Chevy truck parts are the top requests in the Texas room. F-150 bumpers,
              Silverado transmissions, and RAM doors move within minutes. The room is growing
              fast as more yards in the DFW, Houston, and San Antonio markets come online.
            </p>
          </div>
          <div className="fp-channel-card">
            <p className="fp-channel-label">YEAR-ROUND</p>
            <h4>Florida</h4>
            <p>
              Year-round demand for AC compressors, condensers, and cooling parts. Florida yards
              carry rust-free inventory that out-of-state buyers search for constantly. The room
              stays active through every season — no winter slowdown.
            </p>
          </div>
          <div className="fp-channel-card">
            <p className="fp-channel-label">DESERT CLEAN</p>
            <h4>Arizona</h4>
            <p>
              Rust-free body panels, clean underbodies, and sun-baked but structurally solid parts.
              Arizona inventory is prized by yards and shops in rust-belt states. If you need a
              clean fender or quarter panel, the Arizona room is where to ask.
            </p>
          </div>
        </div>

        <div className="fp-guide-section" style={{marginTop:48}}>
          <h3>15 rooms and counting</h3>
          <p>
            Beyond the big four, Hotline HQ operates rooms in Ohio, Michigan, Indiana, Georgia,
            New York, the Carolinas, and more. Each room is tuned to the makes and models that
            dominate its region. You can switch rooms instantly from the web dashboard or by
            pressing a softkey on your desk phone — no need to hang up and redial.
          </p>
          <p>
            Start in your home state, then branch out. Many buyers check two or three rooms before
            finding a match. Browse
            the <Link to="/used-auto-parts/california" style={{color:'var(--red)'}}>California room</Link> and
            the <Link to="/used-auto-parts/texas" style={{color:'var(--red)'}}>Texas room</Link> to see what's
            being requested right now.
          </p>
        </div>
      </section>

      {/* ──── Buyer Tips ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">BUYER TIPS</p>
          <h2>How to get faster answers on the network</h2>
          <p className="fp-lede">
            The yards who respond fastest reward clear, specific requests. A few habits
            make the difference between a 2-second answer and silence.
          </p>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Describe the part like you're talking to a person", copy: "Voice networks let you say exactly what you need — including color, condition preferences, and context. Instead of filtering a search box, you say 'I need a driver-side fender for an 09 Accord, silver if you have it, doesn't need to be perfect.' The yards who have it understand you instantly." },
            { title: "Check multiple rooms", copy: "If your home room doesn't have the part, switch to neighboring states. A Texas buyer looking for a Tacoma part might have better luck in the California room, where Toyota inventory runs deep. Switching rooms takes one button press on the desk phone or one click on the web dashboard." },
            { title: "Compare on the Marketplace too", copy: "Unanswered requests automatically post to the Hotline HQ Marketplace, where yards can respond at their own pace. Check back after your broadcast — a yard that was away from the line may have exactly what you need and will reach out through the marketplace board." },
            { title: "Stack your search channels", copy: "Use Hotline HQ for speed — broadcast once and reach 97 yards in 2 seconds. Use Car-Part.com for browsing when you want to compare prices and availability at your own pace. The two channels complement each other. For a detailed breakdown, see our guide on how Hotline HQ compares as a Car-Part.com alternative." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
        <p className="fp-section-footnote">
          Want to sell parts instead? <Link to="/sell-used-auto-parts" style={{color:'var(--red)'}}>Learn how yards sell on the network</Link> — no listings, no commissions.
        </p>
      </section>

      {/* ──── FAQ ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ──── Bottom CTA ──── */}
      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>READY TO FIND PARTS?</p>
          <h2>Join 500+ yards on the network</h2>
          <p>Free to join. No credit card. Broadcast your first request in under 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Not ready to sign up? <Link to="/#top">Listen to a live call first</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            Also: <Link to="/sell-used-auto-parts">Sell parts on the network</Link> · <Link to="/hard-to-find-auto-parts">Hard-to-find parts</Link> · <Link to="/car-part-alternative">Car-Part.com vs Hotline HQ</Link>
          </p>
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
  const STATS = [
    { value: "15,000+", label: "Part requests broadcast" },
    { value: "~97", label: "Yards hear each request" },
    { value: "2s", label: "Average response time" },
    { value: "60%", label: "Requests answered live" },
  ];

  const STEPS = [
    { n: "1", title: "Join and pick your room", copy: "Sign up free, choose your regional room — California, Texas, Florida, Arizona, or any of our 15 markets. A preconfigured Yealink desk phone ships to your yard, or connect instantly through the web client." },
    { n: "2", title: "Listen to live requests", copy: "Your phone stays on the conference line all day. When a dismantler or shop needs a part, they key up and describe it: year, make, model, what they need. You hear it the instant they say it — no delay, no app to check." },
    { n: "3", title: "Respond and close the deal", copy: "Got the part? Key up and say so. The requester hears you immediately and contacts your yard directly to close the sale. Average response time on the network is under 2 seconds. First to answer wins." },
  ];

  const CHANNELS = [
    { name: "eBay Motors", speed: "3–7 days", cost: "13% final value fee", effort: "High — photos, listings, shipping", flaw: "Margins shrink fast. Returns eat into profit. Every part needs photos, a listing, and packaging. Works for high-value parts, but most yard inventory doesn't justify the effort." },
    { name: "Facebook Marketplace", speed: "Hours to days", cost: "Free or 5% shipping fee", effort: "Medium — photos, messages, negotiation", flaw: "Tire kickers, lowballers, and no-shows. You're competing with private sellers. No filtering for serious buyers. Every sale starts with 'Is this still available?'" },
    { name: "Car-Part.com / Hollander", speed: "Hours to days", cost: "Subscription + per-part fees", effort: "High — full inventory cataloging", flaw: "You need every part photographed, cataloged, and priced before anyone can find it. Inventory changes daily. Most small yards can't keep up with the data entry." },
    { name: "Hotline HQ", speed: "2 seconds", cost: "Flat monthly — no commission", effort: "Zero — just listen and talk", flaw: "You hear requests live, respond by voice, and close the deal directly. No listing, no photos, no data entry. Sell parts you haven't even cataloged yet.", hot: true },
  ];

  const TOP_PARTS = [
    { part: "Bumpers", count: "398" },
    { part: "Transmissions", count: "282" },
    { part: "Fenders", count: "204" },
    { part: "Doors", count: "147" },
    { part: "Motors / Engines", count: "273" },
    { part: "Headlights", count: "131" },
    { part: "Taillights", count: "110" },
    { part: "AC Compressors", count: "85" },
  ];

  const FAQS = [
    { q: "How do I sell used auto parts on Hotline HQ?", a: "Sign up free and pick your regional room. A preconfigured desk phone ships to your yard — plug it in and you're on the network. When someone needs a part, you hear the request live. If you have it, key up and respond. The buyer contacts you directly. No middleman, no commission, no listing required." },
    { q: "Do I need to list or catalog my inventory?", a: "No. Hotline HQ isn't an inventory database — it's a live voice network. You don't list parts; you listen for requests and respond when you have what someone needs. This means you can sell parts you haven't photographed, priced, or entered into any system. The network surfaces demand for whatever's in your yard." },
    { q: "How many part requests happen per day?", a: "The network has processed over 15,000 part requests to date. Active rooms like California average 40+ broadcasts per day. The most-requested parts are bumpers, transmissions, fenders, motors, and doors. The most-requested makes are Ford, Toyota, Honda, Chevrolet, and Nissan — the bread-and-butter of most salvage yards." },
    { q: "What does Hotline HQ cost?", a: "Flat monthly membership fee. No listing fees, no per-call charges, no commissions on any sale you make through the network. Sell 1 part or 50 parts a day — the price is the same. A preconfigured Yealink desk phone is included with membership and shipped directly to your yard at no extra charge." },
    { q: "What regions does Hotline HQ cover?", a: "15 regional rooms covering California, Texas, Florida, Arizona, Ohio, Michigan, Indiana, Georgia, New York, the Carolinas, and more. California is the largest room with 200+ active yards. Each room connects the dismantlers in that region. If your state doesn't have a room yet, you can request one." },
    { q: "Can I be in multiple rooms at once?", a: "Your phone connects to one room at a time, but you can switch rooms instantly through the web dashboard or by pressing a softkey on the desk phone. Many yards start in their home state and switch to neighboring rooms during slow periods to catch more requests." },
    { q: "What if I miss a request?", a: "Unanswered requests are posted to the Hotline HQ Marketplace — an open board where any yard can respond later. You can browse the marketplace anytime to find requests you missed and contact the buyer directly. But live responses always win: 60% of requests get answered within 2 seconds." },
    { q: "Do I need a desk phone, or can I use my computer?", a: "Both. Every membership includes a preconfigured Yealink T31P desk phone shipped to your yard — plug in the ethernet cable and you're live. You can also connect through the web client from any computer or laptop. Most yards keep the desk phone on the counter and use the web client when they're away from the shop." },
    { q: "How is this different from calling yards one by one?", a: "Instead of one buyer calling one yard at a time, one buyer broadcasts to 97 yards simultaneously. For sellers, this means you hear every request without anyone having to dial your number. You don't need to answer individual phone calls — you just listen to the conference line and speak up when you have what someone needs." },
    { q: "What types of businesses use Hotline HQ?", a: "Auto dismantlers, salvage yards, junkyards, used parts dealers, and recyclers. Some shops that pull their own parts also use the network to find parts they don't carry. The network is purpose-built for the used auto parts industry — it's not a general marketplace." },
    { q: "Is there a contract or long-term commitment?", a: "No long-term contracts. Membership is month-to-month. You can cancel anytime. Most yards stay because the network pays for itself within the first week — a single transmission sale covers months of membership." },
    { q: "What makes and models are most requested?", a: "Ford leads with 900+ requests, followed by Toyota (830+), Honda (635+), Chevrolet (525+), Nissan (280+), and Dodge (257+). Model years range from the 1990s through 2025. The network reflects real-world demand — whatever customers are driving into shops, that's what's being requested on the hotline." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="How to Sell Used Auto Parts Online — Reach 500+ Yards | Hotline HQ"
        description="Sell used auto parts in 2 seconds. 15,000+ part requests broadcast to 97 yards at once. No listing fees, no commissions. Free to join."
        keywords="sell used auto parts, how to sell used auto parts online, sell my auto parts online, where to sell used auto parts online, best place to sell used auto parts, sell salvage parts, sell junkyard parts, auto parts buyer network, dismantler sales channel"
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
              description: "Live voice network for auto dismantlers to hear and respond to part requests in real-time. 15,000+ broadcasts, 97 avg listeners, 2-second response time. No listing fees or commissions.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
            {
              "@type": "HowTo",
              name: "How to Sell Used Auto Parts on Hotline HQ",
              description: "Join the network, listen for live part requests, and respond in seconds to close deals.",
              step: STEPS.map((s, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: s.title,
                text: s.copy,
              })),
            },
          ],
        }}
      />
      <SiteNav />

      {/* ──── Hero ──── */}
      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">SELL PARTS FASTER</p>
          <h1>How to sell used auto parts <em>without listing a single one</em></h1>
          <p className="fp-hero-sub">
            Over 15,000 part requests have been broadcast on Hotline HQ. Each one reaches ~97 yards at once.
            Average response time: <strong>2 seconds</strong>. You don't list parts — you listen for demand and respond by voice.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Join the Network — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">See What's Being Requested</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>

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

      {/* ──── How It Works ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">HOW IT WORKS</p>
          <h2>Three steps to selling parts on the hotline</h2>
          <p className="fp-lede">
            No inventory database. No photos. No product listings. <Link to="/used-auto-parts-hotline" style={{color:'var(--red)'}}>The hotline</Link> flips the script:
            instead of waiting for buyers to find your parts, you hear what buyers need the moment they need it.
          </p>
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

      {/* ──── Why It Beats Other Channels ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">COMPARE CHANNELS</p>
          <h2>Where should you sell used auto parts online?</h2>
          <p className="fp-lede">
            Most yards juggle eBay, Facebook, and parts databases. Each takes time, effort, and a cut of the sale.
            Here's how they stack up against a live voice network.
          </p>
        </div>
        <div className="fp-compare">
          {CHANNELS.map((c, i) => (
            <div className={`fp-compare-card${c.hot ? ' hot' : ''}`} key={i}>
              <p className="fp-compare-label">{c.name}</p>
              <div className={`fp-compare-time${c.hot ? ' good' : ''}`}>
                <span>Time to sale</span>
                <strong>{c.speed}</strong>
              </div>
              <div className="fp-compare-meta">
                <span><strong>Cost:</strong> {c.cost}</span>
                <span><strong>Effort:</strong> {c.effort}</span>
              </div>
              <p className="fp-compare-copy">{c.flaw}</p>
              {c.hot && <span className="fp-compare-badge">Fastest channel</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ──── What's Being Requested ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">LIVE DEMAND</p>
          <h2>What parts are buyers looking for right now?</h2>
          <p className="fp-lede">
            These are the most-requested parts across the Hotline HQ network, based on 15,000+ real broadcasts.
            If you stock any of these, you're sitting on demand.
          </p>
        </div>
        <div className="fp-parts-grid">
          {TOP_PARTS.map((p, i) => (
            <div className="fp-part-card" key={i}>
              <strong className="fp-part-name">{p.part}</strong>
              <span className="fp-part-count">{p.count} requests</span>
            </div>
          ))}
        </div>
        <p className="fp-section-footnote">
          Top makes requested: Ford (900+), Toyota (830+), Honda (635+), Chevrolet (525+), Nissan (280+), Dodge (257+).
          Model years span 1990s through 2025. <Link to="/ev-hybrid-auto-parts" style={{color:'var(--red)'}}>EV and hybrid requests</Link> are growing.
        </p>
      </section>

      {/* ──── The Math of Selling on a Hotline ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">THE MATH</p>
          <h2>Why one transmission sale pays for months of membership</h2>
          <p className="fp-lede">
            Salvage yards that sell on multiple channels know the numbers. Here's how a single sale
            on the hotline compares to the same sale through other channels.
          </p>
        </div>
        <div className="fp-math-grid">
          <div className="fp-math-card">
            <strong>$0</strong>
            <span>Commission on a $500 transmission sale via Hotline HQ</span>
            <em>You keep 100%</em>
          </div>
          <div className="fp-math-card">
            <strong>$66</strong>
            <span>eBay fee on the same $500 transmission (13.25%)</span>
            <em>Plus packaging + shipping</em>
          </div>
          <div className="fp-math-card">
            <strong>2s</strong>
            <span>Time from broadcast to response on the hotline</span>
            <em>vs. days listing on eBay</em>
          </div>
        </div>

        <div className="fp-guide-section" style={{marginTop:48}}>
          <h3>The hidden cost of listing-based selling</h3>
          <p>
            Every part you list on eBay, Facebook, or Car-Part.com costs you time before it costs you fees.
            Photographing a part from multiple angles takes <strong>3-5 minutes</strong>. Writing the listing — year, make, model,
            OEM part number, condition, measurements — takes another <strong>5-10 minutes</strong>. Multiply that by 50 parts
            and you've spent an entire day on data entry, not selling.
          </p>
          <p>
            On the hotline, that time goes to zero. You don't list anything. You listen for requests and respond
            when you have what someone needs. A yard with 2,000 vehicles and zero online listings sells just
            as effectively as one with a full Hollander database — because the network surfaces demand, not inventory.
          </p>
        </div>
      </section>

      {/* ──── No Inventory Listing Required ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">ZERO DATA ENTRY</p>
          <h2>Why you don't need to list your inventory</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Demand finds you", copy: "On eBay or Car-Part.com, buyers can only find parts you've listed. On Hotline HQ, buyers broadcast what they need — and you hear it whether you've cataloged that part or not. A transmission sitting in the back of your yard is worth nothing until someone asks for it. On this network, you hear the ask." },
            { title: "Inventory changes daily", copy: "Parts databases go stale. You pull a fender on Monday, but the listing stays up until someone notices. On a live voice network, there's nothing to update — you only respond when you actually have the part right now. No outdated listings. No disappointed buyers." },
            { title: "Small yards compete equally", copy: "A 2-acre yard with 200 vehicles and no parts catalog competes head-to-head with a 40-acre operation running Hollander. On the hotline, what matters is whether you have the part and how fast you respond — not how sophisticated your inventory system is." },
            { title: "Sell what nobody's searching for", copy: "Buyers don't always know how to search for what they need. 'I need a wreck opinion on an '06 Silverado' doesn't fit neatly into a parts database search box. On a voice network, the buyer describes exactly what they need in plain language. If you can help, you speak up." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── Stack Your Channels ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">CHANNEL STRATEGY</p>
          <h2>How the most profitable yards stack their sales channels</h2>
          <p className="fp-lede">
            The highest-revenue salvage yards don't pick one channel — they run two or three simultaneously.
            Each channel reaches a different buyer at a different speed. Here's the stack that works.
          </p>
        </div>
        <div className="fp-channel-stack">
          <div className="fp-channel-card">
            <p className="fp-channel-label">INSTANT SALES</p>
            <h4>Voice Hotline (Hotline HQ)</h4>
            <p>
              Yard-to-yard and shop-to-yard sales in real time. No listing overhead, no fees per sale.
              This is your fastest channel — 40+ requests per day in active rooms, 2-second response time,
              and you sell parts you haven't even cataloged. Best for: high-volume, same-day sales to professionals.
            </p>
          </div>
          <div className="fp-channel-card">
            <p className="fp-channel-label">PASSIVE REACH</p>
            <h4>Car-Part.com / Hollander</h4>
            <p>
              Your cataloged inventory is searchable by shops, insurers, and <Link to="/car-part-alternative" style={{color:'var(--red)'}}>parts locators nationwide</Link>.
              Requires maintained inventory database (Checkmate, Pinnacle, or Hollander). Best for:
              reaching professional buyers who search by part number. Subscription cost, but no per-sale commission.
            </p>
          </div>
          <div className="fp-channel-card">
            <p className="fp-channel-label">CONSUMER REACH</p>
            <h4>eBay Motors / Facebook</h4>
            <p>
              Reaches individual consumers and DIY mechanics nationwide. Every part needs photos, a listing,
              and shipping logistics. eBay takes 13.25%. Facebook is free but time-intensive. Best for:
              high-value parts where the margin justifies the effort — engines, transmissions, rare body panels.
            </p>
          </div>
        </div>

        <div className="fp-guide-section" style={{marginTop:48}}>
          <h3>The 80/20 rule of used auto parts sales</h3>
          <p>
            Across the Hotline HQ network, yards that run a voice hotline alongside one listing platform
            consistently outsell yards using either channel alone. The hotline catches the <strong>80% of
            inventory that never gets listed online</strong> — the parts sitting in rows that nobody photographed,
            priced, or entered into a database. The listing platform covers the 20% of high-value parts
            worth the cataloging effort.
          </p>
          <p>
            This isn't theory. The most-requested parts on the network — <Link to="/find-used-auto-parts" style={{color:'var(--red)'}}>bumpers, transmissions, fenders,
            motors</Link> — are exactly the parts that move fast enough that listings go stale before
            they sell. By the time you photograph a bumper and post it to eBay, it might already be sold
            through the hotline. The voice channel captures demand in real time; the listing channel catches
            buyers who search on their own schedule.
          </p>
        </div>
      </section>

      {/* ──── Pricing Guide ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">PRICING</p>
          <h2>How to price used auto parts for maximum profit</h2>
          <p className="fp-lede">
            Pricing too high means parts sit. Pricing too low means leaving money on the table.
            Here's the framework professional dismantlers use.
          </p>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Grade A: 60-70% of new OEM", copy: "Low mileage, excellent cosmetic and mechanical condition. No visible damage, clean connectors, original paint. These are the parts that command premium pricing — typically engines under 80K miles, un-cracked headlight assemblies, and rust-free body panels from dry-climate vehicles." },
            { title: "Grade B: 40-50% of new OEM", copy: "Average wear consistent with age and mileage. Functional but shows use — minor scratches, normal connector wear, acceptable cosmetic imperfections. This is the bread-and-butter grade for most salvage yards and represents the majority of inventory." },
            { title: "Grade C: 25-35% of new OEM", copy: "Functional but cosmetically imperfect. May have dents, fading, or high mileage. Still mechanically sound. Move these fast at volume pricing — they appeal to budget-conscious buyers and repair shops doing insurance work where appearance matters less." },
            { title: "Check Car-Part.com first", copy: "Before pricing any part, search Car-Part.com to see what other yards charge for the same part in the same condition. Price at or slightly below the market to move inventory faster. On the hotline, pricing happens live in conversation — you hear what the buyer needs and quote on the spot." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── What's Included ──── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">MEMBERSHIP</p>
          <h2>What's included when you join</h2>
          <p className="fp-lede">
            Flat monthly fee. No contracts. No commissions. Everything you need to start selling on day one.
          </p>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Preconfigured desk phone", copy: "A Yealink T31P desk phone ships to your yard, preconfigured and ready to go. Plug in the ethernet cable, and you're on the conference line within 60 seconds. No IT setup, no SIP configuration, no passwords to manage." },
            { title: "Web client access", copy: "Connect from any computer through the Hotline HQ web dashboard. Listen from your office, your home, or your phone. Switch rooms, check who's online, and see broadcast history — all from your browser." },
            { title: "Regional room access", copy: "Join any of the 15 regional rooms. Start in your home state and switch to neighboring rooms whenever you want. California, Texas, Florida, and Arizona are the most active, with 100+ yards online during business hours." },
            { title: "Marketplace fallback", copy: "Can't be on the line all day? Unanswered requests post to the Hotline HQ Marketplace — an open board where you can respond to missed requests at your own pace. The live line is fastest, but the marketplace catches what you miss." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── FAQ ──── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ──── Bottom CTA ──── */}
      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>READY TO SELL MORE PARTS?</p>
          <h2>Get on the hotline</h2>
          <p>Free to join. No credit card. No commission on sales. A desk phone ships to your yard — plug it in and start hearing requests.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            Also: <Link to="/find-used-auto-parts">Find parts on the network</Link> · <Link to="/salvage-yard-marketing">Marketing for yards</Link> · <Link to="/car-part-alternative">Car-Part.com vs Hotline HQ</Link>
          </p>
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
  const rich = REGION_CONTENT[state] || null;
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
          "@graph": [
            {
              "@type": "Service",
              name: `Hotline HQ — Used Auto Parts in ${region.name}`,
              serviceType: "Used Auto Parts Network",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "AdministrativeArea", name: region.name },
              description: description,
            },
            ...(region.active && rich?.faqs?.length ? [{
              "@type": "FAQPage",
              mainEntity: rich.faqs.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }] : []),
          ],
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

      {region.active && (rich || region.content) && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">{region.abbr} DISMANTLER NETWORK</p>
            <h2>Used Auto Parts in {region.name} — How It Works</h2>
          </div>
          <div className="fp-content-text">
            <p>{(rich || region.content).intro}</p>
            <h3>{region.name} Coverage Area</h3>
            <p>{(rich || region.content).geography}</p>
            <h3>Most-Requested Parts in {region.abbr}</h3>
            <p>{(rich || region.content).popular}</p>
            {rich?.whyVoice && (
              <>
                <h3>Why a Live Voice Network Beats a Parts Database</h3>
                <p>{rich.whyVoice}</p>
              </>
            )}
          </div>
        </section>
      )}

      {region.active && rich?.cities?.length > 0 && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">CITY COVERAGE</p>
            <h2>Used auto parts across {region.name}</h2>
            <p className="fp-lede">
              One live room covers every major market in the state — local yards, statewide reach.
            </p>
          </div>
          <div className="fp-steps">
            {rich.cities.map(c => (
              <div className="fp-step" key={c.name}>
                <h3>{c.name}</h3>
                <p>{c.blurb}</p>
              </div>
            ))}
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

      {region.active && rich?.faqs?.length > 0 && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">FAQ</p>
            <h2>{region.name} used auto parts — common questions</h2>
          </div>
          <div className="fp-content-text">
            {rich.faqs.map(f => (
              <div key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {region.active && rich?.resources?.length > 0 && (
        <section className="fp-section">
          <div className="fp-section-head">
            <p className="fp-kicker">KEEP EXPLORING</p>
            <h2>Guides and tools for {region.name} buyers and yards</h2>
          </div>
          <div className="fp-content-text">
            <ul>
              {rich.resources.map(r => (
                <li key={r.href}><Link to={r.href}>{r.label}</Link></li>
              ))}
            </ul>
          </div>
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
          <p className="fp-cta-alt">
            Not ready to sign up? <Link to="/#top">Listen to a live call first</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
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

/* ================================================================== */
/*  /used-auto-parts-hotline — P1 keyword page (zero competition)      */
/*  Targets: "used auto parts hotline", "auto parts hotline",          */
/*  "parts hotline", "call salvage yards for parts"                    */
/* ================================================================== */

export function AutoPartsHotlinePage() {
  const FAQS = [
    { q: "What is a used auto parts hotline?", a: "A used auto parts hotline is a live voice conference network that connects salvage yards, dismantlers, and parts buyers. Instead of calling yards one by one, you join a shared line and broadcast what you need. Every yard on the line hears your request simultaneously and responds by voice in real time. Hotline HQ operates the largest network in the US with 500+ member yards." },
    { q: "How does an auto parts hotline work?", a: "You join a regional conference room — California, Texas, Florida, Arizona, or any of 15 markets. When you need a part, you key up on your desk phone or web client and describe it: year, make, model, and what you're looking for. Roughly 97 yards hear your request at the same time. The first yard with the part responds — average time is 2 seconds." },
    { q: "Is a parts hotline better than calling yards individually?", a: "Dramatically. Calling yards one by one, you might reach 5 in an hour — most go to voicemail. On a parts hotline, one broadcast reaches 97 yards simultaneously. The network has processed 15,000+ requests with a 60% live answer rate and a 2-second average response time. What used to take an hour takes 10 seconds." },
    { q: "How much does it cost to use a parts hotline?", a: "Hotline HQ charges a flat monthly membership fee — no per-call charges, no commissions on sales, no listing fees. A preconfigured Yealink desk phone is included with membership and shipped to your location. You can also connect through the web client at no extra cost." },
    { q: "Can I sell parts on the hotline too?", a: "Yes. The hotline works both ways. When someone broadcasts a part request, every yard on the line hears it. If you have the part, you key up and respond. The buyer contacts you directly to close the deal. Most members both buy and sell — hearing every request in your region means you catch demand you'd never find on your own." },
    { q: "What parts are most requested on the hotline?", a: "The top requests across 15,000+ broadcasts: bumpers (398), transmissions (282), motors and engines (273), fenders (204), doors (147), headlights (131), and taillights (110). Top makes: Ford (900+), Toyota (830+), Honda (635+), Chevrolet (525+). Model years span the 1990s through 2025." },
    { q: "Is the hotline available 24/7?", a: "The conference line is always on. Most activity happens during business hours — roughly 7 AM to 6 PM in each regional time zone — but the line never closes. Some yards leave their phone on overnight and catch early-morning requests from shops that start at 6 AM." },
    { q: "How is this different from Car-Part.com?", a: "Car-Part.com is an inventory database — yards list parts, buyers search listings. Listings go stale when parts sell or vehicles get crushed. Hotline HQ is a live voice network — there's nothing to list, nothing to search. You ask for what you need out loud and get a live answer from someone who can verify the part right now. The two services are complementary, not competing." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Used Auto Parts Hotline — 500+ Yards, Live Voice Network | Hotline HQ"
        description="The used auto parts hotline that reaches 97 yards at once. 15,000+ parts located. 2-second response. Call once, every salvage yard in your region hears it live."
        keywords="used auto parts hotline, auto parts hotline, parts hotline, call salvage yards for parts, auto parts phone hotline, junkyard hotline, salvage yard hotline, parts locator hotline"
        path="/used-auto-parts-hotline"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Used Auto Parts Hotline — Hotline HQ",
              serviceType: "Auto Parts Locating Hotline",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice hotline connecting 500+ salvage yards across 15 regional rooms. Broadcast a part request and get answers from 97 yards in 2 seconds. Over 15,000 parts located.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to join" },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">THE PARTS HOTLINE</p>
          <h1>The used auto parts hotline that <em>every yard hears</em></h1>
          <p className="fp-hero-sub">
            One call. 97 yards. 2 seconds. Hotline HQ is a live voice conference network where salvage yards and
            dismantlers hear part requests the instant they're broadcast. Over 15,000 parts located and counting.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Join the Hotline — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">See Live Requests</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>
          <div className="fp-hero-stats">
            {[
              { value: "15,000+", label: "Parts located" },
              { value: "~97", label: "Yards per call" },
              { value: "2s", label: "Avg response" },
              { value: "500+", label: "Member yards" },
            ].map((s, i) => (
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
          <p className="fp-kicker">WHAT IS A PARTS HOTLINE?</p>
          <h2>How does a used auto parts hotline work?</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "It's a live conference line, not a database", copy: "Think of a parts hotline as a conference call that runs all day. Every salvage yard in your region has a phone on the line. When you need a part, you key up and describe it — year, make, model, what you need. Every yard hears you at the same time. This is the same model dismantlers have used for decades, now scaled to 500+ yards across the country." },
            { title: "Voice is faster than search", copy: "Typing 'wreck opinion 2006 Silverado 2500 transfer case' into a search box doesn't capture what you actually need. On a hotline, you say it in plain language and the yards who can help understand the full context. Average response time on Hotline HQ: 2 seconds. Average time searching a parts database and calling the listing: 15-45 minutes." },
            { title: "Real-time verification, not stale listings", copy: "When a yard responds on the hotline, you know the part is there right now. The person talking to you can see it. Parts databases show what was in stock when someone last updated the record — which might've been last week. Inventory changes daily. The hotline is always current because there are no listings to go stale." },
            { title: "Both buyers and sellers benefit", copy: "The hotline isn't just for buyers. Sellers hear every request in their region — demand they'd never find on their own. A part sitting in the back of the yard is worth nothing until someone asks for it. On the hotline, you hear the ask. 60% of broadcasts get answered live, and the answering yard wins the sale." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">COVERAGE</p>
          <h2>15 regional hotline rooms across the US</h2>
          <p className="fp-lede">
            Each room connects the yards in that region. California is the largest with 200+ active yards
            and 8,600+ broadcasts processed. Texas, Florida, and Arizona are the next most active.
            You can switch rooms anytime to reach yards in neighboring states.
          </p>
        </div>
        <div className="fp-parts-grid">
          {[
            { part: "California", count: "8,600+ calls" },
            { part: "Arizona", count: "2,300+ calls" },
            { part: "Texas", count: "490+ calls" },
            { part: "Ohio", count: "410+ calls" },
            { part: "Michigan", count: "410+ calls" },
            { part: "Florida", count: "Active" },
            { part: "Indiana", count: "Active" },
            { part: "Georgia", count: "Active" },
          ].map((r, i) => (
            <div className="fp-part-card" key={i}>
              <strong className="fp-part-name">{r.part}</strong>
              <span className="fp-part-count">{r.count}</span>
            </div>
          ))}
        </div>
        <p className="fp-section-footnote">
          Additional rooms: New York, Carolinas, Mexico, and more. Request a new room if your state isn't listed.
          {' '}Looking for a specific part? <Link to="/find-used-auto-parts" style={{color:'var(--red)'}}>Learn how to find parts</Link> or <Link to="/sell-used-auto-parts" style={{color:'var(--red)'}}>sell parts</Link> on the network.
        </p>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">HOW TO JOIN</p>
          <h2>Getting on the hotline takes 2 minutes</h2>
        </div>
        <div className="fp-steps">
          {[
            { n: "1", title: "Sign up free", copy: "Create your account and choose your regional room. No credit card required. The sign-up takes under a minute." },
            { n: "2", title: "Connect your phone or computer", copy: "A preconfigured Yealink desk phone ships to your yard — plug in the ethernet cable and you're on the line. Or connect instantly through the web client on any computer." },
            { n: "3", title: "Start listening and talking", copy: "You're on the conference line. Hear every part request in your region. Key up to broadcast your own requests or respond to others. First to answer wins the deal." },
          ].map(s => (
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
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>JOIN THE HOTLINE</p>
          <h2>500+ yards. 15 rooms. One network.</h2>
          <p>Free to join. Desk phone included. Start hearing live part requests in under 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            <Link to="/find-used-auto-parts">Find parts</Link> · <Link to="/sell-used-auto-parts">Sell parts</Link> · <Link to="/hard-to-find-auto-parts">Hard-to-find parts</Link> · <Link to="/car-part-alternative">Car-Part.com comparison</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /car-part-alternative — comparison/alternative page                */
/*  Targets: "car-part.com alternative", "car-part alternative",       */
/*  "alternative to car-part.com", "better than car-part"              */
/* ================================================================== */

export function CarPartAlternativePage() {
  const ROWS = [
    { feature: "How you find parts", carpart: "Search a database of listed inventory", hotline: "Broadcast by voice — 97 yards hear you at once" },
    { feature: "Response time", carpart: "Search instantly, then call the yard", hotline: "2 seconds average — yards answer live" },
    { feature: "Inventory accuracy", carpart: "Only as current as the last update", hotline: "Always current — yards verify in real time" },
    { feature: "Parts you can find", carpart: "Only parts that have been listed", hotline: "Any part in any yard — listed or not" },
    { feature: "Effort to sell", carpart: "Catalog, photograph, and list every part", hotline: "Just listen and respond — zero data entry" },
    { feature: "Cost model", carpart: "Subscription + per-part fees", hotline: "Flat monthly — no per-part, no commission" },
    { feature: "Request types", carpart: "Structured search by year/make/model/part", hotline: "Anything — wreck opinions, assemblies, plain language" },
    { feature: "Network size", carpart: "Thousands of yards (largest database)", hotline: "500+ yards (largest live voice network)" },
  ];

  const FAQS = [
    { q: "Is Hotline HQ a replacement for Car-Part.com?", a: "Not exactly — they solve different problems. Car-Part.com is an inventory database where yards list parts and buyers search listings. Hotline HQ is a live voice network where you broadcast requests and get real-time answers. Many yards use both: Car-Part.com for searchable inventory and Hotline HQ for live demand and parts that aren't cataloged yet." },
    { q: "Why would I use a voice network instead of a parts database?", a: "Three reasons: speed (2-second response vs. search-then-call), accuracy (live verification vs. stale listings), and reach (97 yards hear you at once, including parts they haven't listed). A database only shows you what's been cataloged. A voice network shows you what's actually available right now — including parts nobody thought to list." },
    { q: "Can I use both Car-Part.com and Hotline HQ?", a: "Yes, and many yards do. Use Car-Part.com when you know the exact part number and want to search listed inventory. Use Hotline HQ when you need a fast answer, when the part is hard to describe in a search box, or when you want to reach yards that don't maintain detailed online inventory. The two services complement each other." },
    { q: "Do I need to list my inventory on Hotline HQ?", a: "No. That's the fundamental difference. On Car-Part.com, you need every part cataloged before a buyer can find it. On Hotline HQ, buyers broadcast what they need and you simply respond when you have it. No photos, no data entry, no catalog management. This makes Hotline HQ especially valuable for smaller yards that can't maintain a full parts database." },
    { q: "Which is better for hard-to-find parts?", a: "Hotline HQ. A wreck opinion, a specific assembly, or a part described in plain language ('I need the whole front clip off an 06 Silverado') doesn't translate well to a database search. On a voice network, you describe exactly what you need and the yards who can help understand the context. For standard year/make/model/part searches, Car-Part.com's database is hard to beat." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Car-Part.com Alternative — Live Voice Parts Network | Hotline HQ"
        description="Looking for a Car-Part.com alternative? Hotline HQ is a live voice network — broadcast once, 97 yards hear you, get answers in 2 seconds. No listings to manage."
        keywords="car-part.com alternative, car-part alternative, alternative to car-part, better than car-part.com, car-part.com vs hotline, used auto parts alternative, parts locator alternative"
        path="/car-part-alternative"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: "Car-Part.com Alternative — Hotline HQ Live Voice Network",
              description: "Compare Car-Part.com's inventory database with Hotline HQ's live voice network for finding and selling used auto parts.",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">COMPARE</p>
          <h1>Car-Part.com alternative: <em>a live voice network</em></h1>
          <p className="fp-hero-sub">
            Car-Part.com searches listed inventory. Hotline HQ broadcasts your request to 97 yards at once — live, by voice.
            Different approach. Different speed. Many yards use both.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Try Hotline HQ — Free</a>
            <Link to="/#top" className="fp-btn fp-btn-ghost">Listen to a Live Call</Link>
          </div>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">SIDE BY SIDE</p>
          <h2>Car-Part.com vs. Hotline HQ</h2>
          <p className="fp-lede">
            One is a parts database. The other is a live voice network. Here's how they differ across 8 dimensions.
          </p>
        </div>
        <div className="fp-comparison-table-wrap">
          <table className="fp-comparison-table">
            <thead>
              <tr>
                <th></th>
                <th>Car-Part.com</th>
                <th className="fp-ct-hot">Hotline HQ</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i}>
                  <td className="fp-ct-feature">{r.feature}</td>
                  <td>{r.carpart}</td>
                  <td className="fp-ct-hot">{r.hotline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">WHEN TO USE EACH</p>
          <h2>Database vs. hotline — which is right for you?</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Use Car-Part.com when...", copy: "You know the exact year, make, model, and part number. You want to browse listings and compare prices. You prefer to search quietly without broadcasting. You need interchange data or Hollander numbers. Car-Part.com's database is the industry standard for structured inventory search." },
            { title: "Use Hotline HQ when...", copy: "You need a fast answer — 2 seconds vs. search-then-call. The part is hard to describe in a search box (wreck opinions, assemblies, plain language requests). You want to reach yards that don't maintain online inventory. You want to sell parts without cataloging them first. Speed and reach matter more than browsing." },
            { title: "Use both when...", copy: "You want maximum coverage. Search Car-Part.com for common parts with known part numbers. Broadcast on Hotline HQ for everything else — hard-to-find parts, urgent needs, and demand you'd miss in a database. Many of the most successful yards on the Hotline HQ network also maintain Car-Part.com listings." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
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
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>TRY THE VOICE NETWORK</p>
          <h2>Add a live channel to your parts workflow</h2>
          <p>Free to join. Desk phone included. No commitment — try it alongside your existing tools.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            <Link to="/find-used-auto-parts">Find parts</Link> · <Link to="/sell-used-auto-parts">Sell parts</Link> · <Link to="/hard-to-find-auto-parts">Hard-to-find parts</Link> · <Link to="/used-auto-parts-hotline">How the hotline works</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /hard-to-find-auto-parts — P1 keyword (zero competition)           */
/*  Targets: "hard to find auto parts", "rare auto parts",             */
/*  "hard to find car parts", "obsolete auto parts"                    */
/* ================================================================== */

export function HardToFindPartsPage() {
  const FAQS = [
    { q: "What counts as a hard-to-find auto part?", a: "Any part that doesn't show up in a standard database search — discontinued parts for older vehicles, rare trim-specific components, complete assemblies that aren't sold individually, and parts for low-production vehicles. On Hotline HQ, 'hard to find' also includes wreck opinions, oddball year-make-model combos, and parts described in plain language that don't fit a search box." },
    { q: "Why are some auto parts so hard to find?", a: "Three reasons: the vehicle was low-production (fewer ended up in salvage yards), the part is model-year-specific (a 2007 and 2008 might look identical but have different brackets), or the part simply hasn't been cataloged in any database. Roughly 30% of salvage yard inventory is never listed online because the data entry cost doesn't justify it for lower-value parts." },
    { q: "How does a voice network find parts that databases can't?", a: "Databases only show parts someone took the time to list. A voice network asks real people — 97 yards simultaneously — whether they have the part right now. Many yards carry thousands of unlisted parts sitting on vehicles that haven't been fully inventoried. When you broadcast 'I need a passenger mirror for an 03 Saab 9-3 Viggen,' the yard with that Saab in the back row can walk over and check." },
    { q: "What if nobody on the network has my part?", a: "If the request goes unanswered live, it posts to the Hotline HQ Marketplace where any yard can respond later. You can also broadcast to different regional rooms — a part that's rare in Texas might be common in California. The network covers 15 rooms across the US." },
    { q: "What are the hardest parts to find?", a: "Based on network data: European vehicle interior trim, early-2000s SUV-specific assemblies, Japanese domestic market (JDM) components, diesel-specific parts for light trucks, and anything for vehicles produced in small numbers. The most successful approach is broadcasting to multiple rooms — what's rare in one region may be sitting in a yard 1,000 miles away." },
    { q: "Is this better than searching Car-Part.com for rare parts?", a: "Use both. Search Car-Part.com first — if the part is listed, great. When it's not listed, broadcast on Hotline HQ. The voice network reaches inventory that was never cataloged, and 97 yards can physically check their stock while you wait. For hard-to-find parts specifically, voice beats search because the part you need often exists but was never entered into a database." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Hard to Find Auto Parts — Search 500+ Salvage Yards by Voice | Hotline HQ"
        description="Find hard-to-find auto parts by broadcasting to 97 yards at once. Discontinued, rare, and unlisted parts — if a yard has it, they'll tell you in 2 seconds."
        keywords="hard to find auto parts, rare auto parts, hard to find car parts, obsolete auto parts, discontinued car parts, rare car parts near me, hard to find used auto parts, where to find rare car parts"
        path="/hard-to-find-auto-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Hard to Find Auto Parts — Hotline HQ",
              serviceType: "Rare Auto Parts Locating Service",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network for finding hard-to-find, rare, and discontinued auto parts. Broadcast your request to 97 salvage yards simultaneously and get answers in seconds.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">RARE & HARD TO FIND</p>
          <h1>Hard-to-find auto parts? <em>Ask 97 yards at once</em></h1>
          <p className="fp-hero-sub">
            Databases only show what's been listed. Hotline HQ asks real people — 97 salvage yards hear your request live
            and check their stock while you wait. If the part exists, someone will tell you in 2 seconds.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Start Searching — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">Browse Open Requests</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">WHY VOICE FINDS WHAT SEARCH CAN'T</p>
          <h2>The problem with searching for rare parts online</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "30% of yard inventory is never listed", copy: "Data entry takes time and money. A yard with 2,000 vehicles might have 40,000+ salvageable parts, but only the high-value ones get cataloged. That fender for a 2004 Saab 9-5 Aero? It's there — nobody listed it. On a voice network, the yard owner who knows that car is in row 12 can walk over and check." },
            { title: "Rare parts need context, not keywords", copy: "'I need a complete front clip off a 2006 Silverado 2500 — bumper, header panel, fenders, hood, everything, has to be Summit White.' Try putting that in a search box. On Hotline HQ, you say it in 10 seconds and 97 yards understand exactly what you need — including the color." },
            { title: "Regional rarity varies wildly", copy: "A part that's impossible to find in Ohio might be sitting in 5 yards in California. The Hotline HQ network spans 15 regional rooms. Broadcast to your home room first, then switch to others. Desert yards carry rust-free body panels. Northeast yards have parts from vehicles that never sold out west." },
            { title: "Wreck opinions can't be searched", copy: "'What's this car worth as a whole?' isn't a parts search — it's a conversation. Wreck opinions are one of the most common request types on the network. You describe the vehicle, and yards who want it tell you what they'll pay. No database handles this. Voice does." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">HARD TO FIND EXAMPLES</p>
          <h2>Parts people have found on the hotline</h2>
          <p className="fp-lede">
            Real requests from the Hotline HQ network — the kind of parts that don't show up on a database search.
          </p>
        </div>
        <div className="fp-parts-grid">
          {[
            { part: "Wreck opinions", count: "Most common" },
            { part: "Complete front clips", count: "Color-matched" },
            { part: "European trim pieces", count: "Model-specific" },
            { part: "Diesel-specific parts", count: "Light truck" },
            { part: "Transfer cases", count: "AWD/4WD" },
            { part: "Older model headlights", count: "Pre-2005" },
            { part: "Rare transmission combos", count: "CVT / DCT" },
            { part: "Body panels by color", count: "OEM paint" },
          ].map((p, i) => (
            <div className="fp-part-card" key={i}>
              <strong className="fp-part-name">{p.part}</strong>
              <span className="fp-part-count">{p.count}</span>
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
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>STOP SEARCHING. START ASKING.</p>
          <h2>97 yards are listening right now</h2>
          <p>Free to join. Broadcast your first request in under 2 minutes. If the part exists, someone will find it.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            <Link to="/find-used-auto-parts">Find parts</Link> · <Link to="/ev-hybrid-auto-parts">EV &amp; hybrid parts</Link> · <Link to="/used-auto-parts-hotline">How the hotline works</Link> · <Link to="/car-part-alternative">Car-Part.com comparison</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /salvage-yard-marketing — P1 B2B keyword page                      */
/*  Targets: "salvage yard marketing", "junkyard marketing",           */
/*  "how to get more customers for salvage yard"                       */
/* ================================================================== */

export function SalvageYardMarketingPage() {
  const FAQS = [
    { q: "How do salvage yards get new customers?", a: "Traditionally: word of mouth, Yellow Pages, Google My Business, and waiting for phone calls. The problem is passive — you wait for customers to find you. On Hotline HQ, you hear every part request in your region the moment it's broadcast. Instead of marketing to attract customers, you listen for demand that already exists and respond to it directly." },
    { q: "Does Hotline HQ replace my website or Google listing?", a: "No — it adds a new channel. Keep your website, your Google Business Profile, and your Car-Part.com listings. Hotline HQ gives you something those channels can't: real-time demand. You hear what people need right now, not what they searched for yesterday. Think of it as a live lead source that runs alongside your existing marketing." },
    { q: "How many leads can I expect per day?", a: "Active rooms like California average 40+ broadcasts per day — each one a potential sale. You hear every request in your room. How many you close depends on your inventory and response speed. The average response time is 2 seconds — first to answer typically wins the deal. Even 1-2 sales per day can transform a yard's revenue." },
    { q: "What's the ROI on joining the network?", a: "The membership is a flat monthly fee with no commissions. One transmission sale, one motor sale, or a few smaller parts covers months of membership. The network surfaces demand you'd never find through traditional marketing — parts requests from buyers who would've called your competitor instead of you." },
    { q: "Is this worth it for a small yard?", a: "Especially for small yards. You don't need a big inventory database, a marketing team, or a web presence. Plug in the desk phone, listen for requests, and respond when you have the part. Small yards with 200-500 vehicles can compete head-to-head with 40-acre operations because on the hotline, what matters is speed and inventory — not marketing budget." },
    { q: "How is this different from paying for ads?", a: "Google Ads and Facebook Ads drive traffic to your website and hope visitors convert. Hotline HQ gives you buyers who've already described exactly what they need. There's no funnel, no landing page, no conversion rate to optimize. You hear 'I need a 2018 Civic bumper' — if you have it, you respond. The 'lead' is already qualified." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Salvage Yard Marketing — Get Live Leads Without Ads | Hotline HQ"
        description="Salvage yard marketing that works: hear live part requests from buyers in your region. No ads, no SEO, no waiting. 97 yards hear each request — first to answer wins."
        keywords="salvage yard marketing, junkyard marketing, how to get customers for salvage yard, auto recycler marketing, salvage yard advertising, junkyard advertising, how to sell more auto parts, salvage yard leads"
        path="/salvage-yard-marketing"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Salvage Yard Marketing — Hotline HQ",
              serviceType: "Salvage Yard Lead Generation",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Live voice network that delivers real-time part requests to salvage yards. Hear what buyers need and respond instantly — no ads, no SEO, no waiting for leads.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">SALVAGE YARD MARKETING</p>
          <h1>Stop marketing your yard. <em>Start hearing demand.</em></h1>
          <p className="fp-hero-sub">
            Traditional marketing attracts customers. Hotline HQ lets you hear them. Every part request in your region
            broadcasts live to ~97 yards. First to answer wins the sale. Over 15,000 requests and counting.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Join the Network — Free</a>
            <Link to="/sell-used-auto-parts" className="fp-btn fp-btn-ghost">How Selling Works</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">THE PROBLEM WITH YARD MARKETING</p>
          <h2>Why traditional marketing doesn't work for salvage yards</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Google Ads are expensive and generic", copy: "Bidding on 'used auto parts near me' puts you against national chains, eBay, and Amazon. Cost per click runs $2-$8, and most clicks don't convert — the visitor doesn't find their exact part and leaves. You're paying for traffic that doesn't turn into sales." },
            { title: "SEO takes months and requires content", copy: "Ranking a salvage yard website on Google means writing blog posts, optimizing pages, building backlinks, and waiting 6-12 months. Most yard owners don't have time to be content marketers. And even with rankings, you're still waiting for someone to search, find you, and call." },
            { title: "Listings go stale before they sell", copy: "Posting inventory to Car-Part.com, eBay, or Facebook requires photographing, cataloging, and pricing every part. By the time a buyer finds your listing, the part might be sold. And most of your inventory never gets listed at all — the data entry just isn't worth it." },
            { title: "Word of mouth has a ceiling", copy: "Referrals are your best source, but they don't scale. You only get calls from people who already know you exist. The buyer at a shop 40 miles away who needs your part doesn't know your yard exists — they're calling the yard they've always called." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">THE HOTLINE APPROACH</p>
          <h2>What if leads came to you — live, by voice?</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "40+ part requests per day in active rooms", copy: "The California room averages 40+ broadcasts daily. Each one is a buyer describing exactly what they need. You don't pay per lead. You don't filter through tire kickers. Every broadcast is someone ready to buy if you have the part." },
            { title: "No marketing budget required", copy: "Flat monthly membership. No pay-per-click, no ad spend, no agency fees. The network delivers demand to your phone — literally. A preconfigured desk phone sits on your counter and plays every request in your region." },
            { title: "Compete on speed, not marketing spend", copy: "On the hotline, a 2-acre yard can outsell a 40-acre operation. What matters is response time (network average: 2 seconds) and whether you have the part. Marketing budget, website quality, Google rankings — none of it matters on the line." },
            { title: "Sell parts you haven't listed", copy: "The biggest marketing advantage: you sell inventory you never cataloged. A buyer asks for a part, you check your yard, you respond. No photo, no listing, no data entry. The network surfaces demand for whatever's in your yard — including parts you forgot you had." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
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
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>BETTER THAN ADS</p>
          <h2>Live leads. No marketing required.</h2>
          <p>Free to join. Desk phone included. Hear your first part request in under 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            <Link to="/sell-used-auto-parts">How selling works</Link> · <Link to="/used-auto-parts-hotline">How the hotline works</Link> · <Link to="/find-used-auto-parts">Find parts</Link> · <Link to="/car-part-alternative">Car-Part.com comparison</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ================================================================== */
/*  /ev-hybrid-auto-parts — P2 first-mover keyword page                */
/*  Targets: "ev auto parts", "hybrid car parts used",                 */
/*  "electric car parts salvage", "Tesla parts salvage"                */
/* ================================================================== */

export function EvHybridPartsPage() {
  const FAQS = [
    { q: "Can I find used EV and hybrid parts on Hotline HQ?", a: "Yes. As more electric and hybrid vehicles enter salvage yards, part requests for these vehicles are growing on the network. Common requests include battery packs, drive units, inverters, onboard chargers, and body panels for Tesla, Prius, Chevy Bolt, Nissan Leaf, and Ford Mach-E. Broadcast what you need and yards with EV inventory respond live." },
    { q: "Are salvage EV parts safe to buy?", a: "EV components require proper handling — especially high-voltage battery packs. Yards that dismantle EVs follow OSHA and manufacturer guidelines for high-voltage disconnect. When you buy through the network, you're dealing directly with the dismantler who can tell you the part's condition, mileage, and whether it's been properly decommissioned." },
    { q: "What EV parts are most requested?", a: "Based on network trends: hybrid battery packs (Prius, Camry Hybrid, Accord Hybrid), Tesla body panels and doors (Model 3 and Model Y are the most common in salvage), EV drive units, DC-DC converters, and onboard chargers. As more EVs age out of warranty, demand for used components is accelerating." },
    { q: "Which EV brands show up in salvage yards?", a: "Tesla (Model 3 and Model Y are the most common), Toyota hybrids (Prius all generations, Camry Hybrid, RAV4 Hybrid), Honda hybrids, Nissan Leaf, Chevrolet Bolt and Volt, Ford Escape Hybrid and Mach-E. Availability is regional — California yards have the highest EV density." },
    { q: "Why use a hotline instead of searching online for EV parts?", a: "EV parts are new to the salvage industry. Most yards haven't built out EV categories in their inventory databases. A voice network bypasses the database problem — you describe what you need and any yard with that vehicle can check. This is especially valuable for newer EVs where the parts aren't yet standardized in interchange databases like Hollander." },
  ];

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{FEATURE_CSS}</style>
      <Seo
        title="Used EV & Hybrid Auto Parts — Find Tesla, Prius, Leaf Parts | Hotline HQ"
        description="Find used EV and hybrid parts from salvage yards. Tesla, Prius, Leaf, Bolt batteries, drive units, and body panels. Broadcast to 97 yards — get answers in 2 seconds."
        keywords="ev auto parts, used ev parts, hybrid car parts used, electric car parts salvage, Tesla parts salvage, Prius battery used, used hybrid battery, EV salvage parts, electric vehicle parts"
        path="/ev-hybrid-auto-parts"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "EV & Hybrid Auto Parts — Hotline HQ",
              serviceType: "Electric Vehicle Parts Locating",
              provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
              areaServed: { "@type": "Country", name: "US" },
              description: "Find used EV and hybrid parts from 500+ salvage yards via live voice network. Tesla, Prius, Leaf, Bolt — batteries, drive units, body panels. 2-second average response.",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ],
        }}
      />
      <SiteNav />

      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">EV & HYBRID PARTS</p>
          <h1>Used EV and hybrid parts — <em>before they're listed</em></h1>
          <p className="fp-hero-sub">
            Most salvage yards haven't cataloged their EV inventory yet. On Hotline HQ, that doesn't matter — broadcast what you need
            and 97 yards check their stock in real time. Tesla, Prius, Leaf, Bolt, Mach-E and more.
          </p>
          <div className="fp-hero-ctas">
            <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Start Finding EV Parts — Free</a>
            <Link to="/marketplace" className="fp-btn fp-btn-ghost">Browse Open Requests</Link>
          </div>
          <Link to="/#top" className="fp-listen-link">
            <span className="fp-listen-dot" />
            Hear a real broadcast — listen to a live call
          </Link>
        </div>
      </section>

      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">THE EV PARTS CHALLENGE</p>
          <h2>Why finding used EV parts is harder than conventional ones</h2>
        </div>
        <div className="fp-advantages">
          {[
            { title: "Interchange databases lag behind", copy: "Hollander and other interchange systems were built for ICE vehicles. EV-specific components — battery modules, inverters, onboard chargers, drive units — don't have standardized interchange numbers yet. Searching a database for 'Tesla Model 3 rear drive unit' may return nothing, even if 5 yards have one." },
            { title: "EV inventory is growing but uncataloged", copy: "More EVs are entering salvage streams every year as leases end, accidents happen, and early-generation batteries age out. But most yards haven't built out EV categories in their inventory systems. The parts exist — they just aren't listed anywhere." },
            { title: "High-value parts need conversation", copy: "An EV battery pack worth $3,000-$8,000 isn't a commodity purchase. Buyers need to know state of health, cell voltage consistency, whether it's been properly discharged, and mileage. This level of detail requires a conversation — not a listing with a photo." },
            { title: "Regional concentration matters", copy: "California yards have the highest EV density — Tesla Model 3 and Model Y dominate. Texas and Florida are growing. A yard in Ohio might not have any EV inventory, but broadcasting to the California room reaches 200+ yards that likely do." },
          ].map((b, i) => (
            <div className="fp-advantage" key={i}>
              <h3>{b.title}</h3>
              <p>{b.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">MOST REQUESTED</p>
          <h2>EV and hybrid parts people are looking for</h2>
        </div>
        <div className="fp-parts-grid">
          {[
            { part: "Hybrid batteries", count: "Prius / Camry" },
            { part: "Tesla body panels", count: "Model 3 / Y" },
            { part: "EV drive units", count: "Front & rear" },
            { part: "Onboard chargers", count: "All makes" },
            { part: "DC-DC converters", count: "Hybrid / EV" },
            { part: "Leaf battery modules", count: "Gen 1 & 2" },
            { part: "Bolt/Volt batteries", count: "Chevy" },
            { part: "Mach-E / ID.4 parts", count: "Growing" },
          ].map((p, i) => (
            <div className="fp-part-card" key={i}>
              <strong className="fp-part-name">{p.part}</strong>
              <span className="fp-part-count">{p.count}</span>
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
          {FAQS.map((f, i) => (
            <details className="fp-faq" key={i}>
              <summary className="fp-faq-q">{f.q}</summary>
              <p className="fp-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{color:'var(--red)'}}>EV PARTS, LIVE</p>
          <h2>Ask 97 yards for the EV part you need</h2>
          <p>Free to join. The network already has yards with Tesla, Prius, Leaf, and Bolt inventory. Broadcast your request in 2 minutes.</p>
          <a href={SIGNUP_URL} className="fp-btn fp-btn-hot">Sign Up Free</a>
          <p className="fp-cta-alt">
            Want to hear it first? <Link to="/#top">Listen to a live call</Link>
            {' '}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            <Link to="/find-used-auto-parts">Find all parts</Link> · <Link to="/hard-to-find-auto-parts">Hard-to-find parts</Link> · <Link to="/used-auto-parts-hotline">How the hotline works</Link> · <Link to="/sell-used-auto-parts">Sell parts</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
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
  max-width: 1140px;
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
.fp-listen-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.2s;
}
.fp-listen-link:hover { color: var(--ink); }
.fp-listen-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.15);
  animation: fp-pulse 1.6s infinite;
}
@keyframes fp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
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
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}
.fp-step {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 30px 28px 34px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
  display: flex;
  flex-direction: column;
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
  grid-template-columns: repeat(2, 1fr);
  gap: 22px;
}
.fp-advantage {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 26px 32px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
  display: flex;
  flex-direction: column;
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

/* Compare cards (sell page channel comparison) */
.fp-compare {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  max-width: 1100px;
  margin: 0 auto;
}
.fp-compare-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 26px 34px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
}
.fp-compare-copy { flex: 1; }
.fp-compare-card.hot {
  border-color: rgba(217,45,32,0.35);
  background: linear-gradient(170deg, #fef3f2, #fff 55%);
}
.fp-compare-label {
  font-size: 12px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--ink); margin: 0 0 14px;
}
.fp-compare-card.hot .fp-compare-label { color: var(--red); }
.fp-compare-time {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 14px; padding-bottom: 14px;
  border-bottom: 1px dashed var(--line);
}
.fp-compare-time span {
  font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: #a3a094;
}
.fp-compare-time strong {
  font-size: 24px; font-weight: 700;
  color: var(--ink); line-height: 1;
}
.fp-compare-time.good strong { color: #12b76a; font-size: 28px; }
.fp-compare-meta {
  display: flex; flex-direction: column; gap: 4px;
  margin-bottom: 14px; font-size: 13px; color: var(--muted);
}
.fp-compare-meta strong { color: var(--ink); font-weight: 600; }
.fp-compare-copy {
  color: var(--ink); opacity: .82; font-size: 14.5px; line-height: 1.6; margin: 0;
}
.fp-compare-badge {
  position: absolute; top: -12px; right: 16px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: #fff; background: #12b76a;
  padding: 5px 14px; border-radius: 999px;
}

/* Parts grid (sell page demand section) */
.fp-parts-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  max-width: 1100px;
  margin: 0 auto;
}
.fp-part-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  padding: 28px 22px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}
.fp-part-name {
  font-family: var(--display);
  font-size: 18px; font-weight: 700; color: var(--ink);
}
.fp-part-count {
  font-family: var(--mono);
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red); white-space: nowrap;
}
.fp-section-footnote {
  text-align: center;
  font-size: 14px;
  color: var(--muted);
  margin-top: 24px;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* Comparison table (car-part alternative page) */
.fp-comparison-table-wrap {
  overflow-x: auto;
  max-width: 900px;
  margin: 0 auto;
}
.fp-comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14.5px;
}
.fp-comparison-table th {
  text-align: left;
  padding: 14px 18px;
  border-bottom: 2px solid var(--line);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  white-space: nowrap;
}
.fp-comparison-table th.fp-ct-hot { color: var(--red); }
.fp-comparison-table td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  line-height: 1.55;
  vertical-align: top;
}
.fp-comparison-table tr:last-child td { border-bottom: none; }
.fp-ct-feature {
  font-weight: 600;
  white-space: nowrap;
  color: var(--ink);
}
.fp-comparison-table td.fp-ct-hot {
  color: var(--ink);
  font-weight: 500;
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
.fp-cta-alt {
  margin-top: 20px !important;
  font-size: 14px !important;
  color: rgba(255,255,255,0.4) !important;
}
.fp-cta-alt a {
  color: rgba(255,255,255,0.7);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.2s;
}
.fp-cta-alt a:hover { color: #fff; }

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
/* Sell guide content blocks */
.fp-guide-section { margin-bottom: 48px; }
.fp-guide-section h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  color: var(--ink);
  margin: 0 0 12px;
  line-height: 1.15;
}
.fp-guide-section p {
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.7;
  margin: 0 0 12px;
}
.fp-guide-section p:last-child { margin-bottom: 0; }
.fp-guide-section strong { color: var(--ink); }
.fp-guide-section ul {
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.7;
  padding-left: 20px;
  margin: 8px 0 0;
}
.fp-guide-section li { margin-bottom: 6px; }
.fp-math-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 28px;
}
.fp-math-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 24px;
  text-align: center;
}
.fp-math-card strong {
  display: block;
  font-family: var(--display);
  font-size: 36px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
  margin-bottom: 8px;
}
.fp-math-card span {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}
.fp-math-card em {
  display: block;
  font-style: normal;
  font-size: 12px;
  color: var(--red);
  font-weight: 600;
  margin-top: 8px;
  letter-spacing: 0.04em;
}
.fp-channel-stack {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 28px;
}
.fp-channel-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px 22px 28px;
  display: flex;
  flex-direction: column;
}
.fp-channel-card h4 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  margin: 0 0 6px;
  color: var(--ink);
}
.fp-channel-card p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
  flex: 1;
}
.fp-channel-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
  margin-bottom: 10px;
}

@media (max-width: 900px) {
  .fp-compare { grid-template-columns: repeat(2, 1fr); }
  .fp-steps { grid-template-columns: repeat(2, 1fr); }
  .fp-math-grid { grid-template-columns: repeat(3, 1fr); }
  .fp-channel-stack { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .fp-hero { padding: 120px 16px 48px; }
  .fp-hero h1 { font-size: 32px; }
  .fp-hero-sub { font-size: 16px; }
  .fp-section { padding: 64px 16px; }
  .fp-cta-section { padding: 64px 16px; }
  .fp-hero-ctas { flex-direction: column; align-items: center; }
  .fp-btn { width: 100%; max-width: 320px; text-align: center; }
  .fp-steps { grid-template-columns: 1fr; }
  .fp-advantages { grid-template-columns: 1fr; }
  .fp-compare { grid-template-columns: 1fr; }
  .fp-parts-grid { grid-template-columns: repeat(2, 1fr); }
  .fp-math-grid { grid-template-columns: 1fr; }
  .fp-channel-stack { grid-template-columns: 1fr; }
}
`;
