import{i as e,n as t,o as n,t as r}from"./index-KL5bzAvm.js";var i=n(e(),1),a=r();function o({size:e=34}){return(0,a.jsxs)(`svg`,{width:e,height:e,viewBox:`0 0 48 48`,fill:`none`,"aria-hidden":`true`,children:[(0,a.jsx)(`rect`,{x:`1.5`,y:`1.5`,width:`45`,height:`45`,rx:`13`,fill:`#d92d20`}),(0,a.jsx)(`path`,{d:`M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z`,fill:`#ffffff`}),(0,a.jsx)(`path`,{d:`M30.5 13.6a8.6 8.6 0 0 1 5 5`,stroke:`#ffffff`,strokeWidth:`2.6`,strokeLinecap:`round`}),(0,a.jsx)(`path`,{d:`M32.8 8.4a14.3 14.3 0 0 1 8 8`,stroke:`#ffb4ad`,strokeWidth:`2.6`,strokeLinecap:`round`})]})}function s({light:e=!1,size:t=32}){return(0,a.jsxs)(`span`,{className:`l2-logowrap ${e?`light`:``}`,children:[(0,a.jsx)(o,{size:t}),(0,a.jsxs)(`span`,{className:`l2-logo-text`,children:[`Hotline\xA0`,(0,a.jsx)(`em`,{children:`HQ`})]})]})}var c=`hello@hotlinehq.com`,l=`/hotlinehq`;function u(){return typeof window>`u`?``:window.location.pathname===l||window.location.pathname.startsWith(`${l}/`)?l:``}function d(e=`/`){return`${typeof window>`u`?``:window.location.origin}${u()}${e===`/`?`/`:e.replace(/\/+$/,``)}`}function f({title:e,description:t,keywords:n,path:r=`/`,canonicalUrl:a=null,jsonLd:o=null,robots:s=`index, follow`}){return(0,i.useEffect)(()=>{document.title=e;let i=(e,t)=>{let n=document.head.querySelector(e);return n||(n=t(),document.head.appendChild(n)),n},c=(e,t)=>{let n=i(`meta[name="${e}"]`,()=>{let t=document.createElement(`meta`);return t.name=e,t});n.content=t},l=(e,t)=>{let n=i(`meta[property="${e}"]`,()=>{let t=document.createElement(`meta`);return t.setAttribute(`property`,e),t});n.content=t},u=a||d(r);c(`description`,t),n&&c(`keywords`,n),c(`robots`,s),l(`og:title`,e),l(`og:description`,t),l(`og:type`,`website`),l(`og:url`,u),l(`og:site_name`,`Hotline HQ`),c(`twitter:card`,`summary`),c(`twitter:title`,e),c(`twitter:description`,t);let f=i(`link[rel="canonical"]`,()=>{let e=document.createElement(`link`);return e.rel=`canonical`,e});f.href=u;let p=document.getElementById(`seo-jsonld`);o?(p||(p=document.createElement(`script`),p.type=`application/ld+json`,p.id=`seo-jsonld`,document.head.appendChild(p)),p.textContent=JSON.stringify(o)):p&&p.remove()},[e,t,n,r,o,s,a]),null}function p(){let e=d(`/`);return{"@context":`https://schema.org`,"@graph":[{"@type":`Organization`,"@id":`${e}#org`,name:`Hotline HQ`,url:e,logo:d(`/favicon.svg`),email:c,description:`Hotline HQ builds and operates always-on voice hotline networks that connect businesses in the same industry — proven with a 500+ yard used auto parts network.`},{"@type":`WebSite`,name:`Hotline HQ`,url:e,publisher:{"@id":`${e}#org`}},{"@type":`Service`,name:`Hotline HQ voice hotline network`,serviceType:`Always-on business voice hotline network`,provider:{"@id":`${e}#org`},areaServed:`US`,description:`An always-on voice hotline that connects member businesses by region. Members broadcast requests live and get answers in seconds; the network owner earns flat monthly membership revenue.`,offers:{"@type":`Offer`,priceCurrency:`USD`,description:`Flat monthly membership per member business.`}}]}}function m(){return(0,a.jsxs)(`header`,{className:`l2-nav`,children:[(0,a.jsx)(t,{className:`l2-logo`,to:`/`,children:(0,a.jsx)(s,{})}),(0,a.jsxs)(`nav`,{className:`l2-nav-links`,children:[(0,a.jsx)(t,{to:`/`,children:`Home`}),(0,a.jsx)(t,{to:`/#how`,children:`How it works`}),(0,a.jsx)(t,{to:`/client/login`,className:`l2-nav-login`,children:`Login`}),(0,a.jsx)(t,{to:`/client/signup`,className:`l2-nav-cta`,children:`Sign Up Free`})]})]})}var h=[[`Watch it work`,`/#demo`],[`How it works`,`/#how`],[`Try a sell call`,`/#try`],[`Coverage`,`/#rooms`],[`The system`,`/#system`],[`Get a line`,`/#join`],[`Own an auto parts hotline`,`/own-a-hotline`]],g=[`California`,`Texas`,`Florida`,`Arizona`,`Michigan`,`Georgia`,`Ohio`,`New York`,`Indiana`,`Carolinas`];function _(){return(0,a.jsxs)(`footer`,{className:`l2f`,children:[(0,a.jsxs)(`div`,{className:`l2f-inner`,children:[(0,a.jsxs)(`div`,{className:`l2f-brand`,children:[(0,a.jsx)(t,{to:`/`,className:`l2f-logolink`,children:(0,a.jsx)(s,{light:!0})}),(0,a.jsx)(`p`,{children:`The parts-locating voice network for auto recyclers. One broadcast, your whole region on the line, a sale saved.`}),(0,a.jsx)(`a`,{className:`l2f-mail`,href:`mailto:${c}`,children:c})]}),(0,a.jsxs)(`div`,{className:`l2f-col`,children:[(0,a.jsx)(`p`,{className:`l2f-head`,children:`Product`}),h.map(([e,n])=>(0,a.jsx)(t,{to:n,children:e},e))]}),(0,a.jsxs)(`div`,{className:`l2f-col`,children:[(0,a.jsx)(`p`,{className:`l2f-head`,children:`Rooms`}),g.map(e=>(0,a.jsx)(t,{to:`/#rooms`,children:e},e)),(0,a.jsx)(t,{to:`/#rooms`,className:`l2f-more`,children:`All 12 rooms →`})]}),(0,a.jsxs)(`div`,{className:`l2f-col`,children:[(0,a.jsx)(`p`,{className:`l2f-head`,children:`Company`}),(0,a.jsx)(t,{to:`/about`,children:`About us`}),(0,a.jsx)(t,{to:`/privacy-policy`,children:`Privacy policy`}),(0,a.jsx)(t,{to:`/terms-and-conditions`,children:`Terms & conditions`}),(0,a.jsx)(t,{to:`/disclaimer`,children:`Disclaimer`}),(0,a.jsx)(`a`,{href:`mailto:${c}`,children:`Contact`}),(0,a.jsx)(`a`,{href:`/admin/login`,children:`Admin`})]})]}),(0,a.jsx)(`div`,{className:`l2f-note`,children:`Hotline HQ is a private membership network for auto recyclers and salvage yards. Part availability, prices, and response times depend on member participation and are not guaranteed. Calls on the network are recorded for quality and dispute resolution.`}),(0,a.jsxs)(`div`,{className:`l2f-bottom`,children:[(0,a.jsx)(`span`,{children:`© 2026 Hotline HQ · All rights reserved.`}),(0,a.jsxs)(`span`,{className:`l2f-bottom-links`,children:[(0,a.jsx)(t,{to:`/privacy-policy`,children:`Privacy`}),(0,a.jsx)(t,{to:`/terms-and-conditions`,children:`Terms`}),(0,a.jsx)(t,{to:`/disclaimer`,children:`Disclaimer`}),(0,a.jsx)(t,{to:`/about`,children:`About`})]})]})]})}function v({kicker:e,title:t,updated:n,children:r,seo:i}){return(0,a.jsxs)(`div`,{className:`l2`,children:[(0,a.jsx)(`style`,{children:y}),i&&(0,a.jsx)(f,{...i}),(0,a.jsx)(m,{}),(0,a.jsxs)(`main`,{className:`l2-doc`,children:[(0,a.jsx)(`p`,{className:`l2-doc-kicker`,children:e}),(0,a.jsx)(`h1`,{children:t}),n&&(0,a.jsxs)(`p`,{className:`l2-doc-updated`,children:[`Last updated: `,n]}),r]}),(0,a.jsx)(_,{})]})}var y=`
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.l2 {
  --bg: #fbfaf8;
  --surface: #ffffff;
  --band: #f4f2ee;
  --ink: #16181d;
  --muted: #5d6370;
  --line: #e7e4dd;
  --red: #d92d20;
  --red-deep: #b42318;
  --red-soft: #fef3f2;
  --green: #12b76a;
  --display: "Bricolage Grotesque", "Georgia", sans-serif;
  --body: "Instrument Sans", sans-serif;
  --mono: "IBM Plex Mono", monospace;

  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  min-height: 100vh;
}
.l2 *, .l2 *::before, .l2 *::after { box-sizing: border-box; }
.l2 a { text-decoration: none; color: inherit; }

/* logo */
.l2-logowrap { display: inline-flex; align-items: center; gap: 10px; }
.l2-logo-text {
  font-family: var(--display); font-weight: 700; font-size: 21px;
  letter-spacing: -0.01em; color: var(--ink); white-space: nowrap;
}
.l2-logo-text em { font-style: normal; color: var(--red); }
.l2-logowrap.light .l2-logo-text { color: #ffffff; }

/* nav (shared) */
.l2-nav {
  position: fixed; inset: 0 0 auto 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 32px;
  background: rgba(251,250,248,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.l2-nav-links { display: flex; gap: 26px; align-items: center; font-size: 14.5px; font-weight: 500; }
.l2-nav-links a { color: var(--muted); transition: color .2s; }
.l2-nav-links a:hover { color: var(--ink); }
.l2-nav-login {
  color: var(--ink) !important; font-weight: 600;
  padding: 9px 16px; border-radius: 9px; transition: background .2s;
}
.l2-nav-login:hover { background: rgba(0,0,0,0.04); }
.l2-nav-cta {
  color: #fff !important; background: var(--red);
  padding: 9px 18px; border-radius: 9px; transition: background .2s;
}
.l2-nav-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-nav-links a:not(.l2-nav-cta):not(.l2-nav-login) { display: none; } }

/* footer */
.l2f { background: #111316; color: #b9bcc4; }
.l2f-inner {
  max-width: 1280px; margin: 0 auto; padding: 72px 32px 48px;
  display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 48px;
}
@media (max-width: 980px) { .l2f-inner { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .l2f-inner { grid-template-columns: 1fr; } }
.l2f-brand p { font-size: 14.5px; line-height: 1.65; margin: 18px 0; max-width: 320px; color: #8d919b; }
.l2f-logolink { display: inline-block; }
.l2f-mail { font-family: var(--mono); font-size: 13px; color: #ff6f61; }
.l2f-mail:hover { color: #ff9b91; }
.l2f-head {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #ffffff; margin: 4px 0 16px; font-weight: 600;
}
.l2f-col { display: flex; flex-direction: column; gap: 10px; }
.l2f-col a { font-size: 14px; color: #8d919b; transition: color .2s; }
.l2f-col a:hover { color: #ffffff; }
.l2f-more { color: #ff6f61 !important; }
.l2f-note {
  max-width: 1280px; margin: 0 auto; padding: 0 32px 24px;
  font-size: 12px; line-height: 1.7; color: #6b6f7a;
  border-bottom: 1px solid #23262b;
}
.l2f-bottom {
  max-width: 1280px; margin: 0 auto; padding: 20px 32px 26px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font-size: 12.5px; color: #6b6f7a;
}
.l2f-bottom-links { display: inline-flex; gap: 18px; }
.l2f-bottom-links a { color: #8d919b; }
.l2f-bottom-links a:hover { color: #ffffff; }

@media (max-width: 640px) {
  .l2-nav { padding: 10px 16px; }
  .l2-nav-links { gap: 8px; }
  .l2-nav-login { padding: 8px 10px; font-size: 13px; }
  .l2-nav-cta { padding: 8px 14px; font-size: 13px; }
  .l2f-inner { padding: 48px 16px 32px; gap: 32px; }
  .l2f-note { padding: 0 16px 20px; }
  .l2f-bottom { padding: 16px; }
  .l2-doc { padding: 120px 16px 60px; }
}

/* document pages (about / legal) */
.l2-doc { max-width: 840px; margin: 0 auto; padding: 150px 32px 90px; }
.l2-doc-kicker {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--red); margin: 0 0 14px;
}
.l2-doc h1 {
  font-family: var(--display); font-weight: 700; font-size: clamp(34px, 5vw, 52px);
  line-height: 1.05; letter-spacing: -0.015em; margin: 0 0 10px;
}
.l2-doc-updated { font-family: var(--mono); font-size: 12px; color: #a3a094; margin: 0 0 36px; }
.l2-doc h2 {
  font-family: var(--display); font-weight: 700; font-size: 24px;
  margin: 40px 0 12px; letter-spacing: -0.01em;
}
.l2-doc p, .l2-doc li { color: var(--muted); font-size: 15.5px; line-height: 1.75; }
.l2-doc p { margin: 0 0 16px; }
.l2-doc ul { padding-left: 22px; margin: 0 0 16px; }
.l2-doc li { margin-bottom: 8px; }
.l2-doc strong { color: var(--ink); }
.l2-doc a { color: var(--red); }
.l2-doc a:hover { text-decoration: underline; }
.l2-doc .l2-doc-lead { font-size: 17.5px; color: var(--ink); opacity: 0.85; }

/* team grid (about page) */
.l2-team { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 24px 0 8px; }
@media (max-width: 700px) { .l2-team { grid-template-columns: 1fr; } }
.l2-team-card {
  display: flex; gap: 16px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.12);
}
.l2-team-card img {
  width: 84px; height: 84px; border-radius: 12px; object-fit: cover; flex-shrink: 0;
  border: 1px solid var(--line);
}
.l2-team-name {
  font-family: var(--display); font-weight: 700; font-size: 18px;
  color: var(--ink); margin: 2px 0 2px !important; line-height: 1.2;
}
.l2-team-role {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--red); margin: 0 0 8px !important;
}
.l2-team-role span { color: #a3a094; }
.l2-team-bio { font-size: 13.5px !important; line-height: 1.55 !important; margin: 0 !important; }
`;export{f as a,d as c,y as i,p as l,s as n,_ as o,v as r,m as s,c as t};