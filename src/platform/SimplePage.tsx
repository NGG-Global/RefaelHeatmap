import { Dot, Trail } from "./Motif";
import "./simple-page.css";

interface Props {
  title: string;
  body?: string;
}

/** Full-screen navy message page (closed voting, unknown link, fallback). */
export function SimplePage({ title, body }: Props) {
  return (
    <main className="simple-page">
      <div className="simple-page-motif" dir="ltr" aria-hidden="true">
        <Trail x={-150} y={40} rot={36.7} />
        <Dot x={88} y={168} />
      </div>
      <div className="simple-page-copy">
        <h1 className="simple-page-title">{title}</h1>
        {body ? <p className="simple-page-body">{body}</p> : null}
      </div>
    </main>
  );
}
