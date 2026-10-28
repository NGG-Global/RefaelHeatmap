/** Design-system footer lockup on the projector: NGG mark, then the co-brand wordmark. */
import { COBRAND } from "../../../brand/cobrand";
import nggMark from "../../../platform/ngg-mark.png";

export function StageFooter({ ground }: { ground: "dark" | "light" }) {
  return (
    <div className="stage-footer" dir="ltr">
      <img className="stage-footer-ngg" src={nggMark} alt="NGG" />
      {COBRAND ? (
        <img className="stage-footer-cobrand" src={ground === "dark" ? COBRAND.onDark : COBRAND.onLight} alt={COBRAND.alt} />
      ) : null}
    </div>
  );
}
