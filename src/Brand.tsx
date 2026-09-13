/** Shared identity for the sign-in screen and workspace navigation. */
export default function Brand() {
  return (
    <>
      <img
        className="brand-mark"
        src="/favicon.svg?v=2"
        width="40"
        height="40"
        alt=""
        aria-hidden="true"
      />
      <span className="brand-wordmark">opervia</span>
    </>
  );
}
