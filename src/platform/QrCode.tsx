/** QR code rendered in the app as one SVG path (no network, no canvas). */
import qrcode from "qrcode-generator";
import { useMemo } from "react";

const QUIET_ZONE = 4; // modules, as the QR specification requires

interface Props {
  value: string;
  size: number;
  label: string;
}

export function QrCode({ value, size, label }: Props) {
  const { path, extent } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { path: d, extent: count + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#000030" />
    </svg>
  );
}
