import Image from "next/image";
import Link from "next/link";
import { release } from "@/config/release";

// /download — the public page for installing the Android app. Static (no data
// fetching); the APK itself is on a GitHub release (src/config/release.js).

const megabytes = Math.round(release.sizeBytes / (1024 * 1024));
const releasedOn = new Date(`${release.releasedOn}T00:00:00Z`).toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fingerprint = release.certificateSha256.toUpperCase().match(/.{2}/g).join(":");

export const metadata = {
  title: "Download Planner Flow for Android",
  description: "A calm planner for your week, habits, notes, money, books and a private journal. Free, no ads, works offline.",
  openGraph: {
    title: "Planner Flow for Android",
    description: "Plan your week, keep your habits and write what you learn. Free, no ads, works offline.",
    images: ["/app-icon.png"],
  },
};

export default function DownloadPage() {
  return (
    <div className="flex-1 bg-[#FAF8F3] text-[#1F1D1A] dark:bg-[#141311] dark:text-[#ECE8E1]">
      <Header />
      <main>
        <Hero />
        <Trust />
        <Features />
        <WhatsNew />
        <Install />
        <Verify />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/download" className="flex items-center gap-2.5">
        <Image src="/app-icon.png" alt="" width={34} height={34} className="rounded-[10px]" />
        <span className="font-serif text-lg font-bold">Planner Flow</span>
      </Link>
      <a
        href={release.downloadUrl}
        className="rounded-full border border-[#2F5D50]/30 px-4 py-2 text-sm font-semibold text-[#2F5D50] transition hover:bg-[#2F5D50] hover:text-white dark:border-[#7FB8A4]/40 dark:text-[#9FD4C2] dark:hover:bg-[#2F5D50] dark:hover:text-white"
      >
        Download
      </a>
    </header>
  );
}

