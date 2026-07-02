import ipaddr from 'ipaddr.js';

/**
 * Validates if an IP address is within the provided allowlist.
 * 
 * @param ip Client IP address string (e.g. '192.168.1.5', '::1')
 * @param allowlist Array of allowed IP addresses or CIDR blocks (e.g. ['192.168.1.0/24', '10.0.0.1'])
 * @returns boolean
 */
export function isIpAllowed(ip: string, allowlist: string[] | null | undefined): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true; // No allowlist means access is fully allowed
  }

  try {
    let parsedIp = ipaddr.parse(ip);

    // Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
    if (parsedIp.kind() === 'ipv6' && (parsedIp as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsedIp = (parsedIp as ipaddr.IPv6).toIPv4Address();
    }

    for (const allowed of allowlist) {
      try {
        // If it's a CIDR block (contains '/')
        if (allowed.includes('/')) {
          const parsedRange = ipaddr.parseCIDR(allowed);
          // Only compare if they are the same kind (IPv4 vs IPv6)
          if (parsedIp.kind() === parsedRange[0].kind() && parsedIp.match(parsedRange)) {
            return true;
          }
        } else {
          // If it's a direct IP
          let parsedAllowed = ipaddr.parse(allowed);
          if (parsedAllowed.kind() === 'ipv6' && (parsedAllowed as ipaddr.IPv6).isIPv4MappedAddress()) {
            parsedAllowed = (parsedAllowed as ipaddr.IPv6).toIPv4Address();
          }
          if (parsedIp.kind() === parsedAllowed.kind() && parsedIp.toString() === parsedAllowed.toString()) {
            return true;
          }
        }
      } catch (err) {
        // Ignore invalid entries in allowlist and continue
        continue;
      }
    }

    return false; // Matched nothing in the allowlist
  } catch (err) {
    // If the provided client IP is completely unparseable, block it for safety
    return false;
  }
}
