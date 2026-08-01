export default function SiteLogo({ size = 'small' }: { size?: 'small' | 'large' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/api/logo"
      alt="Site logo"
      className={size === 'large' ? 'h-24 w-auto mx-auto' : 'h-10 w-auto'}
    />
  );
}