function DownloadButton({ large = false }) {
  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <a
        href={release.downloadUrl}
        className={`group inline-flex items-center gap-3 rounded-2xl bg-[#2F5D50] font-semibold text-white shadow-lg shadow-[#2F5D50]/25 transition hover:-translate-y-0.5 hover:bg-[#264C41] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F5D50] ${
          large ? "px-8 py-5 text-lg" : "px-7 py-4 text-base"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 transition group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" />
        </svg>
        Download for Android
      </a>
      <p className="text-sm text-[#6B675F] dark:text-[#A19B90]">
        Version {release.version} · {megabytes} MB · {release.minAndroid}
      </p>
    </div>
  );
}

function Hero() {
  const badges = ["Free, no ads", "No trackers", "Works offline", "Signed release"];
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] h-130 w-130 rounded-full bg-[#2F5D50]/15 blur-3xl dark:bg-[#2F5D50]/25" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[-30%] left-[-10%] h-105 w-105 rounded-full bg-[#23395B]/10 blur-3xl dark:bg-[#23395B]/30" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#2F5D50]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#2F5D50] dark:bg-[#2F5D50]/30 dark:text-[#9FD4C2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D50] dark:bg-[#9FD4C2]" /> For Android
          </span>
          <h1 className="font-serif text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
            Plan calmly.
            <br />
            Keep your streaks.
            <br />
            <span className="text-[#2F5D50] dark:text-[#9FD4C2]">Write what you learn.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">
            Planner Flow brings your week, your habits, your notes and a private journal together in one quiet place. It feels
            like a well-loved paper diary, and it works even when you’re offline.
          </p>
          <DownloadButton large />
          <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {badges.map((badge) => (
              <li
                key={badge}
                className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/70 px-3 py-1.5 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <Check /> {badge}
              </li>
            ))}
          </ul>
        </div>
        <PhonePreview />
      </div>
    </section>
  );
}

function Check({ className = "text-[#2F5D50] dark:text-[#9FD4C2]" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

// A drawn phone showing the Week page: habits marked like the paper diary,
// | for done and a zigzag for missed.
function PhonePreview() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const habits = [
    { name: "Read 20 pages", marks: "||~||||" },
    { name: "Morning walk", marks: "|||~|| " },
    { name: "No phone at dinner", marks: "|~||~| " },
  ];
  return (
    <div className="relative mx-auto w-full max-w-82.5" aria-hidden="true">
      <div className="absolute inset-6 rotate-6 rounded-[44px] bg-[#23395B]/15 dark:bg-[#23395B]/40" />
      <div className="relative rounded-[44px] border-10 border-[#1F1D1A] bg-[#FAF8F3] p-5 shadow-2xl shadow-black/25 dark:border-[#2A2824] dark:bg-[#1C1B19]">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-black/15 dark:bg-white/15" />
        <p className="text-xs text-[#6B675F] dark:text-[#A19B90]">Good morning</p>
        <p className="font-serif text-xl font-bold">This week</p>
        <div className="mt-3 rounded-2xl bg-[#2F5D50] p-4 text-white">
          <p className="text-[10px] font-bold tracking-[0.14em] opacity-80">THIS WEEK</p>
          <p className="text-3xl font-extrabold">82%</p>
          <p className="text-xs opacity-90">Great pace. Keep it up!</p>
          <div className="mt-2 h-1.5 rounded-full bg-white/25">
            <div className="h-1.5 w-4/5 rounded-full bg-white" />
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#232220]">
          <div className="mb-1 grid grid-cols-[1fr_repeat(7,18px)] gap-1 text-center text-[10px] text-[#6B675F] dark:text-[#A19B90]">
            <span />
            {days.map((day, index) => (
              <span key={index}>{day}</span>
            ))}
          </div>
          {habits.map((habit) => (
            <div key={habit.name} className="grid grid-cols-[1fr_repeat(7,18px)] items-center gap-1 py-1">
              <span className="truncate text-xs font-semibold">{habit.name}</span>
              {[...habit.marks].map((mark, index) => (
                <Mark key={index} kind={mark} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#232220]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2F5D50]/12 text-[#2F5D50] dark:text-[#9FD4C2]">⏰</span>
          <div>
            <p className="text-xs font-semibold">Call mum</p>
            <p className="text-[10px] text-[#6B675F] dark:text-[#A19B90]">Today · 7:30 pm · Chime</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mark({ kind }) {
  if (kind === " ") return <span className="h-5" />;
  return (
    <svg viewBox="0 0 18 22" className="h-5 w-4.5">
      {kind === "|" ? (
        <line x1="9" y1="3" x2="9" y2="19" stroke="#23395B" strokeWidth="2.6" strokeLinecap="round" className="dark:stroke-[#A9C3EA]" />
      ) : (
        <polyline points="6,3 12,6 6,9 12,12 6,15 12,19" fill="none" stroke="#B4483A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Section({ id, kicker, title, children, className = "" }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-16 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F5D50] dark:text-[#9FD4C2]">{kicker}</p>
      <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Trust() {
  const items = [
    {
      icon: "🔏",
      title: "Signed by the developer",
      text: "Every version is signed with the same private key. Android checks it, so an update can only come from the same source.",
    },
    {
      icon: "🔐",
      title: "Your journal is encrypted",
      text: "Journal entries are encrypted on the server. Nobody else, not even the admin, can read them.",
    },
    {
      icon: "🏡",
      title: "Your data stays yours",
      text: "Everything lives on your phone first. Export it to Excel or JSON any time, or delete your account and it's all gone.",
    },
    {
      icon: "🌿",
      title: "No ads. No trackers.",
      text: "No advertising, no analytics companies, nothing sold. The app talks only to its own server.",
    },
  ];
  return (
    <div className="border-y border-black/5 bg-white/60 dark:border-white/5 dark:bg-white/3">
      <Section id="trust" kicker="Why you can trust it" title="Built to be safe and private">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.title} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1C1B19]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F5D50]/10 text-2xl" aria-hidden="true">
                {item.icon}
              </span>
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">{item.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Features() {
  const features = [
    { icon: "🗓️", title: "Your week", text: "Weekly tasks that carry over, and daily habits marked like a paper diary: a stroke for done, a zigzag for missed." },
    { icon: "📈", title: "Dashboard", text: "See how your weeks are going, which habits are strong, and which could use a smaller step." },
    { icon: "⏰", title: "Notes that ring", text: "Reminders that ring like a real alarm, with your choice of tone, even when the app is closed." },
    { icon: "✍️", title: "A private journal", text: "Write what you learn with headings, lists and bold, in a calm full-screen space. Drafts are never lost." },
    { icon: "💸", title: "Money notes", text: "Remember who owes whom and settle up with a tap." },
    { icon: "📚", title: "Books", text: "Track what you read, set a yearly goal and import your old reading spreadsheet." },
  ];
  return (
    <Section id="features" kicker="What's inside" title="Everything for a calmer week">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="flex gap-4 rounded-3xl p-5 transition hover:bg-white hover:shadow-sm dark:hover:bg-white/5">
            <span className="text-3xl" aria-hidden="true">
              {feature.icon}
            </span>
            <div>
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">{feature.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function WhatsNew() {
  return (
    <Section id="whats-new" kicker={`Version ${release.version} · ${releasedOn}`} title="What's new">
      <ul className="grid gap-3 sm:grid-cols-2">
        {release.whatsNew.map((item) => (
          <li key={item} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1C1B19]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2F5D50] text-white">
              <Check className="text-white" />
            </span>
            <span className="text-[15px] leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Install() {
  const steps = [
    {
      title: "Download the app",
      text: `Tap the download button. The file (${megabytes} MB) is saved to your phone's Downloads.`,
    },
    {
      title: "Allow the install",
      text: "Open the file. Android asks once whether your browser may install apps: tap Settings, switch on “Allow from this source”, then go back. This is normal for apps from outside the Play Store.",
    },
    {
      title: "Open and sign up",
      text: "Tap Install, then Open. Create your account with your email, and your planner is ready.",
    },
  ];
  return (
    <div className="border-y border-black/5 bg-white/60 dark:border-white/5 dark:bg-white/3">
      <Section id="install" kicker="Installing" title="Ready in three steps">
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1C1B19]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2F5D50] font-serif text-lg font-bold text-white">{index + 1}</span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-[#2F5D50]/10 p-4 text-[15px] leading-relaxed dark:bg-[#2F5D50]/25">
          <span aria-hidden="true">💡</span>
          <span>
            <strong>Updating?</strong> Install the new version right over the old one. Your habits, notes and journal stay exactly
            where they are.
          </span>
        </p>
      </Section>
    </div>
  );
}

