"use client";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { useSession } from "@/components/session";

const FEATURES = [
  { icon: "◍", title: "Carte 3D vivante", text: "Un relief réel, généré à partir de la graine de votre monde. Zoomez du continent au village, créez directement sur le terrain. Un monde vierge commence blanc, et se révèle à mesure que vous l'écrivez." },
  { icon: "⚖", title: "Guardian AI", text: "Chaque création est vérifiée contre vos lois et votre histoire : VALID, WARNING ou CONFLICT, avec la loi citée et une alternative compatible." },
  { icon: "✺", title: "World Brain", text: "La mémoire du monde repose sur vos données, pas sur une conversation. Demandez qui gouverne, pourquoi deux peuples se haïssent, ce qu'il reste d'une cité." },
  { icon: "⧗", title: "Time Engine", text: "Avancez d'un jour, d'un an, d'un siècle. Vieillissement, naissances, guerres, technologies, épuisement des ressources : prévisualisez, puis appliquez." },
  { icon: "☥", title: "Histoire inviolable", text: "Rien ne s'efface en silence. Corrections et révisions sont tracées, les versions précédentes restent consultables, les lois changent par amendement." },
  { icon: "⚜", title: "Mondes partagés", text: "Créateur, administrateurs, gardiens, contributeurs, lecteurs. Les contributions passent par Guardian et la validation de ceux que vous désignez." }
];

export default function Landing() {
  const { session } = useSession();
  const primary = session ? "/worlds" : "/auth?mode=signup";
  return (
    <>
      <TopBar />
      <section className="hero">
        <div className="hero-bg"><img src="/art/hero.jpg" alt="" /></div>
        <div className="hero-inner">
          <div className="orb" aria-hidden />
          <span className="slogan">Where worlds are born</span>
          <h1>Créez un monde.<br />Donnez-lui des lois.<br />Regardez-le vivre.</h1>
          <p className="muted" style={{ maxWidth: 640, fontSize: 17 }}>
            ARTHENIS est un atelier de création d&apos;univers. Chaque monde a ses propres règles, sa mémoire, son temps — et une intelligence qui veille à sa cohérence. Vous en restez l&apos;autorité suprême.
          </p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <Link className="btn primary lg" href={primary}>{session ? "Entrer dans mes mondes" : "Commencer un monde"}</Link>
            <Link className="btn lg" href={session ? "/worlds/new" : "/auth"}>{session ? "Créer un univers" : "J'ai déjà un compte"}</Link>
          </div>
        </div>
      </section>
      <section className="features">
        {FEATURES.map(f => (
          <div key={f.title} className="panel feature">
            <div className="icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p className="muted">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="page muted small" style={{ textAlign: "center", paddingTop: 0 }}>ARTHENIS · Where worlds are born</footer>
    </>
  );
}
