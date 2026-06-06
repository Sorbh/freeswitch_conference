import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Menu,
  Phone,
  Play,
  Radio,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

const metrics = [
  { value: "500+", label: "yards on the network" },
  { value: "12", label: "regional rooms" },
  { value: "<10s", label: "typical reply speed" },
];

const steps = [
  {
    number: "01",
    title: "A member needs a part",
    copy: "They have a customer waiting, but do not have the part in stock.",
  },
  {
    number: "02",
    title: "They broadcast once",
    copy: "The request goes to the hotline room for their area.",
  },
  {
    number: "03",
    title: "Other yards reply",
    copy: "A yard with the part answers back and the deal stays alive.",
  },
];

const reasons = [
  "Own the hotline for your area",
  "Give members a simple way to help each other",
  "Build a network people use every day",
  "Create recurring revenue from membership",
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef(null);
  const [formData, setFormData] = useState({
    company: "",
    name: "",
    email: "",
    useCase: "Auto Dismantlers",
  });

  const handleFormSubmit = (event) => {
    event.preventDefault();
    setFormSubmitted(true);
    toast.success("Demo request submitted. We will reach out within 24 hours.");
  };

  const handlePlayVideo = () => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.play();
    setIsVideoPlaying(true);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f2937]">
      <header className="sticky top-0 z-50 border-b border-black/8 bg-[#f7f4ee]/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f2937] text-white">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-[-0.02em] text-[#111827]">
                HotlineHQ
              </div>
              <div className="text-xs text-[#6b7280]">Own the hotline in your market</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#6b7280] md:flex">
            <a href="#how-it-works" className="hover:text-[#111827]">
              How it works
            </a>
            <a href="#why-own" className="hover:text-[#111827]">
              Why owners buy
            </a>
            <a href="#demo" className="hover:text-[#111827]">
              Demo
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/dashboard"
              className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-white"
            >
              Console
            </Link>
            <a
              href="#demo"
              className="rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#000]"
            >
              Request demo
            </a>
          </div>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="p-2 text-[#6b7280] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="border-b border-black/8 bg-[#f7f4ee] px-6 py-5 md:hidden">
          <div className="flex flex-col gap-4 text-sm text-[#4b5563]">
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
              How it works
            </a>
            <a href="#why-own" onClick={() => setMobileMenuOpen(false)}>
              Why owners buy
            </a>
            <a href="#demo" onClick={() => setMobileMenuOpen(false)}>
              Demo
            </a>
          </div>
        </div>
      ) : null}

      <main>
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mx-auto mb-10 max-w-6xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#6b7280]">
              <Radio className="h-4 w-4" />
              Built for local hotline owners
            </div>

            <h1 className="text-5xl font-semibold leading-[1] tracking-[-0.05em] text-[#111827] md:text-7xl">
              Run the hotline
              <br />
              your market depends on.
            </h1>

            <p className="mx-auto mt-6 max-w-4xl text-xl leading-8 text-[#4b5563]">
              Build a simple voice network for businesses in your area. Members
              broadcast what they need, other members reply, and more deals get done.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Request demo
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-6 py-3.5 text-sm font-medium text-[#374151] transition hover:bg-[#fafafa]"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,#fffefb_0%,#f3ede4_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.08)] md:p-6">
            <div className="absolute left-8 top-8 hidden h-24 w-24 rounded-full bg-[#dbeafe] blur-3xl md:block" />
            <div className="absolute bottom-8 right-8 hidden h-28 w-28 rounded-full bg-[#fde68a] blur-3xl md:block" />

            <div className="relative rounded-[28px] border border-black/10 bg-white p-3 md:p-4">
              <div className="mb-3 flex items-center justify-between px-2 md:px-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                    Watch the product
                  </div>
                  <div className="mt-1 text-sm text-[#4b5563]">
                    See how the hotline works in under a minute
                  </div>
                </div>
                <div className="hidden rounded-full border border-black/8 bg-[#faf8f4] px-3 py-1 text-xs font-medium text-[#4b5563] md:block">
                  Local network example
                </div>
              </div>

              <div className="relative">
                {!isVideoPlaying ? (
                  <button
                    type="button"
                    onClick={handlePlayVideo}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-black/16 transition hover:bg-black/22"
                    aria-label="Play video"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
                        <Play className="ml-1 h-10 w-10 fill-current" />
                      </div>
                      <div className="rounded-full bg-white/92 px-4 py-2 text-sm font-medium text-[#111827] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                        Play video
                      </div>
                    </div>
                  </button>
                ) : null}
                <video
                  ref={videoRef}
                  src="/out/hotlinehq.mp4"
                  className="aspect-video w-full rounded-[22px] bg-black object-cover"
                  controls
                  loop
                  playsInline
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-black/8 bg-white px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
              >
                <div className="text-4xl font-semibold tracking-[-0.05em] text-[#111827]">
                  {metric.value}
                </div>
                <div className="mt-2 text-base text-[#4b5563]">{metric.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-black/8 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="max-w-2xl">
              <div className="text-sm font-medium text-[#6b7280]">How it works</div>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#111827] md:text-5xl">
                Simple for members.
                <br />
                Good for owners.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-black/8 bg-[#faf8f4] p-6"
                >
                  <div className="text-sm font-medium text-[#9ca3af]">Step {step.number}</div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#111827]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-lg leading-8 text-[#4b5563]">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why-own" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="text-sm font-medium text-[#6b7280]">Why owners buy</div>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#111827] md:text-5xl">
                Build a network
                <br />
                people keep using.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#4b5563]">
                When the hotline helps members save deals and find inventory, it
                becomes part of how they do business.
              </p>
            </div>

            <div className="grid gap-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-start gap-3 rounded-2xl border border-black/8 bg-white px-5 py-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#111827]" />
                  <span className="text-lg leading-8 text-[#374151]">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="border-t border-black/8 bg-white">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <div className="rounded-3xl border border-black/8 bg-[#faf8f4] p-8 md:p-10">
              <div className="max-w-2xl">
                <div className="text-sm font-medium text-[#6b7280]">Request a demo</div>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#111827]">
                  See how to run the hotline in your area.
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#4b5563]">
                  We will walk you through the product, the member flow, and how
                  this can work in your market.
                </p>
              </div>

              <div className="mt-8">
                {formSubmitted ? (
                  <div className="rounded-2xl border border-black/8 bg-white p-8 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#111827] text-white">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-[#111827]">Request received</h3>
                    <p className="mt-3 text-lg leading-8 text-[#4b5563]">
                      We will reach out within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        type="text"
                        required
                        placeholder="Company"
                        value={formData.company}
                        onChange={(event) =>
                          setFormData({ ...formData, company: event.target.value })
                        }
                        className="rounded-xl border border-black/10 bg-white px-4 py-4 text-base outline-none placeholder:text-[#9ca3af]"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Name"
                        value={formData.name}
                        onChange={(event) =>
                          setFormData({ ...formData, name: event.target.value })
                        }
                        className="rounded-xl border border-black/10 bg-white px-4 py-4 text-base outline-none placeholder:text-[#9ca3af]"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        type="email"
                        required
                        placeholder="Work email"
                        value={formData.email}
                        onChange={(event) =>
                          setFormData({ ...formData, email: event.target.value })
                        }
                        className="rounded-xl border border-black/10 bg-white px-4 py-4 text-base outline-none placeholder:text-[#9ca3af]"
                      />
                      <select
                        value={formData.useCase}
                        onChange={(event) =>
                          setFormData({ ...formData, useCase: event.target.value })
                        }
                        className="rounded-xl border border-black/10 bg-white px-4 py-4 text-base outline-none"
                      >
                        <option>Auto Dismantlers</option>
                        <option>Regional Trading Networks</option>
                        <option>Wholesale Supply</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-6 py-4 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Request demo
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/8 bg-[#f7f4ee] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
              <Users className="h-4 w-4" />
            </div>
            <div className="text-sm font-medium text-[#374151]">HotlineHQ</div>
          </div>
          <div className="text-sm text-[#6b7280]">
            &copy; {new Date().getFullYear()} HotlineHQ. All rights reserved.
          </div>
          <Link to="/dashboard" className="text-sm font-medium text-[#374151]">
            Admin Console
          </Link>
        </div>
      </footer>
    </div>
  );
}