function Verify() {
  return (
    <Section id="verify" kicker="For the careful" title="Check your download">
      <p className="max-w-3xl text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">
        You don’t have to, but you can confirm the file you downloaded is exactly the one published here, untouched.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Fact label="File (SHA-256)" value={release.sha256} hint={`Windows: certutil -hashfile ${release.fileName} SHA256`} />
        <Fact label="Signing certificate (SHA-256)" value={fingerprint} hint="The same for every version of the app. Android Studio: apksigner verify --print-certs" />
      </div>
      <p className="mt-4 text-sm text-[#6B675F] dark:text-[#A19B90]">
        Also listed on the{" "}
        <a href={release.releasePage} className="font-semibold text-[#2F5D50] underline-offset-4 hover:underline dark:text-[#9FD4C2]">
          GitHub release
        </a>
        .
      </p>
    </Section>
  );
}

function Fact({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1C1B19]">
      <p className="text-sm font-bold">{label}</p>
      <code className="mt-2 block select-all break-all rounded-xl bg-[#FAF8F3] p-3 font-mono text-[13px] leading-relaxed dark:bg-[#141311]">{value}</code>
      <p className="mt-2 font-mono text-xs text-[#6B675F] dark:text-[#A19B90]">{hint}</p>
    </div>
  );
}

function Faq() {
  const questions = [
    {
      q: "Why isn't it on the Play Store?",
      a: "Planner Flow is an independent app, shared directly. Installing it this way is safe: the app is signed, and you can check the file above.",
    },
    {
      q: "Android warns about unknown apps. Is that okay?",
      a: "Yes. Android shows that message for every app installed from outside the Play Store. You only allow your browser to install this file; you can switch it off again afterwards.",
    },
    {
      q: "How do I get updates?",
      a: "Come back to this page and download the new version. It installs over the old one and keeps all your data.",
    },
    {
      q: "What does the app know about me?",
      a: "Your name, email and what you add to it, kept so it syncs between your devices. Your journal is encrypted, and you can export or delete everything from Settings.",
    },
    {
      q: "Does it work without internet?",
      a: "Yes. Everything is saved on your phone first and syncs when you're back online.",
    },
  ];
  return (
    <div className="border-t border-black/5 bg-white/60 dark:border-white/5 dark:bg-white/3">
      <Section id="faq" kicker="Questions" title="Good to know">
        <div className="mx-auto max-w-3xl divide-y divide-black/5 dark:divide-white/10">
          {questions.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {q}
                <span className="text-2xl leading-none text-[#2F5D50] transition group-open:rotate-45 dark:text-[#9FD4C2]" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4A4740] dark:text-[#C9C3B8]">{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}

function FinalCta() {
  return (
    <section className="px-5 py-20">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-[36px] bg-[#2F5D50] px-6 py-14 text-center text-white shadow-xl shadow-[#2F5D50]/25">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <Image src="/app-icon.png" alt="" width={72} height={72} className="relative rounded-[20px] shadow-lg" />
        <h2 className="relative font-serif text-3xl font-bold sm:text-4xl">Start your calmer week today</h2>
        <p className="relative max-w-xl text-white/85">Free, private and made with care. It takes about a minute to set up.</p>
        <a
          href={release.downloadUrl}
          className="relative inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-[#2F5D50] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          Download for Android
        </a>
        <p className="relative text-sm text-white/75">
          Version {release.version} · {megabytes} MB · {release.minAndroid}
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 pb-10 text-sm text-[#6B675F] sm:flex-row dark:text-[#A19B90]">
      <p>© {release.releasedOn.slice(0, 4)} Planner Flow · Made with care</p>
      <nav className="flex gap-5">
        <a href="#verify" className="hover:text-[#2F5D50] dark:hover:text-[#9FD4C2]">
          Verify download
        </a>
        <a href="#faq" className="hover:text-[#2F5D50] dark:hover:text-[#9FD4C2]">
          FAQ
        </a>
      </nav>
    </footer>
  );
}
