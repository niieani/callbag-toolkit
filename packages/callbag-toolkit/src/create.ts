/* eslint-disable @typescript-eslint/no-use-before-define,@typescript-eslint/no-unused-expressions,no-return-assign */

import type {
  ConsumerHandlers,
  Sink,
  Source,
  SourceHandlers,
  SourceManagement,
  StopFn,
} from './types'
import { DATA, END, START } from './types'

export const createConsumer =
  <In>({ next, complete, error, start, end }: ConsumerHandlers<In>): Sink<In> =>
  (...args) => {
    if (start && args[0] === START) {
      /** talkback */
      const upstream = args[1]
      start({
        stop: () => void upstream(END),
        pull: () => void upstream(DATA),
      })
    } else if (next && args[0] === DATA && args.length === 2) {
      const data = args[1]
      next(data)
    } else if ((error || complete || end) && args[0] === END) {
      const errorValue = args[1]
      if (error && errorValue !== undefined) error(errorValue)
      else if (complete) complete()
      // consumer dispose logic
      if (end) end()
    }
  }

export const createSource =
  <Out>(
    onConsume: (
      handlers: SourceHandlers<Out>,
    ) => SourceManagement | StopFn | void,
  ): Source<Out> =>
  (...args) => {
    if (args[0] !== START) return

    let state: 'active' | 'disposed' | 'inactive' = 'inactive'
    const deactivate = () => state === 'active' && (state = 'inactive')
    const activate = () => state !== 'active' && (state = 'active')
    const markDisposed = () => state !== 'disposed' && (state = 'disposed')

    /** talkback - sends messages back upstream */
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const upstream: Source<Out> = (...args) => {
      if (state === 'disposed') return
      // got a request from the sink for the next value, let's process it
      if (askToPull && args[0] === DATA) askToPull()
      else if (dispose && args[0] === END) markDisposed() && dispose()
    }

    /** sink */
    const downstream = args[1]

    const consumer = onConsume({
      start: () => void (activate() && downstream(START, upstream)),
      next: (data: Out) => state === void ('active' && downstream(DATA, data)),
      error: (error: unknown) => void (deactivate() && downstream(END, error)),
      complete: () => void (deactivate() && downstream(END)),
    })

    const dispose = typeof consumer === 'function' ? consumer : consumer?.stop
    const askToPull = typeof consumer === 'object' ? consumer?.pull : undefined
  }
