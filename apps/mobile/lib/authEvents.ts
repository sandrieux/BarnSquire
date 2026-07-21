// Minimal pub/sub so the network layer can tell the AuthProvider that the
// session is unrecoverable (a refresh failed) and it should return to login —
// without the two modules importing each other.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitSessionExpired(): void {
  for (const cb of listeners) cb();
}
