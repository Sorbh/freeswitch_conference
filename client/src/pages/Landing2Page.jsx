import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import { HQLogo, SiteFooter, SITE_CSS, Seo, landingJsonLd, CONTACT_EMAIL } from "./landing2/site";

/* ------------------------------------------------------------------ */
/*  Landing 2 — Hotline HQ. Light B2B theme, Three.js throughout:     */
/*  - Hero: live sell-call map (click a city to fire one yourself)    */
/*  - "Try it" section: playable sell-call demo with a scoreboard     */
/*  - CTA section: signal-wave particle background                    */
/* ------------------------------------------------------------------ */

/* Simplified continental-US outline, [lon, lat] pairs. */
const US_OUTLINE = [
  [-124.4, 48.4], [-123.2, 49.0], [-120.0, 49.0], [-116.0, 49.0],
  [-110.0, 49.0], [-104.0, 49.0], [-97.2, 49.0], [-95.1, 49.4],
  [-94.6, 48.7], [-92.0, 46.8], [-89.6, 47.9], [-88.4, 48.2],
  [-84.8, 46.8], [-84.5, 45.9], [-82.5, 45.3], [-82.4, 43.0],
  [-79.1, 42.9], [-76.8, 43.6], [-75.0, 44.8], [-71.5, 45.0],
  [-69.2, 47.4], [-67.8, 47.1], [-66.9, 44.8], [-68.8, 44.3],
  [-70.8, 42.7], [-70.0, 41.7], [-74.0, 40.6], [-75.5, 38.5],
  [-76.0, 37.2], [-75.7, 35.5], [-76.5, 34.7], [-78.9, 33.8],
  [-81.0, 31.9], [-81.4, 30.5], [-80.5, 28.5], [-80.0, 26.8],
  [-80.4, 25.2], [-81.8, 24.6], [-81.7, 25.9], [-82.7, 27.5],
  [-82.7, 29.0], [-84.0, 30.1], [-85.4, 29.7], [-86.5, 30.4],
  [-89.2, 30.2], [-90.1, 29.1], [-91.8, 29.5], [-93.8, 29.7],
  [-95.0, 29.0], [-97.1, 27.0], [-97.5, 25.9], [-99.1, 26.4],
  [-100.0, 28.0], [-101.4, 29.8], [-102.8, 29.4], [-103.1, 29.0],
  [-104.5, 29.6], [-105.0, 30.6], [-106.5, 31.8], [-108.2, 31.78],
  [-108.2, 31.33], [-111.0, 31.33], [-114.8, 32.5], [-117.1, 32.5],
  [-118.4, 34.0], [-120.6, 34.6], [-121.9, 36.6], [-122.5, 37.8],
  [-124.0, 40.0], [-124.4, 40.4], [-124.1, 43.0], [-124.0, 44.0],
];

/* The 12 regional rooms (used by the coverage section). */
const HUBS = [
  { name: "CALIFORNIA" }, { name: "TEXAS" }, { name: "FLORIDA" },
  { name: "MEXICO" }, { name: "ENS" }, { name: "ARIZONA" },
  { name: "OHIO" }, { name: "NEW YORK" }, { name: "GEORGIA" },
  { name: "INDIANA" }, { name: "MICHIGAN" }, { name: "CAROLINAS" },
];

/* Cities in the core operating regions — CA, AZ, TX, FL. */
const CITIES = [
  { name: "Sacramento", st: "CA", lon: -121.49, lat: 38.58 },
  { name: "San Jose", st: "CA", lon: -121.89, lat: 37.34 },
  { name: "Fresno", st: "CA", lon: -119.77, lat: 36.75 },
  { name: "Bakersfield", st: "CA", lon: -119.02, lat: 35.37 },
  { name: "Los Angeles", st: "CA", lon: -118.24, lat: 34.05 },
  { name: "Riverside", st: "CA", lon: -117.4, lat: 33.95 },
  { name: "San Diego", st: "CA", lon: -117.16, lat: 32.72 },
  { name: "Flagstaff", st: "AZ", lon: -111.65, lat: 35.2 },
  { name: "Prescott", st: "AZ", lon: -112.47, lat: 34.54 },
  { name: "Phoenix", st: "AZ", lon: -112.07, lat: 33.45 },
  { name: "Tucson", st: "AZ", lon: -110.97, lat: 32.22 },
  { name: "Yuma", st: "AZ", lon: -114.62, lat: 32.69 },
  { name: "El Paso", st: "TX", lon: -106.49, lat: 31.76 },
  { name: "Lubbock", st: "TX", lon: -101.86, lat: 33.58 },
  { name: "Fort Worth", st: "TX", lon: -97.33, lat: 32.76 },
  { name: "Dallas", st: "TX", lon: -96.8, lat: 32.78 },
  { name: "Austin", st: "TX", lon: -97.74, lat: 30.27 },
  { name: "San Antonio", st: "TX", lon: -98.49, lat: 29.42 },
  { name: "Houston", st: "TX", lon: -95.37, lat: 29.76 },
  { name: "Corpus Christi", st: "TX", lon: -97.4, lat: 27.8 },
  { name: "Tallahassee", st: "FL", lon: -84.28, lat: 30.44 },
  { name: "Jacksonville", st: "FL", lon: -81.66, lat: 30.33 },
  { name: "Orlando", st: "FL", lon: -81.38, lat: 28.54 },
  { name: "Tampa", st: "FL", lon: -82.46, lat: 27.95 },
  { name: "Fort Myers", st: "FL", lon: -81.87, lat: 26.64 },
  { name: "Miami", st: "FL", lon: -80.19, lat: 25.76 },
];

const STATE_LABELS = [
  { name: "CALIFORNIA", lon: -120.6, lat: 37.6 },
  { name: "ARIZONA", lon: -112.2, lat: 35.9 },
  { name: "TEXAS", lon: -99.3, lat: 31.6 },
  { name: "FLORIDA", lon: -82.0, lat: 29.3 },
];

/* Sell-call scripts: [year, make, model, part]. */
const PARTS = [
  ["2006", "Chevrolet", "Silverado", "Window switch"],
  ["2014", "Honda", "Accord", "Passenger fender"],
  ["2011", "Toyota", "Camry", "Alternator"],
  ["2017", "Ford", "F-150", "Tail light"],
  ["2009", "Nissan", "Altima", "Radiator"],
  ["2013", "Jeep", "Wrangler", "Door mirror"],
  ["2008", "GMC", "Sierra", "Tailgate"],
  ["2015", "Dodge", "Ram 1500", "Headlight"],
  ["2012", "Volkswagen", "Jetta", "Turbocharger"],
  ["2010", "Subaru", "Outback", "A/C compressor"],
];

const REPLY_LINES = ["I have it", "Got one", "In stock", "Pulling it now"];
const PRICES = [35, 40, 45, 55, 60, 75, 85, 95, 110, 125];

const RED = 0xd92d20;
const GREEN = 0x12b76a;

function project(lon, lat) {
  return { x: (lon + 96) * 1.85, z: -(lat - 37) * 2.35 };
}

function pointInPolygon(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---- canvas-texture sprites ---------------------------------------- */

function spriteFromCanvas(canvas, worldScale) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(canvas.width * worldScale, canvas.height * worldScale, 1);
  return sprite;
}

/* Broadcast card: "FRESNO — SELL CALL / 2006 | CHEVROLET | SILVERADO / WINDOW SWITCH" */
function makeBroadcastCard(callerName, part, worldScale = 0.026) {
  const head = `${callerName.toUpperCase()} — SELL CALL`;
  const line1 = `${part[0]} | ${part[1].toUpperCase()} | ${part[2].toUpperCase()}`;
  const line2 = part[3].toUpperCase();
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  ctx.font = "700 38px 'Instrument Sans', sans-serif";
  const w1 = ctx.measureText(line1).width;
  ctx.font = "800 40px 'Instrument Sans', sans-serif";
  const w2 = ctx.measureText(line2).width;
  ctx.font = "600 24px 'IBM Plex Mono', monospace";
  const w0 = ctx.measureText(head).width;
  const pad = 36;
  const w = Math.ceil(Math.max(w0 + 70, w1, w2)) + pad * 2;
  const h = 196;
  canvas.width = w;
  canvas.height = h;
  ctx = canvas.getContext("2d");
  ctx.shadowColor = "rgba(22,24,29,0.25)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(8, 6, w - 16, h - 22, 18);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#d92d20";
  ctx.beginPath();
  ctx.roundRect(8, 6, 10, h - 22, { tl: 18, bl: 18, tr: 0, br: 0 });
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 14, h - 18);
  ctx.lineTo(w / 2 + 14, h - 18);
  ctx.lineTo(w / 2, h);
  ctx.fill();
  ctx.fillStyle = "#d92d20";
  ctx.beginPath();
  ctx.arc(pad + 10, 44, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "600 24px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#98948a";
  ctx.textBaseline = "middle";
  ctx.fillText(head, pad + 32, 45);
  ctx.font = "700 38px 'Instrument Sans', sans-serif";
  ctx.fillStyle = "#16181d";
  ctx.fillText(line1, pad, 96);
  ctx.font = "800 40px 'Instrument Sans', sans-serif";
  ctx.fillStyle = "#d92d20";
  ctx.fillText(line2, pad, 146);
  return spriteFromCanvas(canvas, worldScale);
}

/* Reply chip: "PHOENIX · I HAVE IT — $45" */
function makeReplyChip(cityName, reply, price, worldScale = 0.024) {
  const text = `${cityName.toUpperCase()}  ·  ${reply.toUpperCase()} — $${price}`;
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  ctx.font = "700 30px 'Instrument Sans', sans-serif";
  const tw = ctx.measureText(text).width;
  const pad = 30;
  const w = Math.ceil(tw) + pad * 2 + 44;
  const h = 92;
  canvas.width = w;
  canvas.height = h;
  ctx = canvas.getContext("2d");
  ctx.shadowColor = "rgba(22,24,29,0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ecfdf3";
  ctx.beginPath();
  ctx.roundRect(6, 4, w - 12, h - 18, 34);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#abefc6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(6, 4, w - 12, h - 18, 34);
  ctx.stroke();
  ctx.fillStyle = "#12b76a";
  ctx.beginPath();
  ctx.arc(pad + 12, h / 2 - 7, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(pad + 4, h / 2 - 7);
  ctx.lineTo(pad + 10, h / 2 - 1);
  ctx.lineTo(pad + 21, h / 2 - 14);
  ctx.stroke();
  ctx.font = "700 30px 'Instrument Sans', sans-serif";
  ctx.fillStyle = "#085d3a";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad + 40, h / 2 - 6);
  return spriteFromCanvas(canvas, worldScale);
}

