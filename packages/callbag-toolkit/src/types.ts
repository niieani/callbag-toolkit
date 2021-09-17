export type {
  Callbag,
  CallbagArgs,
  Sink,
  Source,
  SourceFactory,
  SourceOperator,
  UnwrapSink,
  UnwrapSource, // https://github.com/import-js/eslint-plugin-import/issues/2132
} from 'callbag' // eslint-disable-line import/no-unresolved

export const START = 0
export const DATA = 1
export const END = 2

export interface ConsumerHandlers<In> {
  next?: (data: In) => void
  complete?: () => void
  error?: (error: unknown) => void
  start?: (actions: ConsumptionManagement) => void
  // called regardless on either error or completion
  end?: () => void
}

export interface ConsumptionManagement {
  pull: () => void
  stop: () => void
}

export interface ConsumptionSource extends ConsumptionManagement {
  readonly started: boolean
  /**
   * starts consumption only if not already started
   * @returns {boolean} true if consumption was started
   */
  start: () => boolean
}

export interface SourceHandlers<Out> {
  start: () => void
  next: (data: Out) => void
  error: (error: unknown) => void
  complete: () => void
}

export type StopFn = () => void
export interface SourceManagement {
  /** callback that should react to a request to pull data */
  pull?: () => void
  /** callback that should clean-up whatever was setup by this source */
  stop?: StopFn
}
