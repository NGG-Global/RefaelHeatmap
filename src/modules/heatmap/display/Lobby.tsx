/** Before the reveal: QR code, short link, event name and the live voter count. */
import { publicBaseUrl } from "../../../platform/env";
import { Comet } from "../../../platform/Motif";
import { QrCode } from "../../../platform/QrCode";
import { Stage } from "../../../platform/Stage";
import { DISPLAY_UI, VOTERS_SUFFIX } from "../content";
import { StageFooter } from "./StageFooter";

const QR_SIZE = 760;
const LINK_MAX_FONT = 46;

interface Props {
  name: string;
  shortCode: string;
  voters: number;
  votingOpen: boolean;
}

export function Lobby({ name, shortCode, voters, votingOpen }: Props) {
  const url = `${publicBaseUrl()}/v/${shortCode}`;
  const linkText = url.replace(/^https?:\/\//, "");
  // Keep the link on one line under the QR, whatever the domain length.
  const linkFont = Math.min(LINK_MAX_FONT, Math.floor(QR_SIZE / (linkText.length * 0.52)));

  return (
    <Stage ground="var(--navy)">
      <div className="lobby">
        <div className="stage-motif" dir="ltr" aria-hidden="true">
          {/* trail at the template rotation 148.5°, running off the right edge */}
          <Comet x={1660} y={930} angle={-31.5} />
        </div>

        <div className="lobby-qr" dir="ltr">
          <QrCode value={url} size={QR_SIZE} label={DISPLAY_UI.qrAlt} />
        </div>
        <p className="lobby-link ltr" style={{ fontSize: linkFont }}>
          {linkText}
        </p>

        <h1 className="lobby-name">{name}</h1>

        <div className="lobby-count" aria-live="polite">
          <span className="count-number">{voters}</span>
          <span className="count-label">{VOTERS_SUFFIX}</span>
        </div>
        {!votingOpen ? <p className="stage-badge lobby-badge">{DISPLAY_UI.votingClosedBadge}</p> : null}

        <StageFooter />
      </div>
    </Stage>
  );
}