/* "SALE SAVED — $45" celebration stamp */
function makeSaleStamp(price) {
  const text = `SALE SAVED — $${price}`;
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  ctx.font = "800 52px 'Instrument Sans', sans-serif";
  const tw = ctx.measureText(text).width;
  const pad = 44;
  const w = Math.ceil(tw) + pad * 2;
  const h = 124;
  canvas.width = w;
  canvas.height = h;
  ctx = canvas.getContext("2d");
  ctx.shadowColor = "rgba(18,183,106,0.5)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#12b76a";
  ctx.beginPath();
  ctx.roundRect(10, 10, w - 20, h - 20, 22);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.roundRect(20, 20, w - 40, h - 40, 14);
  ctx.stroke();
  ctx.font = "800 52px 'Instrument Sans', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, h / 2 + 2);
  const sprite = spriteFromCanvas(canvas, 0.03);
  sprite.material.rotation = -0.06;
  return sprite;
}

function makeTextLabel(text, { font = "600 30px 'IBM Plex Mono', monospace", color = "#a8a399", scale = 0.045, opacity = 0.55 } = {}) {
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  canvas.width = Math.ceil(tw) + 20;
  canvas.height = 48;
  ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 10, 26);
  const sprite = spriteFromCanvas(canvas, scale);
  sprite.material.opacity = opacity;
  return sprite;
}

/* ---- shared pools --------------------------------------------------- */

function createRingPool(scene, count = 10) {
  const ringGeo = new THREE.PlaneGeometry(34, 34);
  const rings = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uProgress: { value: 1 },
        uColor: { value: new THREE.Color(RED) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float band = smoothstep(0.085, 0.0, abs(d - uProgress * 0.94));
          float trail = smoothstep(uProgress * 0.94, uProgress * 0.94 - 0.25, d) * 0.18;
          float a = (band + trail) * (1.0 - uProgress);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    rings.push({ mesh, mat, active: false, start: 0, dur: 1.7 });
  }
  return {
    fire(pos, now, color, scale = 1) {
      const slot = rings.find((r) => !r.active);
      if (!slot) return;
      slot.mesh.position.set(pos.x, pos.y + 0.18, pos.z);
      slot.mesh.scale.setScalar(scale);
      slot.mat.uniforms.uColor.value.set(color);
      slot.mat.uniforms.uProgress.value = 0;
      slot.active = true;
      slot.start = now;
      slot.mesh.visible = true;
    },
    update(t) {
      rings.forEach((r) => {
        if (!r.active) return;
        const p = (t - r.start) / r.dur;
        if (p >= 1) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          r.mat.uniforms.uProgress.value = p;
        }
      });
    },
    dispose() {
      ringGeo.dispose();
      rings.forEach((r) => r.mat.dispose());
    },
  };
}

function createArcPool(scene, count = 14) {
  const arcs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uDraw: { value: 0 },
        uFade: { value: 1 },
        uHead: { value: 0 },
        uColor: { value: new THREE.Color(RED) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uDraw;
        uniform float uFade;
        uniform float uHead;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float vis = 1.0 - step(uDraw, vUv.x);
          float head = smoothstep(0.07, 0.0, abs(vUv.x - uHead));
          vec3 col = mix(uColor, vec3(1.0, 0.78, 0.35), head * 0.7);
          float a = vis * uFade * (0.45 + head * 0.55);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.visible = false;
    scene.add(mesh);
    arcs.push({ mesh, mat, active: false, start: 0, dur: 2.1 });
  }
  return {
    fire(from, to, now, color, dur = 2.1, radius = 0.13) {
      const slot = arcs.find((a) => !a.active);
      if (!slot) return;
      const dist = from.distanceTo(to);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.y = 2.0 + dist * 0.26;
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      slot.mesh.geometry.dispose();
      slot.mesh.geometry = new THREE.TubeGeometry(curve, 26, radius, 6, false);
      slot.mat.uniforms.uColor.value.set(color);
      slot.mat.uniforms.uDraw.value = 0;
      slot.mat.uniforms.uFade.value = 1;
      slot.active = true;
      slot.start = now;
      slot.dur = dur;
      slot.mesh.visible = true;
    },
    update(t) {
      arcs.forEach((a) => {
        if (!a.active) return;
        const age = t - a.start;
        if (age >= a.dur) {
          a.active = false;
          a.mesh.visible = false;
          return;
        }
        a.mat.uniforms.uDraw.value = Math.min(age / 0.5, 1);
        a.mat.uniforms.uHead.value = (age / 0.7) % 1;
        a.mat.uniforms.uFade.value = age < a.dur - 0.6 ? 1 : (a.dur - age) / 0.6;
      });
    },
    dispose() {
      arcs.forEach((a) => {
        a.mesh.geometry.dispose();
        a.mat.dispose();
      });
    },
  };
}

function createFloatPool(scene) {
  const floats = [];
  function disposeFloat(f) {
    scene.remove(f.sprite);
    f.sprite.material.map.dispose();
    f.sprite.material.dispose();
  }
  return {
    spawn(sprite, pos, y, now, ttl, rise = 0.12) {
      sprite.position.set(pos.x, y, pos.z);
      floats.push({
        sprite, born: now, ttl, rise,
        baseY: y,
        baseScaleX: sprite.scale.x,
        baseScaleY: sprite.scale.y,
      });
      scene.add(sprite);
    },
    update(t) {
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        const age = t - f.born;
        if (age >= f.ttl) {
          disposeFloat(f);
          floats.splice(i, 1);
          continue;
        }
        const popK = easeOutBack(Math.min(age / 0.45, 1));
        f.sprite.scale.set(f.baseScaleX * popK, f.baseScaleY * popK, 1);
        const fadeIn = Math.min(age / 0.3, 1);
        const fadeOut = age > f.ttl - 0.55 ? (f.ttl - age) / 0.55 : 1;
        f.sprite.material.opacity = fadeIn * fadeOut;
        f.sprite.position.y = f.baseY + Math.sin(t * 1.6 + f.born) * 0.22 + age * f.rise;
      }
    },
    dispose() {
      floats.forEach(disposeFloat);
      floats.length = 0;
    },
  };
}

