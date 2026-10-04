import { createAvatar } from "@dicebear/core";
import { identicon } from "@dicebear/collection";

/** Avatar generated locally from the user's email. No network request. */
export function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const uri = createAvatar(identicon, { seed, size, backgroundColor: ["152234"], rowColor: ["22d3ee"] }).toDataUri();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} width={size} height={size} alt="" />;
}
