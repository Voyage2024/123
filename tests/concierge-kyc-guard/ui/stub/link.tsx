export default function Link({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) { return <a href={href} {...rest}>{children}</a>; }