/* Confetti-style spark burst inside a scene. */
function createBurstPool(scene, count = 2) {
  const bursts = [];
  const N = 46;
  for (let b = 0; b < count; b++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.42, color: 0x12b76a, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    scene.add(pts);
    bursts.push({ pts, geo, mat, vels: new Float32Array(N * 3), origin: new THREE.Vector3(), active: false, start: 0 });
  }
  return {
    fire(pos, now) {
      const slot = bursts.find((s) => !s.active);
      if (!slot) return;
      slot.origin.copy(pos);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const up = 4 + Math.random() * 7;
        const out = 2 + Math.random() * 5;
        slot.vels[i * 3] = Math.cos(a) * out;
        slot.vels[i * 3 + 1] = up;
        slot.vels[i * 3 + 2] = Math.sin(a) * out;
      }
      slot.active = true;
      slot.start = now;
      slot.pts.visible = true;
    },
    update(t) {
      bursts.forEach((s) => {
        if (!s.active) return;
        const age = t - s.start;
        if (age > 1.3) {
          s.active = false;
          s.pts.visible = false;
          return;
        }
        const arr = s.geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          arr[i * 3] = s.origin.x + s.vels[i * 3] * age;
          arr[i * 3 + 1] = s.origin.y + s.vels[i * 3 + 1] * age - 9.5 * age * age;
          arr[i * 3 + 2] = s.origin.z + s.vels[i * 3 + 2] * age;
        }
        s.geo.attributes.position.needsUpdate = true;
        s.mat.opacity = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 1.15;
      });
    },
    dispose() {
      bursts.forEach((s) => {
        s.geo.dispose();
        s.mat.dispose();
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Scene 1 — hero map                                                 */
/* ------------------------------------------------------------------ */

function buildNetworkScene(container, { reducedMotion, onReply }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xfbfaf8, 95, 215);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
  const lookBase = new THREE.Vector3(0, 12, -6);
  const camBase = new THREE.Vector3(0, 42, 88);
  const camIntro = new THREE.Vector3(0, 95, 170);
  const lookCur = lookBase.clone();
  const lookTarget = lookBase.clone();
  const camCur = camBase.clone();
  const camTarget = camBase.clone();
  camera.position.copy(reducedMotion ? camBase : camIntro);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  /* dot-matrix map */
  const dots = [];
  for (let lon = -125; lon <= -66.5; lon += 0.72) {
    for (let lat = 24.5; lat <= 49.4; lat += 0.58) {
      if (pointInPolygon(lon, lat, US_OUTLINE)) dots.push({ lon, lat });
    }
  }

  const total = dots.length + CITIES.length;
  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const kinds = new Float32Array(total);
  const flare = new Float32Array(total);
  const hotSel = new Float32Array(total);

  dots.forEach((p, i) => {
    const { x, z } = project(p.lon, p.lat);
    positions.set([x, 0, z], i * 3);
    sizes[i] = 1.55;
    kinds[i] = 0;
  });
  CITIES.forEach((c, i) => {
    const idx = dots.length + i;
    const { x, z } = project(c.lon, c.lat);
    positions.set([x, 0.4, z], idx * 3);
    sizes[idx] = 5.0;
    kinds[idx] = 1;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
  geo.setAttribute("aFlare", new THREE.BufferAttribute(flare, 1));
  geo.setAttribute("aHotSel", new THREE.BufferAttribute(hotSel, 1));

  const pointsMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aKind;
      attribute float aFlare;
      attribute float aHotSel;
      uniform float uTime;
      varying float vKind;
      varying float vFlare;
      varying float vHotSel;
      varying float vSheen;
      void main() {
        vKind = aKind;
        vFlare = aFlare;
        vHotSel = aHotSel;
        vSheen = 0.82 + 0.18 * sin(uTime * 0.5 + position.x * 0.09 + position.z * 0.05);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = aSize * (1.0 + aFlare * 1.6);
        gl_PointSize = s * (250.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vKind;
      varying float vFlare;
      varying float vHotSel;
      varying float vSheen;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.5, 0.12, d);
        vec3 dotCol  = vec3(0.80, 0.78, 0.74) * vSheen;
        vec3 cityCol = vec3(0.28, 0.30, 0.36);
        vec3 base = mix(dotCol, cityCol, vKind);
        vec3 hot = mix(vec3(0.85, 0.18, 0.13), vec3(0.07, 0.72, 0.42), vHotSel);
        vec3 col = mix(base, hot, clamp(vFlare, 0.0, 1.0));
        float a = core * (0.8 + vFlare * 0.2);
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  scene.add(new THREE.Points(geo, pointsMat));

  /* US border */
  const borderPts = US_OUTLINE.map(([lon, lat]) => {
    const { x, z } = project(lon, lat);
    return new THREE.Vector3(x, 0.05, z);
  });
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(borderPts),
    new THREE.LineBasicMaterial({ color: 0xc9c4ba, transparent: true, opacity: 0.8 })
  );
  scene.add(border);

  /* state labels */
  const stateSprites = STATE_LABELS.map((s) => {
    const { x, z } = project(s.lon, s.lat);
    const sprite = makeTextLabel(s.name);
    sprite.position.set(x, 1.6, z);
    scene.add(sprite);
    return sprite;
  });

  const ringPool = createRingPool(scene, 10);
  const arcPool = createArcPool(scene, 14);
  const floatPool = createFloatPool(scene);

  /* sell-call cycle */
  const cityVecs = CITIES.map((c, i) => {
    const { x, z } = project(c.lon, c.lat);
    return { idx: dots.length + i, city: c, vec: new THREE.Vector3(x, 0.4, z) };
  });

  let nextCall = reducedMotion ? Infinity : 2.6;
  let partIdx = 0;
  const pending = [];

  function startSellCall(now, callerOverride, partOverride, skipResponses) {
    const caller = callerOverride || pick(cityVecs);
    const part = partOverride || PARTS[partIdx % PARTS.length];
    partIdx++;

    lookTarget.set(caller.vec.x * 0.62, 9, caller.vec.z * 0.5 - 4);
    camTarget.set(camBase.x + caller.vec.x * 0.34, camBase.y - 7, camBase.z - 10);

    flare[caller.idx] = 1;
    hotSel[caller.idx] = 0;
    ringPool.fire(caller.vec, now, RED, 1);
    floatPool.spawn(makeBroadcastCard(caller.city.name, part), caller.vec, 7.4, now, skipResponses ? 12.0 : 6.0);

    const neighbors = cityVecs
      .filter((n) => {
        const d = n.vec.distanceTo(caller.vec);
        return d > 0.5 && d < 24;
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    neighbors.forEach((n, k) => {
      pending.push({
        at: now + 0.55 + k * 0.16,
        fn: (t) => {
          arcPool.fire(caller.vec.clone(), n.vec.clone(), t, RED, 1.9);
          flare[n.idx] = 0.55;
          hotSel[n.idx] = 0;
        },
      });
    });

    if (skipResponses) return;

    const responders = neighbors.slice(0, 2 + Math.floor(Math.random() * 2));
    responders.forEach((n, k) => {
      const reply = pick(REPLY_LINES);
      const price = pick(PRICES);
      pending.push({
        at: now + 2.0 + k * 0.55,
        fn: (t) => {
          flare[n.idx] = 1;
          hotSel[n.idx] = 1;
          ringPool.fire(n.vec, t, GREEN, 0.45);
          arcPool.fire(n.vec.clone(), caller.vec.clone(), t, GREEN, 2.2);
          floatPool.spawn(makeReplyChip(n.city.name, reply, price), n.vec, 4.6, t, 3.6);
          onReply?.(price);
        },
      });
    });
  }

  /* click a city to fire a sell call */
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPt = new THREE.Vector3();

  function onClick(e) {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hitPt)) return;
    let best = null;
    let bd = Infinity;
    cityVecs.forEach((c) => {
      const d = c.vec.distanceTo(hitPt);
      if (d < bd) {
        bd = d;
        best = c;
      }
    });
    if (best && bd < 14) {
      const t = clock.getElapsedTime();
      startSellCall(t, best);
      nextCall = t + 9;
    }
  }
  container.addEventListener("pointerdown", onClick);

  /* loop */
  const clock = new THREE.Clock();
  let mouseX = 0;
  let mouseY = 0;
  let raf = 0;
  let running = true;
  let autoPaused = false;

  function onMouse(e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  window.addEventListener("pointermove", onMouse, { passive: true });

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const t = clock.getElapsedTime();
    pointsMat.uniforms.uTime.value = t;

    if (!reducedMotion) {
      if (!autoPaused && t > nextCall) {
        startSellCall(t);
        nextCall = t + 7.5;
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (t >= pending[i].at) {
          pending[i].fn(t);
          pending.splice(i, 1);
        }
      }

      for (let i = 0; i < total; i++) {
        if (flare[i] > 0.001) flare[i] *= 0.975;
        else flare[i] = 0;
      }
      geo.attributes.aFlare.needsUpdate = true;
      geo.attributes.aHotSel.needsUpdate = true;

      ringPool.update(t);
      arcPool.update(t);
      floatPool.update(t);

      if (t < 2.2) {
        const k = easeOutCubic(Math.min(t / 2.2, 1));
        camera.position.lerpVectors(camIntro, camBase, k);
        camCur.copy(camera.position);
      } else {
        camCur.lerp(camTarget, 0.018);
        lookCur.lerp(lookTarget, 0.022);
        camera.position.set(
          camCur.x + Math.sin(t * 0.05) * 1.6 + mouseX * 2.2,
          camCur.y + mouseY * -1.4,
          camCur.z + Math.cos(t * 0.04) * 1.0
        );
      }
    }

    camera.lookAt(lookCur);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  frame();

  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
    },
    { threshold: 0.02 }
  );
  io.observe(container);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMouse);
      container.removeEventListener("pointerdown", onClick);
      geo.dispose();
      pointsMat.dispose();
      border.geometry.dispose();
      border.material.dispose();
      ringPool.dispose();
      arcPool.dispose();
      floatPool.dispose();
      stateSprites.forEach((s) => {
        s.material.map.dispose();
        s.material.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
    fireSellCall() {
      const t = clock.getElapsedTime();
      startSellCall(t);
      nextCall = t + 12;
    },
    fireSellCallWithData(cityName, partData) {
      const t = clock.getElapsedTime();
      const match = cityVecs.find((c) => c.city.name === cityName);
      startSellCall(t, match || null, partData || null, true);
      nextCall = t + 20;
    },
    fireResponse(callerCityName, responderCityName, yardName, reply) {
      const t = clock.getElapsedTime();
      const caller = cityVecs.find((c) => c.city.name === callerCityName);
      const responder = cityVecs.find((c) => c.city.name === responderCityName);
      if (!caller || !responder) return;
      flare[responder.idx] = 1;
      hotSel[responder.idx] = 1;
      ringPool.fire(responder.vec, t, GREEN, 0.45);
      arcPool.fire(responder.vec.clone(), caller.vec.clone(), t, GREEN, 2.2);
      floatPool.spawn(
        makeReplyChip(yardName, reply, pick(PRICES)),
        responder.vec, 4.6, t, 3.6
      );
      onReply?.(pick(PRICES));
    },
    pauseAuto() { autoPaused = true; },
    resumeAuto() {
      autoPaused = false;
      nextCall = clock.getElapsedTime() + 4;
    },
    get _autoPaused() { return autoPaused; },
  };
}

/* ------------------------------------------------------------------ */
/*  Scene 2 — playable sell-call demo                                  */
/* ------------------------------------------------------------------ */

const DEMO_NEIGHBORS = [
  "Tucson", "Flagstaff", "Yuma", "Prescott",
  "San Diego", "Riverside", "El Paso", "Las Vegas",
];

function buildDemoScene(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xfbfaf8, 42, 90);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(0, 24, 28);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  /* radar ground: dot grid + range rings */
  const gPts = [];
  for (let x = -18; x <= 18; x += 1.3) {
    for (let z = -18; z <= 18; z += 1.3) {
      if (Math.hypot(x, z) <= 17) gPts.push(x, 0, z);
    }
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gPts), 3));
  const groundMat = new THREE.PointsMaterial({
    color: 0xcdc8bf, size: 0.16, transparent: true, opacity: 0.8, sizeAttenuation: true,
  });
  scene.add(new THREE.Points(groundGeo, groundMat));

  const rangeRings = [6.5, 13].map((r) => {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xddd8cf, transparent: true, opacity: 0.9 })
    );
    scene.add(line);
    return line;
  });

  /* nodes: your yard center + neighbors in a ring */
  const nodeGeo = new THREE.SphereGeometry(0.5, 20, 20);
  const center = {
    mesh: new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: RED })),
    vec: new THREE.Vector3(0, 0.5, 0),
    flare: 0,
  };
  center.mesh.position.copy(center.vec);
  scene.add(center.mesh);

  const centerLabel = makeTextLabel("YOUR YARD — PHOENIX", {
    color: "#d92d20", opacity: 0.95, scale: 0.034,
    font: "700 30px 'IBM Plex Mono', monospace",
  });
  centerLabel.position.set(0, 2.1, 0);
  scene.add(centerLabel);

  const slate = new THREE.Color(0x474c57);
  const greenC = new THREE.Color(GREEN);
  const neighbors = DEMO_NEIGHBORS.map((name, i) => {
    const a = (i / DEMO_NEIGHBORS.length) * Math.PI * 2 - Math.PI / 2 + 0.18;
    const r = 11.5 + (i % 2) * 2.6;
    const vec = new THREE.Vector3(Math.cos(a) * r, 0.45, Math.sin(a) * r * 0.82);
    const mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: slate.clone() }));
    mesh.position.copy(vec);
    mesh.scale.setScalar(0.82);
    scene.add(mesh);
    const label = makeTextLabel(name.toUpperCase(), {
      color: "#6b6f7a", opacity: 0.85, scale: 0.028,
    });
    label.position.set(vec.x, 1.8, vec.z);
    scene.add(label);
    return { name, vec, mesh, label, flare: 0, hot: 0 };
  });

  const ringPool = createRingPool(scene, 8);
  const arcPool = createArcPool(scene, 10);
  const floatPool = createFloatPool(scene);
  const burstPool = createBurstPool(scene, 2);

  /* run a sell call */
  const pending = [];
  let busy = false;

  function run(part, cbs = {}) {
    if (busy) return;
    busy = true;
    const now = clock.getElapsedTime();

    center.flare = 1;
    ringPool.fire(center.vec, now, RED, 0.8);
    floatPool.spawn(makeBroadcastCard("Your yard", part, 0.022), center.vec, 5.6, now, 5.4);

    neighbors.forEach((n, k) => {
      pending.push({
        at: now + 0.45 + k * 0.1,
        fn: (t) => {
          arcPool.fire(center.vec.clone(), n.vec.clone(), t, RED, 1.7, 0.09);
          n.flare = 0.6;
          n.hot = 0;
        },
      });
    });

    const shuffled = [...neighbors].sort(() => Math.random() - 0.5);
    const responders = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
    const prices = responders.map(() => pick(PRICES));

    responders.forEach((n, k) => {
      pending.push({
        at: now + 1.9 + k * 0.55,
        fn: (t) => {
          n.flare = 1;
          n.hot = 1;
          ringPool.fire(n.vec, t, GREEN, 0.4);
          arcPool.fire(n.vec.clone(), center.vec.clone(), t, GREEN, 2.0, 0.09);
          floatPool.spawn(makeReplyChip(n.name, pick(REPLY_LINES), prices[k], 0.02), n.vec, 3.4, t, 3.2);
        },
      });
    });

    const bestPrice = Math.min(...prices);
    pending.push({
      at: now + 4.1,
      fn: (t) => {
        floatPool.spawn(makeSaleStamp(bestPrice), center.vec, 6.4, t, 2.6, 0.35);
        burstPool.fire(new THREE.Vector3(0, 1.5, 0), t);
        cbs.onSale?.(bestPrice, responders.length);
      },
    });
    pending.push({
      at: now + 6.0,
      fn: () => {
        busy = false;
        cbs.onDone?.();
      },
    });
  }

  /* loop */
  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const t = clock.getElapsedTime();

    for (let i = pending.length - 1; i >= 0; i--) {
      if (t >= pending[i].at) {
        pending[i].fn(t);
        pending.splice(i, 1);
      }
    }

    center.flare *= 0.97;
    center.mesh.scale.setScalar(1 + center.flare * 0.7 + Math.sin(t * 2.4) * 0.05);
    neighbors.forEach((n) => {
      n.flare *= 0.97;
      n.mesh.scale.setScalar(0.82 + n.flare * 0.6);
      n.mesh.material.color.copy(slate).lerp(n.hot ? greenC : new THREE.Color(RED), Math.min(n.flare, 1));
    });

    ringPool.update(t);
    arcPool.update(t);
    floatPool.update(t);
    burstPool.update(t);

    camera.position.x = Math.sin(t * 0.12) * 2.2;
    camera.position.y = 24 + Math.sin(t * 0.09) * 0.8;
    camera.lookAt(0, 1.5, 0);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  frame();

  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
    },
    { threshold: 0.02 }
  );
  io.observe(container);

  const dispose = () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    groundGeo.dispose();
    groundMat.dispose();
    rangeRings.forEach((l) => {
      l.geometry.dispose();
      l.material.dispose();
    });
    nodeGeo.dispose();
    center.mesh.material.dispose();
    centerLabel.material.map.dispose();
    centerLabel.material.dispose();
    neighbors.forEach((n) => {
      n.mesh.material.dispose();
      n.label.material.map.dispose();
      n.label.material.dispose();
    });
    ringPool.dispose();
    arcPool.dispose();
    floatPool.dispose();
    burstPool.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };

  return { run, dispose };
}

