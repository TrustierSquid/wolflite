const DEFAULT_AVATAR = "/static/uploads/defaultUser.jpg";

// Round profile picture. Falls back to the default picture when the user has
// none, or when their image fails to load.
export default function Avatar({ src, size = 40, alt = "" }) {
  return (
    <img
      className="avatar"
      src={src || DEFAULT_AVATAR}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt={alt}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(DEFAULT_AVATAR)) e.currentTarget.src = DEFAULT_AVATAR;
      }}
    />
  );
}
