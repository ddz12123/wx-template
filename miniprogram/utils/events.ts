export type EventListener<Payload> = (payload: Payload) => void;
export type Unsubscribe = () => void;

export interface EventBus<Events extends object> {
  on<Name extends keyof Events>(name: Name, listener: EventListener<Events[Name]>): Unsubscribe;
  /** Removes all registrations of this listener for the event. */
  off<Name extends keyof Events>(name: Name, listener: EventListener<Events[Name]>): void;
  emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void;
  /** Permanently closes this bus. Later emits are ignored and on calls throw. */
  dispose(): void;
}

interface Subscription {
  listener: unknown;
  notify: (payload: unknown) => void;
}

/**
 * Each on call owns an independent registration. During emit, additions wait until
 * the next emit and removals take effect immediately. Listener errors propagate.
 */
export function createEventBus<Events extends object>(): EventBus<Events> {
  const subscriptions = new Map<keyof Events, Set<Subscription>>();
  let disposed = false;

  return {
    on<Name extends keyof Events>(name: Name, listener: EventListener<Events[Name]>): Unsubscribe {
      if (disposed) throw new Error('Cannot subscribe to a disposed event bus');
      let listeners = subscriptions.get(name);
      if (listeners === undefined) {
        listeners = new Set<Subscription>();
        subscriptions.set(name, listeners);
      }
      const subscription: Subscription = {
        listener,
        notify: (payload) => listener(payload as Events[Name]),
      };
      listeners.add(subscription);
      let active = true;
      return (): void => {
        if (!active) return;
        active = false;
        const current = subscriptions.get(name);
        if (current === undefined) return;
        current.delete(subscription);
        if (current.size === 0) subscriptions.delete(name);
      };
    },
    off(name, listener): void {
      const listeners = subscriptions.get(name);
      if (listeners === undefined) return;
      for (const subscription of listeners) {
        if (subscription.listener === listener) listeners.delete(subscription);
      }
      if (listeners.size === 0) subscriptions.delete(name);
    },
    emit(name, payload): void {
      if (disposed) return;
      const listeners = subscriptions.get(name);
      if (listeners === undefined) return;
      for (const subscription of Array.from(listeners)) {
        if (disposed) break;
        if (listeners.has(subscription)) subscription.notify(payload);
      }
    },
    dispose(): void {
      disposed = true;
      for (const listeners of subscriptions.values()) listeners.clear();
      subscriptions.clear();
    },
  };
}