/* ------------------------------------------------------------------ */
/*  Scene 3 — signal wave for the dark CTA band                        */
/* ------------------------------------------------------------------ */

function buildWaveScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 7, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const COLS = 90;
  const ROWS = 16;
  const N = COLS * ROWS;
  const pos = new Float32Array(N * 3);
  let p = 0;
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      pos[p++] = (i / (COLS - 1) - 0.5) * 56;
      pos[p++] = 0;
      pos[p++] = (j / (ROWS - 1) - 0.5) * 12;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xff6f61, size: 0.13, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));

  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const t = clock.getElapsedTime();
    const arr = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const x = arr[i * 3];
      const z = arr[i * 3 + 2];
      arr[i * 3 + 1] =
        Math.sin(x * 0.32 + t * 1.1) * 0.9 +
        Math.sin(x * 0.11 - t * 0.6 + z * 0.4) * 0.7;
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  frame();

  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
    },
    { threshold: 0.02 }
  );
  io.observe(container);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    geo.dispose();
    mat.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

const TICKER = [
  ["10:42:08", "TX ROOM", "’06 Silverado 2500 transfer case", "Answered · 2s"],
  ["10:43:51", "CA ROOM", "’14 Accord passenger fender, white", "Answered · 3s"],
  ["10:47:12", "FL ROOM", "’09 Camry alternator", "Answered · 2s"],
  ["10:49:40", "OH ROOM", "’17 F-150 3.5 EcoBoost long block", "Answered · 5s"],
  ["10:52:03", "AZ ROOM", "’11 Jetta TDI turbo", "Escalated → CA"],
  ["10:55:27", "GA ROOM", "’15 Altima CVT, 62k", "Answered · 2s"],
  ["10:58:44", "MI ROOM", "’08 Sierra tailgate, black", "Answered · 4s"],
  ["11:01:19", "NY ROOM", "’13 Rogue transfer case AWD", "Answered · 3s"],
];

const STEPS = [
  {
    n: "1",
    title: "Broadcast the request",
    copy: "A customer asks for a part you don't have. Pick up the handset and say it once — every yard in your region hears it instantly.",
  },
  {
    n: "2",
    title: "A yard answers",
    copy: "Members monitor the room hands-free. The yard sitting on your part unmutes and replies. Typical answer time is about two seconds.",
  },
  {
    n: "3",
    title: "Close the sale",
    copy: "Talk it through live or take it private. Your customer gets the part, both yards get paid — and the call is logged and recorded.",
  },
];

const COMPARES = [
  {
    label: "Inventory databases",
    viz: "db",
    time: "30–60 min",
    flaw: "Stale listings, and you're result #38 of 40. The part shows in stock — until you drive out and it's already gone.",
  },
  {
    label: "Calling around",
    viz: "hold",
    time: "40+ min",
    flaw: "Forty minutes of hold music to check five yards. Your customer already bought the part somewhere else.",
  },
  {
    label: "Facebook groups",
    viz: "fb",
    time: "Hours — if ever",
    flaw: "Your post is buried within the hour, and nobody who can actually sell the part is watching the feed.",
  },
  {
    label: "The Hotline HQ network",
    viz: "hot",
    time: "2 seconds",
    flaw: "One voice broadcast. Every counter in your region hears it right now, and the yard that has it answers you back in seconds.",
    hot: true,
  },
];

const FEATURES = [
  {
    code: "1",
    title: "Always on",
    copy: "If the line ever drops, it reconnects on its own. Your phone stays in the room day and night without anyone touching it.",
  },
  {
    code: "2",
    title: "Hands-free listening",
    copy: "The room plays quietly at your counter. Pick up the handset to talk, put it down to go quiet. No apps, no logins, no screens.",
  },
  {
    code: "3",
    title: "Phone or computer",
    copy: "We ship you a desk phone that's ready to go — plug it in and you're on the air. Prefer the computer? It works in your browser too.",
  },
  {
    code: "4",
    title: "Every call on record",
    copy: "Every request is saved and recorded, along with who answered it. You can always go back and hear exactly what was said.",
  },
  {
    code: "5",
    title: "Reach beyond your region",
    copy: "You're not boxed into your own area. Your yard also reaches nearby regions, and you can switch rooms right from the phone.",
  },
  {
    code: "6",
    title: "We watch your line 24/7",
    copy: "If your line goes quiet, our team is alerted within minutes and gets you back on the air — usually before you even notice.",
  },
];

/* Count-up stat that animates when scrolled into view. */
function Stat({ to, suffix = "", label }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const k = Math.min((now - start) / 1400, 1);
          setVal(Math.round(to * easeOutCubic(k)));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <div ref={ref}>
      <strong>
        {val}
        {suffix}
      </strong>
      <span>{label}</span>
    </div>
  );
}

const HERO_CLIPS = [
  {
    file: "./broadcasts/clip1.mp3",
    part: "2018 Honda Civic — Wreck Opinion",
    yard: "Fast Auto Parts",
    city: "Phoenix",
    partData: ["2018", "Honda", "Civic", "Wreck opinion"],
    responses: [
      { at: 7.3, city: "Tucson", yard: "A&G Auto Wrecking", reply: "Got it" },
      { at: 8.5, city: "Yuma", yard: "J&A Auto Parts", reply: "J&A got it" },
      { at: 10.0, city: "Prescott", yard: "ODR Auto Wrecking", reply: "Got two" },
      { at: 11.5, city: "Flagstaff", yard: "Fast Auto Parts", reply: "In stock" },
    ],
  },
  {
    file: "./broadcasts/clip2.mp3",
    part: "2020 Camry — Trunk & Taillights",
    yard: "Reeves Auto Wrecking",
    city: "Tucson",
    partData: ["2020", "Toyota", "Camry", "Trunk & taillights"],
    responses: [
      { at: 5.2, city: "Phoenix", yard: "Reeves", reply: "Checking" },
      { at: 8.5, city: "Prescott", yard: "Phoenix Salvage", reply: "Got it" },
      { at: 12.5, city: "Yuma", yard: "Chapin Auto", reply: "Thank you" },
    ],
  },
  {
    file: "./broadcasts/clip3.mp3",
    part: "2021 Chevy Tahoe — Wreck Opinion",
    yard: "Carrillo Auto Parts",
    city: "Flagstaff",
    partData: ["2021", "Chevrolet", "Tahoe", "Wreck opinion"],
    responses: [
      { at: 3.8, city: "Phoenix", yard: "J&A Auto Parts", reply: "J&A got it" },
      { at: 5.5, city: "Tucson", yard: "Parts Plus", reply: "Ready to go" },
      { at: 7.0, city: "Prescott", yard: "Jordan Auto", reply: "Got it" },
    ],
  },
  {
    file: "./broadcasts/clip4.mp3",
    part: "2018 Honda Civic — Rack & Pinion",
    yard: "Jordan Auto Wrecking",
    city: "Prescott",
    partData: ["2018", "Honda", "Civic", "Rack & pinion"],
    responses: [
      { at: 9.5, city: "Phoenix", yard: "Jordan Auto", reply: "Got one" },
      { at: 11.5, city: "Tucson", yard: "A&G Auto", reply: "Got a 15" },
      { at: 14.0, city: "Flagstaff", yard: "Fast Auto Parts", reply: "In stock" },
    ],
  },
];

