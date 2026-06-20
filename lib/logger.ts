function ts() {
  return new Date().toISOString().slice(11, 23);
}

function make(tag: string) {
  const prefix = `[${tag}]`;
  return {
    info: (...a: unknown[]) => __DEV__ && console.log(`${ts()} ${prefix}`, ...a),
    warn: (...a: unknown[]) => __DEV__ && console.warn(`${ts()} ${prefix}`, ...a),
    error: (...a: unknown[]) => console.error(`${ts()} ${prefix}`, ...a),
    time: (label: string) => {
      const t0 = Date.now();
      return () => __DEV__ && console.log(`${ts()} ${prefix} ${label} — ${Date.now() - t0}ms`);
    },
  };
}

export const logger = { make };
