import { t as tr } from "./i18n";
import { User } from "./icons";
export default function SignInRequired({
  title,
  message,
  signIn,
}: {
  title: string;
  message: string;
  signIn: () => void;
}) {
  return (
    <section className="page-section sign-in-page" aria-label={title}>
      <div className="sign-in-panel surface">
        <User size={32} />
        <h1>{title}</h1>
        <p className="muted">{tr(message)}</p>
        <button className="button primary" onClick={signIn}>
          {tr("Se connecter")}
        </button>
      </div>
    </section>
  );
}