export default function Landing2Page() {
  const heroRef = useRef(null);
  const demoRef = useRef(null);
  const waveRef = useRef(null);
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const wireRef = useRef(null);
  const formRef = useRef(null);
  const demoApi = useRef(null);

  const [sent, setSent] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [heroFeed, setHeroFeed] = useState({ deals: 0, revenue: 0 });
  const [demoPart, setDemoPart] = useState(0);
  const [demoBusy, setDemoBusy] = useState(false);
  const [score, setScore] = useState({ deals: 0, revenue: 0 });

  /* hero audio — real broadcasts synced with map animation */
  const heroSceneApi = useRef(null);
  const heroAudioRef = useRef(null);
  const heroClipIdx = useRef(0);
  const heroTimers = useRef([]);
  const [heroAudioState, setHeroAudioState] = useState("idle");
  const [heroClipInfo, setHeroClipInfo] = useState(null);

  const clearHeroTimers = () => {
    heroTimers.current.forEach(clearTimeout);
    heroTimers.current = [];
  };

  const playHeroBroadcast = () => {
    const audio = heroAudioRef.current;
    const api = heroSceneApi.current;
    if (!audio) return;

    if (heroAudioState === "playing") {
      audio.pause();
      clearHeroTimers();
      setHeroAudioState("idle");
      setHeroClipInfo(null);
      api?.resumeAuto();
      return;
    }

    const idx = heroClipIdx.current % HERO_CLIPS.length;
    const clip = HERO_CLIPS[idx];
    heroClipIdx.current = idx + 1;

    audio.src = clip.file;
    setHeroAudioState("playing");
    setHeroClipInfo(clip);
    api?.pauseAuto();
    clearHeroTimers();

    audio.play().then(() => {
      api?.fireSellCallWithData(clip.city, clip.partData);
      if (clip.responses) {
        clip.responses.forEach((r) => {
          const timer = setTimeout(() => {
            api?.fireResponse(clip.city, r.city, r.yard, r.reply);
          }, r.at * 1000);
          heroTimers.current.push(timer);
        });
      }
    }).catch(() => {});
  }

  useEffect(() => {
    const audio = heroAudioRef.current;
    if (!audio) return;
    const onEnd = () => {
      const api = heroSceneApi.current;
      clearHeroTimers();
      setHeroAudioState("idle");
      setHeroClipInfo(null);
      api?.resumeAuto();
    };
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, []);

  /* hero scene */
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!heroRef.current) return;
    const api = buildNetworkScene(heroRef.current, {
      reducedMotion,
      onReply: (price) =>
        setHeroFeed((f) => ({ deals: f.deals + 1, revenue: f.revenue + price })),
    });
    heroSceneApi.current = api;
    return () => {
      heroSceneApi.current = null;
      api.dispose();
    };
  }, []);

  /* playable demo scene */
  useEffect(() => {
    if (!demoRef.current) return;
    const api = buildDemoScene(demoRef.current);
    demoApi.current = api;
    return () => {
      demoApi.current = null;
      api.dispose();
    };
  }, []);

  /* CTA wave scene */
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!waveRef.current || reducedMotion) return;
    return buildWaveScene(waveRef.current);
  }, []);

  /* scroll reveal */
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".l2-reveal") ?? [];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("l2-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* scroll progress wire */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const d = document.documentElement;
        const max = d.scrollHeight - window.innerHeight;
        const k = max > 0 ? Math.min(d.scrollTop / max, 1) : 0;
        if (wireRef.current) wireRef.current.style.height = `${k * 100}%`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  function runDemo() {
    if (demoBusy || !demoApi.current) return;
    setDemoBusy(true);
    demoApi.current.run(PARTS[demoPart], {
      onSale: (price, bids) =>
        setScore((s) => ({ deals: s.deals + 1, revenue: s.revenue + price, bids })),
      onDone: () => setDemoBusy(false),
    });
  }

  function confettiBurst() {
    const host = formRef.current;
    if (!host) return;
    const colors = ["#d92d20", "#12b76a", "#f79009", "#16181d"];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("span");
      s.className = "l2-confetti";
      s.style.setProperty("--dx", `${(Math.random() - 0.5) * 360}px`);
      s.style.setProperty("--dy", `${-40 - Math.random() * 260}px`);
      s.style.setProperty("--rot", `${(Math.random() - 0.5) * 540}deg`);
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 0.12}s`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const businessName = (fd.get("businessName") || "").trim();
    const phone = (fd.get("phone") || "").trim();
    const region = (fd.get("region") || "").trim();

    setSent(true);
    confettiBurst();
    toast.success("Request received — we'll call your yard within one business day.");

    try {
      const payload = JSON.stringify({
        email: `${businessName} — ${region}`,
        feature: "get-listed",
        name: region,
        businessName,
        phone,
      });
      navigator.sendBeacon(
        "https://script.google.com/macros/s/AKfycbwX_nAG62h6qlqF1bD9QjxDGPuOmp9ruGAPwhNq6ZRLj0NYVxKEwzdnN3io8nLsEmoS/exec",
        new Blob([payload], { type: "text/plain" })
      );
    } catch (_) {}
  }

  const part = PARTS[demoPart];

  return (
    <div className="l2" ref={rootRef}>
      <style>{SITE_CSS}</style>
      <style>{CSS}</style>
      <Seo
        title="Hotline HQ — Find Any Used Auto Part in 2 Seconds | Salvage Yard Parts Locator"
        description="Stop losing sales when you don't have the part. Broadcast once to 500+ salvage yards — get an answer in 2 seconds. The fastest way to locate and sell used auto parts."
        keywords="find used auto parts fast, used auto parts locator, salvage yard parts finder, locate used car parts, sell used auto parts to yards, junkyard parts sourcing, used OEM parts supplier, auto parts interchange, salvage yard parts network, used car parts wholesale, auto recycler parts locator, find junkyard parts near me"
        canonicalUrl="https://redlineusedautoparts.com/hotlinehq/"
        path="/"
        jsonLd={landingJsonLd()}
      />

      {/* scroll progress wire */}
      <div className="l2-wire" aria-hidden="true">
        <div className="l2-wire-fill" ref={wireRef} />
      </div>

      {/* ───────────────── nav ───────────────── */}
      <header className="l2-nav">
        <a className="l2-logo" href="#top">
          <HQLogo />
        </a>
        <nav className="l2-nav-links">
          <a href="#how">How it works</a>
          <a href="#try">Try it</a>
          <a href="#rooms">Coverage</a>
          <a href="./own-a-hotline">Own a hotline</a>
          <a href="/client/login" className="l2-nav-login">Login</a>
          <a href="/client/signup" className="l2-nav-cta">
            Sign Up Free
          </a>
        </nav>
      </header>

      {/* ───────────────── hero ───────────────── */}
      <section className="l2-hero" id="top">
        <div className="l2-hero-bg" ref={heroRef} aria-hidden="true" />
        <div className="l2-hero-scrim" aria-hidden="true" />

        <div className="l2-stage-chip l2-stage-tl">
          <span className="l2-live-dot" /> Live network · 12 regional rooms
        </div>
        <div className="l2-stage-chip l2-stage-tr">◉ Click any city to fire a sell call</div>
        <div className="l2-stage-chip l2-stage-br" key={heroFeed.deals}>
          ▲ ${heroFeed.revenue.toLocaleString()} matched · {heroFeed.deals} deals (demo feed)
        </div>

        <div className="l2-hero-copy">
          <p className="l2-eyebrow">The parts-locating voice network for auto recyclers</p>
          <h1>
            Every &ldquo;we don&rsquo;t have it&rdquo; is a customer walking
            out. <em>It doesn&rsquo;t have to be.</em>
          </h1>
          <p className="l2-sub">
            The part you don&rsquo;t have is sitting in somebody&rsquo;s yard.
            Hotline HQ is the always-on voice network connecting 500+ salvage
            yards — broadcast once, get an answer in seconds, and keep the sale.
          </p>
          <div className="l2-hero-ctas">
            <a className="l2-btn l2-btn-hot" href="/client/signup">
              Sign Up Free
            </a>
            <a className="l2-btn l2-btn-ghost" href="/client/login">
              Login
            </a>
          </div>

          <audio ref={heroAudioRef} preload="none" />
          <button
            type="button"
            className={`l2-listen-btn ${heroAudioState === "playing" ? "on" : ""}`}
            onClick={playHeroBroadcast}
          >
            <span className="l2-listen-icon">
              {heroAudioState === "playing" ? (
                <span className="l2-listen-eq"><span /><span /><span /><span /><span /></span>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </span>
            <span className="l2-listen-text">
              {heroAudioState === "playing" ? (
                <>
                  <strong>Now playing</strong>
                  <span>{heroClipInfo?.part}</span>
                </>
              ) : (
                <>
                  <strong>Listen to a real sell call</strong>
                  <span>Hear a live broadcast from the network</span>
                </>
              )}
            </span>
          </button>
        </div>

        <div className="l2-stats">
          <Stat to={500} suffix="+" label="member yards" />
          <Stat to={12} label="regional rooms" />
          <Stat to={2} suffix="s" label="typical answer" />
          <Stat to={24} suffix="/7" label="line monitoring" />
        </div>
      </section>

      {/* ───────────────── ticker ───────────────── */}
      <div className="l2-ticker" aria-hidden="true">
        <div className="l2-ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span className="l2-tick" key={i}>
              <span className="l2-tick-time">{t[0]}</span>
              <span className="l2-tick-room">{t[1]}</span>
              <span className="l2-tick-part">{t[2]}</span>
              <span className={`l2-tick-status ${t[3].startsWith("Answered") ? "ok" : "esc"}`}>
                {t[3]}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ───────────────── video demo ───────────────── */}
      <section className="l2-section l2-video-section" id="demo">
        <div className="l2-section-head l2-center l2-reveal">
          <p className="l2-kicker">See it run</p>
          <h2>Watch a part get located.</h2>
          <p className="l2-lede">
            This is the actual hotline — a real broadcast going out, and a yard
            answering back. No demo environment, no mockups.
          </p>
        </div>
        <div className="l2-video-frame l2-reveal">
          <video
            ref={videoRef}
            src="./hotlinehq.mp4"
            controls={playing}
            preload="metadata"
            playsInline
            onEnded={() => setPlaying(false)}
          />
          {!playing && (
            <button
              className="l2-video-overlay"
              onClick={() => {
                setPlaying(true);
                videoRef.current?.play();
              }}
              aria-label="Play video"
            >
              <span className="l2-play-btn" aria-hidden="true" />
              <span className="l2-play-label">Watch the hotline in action · 1 min</span>
            </button>
          )}
        </div>
      </section>

      {/* ───────────────── problem ───────────────── */}
      <section className="l2-section l2-band">
        <div className="l2-section-head l2-reveal">
          <p className="l2-kicker">The problem</p>
          <h2>
            How long does it take you to find a part? 30&nbsp;minutes?
            An&nbsp;hour?
          </h2>
          <p className="l2-lede l2-lede-wide l2-two-sec">
            Our network average is <strong>2&nbsp;seconds.</strong>
          </p>
        </div>
        <div className="l2-compare">
          {COMPARES.map((c, i) => (
            <div
              className={`l2-compare-card l2-reveal ${c.hot ? "hot" : ""}`}
              key={c.label}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <p className="l2-compare-label">{c.label}</p>
              <div className={`l2-compare-time ${c.hot ? "good" : ""}`}>
                <span>Avg response</span>
                <strong>{c.time}</strong>
              </div>
              <p className="l2-compare-copy">{c.flaw}</p>
              {c.hot && <span className="l2-compare-badge">This is Hotline HQ</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── mid-page CTA ───────────────── */}
      <section className="l2-mid-cta-band" id="get-started">
        <div className="l2-mid-cta-inner l2-reveal">
          <h2>Ready to stop losing sales?</h2>
          <p>Join 500+ yards already on the network. Set up takes 30 seconds.</p>
          <div style={{display:'flex',gap:'14px',justifyContent:'center',marginBottom:'28px',flexWrap:'wrap'}}>
            <a className="l2-btn l2-btn-hot" href="/client/signup" style={{background:'#fff',color:'var(--red)',boxShadow:'0 8px 24px -8px rgba(0,0,0,0.2)',fontSize:'15.5px',padding:'14px 32px'}}>Sign Up Free</a>
            <a className="l2-btn l2-btn-ghost" href="/client/login" style={{border:'2px solid rgba(255,255,255,0.4)',color:'#fff',background:'transparent',fontSize:'15.5px',padding:'14px 32px'}}>Login</a>
          </div>
        </div>
      </section>

      {/* ───────────────── how it works ───────────────── */}
      <section className="l2-section" id="how">
        <div className="l2-section-head l2-center l2-reveal">
          <p className="l2-kicker">How it works</p>
          <h2>One broadcast. One answer. One sale saved.</h2>
        </div>
        <div className="l2-steps">
          {STEPS.map((s, i) => (
            <div className="l2-step l2-reveal" key={s.n} style={{ transitionDelay: `${i * 110}ms` }}>
              <span className="l2-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
            </div>
          ))}
        </div>
        <p className="l2-footnote l2-reveal">
          Unanswered? The request is logged, escalated to neighboring rooms, and
          sent to the entire network as a message — a miss in your region
          isn&rsquo;t a miss on the network.
        </p>
      </section>

      {/* ───────────────── playable demo ───────────────── */}
      <section className="l2-section l2-band" id="try">
        <div className="l2-section-head l2-center l2-reveal">
          <p className="l2-kicker">Try it yourself</p>
          <h2>Run a sell call. Watch the yards bid.</h2>
          <p className="l2-lede">
            Pick a part and put it on the air. This is exactly what your counter
            person does — minus the mouse.
          </p>
        </div>

        <div className="l2-demo l2-reveal">
          <div className="l2-demo-panel">
            <p className="l2-demo-label">Part request</p>
            <div className="l2-part-picker">
              <button
                type="button"
                aria-label="Previous part"
                onClick={() => setDemoPart((i) => (i + PARTS.length - 1) % PARTS.length)}
                disabled={demoBusy}
              >
                ‹
              </button>
              <div className="l2-part-display">
                <span className="l2-part-line">
                  {part[0]} | {part[1]} | {part[2]}
                </span>
                <span className="l2-part-name">{part[3]}</span>
              </div>
              <button
                type="button"
                aria-label="Next part"
                onClick={() => setDemoPart((i) => (i + 1) % PARTS.length)}
                disabled={demoBusy}
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className={`l2-broadcast-btn ${demoBusy ? "onair" : ""}`}
              onClick={runDemo}
              disabled={demoBusy}
            >
              {demoBusy ? (
                <>
                  <span className="l2-onair-dot" /> ON AIR…
                </>
              ) : score.deals > 0 ? (
                "Broadcast another"
              ) : (
                "Broadcast it"
              )}
            </button>

            <div className="l2-scoreboard">
              <div>
                <strong>{score.deals}</strong>
                <span>deals closed</span>
              </div>
              <div>
                <strong>${score.revenue.toLocaleString()}</strong>
                <span>revenue recovered</span>
              </div>
            </div>
            <p className="l2-demo-fine">
              Simulated replies. On the real network this takes one spoken
              sentence.
            </p>
          </div>

          <div className="l2-demo-stage">
            <div className="l2-demo-canvas" ref={demoRef} aria-hidden="true" />
            <div className="l2-stage-chip l2-demo-chip">
              <span className="l2-live-dot" /> AZ room · your yard + 8 neighbors
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── rooms ───────────────── */}
      <section className="l2-section" id="rooms">
        <div className="l2-section-head l2-reveal">
          <p className="l2-kicker">Coverage</p>
          <h2>Twelve rooms. Every major market.</h2>
          <p className="l2-lede">
            Your yard lives in its home room and is profiled into nearby regions
            — and you can switch rooms straight from the phone when the hunt
            goes wide.
          </p>
        </div>
        <div className="l2-rooms">
          {HUBS.map((h, i) => (
            <div className="l2-room l2-reveal" key={h.name} style={{ transitionDelay: `${i * 40}ms` }}>
              <span className="l2-room-code">RM-{String(i + 1).padStart(2, "0")}</span>
              <span className="l2-room-name">{h.name.charAt(0) + h.name.slice(1).toLowerCase()}</span>
              <span className="l2-room-live">● Live</span>
            </div>
          ))}
        </div>
        <div className="l2-reveal" style={{textAlign:'center',marginTop:'40px'}}>
          <a className="l2-btn l2-btn-hot" href="/client/signup">Sign Up Free — pick your room</a>
        </div>
      </section>

      {/* ───────────────── system ───────────────── */}
      <section className="l2-section l2-band" id="system">
        <div className="l2-section-head l2-center l2-reveal">
          <p className="l2-kicker">The system</p>
          <h2>Built like shop equipment, not software.</h2>
          <p className="l2-lede">
            No apps to update, no passwords on sticky notes. It's a piece of
            counter equipment that pays its membership back on one saved sale.
          </p>
        </div>
        <div className="l2-features">
          {FEATURES.map((f, i) => (
            <div className="l2-feature l2-reveal" key={f.code} style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="l2-feature-code">{f.code}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── join ───────────────── */}
      <section className="l2-join" id="join">
        <div className="l2-join-bg" ref={waveRef} aria-hidden="true" />
        <div className="l2-join-inner">
          <div className="l2-reveal">
            <p className="l2-kicker l2-kicker-light">Membership</p>
            <h2>
              One flat membership. Your whole region on the line.
            </h2>
            <ul className="l2-join-list">
              <li>Flat monthly fee per yard — no per-call charges</li>
              <li>Preconfigured desk phone or browser client included</li>
              <li>Live in your regional room the day the phone arrives</li>
              <li>Call recordings and answer-rate reporting included</li>
            </ul>
          </div>
          <div className="l2-form l2-reveal" style={{textAlign:'center'}}>
            <p className="l2-form-title">Get started in 30 seconds</p>
            <a className="l2-btn l2-btn-hot" href="/client/signup" style={{width:'100%',display:'block',textAlign:'center',marginBottom:'14px'}}>
              Sign Up Free
            </a>
            <p style={{color:'rgba(255,255,255,0.6)',fontSize:'14px',marginBottom:'14px'}}>
              Already have an account? <a href="/client/login" style={{color:'#fff',fontWeight:600,textDecoration:'underline'}}>Login</a>
            </p>
            <p className="l2-form-fine">
              No credit card required. Set up your yard in minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────── footer ───────────────── */}
      <SiteFooter />

      {/* sticky mobile CTA */}
      <a className="l2-sticky-cta" href="/client/signup">
        Sign Up Free
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles — scoped under .l2 (light B2B theme)                        */
/* ------------------------------------------------------------------ */

const CSS = `
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
  --amber: #b45309;
  --display: "Bricolage Grotesque", "Georgia", sans-serif;
  --body: "Instrument Sans", sans-serif;
  --mono: "IBM Plex Mono", monospace;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);

  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  min-height: 100vh;
  overflow-x: hidden;
}
.l2 *, .l2 *::before, .l2 *::after { box-sizing: border-box; }
.l2 a { text-decoration: none; color: inherit; }
.l2 h1, .l2 h2, .l2 h3 {
  font-family: var(--display);
  line-height: 1.04;
  margin: 0;
  letter-spacing: -0.015em;
}

