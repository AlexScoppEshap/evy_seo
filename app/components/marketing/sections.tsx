import Image from "next/image";
import styles from "./sections.module.css";
import {
  APP_URL,
  marketingPath,
  STORE_URLS,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { conversionAttributes } from "@/lib/marketing-analytics";
export function Phone({
  screen = "discover",
  d,
  priority = false,
}: {
  screen?: "discover" | "search" | "event-detail";
  d: Dictionary;
  priority?: boolean;
}) {
  return (
    <figure className={`phone-composition phone-${screen}`}>
      <Image
        src={`/marketing/screens/${screen === "discover" ? "webscreen1" : screen === "search" ? "webscreen2" : screen}.webp`}
        width={720}
        height={
          screen === "discover" ? 1512 : screen === "search" ? 1506 : 1466
        }
        alt={`${screen === "discover" ? d.features[0] : screen === "search" ? d.featureCopy[0] : d.event} — Evy`}
        priority={priority}
        sizes="(max-width: 600px) 260px, (max-width: 1000px) 310px, 360px"
      />
      <figcaption>{d.appCaption}</figcaption>
    </figure>
  );
}
export function Hero({ locale, d }: { locale: Locale; d: Dictionary }) {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="tiny-star" aria-hidden="true">
            ✦
          </span>{" "}
          {d.eyebrow}
        </p>
        <h1>
          <span>{d.hero[0]}</span>
          <span>{d.hero[1]}</span>
          <span className="gradient-text">{d.hero[2]}</span>
        </h1>
        <p className="hero-intro">{d.intro}</p>
        <div className="cta-row">
          <a href={marketingPath(locale, "events")} className="button">
            {d.explore}
            <span aria-hidden="true">↗</span>
          </a>
          <a
            href={marketingPath(locale, "download")}
            className="button button-outline"
          >
            {d.download}
          </a>
        </div>
        <p className="microcopy">{d.free}</p>
      </div>
      <div className="hero-visual">
        <div className="hero-orbit" aria-hidden="true" />
        <span className="hero-note" aria-hidden="true">
          find
          <br />
          your vibe.
        </span>
        <Phone d={d} priority />
        <span className="hero-spark" aria-hidden="true">
          ✦
        </span>
      </div>
      <div className="hero-bottom">
        <span>EVY / FIND YOUR VIBE</span>
        <a href="#live-events">
          {d.scroll} <span aria-hidden="true">↓</span>
        </a>
        <span aria-hidden="true">01 — 05</span>
      </div>
    </section>
  );
}
export function Meetups({
  locale,
  d,
  standalone = false,
}: {
  locale: Locale;
  d: Dictionary;
  standalone?: boolean;
}) {
  const Heading = standalone ? "h1" : "h2";
  const StepHeading = standalone ? "h2" : "h3";
  return (
    <section className="section meetup-section" id="meetups">
      <div className="container">
        <div className="meetup-layout">
          <div>
            <p className="eyebrow">{d.meetupTag}</p>
            <Heading>{d.meetupTitle}</Heading>
            <p className="section-intro">{d.meetupIntro}</p>
            <a
              className="button"
              href={standalone ? APP_URL : marketingPath(locale, "meetups")}
              {...conversionAttributes(
                "meetup_cta_click",
                standalone ? "meetups-page" : "home",
              )}
            >
              {d.meetupCta}
              <span aria-hidden="true">↗</span>
            </a>
            <p className="microcopy">{d.meetupHelp}</p>
          </div>
          <div className="activity-art">
            <div className="activity-ring" aria-hidden="true" />
            <Image
              src="/marketing/star.svg"
              alt=""
              width={120}
              height={120}
              className="activity-star"
            />
            {d.activity.map((a, i) => (
              <span key={a} className={`activity-chip activity-${i}`}>
                <span aria-hidden="true">{["↗", "☕", "↟", "◉"][i]}</span>
                {a}
              </span>
            ))}
            <p>{d.ideaLabel}</p>
          </div>
        </div>
        <ol className={`meetup-steps ${styles.steps}`}>
          {d.steps.map((step, i) => (
            <li key={step}>
              <span className="step-number">0{i + 1}</span>
              <StepHeading className={styles.stepHeading}>{step}</StepHeading>
              <p>{d.stepCopy[i]}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
export function Features({ d }: { d: Dictionary }) {
  return (
    <section className="section features-section container">
      <div className="feature-visual">
        <span className="feature-word" aria-hidden="true">
          explore.
        </span>
        <Phone screen="search" d={d} />
      </div>
      <div className="feature-content">
        <p className="eyebrow">{d.featuresTag}</p>
        <h2>{d.featuresTitle}</h2>
        <div className="feature-list">
          {d.features.map((name, i) => (
            <div key={name}>
              <span aria-hidden="true">{["◎", "♡", "↗", "✦"][i]}</span>
              <div>
                <h3>{name}</h3>
                <p>{d.featureCopy[i]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Organizers({
  locale,
  d,
  standalone = false,
}: {
  locale: Locale;
  d: Dictionary;
  standalone?: boolean;
}) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <section className="section organizer-section" id="organizers">
      <div className="container organizer-layout">
        <div className="organizer-copy">
          <p className="eyebrow">{d.orgTag}</p>
          <Heading>{d.orgTitle}</Heading>
          <p className="section-intro">{d.orgIntro}</p>
          <ul className="organizer-benefits">
            {d.orgBenefits.map((b) => (
              <li key={b}>
                <span aria-hidden="true">↗</span>
                {b}
              </li>
            ))}
          </ul>
          <a
            href={standalone ? APP_URL : marketingPath(locale, "organizers")}
            className="button"
            {...conversionAttributes(
              "organizer_cta_click",
              standalone ? "organizers-page" : "home",
            )}
          >
            {d.orgCta} ↗
          </a>
          <p className="microcopy">{d.orgHelp}</p>
          {standalone && <p className="pro-note">{d.orgPro}</p>}
        </div>
        <div className="organizer-visual">
          <span className="organizer-word" aria-hidden="true">
            MAKE
            <br />
            IT
            <br />
            <em>HAPPEN.</em>
          </span>
          <Phone screen="event-detail" d={d} />
        </div>
      </div>
    </section>
  );
}
export function Download({
  d,
  standalone = false,
}: {
  d: Dictionary;
  standalone?: boolean;
}) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <section className="section download-section container" id="download">
      <div className="download-panel">
        <div className="download-copy">
          <Image src="/marketing/evy-logo.png" alt="Evy — Find your vibe" width={945} height={989} sizes="120px" />
          <p className="eyebrow">{d.downloadTag}</p>
          <Heading>{d.downloadTitle}</Heading>
          <p>{d.downloadIntro}</p>
          <div className="store-badges">
            <a
              href={STORE_URLS.ios}
              aria-label={`${d.download} — App Store`}
              {...conversionAttributes("app_store_click", "download")}
            >
              <Image
                src="/marketing/appstore.png"
                alt="App Store"
                width={180}
                height={61}
              />
            </a>
            <a
              href={STORE_URLS.android}
              aria-label={`${d.download} — Google Play`}
              {...conversionAttributes("google_play_click", "download")}
            >
              <Image
                src="/marketing/playstore.png"
                alt="Google Play"
                width={180}
                height={61}
              />
            </a>
          </div>
          <p className="microcopy">{d.stores}</p>
        </div>
        <div className="qr-panel">
          <div>
            <Image
              src="/marketing/download-qr.svg"
              alt={d.scan}
              width={176}
              height={176}
            />
          </div>
          <p>{d.scan}</p>
          <span aria-hidden="true">↗</span>
        </div>
      </div>
      <p className="web-alternative">
        {d.web}{" "}
        <a
          href={APP_URL}
          {...conversionAttributes("open_in_evy_click", "download")}
        >
          {d.webLink} ↗
        </a>
      </p>
    </section>
  );
}
