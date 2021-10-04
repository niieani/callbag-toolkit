/* eslint-disable @typescript-eslint/no-use-before-define,@typescript-eslint/no-unused-expressions,no-return-assign */

import type {
  CallbagArgs,
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

type SourceState = 'active' | 'disposed' | 'ended' | 'inactive'

const assertActive = (state: SourceState, method: string) => {
  if (state === 'active') return true
  // eslint-disable-next-line no-console
  console.error(
    `This callbag source ${
      state === 'disposed'
        ? 'was previously disposed'
        : state === 'ended'
        ? 'has previously ended'
        : 'has not been started'
    }, but '${method}' was invoked.`,
  )
  return false
}

const assertInactive = (state: SourceState, method: string) => {
  if (state !== 'active') return true
  // eslint-disable-next-line no-console
  console.error(
    `This callbag source is already active, but '${method}' was invoked.`,
  )
  return false
}

export const createSource =
  <Out>(
    onConsume: (
      handlers: SourceHandlers<Out>,
    ) => SourceManagement | StopFn | void,
  ): Source<Out> =>
  (...args) => {
    if (args[0] !== START) return

    let state: SourceState = 'inactive'
    const markDisposed = () => state !== 'disposed' && (state = 'disposed')
    let init: CallbagArgs<never, Out> | boolean = false

    /** talkback: handle messages from the sink back to this source */
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const upstream: Source<Out> = (...args) => {
      if (state === 'disposed') return
      if (init) {
        // got a request from the sink for the next value, let's process it
        if (askToPull && args[0] === DATA) askToPull()
        else if (args[0] === END) markDisposed() && dispose?.()
      } else {
        init = args
      }
    }

    /** sink */
    const downstream = args[1]

    const consumer = onConsume({
      start: () => {
        if (!assertInactive(state, 'start')) return
        downstream(START, upstream)
        state = 'active'
      },
      next: (data: Out) => {
        if (!assertActive(state, 'next')) return
        downstream(DATA, data)
      },
      error: (error: unknown) => {
        // assert, but passthrough errors so that clean-up may take place
        assertActive(state, 'error')
        downstream(END, error)
        state = 'ended'
      },
      complete: () => {
        // assert, but passthrough errors so that clean-up may take place
        assertActive(state, 'complete')
        downstream(END)
        state = 'ended'
      },
    })

    const dispose = typeof consumer === 'function' ? consumer : consumer?.stop
    const askToPull = typeof consumer === 'object' ? consumer?.pull : undefined
    if (init) upstream(...init)
    init = true
  }