/* scroll wire */
.l2-wire {
  position: fixed; left: 16px; top: 0; bottom: 0; width: 2px;
  background: var(--line); z-index: 60;
}
.l2-wire-fill {
  position: absolute; top: 0; left: 0; width: 100%; height: 0%;
  background: linear-gradient(var(--red-deep), var(--red));
}
.l2-wire-fill::after {
  content: ""; position: absolute; bottom: -11px; left: -10px;
  width: 22px; height: 22px;
  background-color: var(--bg);
  border-radius: 50%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d92d20'%3E%3Cpath d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/%3E%3C/svg%3E");
  background-size: 16px 16px;
  background-position: center;
  background-repeat: no-repeat;
  transform: rotate(90deg);
  filter: drop-shadow(0 0 6px rgba(217,45,32,0.55));
}
@media (max-width: 1100px) { .l2-wire { display: none; } }

/* nav */
.l2-nav {
  position: fixed; inset: 0 0 auto 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 32px;
  background: rgba(251,250,248,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.l2-logo { display: inline-flex; align-items: center; }
.l2-nav-links { display: flex; gap: 26px; align-items: center; font-size: 14.5px; font-weight: 500; }
.l2-nav-links a { color: var(--muted); transition: color .2s; }
.l2-nav-links a:hover { color: var(--ink); }
.l2-nav-login {
  color: var(--ink) !important;
  font-weight: 600;
  padding: 9px 16px; border-radius: 9px;
  transition: background .2s;
}
.l2-nav-login:hover { background: rgba(0,0,0,0.04); }
.l2-nav-cta {
  color: #fff !important;
  background: var(--red);
  padding: 9px 18px; border-radius: 9px;
  transition: background .2s;
}
.l2-nav-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-nav-links a:not(.l2-nav-cta):not(.l2-nav-login) { display: none; } }

/* hero */
.l2-hero {
  position: relative;
  min-height: 100vh;
  padding: 160px 32px 0;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden;
}
.l2-hero-bg { position: absolute; inset: 0; cursor: crosshair; }
.l2-hero-bg canvas { display: block; width: 100%; height: 100%; }
.l2-hero-scrim {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 62% 46% at 50% 30%, rgba(251,250,248,0.94) 36%, rgba(251,250,248,0.55) 68%, transparent 100%),
    linear-gradient(180deg, rgba(251,250,248,0.9) 0%, transparent 26%),
    linear-gradient(0deg, rgba(251,250,248,0.95) 0%, transparent 22%);
}
.l2-hero-copy { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; text-align: center; pointer-events: none; }
.l2-hero-copy a, .l2-hero-copy button { pointer-events: auto; }
.l2-eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--red); margin: 0 0 22px;
}
.l2-hero-copy h1 { font-size: clamp(42px, 6vw, 76px); font-weight: 700; }
.l2-hero-copy h1 em {
  font-style: normal; color: var(--red);
  background: linear-gradient(transparent 68%, var(--red-soft) 68%);
}
.l2-sub { max-width: 600px; margin: 24px auto 34px; color: var(--ink); font-size: 18.5px; font-weight: 600; line-height: 1.65; }
.l2-hero-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.l2-btn {
  font-family: var(--body); font-weight: 600; font-size: 15.5px;
  padding: 14px 28px; border-radius: 11px; border: 1px solid transparent;
  cursor: pointer; display: inline-block;
  transition: transform .15s, background .2s, box-shadow .2s, border-color .2s;
}
.l2-btn:active { transform: translateY(1px); }
.l2 .l2-btn-hot {
  background: var(--red); color: #fff;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
}
.l2 .l2-btn-hot:hover { background: var(--red-deep); box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.l2-btn-ghost { background: var(--surface); border-color: var(--line); color: var(--ink); }
.l2-btn-ghost:hover { border-color: #c9c4ba; }

/* hero overlay chips */
.l2-stage-chip {
  position: absolute; z-index: 3;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  background: rgba(255,255,255,0.85); backdrop-filter: blur(6px);
  border: 1px solid var(--line); border-radius: 999px;
  padding: 7px 14px;
  pointer-events: none;
}
.l2-stage-tl { top: 86px; left: 24px; }
.l2-stage-tr { top: 86px; right: 24px; color: var(--red); border-color: rgba(217,45,32,0.3); }
.l2-stage-br { bottom: 130px; right: 24px; animation: l2chip-pop .4s ease; }
@keyframes l2chip-pop { 0% { transform: scale(1.1); } 100% { transform: scale(1); } }
@media (max-width: 760px) { .l2-stage-tl, .l2-stage-tr, .l2-stage-br { display: none; } }
.l2-live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.15);
  animation: l2pulse 1.6s infinite;
}
@keyframes l2pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* hero listen button */
.l2-listen-btn {
  display: inline-flex; align-items: center; gap: 14px;
  margin-top: 28px;
  padding: 12px 24px 12px 16px;
  background: rgba(22,24,29,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px; cursor: pointer;
  pointer-events: auto;
  transition: background .2s, border-color .2s, transform .2s;
}
.l2-listen-btn:hover { background: rgba(22,24,29,0.95); border-color: rgba(217,45,32,0.5); transform: translateY(-2px); }
.l2-listen-btn:active { transform: translateY(0); }
.l2-listen-btn.on { border-color: var(--red); background: rgba(217,45,32,0.15); }
.l2-listen-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--red);
  display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(217,45,32,0.2);
  position: relative;
}
.l2-listen-btn:not(.on) .l2-listen-icon::before {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  border: 1.5px solid rgba(217,45,32,0.6);
  animation: l2-pill-ring 2.4s cubic-bezier(.2,.6,.25,1) infinite;
}
.l2-listen-text {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
}
.l2-listen-text strong { font-family: var(--body); font-size: 15px; font-weight: 700; color: #fff; }
.l2-listen-text span {
  font-family: var(--mono); font-size: 11.5px; color: rgba(255,255,255,0.55);
  letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
}

/* EQ bars inside listen button */
.l2-listen-eq {
  display: flex; align-items: flex-end; gap: 2.5px; height: 20px;
}
.l2-listen-eq span {
  width: 3px; border-radius: 1.5px; background: #fff;
  animation: l2eq 0.8s ease-in-out infinite alternate;
}
.l2-listen-eq span:nth-child(1) { height: 6px; animation-delay: 0s; }
.l2-listen-eq span:nth-child(2) { height: 14px; animation-delay: 0.15s; }
.l2-listen-eq span:nth-child(3) { height: 20px; animation-delay: 0.3s; }
.l2-listen-eq span:nth-child(4) { height: 10px; animation-delay: 0.45s; }
.l2-listen-eq span:nth-child(5) { height: 16px; animation-delay: 0.6s; }
@keyframes l2eq {
  0% { height: 4px; }
  100% { height: 20px; }
}

/* stats */
.l2-stats {
  position: relative; z-index: 2;
  display: flex; justify-content: center; gap: clamp(36px, 7vw, 96px);
  flex-wrap: wrap; padding: 44px 0 48px;
  pointer-events: none;
}
.l2-stats div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.l2-stats strong { font-family: var(--display); font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.l2-stats span { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }

/* ticker */
.l2-ticker {
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: var(--surface); overflow: hidden; padding: 13px 0;
}
.l2-ticker-track { display: inline-flex; gap: 56px; white-space: nowrap; animation: l2marquee 48s linear infinite; }
.l2-ticker:hover .l2-ticker-track { animation-play-state: paused; }
@keyframes l2marquee { to { transform: translateX(-50%); } }
.l2-tick { font-family: var(--mono); font-size: 12px; letter-spacing: 0.02em; display: inline-flex; gap: 14px; }
.l2-tick-time { color: #a3a094; }
.l2-tick-room { color: var(--red); font-weight: 600; }
.l2-tick-part { color: var(--ink); }
.l2-tick-status.ok { color: var(--amber); }
.l2-tick-status.esc { color: #a3a094; }

/* sections */
.l2-section { padding: 110px 32px; max-width: 1280px; margin: 0 auto; }
.l2-band {
  max-width: none;
  background: var(--band);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.l2-band > * { max-width: 1216px; margin-left: auto; margin-right: auto; }
.l2-kicker {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--red); margin: 0 0 16px;
}
.l2-section-head h2 { font-size: clamp(32px, 4.2vw, 54px); font-weight: 700; }
.l2-lede { color: var(--muted); max-width: 600px; font-size: 17px; line-height: 1.65; margin-top: 18px; }
.l2-lede-wide { max-width: 920px; }
.l2-two-sec { font-size: 22px; }
.l2-two-sec strong {
  font-family: var(--display); font-size: clamp(36px, 4.5vw, 56px);
  font-weight: 800; color: var(--red); display: block; margin-top: 6px;
  line-height: 1.1;
}
.l2-section-head { margin-bottom: 56px; }
.l2-center { text-align: center; }
.l2-center .l2-lede { margin-left: auto; margin-right: auto; }

/* video */
.l2-video-section { padding-top: 128px; }
.l2-video-section .l2-section-head { margin-bottom: 68px; }
.l2-video-section .l2-kicker { font-size: 13px; }
.l2-video-section .l2-section-head h2 {
  font-size: clamp(44px, 5.4vw, 76px);
  line-height: 0.98;
}
.l2-video-section .l2-lede {
  max-width: 820px;
  font-size: clamp(21px, 2.1vw, 28px);
  line-height: 1.55;
}
.l2-video-frame {
  position: relative; max-width: 1120px; margin: 0 auto;
  border-radius: 22px; overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: 0 2px 4px rgba(22,24,29,0.05), 0 36px 80px -24px rgba(22,24,29,0.34);
  background: #0e0f12;
}
.l2-video-frame video { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.l2-video-overlay {
  position: absolute; inset: 0; border: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: linear-gradient(rgba(14,15,18,0.18), rgba(14,15,18,0.5));
  transition: background .25s;
}
.l2-video-overlay:hover { background: linear-gradient(rgba(14,15,18,0.06), rgba(14,15,18,0.42)); }
.l2-play-btn {
  position: relative;
  width: 112px; height: 112px; border-radius: 50%;
  background: var(--red);
  display: block;
  box-shadow: 0 16px 46px -8px rgba(217,45,32,0.7), 0 0 0 14px rgba(255,255,255,0.14);
  transition: transform .2s;
}
.l2-play-btn::before {
  content: "";
  position: absolute;
  left: 44px; top: 34px;
  width: 0; height: 0;
  border-top: 22px solid transparent;
  border-bottom: 22px solid transparent;
  border-left: 30px solid #fff;
}
.l2-video-overlay:hover .l2-play-btn { transform: scale(1.07); }
.l2-play-label {
  font-family: var(--mono); font-size: 15px; letter-spacing: 0.1em;
  text-transform: uppercase; color: #fff;
  background: rgba(14,15,18,0.62); padding: 10px 20px; border-radius: 999px;
}

/* compare cards */
.l2-compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 18px; }
.l2-compare-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 28px 26px 34px; position: relative; box-shadow: var(--shadow);
}
.l2-compare-card.hot { border-color: rgba(217,45,32,0.35); background: linear-gradient(170deg, var(--red-soft), #fff 55%); }
.l2-compare-time {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 14px; padding-bottom: 14px;
  border-bottom: 1px dashed var(--line);
}
.l2-compare-time span {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: #a3a094;
}
.l2-compare-time strong {
  font-family: var(--display); font-size: 24px; font-weight: 700;
  color: var(--red-deep); line-height: 1;
}
.l2-compare-time.good strong { color: var(--green); font-size: 28px; }
.l2-compare-label { font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); margin: 0 0 14px; }
.l2-compare-card.hot .l2-compare-label { color: var(--red); }
.l2-compare-copy { color: var(--ink); opacity: .82; font-size: 15px; line-height: 1.6; margin: 0; }
.l2-compare-badge {
  position: absolute; top: -12px; right: 16px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: var(--red); border-radius: 999px; padding: 5px 12px;
  box-shadow: 0 6px 16px -4px rgba(217,45,32,0.5);
}

/* steps */
.l2-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }
.l2-step {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 30px 28px 34px; box-shadow: var(--shadow);
}
.l2-step-n {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--red-soft); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 22px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 20px;
}
.l2-step h3 { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
.l2-step p { color: var(--muted); font-size: 15px; line-height: 1.65; margin: 0; }
.l2-footnote {
  margin: 52px auto 0; max-width: 820px;
  font-size: 16px; font-weight: 600; color: #fff; line-height: 1.7; text-align: center;
  background: var(--red); border: 1px solid var(--red-deep); border-radius: 12px;
  padding: 18px 26px;
  box-shadow: 0 12px 32px -10px rgba(217,45,32,0.45);
}

/* playable demo */
.l2-demo {
  display: grid; grid-template-columns: 0.85fr 1.35fr; gap: 26px; align-items: stretch;
}
@media (max-width: 900px) { .l2-demo { grid-template-columns: 1fr; } }
.l2-demo-panel {
  background: var(--surface); border: 1px solid var(--line); border-radius: 18px;
  padding: 30px 28px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 18px;
}
.l2-demo-label {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--muted); margin: 0;
}
.l2-part-picker {
  display: flex; align-items: stretch; gap: 10px;
}
.l2-part-picker > button {
  width: 46px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--bg); color: var(--ink); font-size: 24px; cursor: pointer;
  transition: border-color .2s, background .2s;
}
.l2-part-picker > button:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.l2-part-picker > button:disabled { opacity: 0.4; cursor: default; }
.l2-part-display {
  flex: 1; border: 1px solid var(--line); border-radius: 12px; background: var(--bg);
  padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; min-width: 0;
}
.l2-part-line { font-family: var(--mono); font-size: 13px; color: var(--muted); letter-spacing: 0.02em; }
.l2-part-name { font-family: var(--display); font-weight: 700; font-size: 22px; color: var(--red); }
.l2-broadcast-btn {
  font-family: var(--body); font-weight: 700; font-size: 17px; letter-spacing: 0.01em;
  text-transform: uppercase;
  padding: 18px; border: 0; border-radius: 13px; cursor: pointer;
  background: var(--red); color: #fff;
  box-shadow: 0 10px 30px -8px rgba(217,45,32,0.55);
  transition: background .2s, transform .15s;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
}
.l2-broadcast-btn:hover:not(:disabled) { background: var(--red-deep); }
.l2-broadcast-btn:active:not(:disabled) { transform: translateY(1px); }
.l2-broadcast-btn.onair { background: #16181d; cursor: default; }
.l2-onair-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #f04438;
  animation: l2pulse 0.9s infinite;
}
.l2-scoreboard {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.l2-scoreboard div {
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 2px;
}
.l2-scoreboard strong {
  font-family: var(--display); font-size: 30px; font-weight: 700;
  color: var(--green); font-variant-numeric: tabular-nums;
}
.l2-scoreboard span {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted);
}
.l2-demo-fine { font-size: 12.5px; color: var(--muted); margin: 0; }
.l2-demo-stage {
  position: relative; min-height: 460px;
  border: 1px solid var(--line); border-radius: 18px; overflow: hidden;
  background:
    radial-gradient(ellipse 70% 60% at 50% 45%, #ffffff 0%, transparent 75%),
    linear-gradient(#fdfcfb, #f3f1ec);
  box-shadow: var(--shadow);
}
.l2-demo-canvas { position: absolute; inset: 0; }
.l2-demo-canvas canvas { display: block; width: 100%; height: 100%; }
.l2-demo-chip { top: 14px; left: 14px; }
@media (max-width: 760px) { .l2-demo-chip { display: inline-flex; } }

/* rooms */
.l2-rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.l2-room {
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  padding: 18px; display: flex; flex-direction: column; gap: 8px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.l2-room:hover { border-color: rgba(217,45,32,0.4); transform: translateY(-2px); box-shadow: var(--shadow); }
.l2-room-code { font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; color: #a3a094; }
.l2-room-name { font-family: var(--display); font-weight: 700; font-size: 19px; }
.l2-room-live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--red); }

/* features */
.l2-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
@media (max-width: 1000px) { .l2-features { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .l2-features { grid-template-columns: 1fr; } }
.l2-feature {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 28px 26px 32px; box-shadow: var(--shadow);
  transition: transform .2s, border-color .2s;
}
.l2-feature:hover { transform: translateY(-3px); border-color: rgba(217,45,32,0.3); }
.l2-feature-code {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--red-soft); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 22px;
  display: flex; align-items: center; justify-content: center;
}
.l2-feature h3 { font-size: 20px; font-weight: 700; margin: 18px 0 9px; }
.l2-feature p { color: var(--muted); font-size: 14.5px; line-height: 1.62; margin: 0; }

/* own the hotline */
.l2-own { max-width: 860px; }
.l2-own-list { list-style: none; padding: 0; margin: 26px 0 30px; display: flex; flex-direction: column; gap: 12px; }
.l2-own-list li { color: var(--muted); font-size: 15.5px; line-height: 1.6; padding-left: 26px; position: relative; }
.l2-own-list li::before { content: "▸"; position: absolute; left: 0; color: var(--red); }

/* join */
.l2-join { background: #16181d; color: #f4f2ee; position: relative; overflow: hidden; }
.l2-join-bg { position: absolute; inset: 0; opacity: 0.8; }
.l2-join-bg canvas { display: block; width: 100%; height: 100%; }
.l2-join-inner {
  position: relative; z-index: 1;
  max-width: 1280px; margin: 0 auto; padding: 110px 32px;
  display: grid; grid-template-columns: 1.15fr 1fr; gap: 72px; align-items: start;
}
@media (max-width: 900px) { .l2-join-inner { grid-template-columns: 1fr; } }
.l2-join h2 { font-size: clamp(32px, 4vw, 52px); font-weight: 700; color: #fff; }
.l2-kicker-light { color: #ff6f61; }
.l2-join-list { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-direction: column; gap: 14px; }
.l2-join-list li { color: #b9bcc4; font-size: 16px; padding-left: 28px; position: relative; line-height: 1.55; }
.l2-join-list li::before {
  content: "✓"; position: absolute; left: 0; color: #ff6f61; font-weight: 700;
}
.l2-form { background: #fff; color: var(--ink); border-radius: 18px; padding: 36px 32px 30px; box-shadow: 0 30px 80px -20px rgba(0,0,0,0.5); position: relative; }
.l2-form-title { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 24px; }
.l2-form label { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; font-size: 13px; font-weight: 600; color: var(--muted); }
.l2-form input {
  background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--ink);
  font-family: var(--body); font-size: 15px; padding: 12px 14px; outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.l2-form input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(217,45,32,0.12); }
.l2-form input::placeholder { color: #b3afa6; }
.l2-form .l2-btn { width: 100%; margin-top: 6px; }
.l2-form-fine { font-size: 12.5px; color: var(--muted); text-align: center; margin: 14px 0 0; }
.l2-form-done { font-size: 15px; color: var(--ink); line-height: 1.7; margin: 0; }

/* confetti */
.l2-confetti {
  position: absolute; top: 50%; left: 50%;
  width: 8px; height: 12px; border-radius: 2px; pointer-events: none; z-index: 5;
  animation: l2confetti 1.15s ease-out forwards;
}
@keyframes l2confetti {
  0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); }
}

/* mid-page CTA band */
.l2-mid-cta-band {
  background: var(--red);
  padding: 80px 32px;
  text-align: center;
}
.l2-mid-cta-inner {
  max-width: 820px; margin: 0 auto;
}
.l2-mid-cta-band h2 {
  font-family: var(--display); font-weight: 700;
  font-size: clamp(30px, 4vw, 48px); color: #fff;
  line-height: 1.08; margin: 0 0 14px;
}
.l2-mid-cta-band > .l2-reveal > p { color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.6; margin: 0 0 36px; }
/* sticky mobile CTA */
.l2-sticky-cta {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 55;
  background: var(--red); color: #fff;
  font-family: var(--body); font-weight: 700; font-size: 16px; letter-spacing: 0.02em;
  text-transform: uppercase; text-align: center;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 20px rgba(217,45,32,0.35);
  transition: background .2s;
}
.l2-sticky-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-sticky-cta { display: block; } }

/* ── mobile responsive ── */
@media (max-width: 640px) {
  .l2-nav { padding: 10px 16px; }
  .l2-nav-links { gap: 8px; }
  .l2-nav-login { padding: 8px 10px; font-size: 13px; }
  .l2-nav-cta { padding: 8px 14px; font-size: 13px; }
  .l2-hero { padding: 120px 16px 0; min-height: auto; }
  .l2-hero-bg { display: none; }
  .l2-hero-scrim { display: none; }
  .l2-hero-copy { padding: 0; }
  .l2-hero-copy h1 { font-size: clamp(26px, 7vw, 38px); }
  .l2-eyebrow { font-size: 10px; letter-spacing: 0.1em; }
  .l2-sub { font-size: 14.5px; margin: 14px auto 22px; }
  .l2-hero-ctas { flex-direction: column; align-items: stretch; gap: 10px; }
  .l2-hero-ctas .l2-btn { text-align: center; padding: 14px 20px; }
  .l2-stage-chip { display: none !important; }
  .l2-listen-btn { font-size: 12px; padding: 9px 16px; }
  .l2-stats { flex-direction: row; flex-wrap: wrap; gap: 12px; padding: 20px 16px; justify-content: center; }
  .l2-stats div { min-width: 100px; }
  .l2-stats strong { font-size: 26px; }
  .l2-stats span { font-size: 9px; }
  .l2-section { padding: 48px 16px; }
  .l2-section-head { margin-bottom: 28px; }
  .l2-section-head h2 { font-size: clamp(22px, 6vw, 30px); }
  .l2-lede { font-size: 14.5px; }
  .l2-rooms { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .l2-room { padding: 14px; }
  .l2-room-name { font-size: 15px; }
  .l2-steps { gap: 12px; }
  .l2-step { padding: 18px 14px; }
  .l2-step h3 { font-size: 15px; }
  .l2-step p { font-size: 13.5px; }
  .l2-demo { gap: 14px; }
  .l2-feature { padding: 18px 14px; }
  .l2-feature h3 { font-size: 15px; }
  .l2-feature p { font-size: 13.5px; }
  .l2-mid-cta-band { padding: 40px 16px; }
  .l2-mid-cta-inner h2 { font-size: clamp(22px, 6vw, 32px); }
  .l2-mid-cta-inner p { font-size: 14px; }
  .l2-video-overlay { gap: 0; justify-content: center; align-items: center; }
  .l2-play-btn { width: 64px; height: 64px; box-shadow: 0 8px 24px -6px rgba(217,45,32,0.5), 0 0 0 7px rgba(255,255,255,0.14); }
  .l2-play-btn::before {
    left: 26px; top: 20px;
    border-top-width: 12px;
    border-bottom-width: 12px;
    border-left-width: 17px;
  }
  .l2-play-label { position: absolute; bottom: 18px; left: 0; right: 0; font-size: 11px; letter-spacing: 0.08em; }
  .l2-join-inner { padding: 40px 16px; }
  .l2-join-inner h2 { font-size: clamp(22px, 6vw, 32px); }
  .l2-join-list { font-size: 13.5px; padding-left: 18px; }
  .l2-join-list li { margin-bottom: 6px; }
  .l2-form { padding: 20px 16px; }
  .l2-own { padding: 28px 16px; }
  .l2-tick { overflow: hidden; }
  .l2-compare-cards { gap: 12px; }
  .l2-compare-card { padding: 18px 14px; }
}
@media (max-width: 400px) {
  .l2-nav-login { padding: 6px 8px; font-size: 12px; }
  .l2-nav-cta { padding: 6px 10px; font-size: 12px; }
  .l2-rooms { grid-template-columns: 1fr; }
  .l2-hero-copy h1 { font-size: 24px; }
}
@media (max-width: 320px) {
  .l2-hero { padding: 100px 12px 0; }
  .l2-hero-copy h1 { font-size: 21px; }
  .l2-eyebrow { font-size: 9px; letter-spacing: 0.08em; }
  .l2-sub { font-size: 13px; margin: 10px auto 18px; }
  .l2-hero-ctas .l2-btn { font-size: 14px; padding: 12px 16px; }
  .l2-listen-btn { padding: 8px 12px; gap: 10px; }
  .l2-listen-icon { width: 36px; height: 36px; }
  .l2-listen-icon svg { width: 16px; height: 16px; }
  .l2-listen-text strong { font-size: 13px; }
  .l2-listen-text span { font-size: 10px; max-width: 160px; }
  .l2-stats strong { font-size: 22px; }
  .l2-stats div { min-width: 80px; }
  .l2-section { padding: 36px 12px; }
  .l2-section-head h2 { font-size: 20px; }
  .l2-lede { font-size: 13px; }
  .l2-step { padding: 14px 12px; }
  .l2-step-n { width: 36px; height: 36px; font-size: 18px; }
  .l2-step h3 { font-size: 14px; }
  .l2-step p { font-size: 12.5px; }
  .l2-compare-card { padding: 14px 12px; }
  .l2-compare-label { font-size: 11px; }
  .l2-compare-time strong { font-size: 20px; }
  .l2-compare-copy { font-size: 13px; }
  .l2-feature { padding: 14px 12px; }
  .l2-feature h3 { font-size: 14px; }
  .l2-feature p { font-size: 12.5px; }
  .l2-mid-cta-band { padding: 32px 12px; }
  .l2-mid-cta-inner h2 { font-size: 20px; }
  .l2-join-inner { padding: 32px 12px; }
  .l2-join-inner h2 { font-size: 20px; }
  .l2-form { padding: 16px 12px; }
  .l2-form-title { font-size: 20px; }
  .l2-nav { padding: 8px 10px; }
  .l2-nav-links { gap: 6px; }
  .l2-nav-login { padding: 6px 6px; font-size: 11px; }
  .l2-nav-cta { padding: 6px 8px; font-size: 11px; }
  .l2-sticky-cta { font-size: 14px; padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px)); }
}

/* reveal */
.l2-reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
.l2-reveal.l2-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .l2-reveal { opacity: 1; transform: none; transition: none; }
  .l2-ticker-track { animation: none; }
}
`;
