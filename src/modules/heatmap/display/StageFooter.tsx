/** Design-system footer on the projector: the NGG mark only (brief V5: no client logo or name). */
import nggMark from "../../../platform/ngg-mark.png";

export function StageFooter() {
  return (
    <div className="stage-footer" dir="ltr">
      <img className="stage-footer-ngg" src={nggMark} alt="NGG" />
    </div>
  );
}
