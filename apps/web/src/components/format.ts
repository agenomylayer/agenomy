export function shortAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatCreatedAt(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function basescanAddressUrl(addr: string): string {
  return `https://sepolia.basescan.org/address/${addr}`;
}

export function ipfsUrl(gateway: string, cid: string): string {
  const gw = gateway.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${gw}/ipfs/${cid}`;
}
