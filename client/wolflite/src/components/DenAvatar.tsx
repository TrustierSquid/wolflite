import { useState } from "react";

interface DenAvatarProps {
  name: string;
  image: string | null | undefined;
  size?: number;
}

// A den's picture: a rounded square, so it never gets mistaken for a (round) user
// picture. Dens without a picture, or whose picture fails to load, show their first letter.
export default function DenAvatar({ name, image, size = 40 }: DenAvatarProps) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };

  if (image && !failed) {
    return (
      <img className="den-avatar" src={image} width={size} height={size} style={style} alt="" onError={() => setFailed(true)} />
    );
  }

  return (
    <span className="den-avatar den-avatar-letter" style={style} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
