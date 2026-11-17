// Test process only: never imported by application routes or production startup.
const instant = Date.parse('2026-10-12T12:00:00Z')
const NativeDate = Date
global.Date = new Proxy(NativeDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [instant], newTarget)
  },
  apply() { return new NativeDate(instant).toString() },
  get(target, key) { return key === 'now' ? () => instant : Reflect.get(target, key) },
})
