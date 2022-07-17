import { concat, fromIter, fromPromise } from 'callbag-basics'
import of from 'callbag-of'
import pipe from 'callbag-pipe'
import { consumeSource, consumeSynchronously } from './consume'
import { createSource } from './create'
import type { Source } from './types'

const multiplyBy = (n: number) => (inputSource: Source<number>) =>
  createSource<number>(({ next, ...passthrough }) =>
    consumeSource(inputSource, {
      next: (data) => void next(data * n),
      ...passthrough,
    }),
  )

const interval = (intervalMs: number, startWith = 1) =>
  createSource<number>(({ next, start }) => {
    start()
    let value = startWith
    const timeout = setInterval(() => void next(value++), intervalMs)
    return () => void clearInterval(timeout)
  })

const take =
  (n: number) =>
  <T>(inputSource: Source<T>) =>
    createSource<T>(({ complete, next, ...rest }) => {
      const consumption = consumeSource(inputSource, {
        next: (data) => {
          if (n > 0) {
            next(data)
            // eslint-disable-next-line no-param-reassign
            n--
          }
          if (n === 0) {
            consumption.stop()
            complete()
          }
        },
        complete,
        ...rest,
      })
      return consumption
    })

const switchError =
  <O>(getNewSource: (error: unknown) => Source<O>) =>
  <T>(inputSource: Source<T>) =>
    createSource<O | T>(({ start, next, error, complete }) => {
      let pulling = false
      let consumption = consumeSource(inputSource, {
        start,
        next: (data) => {
          pulling = false
          next(data)
        },
        complete,
        error: (err) => {
          try {
            // run cleanup on the source that emitted the error
            consumption.stop()
            consumption = consumeSource(getNewSource(err), {
              next,
              complete,
              // if this error is a result of a pull,
              // we also need to pull on the new source as soon as it starts:
              start: pulling ? ({ pull }) => void pull() : undefined,
              error,
            })
          } catch (error_: unknown) {
            error(error_)
          }
        },
      })
      return {
        stop: () => void consumption.stop(),
        pull: () => {
          pulling = true
          consumption.pull()
        },
      }
    })

const sequence = (length: number) =>
  createSource<number>(({ next, start, complete }) => {
    start()
    Array.from({ length }).forEach((_, index) => void next(index))
    complete()
  })

const nextTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve)
  })

describe(`callbag-toolkit`, () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it(`should emit and transform values and complete correctly`, () => {
    const intervalMs = 1_000
    const source = pipe(interval(intervalMs), multiplyBy(2), take(10))
    const next = jest.fn<void, [number]>()
    const complete = jest.fn<void, []>()
    const error = jest.fn<void, []>()
    const end = jest.fn<void, []>()

    const handlers = consumeSource(source, {
      next,
      complete,
      error,
      end,
    })

    expect(next).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(end).not.toHaveBeenCalled()

    expect(jest.getTimerCount()).toBe(1)

    jest.advanceTimersByTime(intervalMs)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenLastCalledWith(2)
    jest.advanceTimersByTime(intervalMs)
    expect(next).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenLastCalledWith(4)
    jest.advanceTimersByTime(intervalMs * 8)
    expect(next).toHaveBeenCalledTimes(10)
    expect(next).toHaveBeenLastCalledWith(20)

    expect(handlers.stop).toThrowErrorMatchingInlineSnapshot(
      `"Cannot stop a source that is not started."`,
    )

    expect(complete).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(0)
    expect(end).toHaveBeenCalledTimes(1)

    expect(jest.getTimerCount()).toBe(0)
  })
})

describe(`switchError`, () => {
  const myError = new Error('error')
  const rejectedPromise = Promise.reject(myError)
  void rejectedPromise.catch(() => {})

  it(`should switch to a new source upon error`, async () => {
    const source = pipe(
      concat(of(1, 2, 3), fromPromise(rejectedPromise)),
      switchError((error) => of(error, 5, 6)),
    )

    const next = jest.fn<void, [unknown]>()
    const complete = jest.fn<void, []>()
    const error = jest.fn<void, []>()
    const end = jest.fn<void, []>()

    const handlers = consumeSource(source, {
      next,
      complete,
      error,
      end,
    })

    expect(handlers.started).toBe(true)
    expect(next).toHaveBeenCalledTimes(3)
    expect(complete).not.toHaveBeenCalled()

    // promises are not resolved until the next tick
    await nextTick()
    expect(handlers.started).toBe(false)

    expect(next).toHaveBeenCalledTimes(6)

    expect(next).toHaveBeenNthCalledWith(4, myError)
    expect(next).toHaveBeenNthCalledWith(5, 5)
    expect(next).toHaveBeenNthCalledWith(6, 6)

    expect(complete).toHaveBeenCalledTimes(1)

    expect(error).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
  })

  it(`should switch to a new source upon error in pullable`, async () => {
    const source = pipe(
      concat(fromIter([1, 2, 3]), fromPromise(rejectedPromise)),
      switchError((error) => fromIter([error, 5, 6])),
    )

    const next = jest.fn<void, [unknown]>()
    const complete = jest.fn<void, []>()
    const error = jest.fn<void, []>()
    const end = jest.fn<void, []>()

    const handlers = consumeSource(source, {
      next,
      complete,
      error,
      end,
    })

    expect(handlers.started).toBe(true)
    // we need to pull first
    expect(next).toHaveBeenCalledTimes(0)
    expect(complete).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()

    handlers.pull()
    expect(next).toHaveBeenLastCalledWith(1)
    handlers.pull()
    expect(next).toHaveBeenLastCalledWith(2)
    handlers.pull()
    expect(next).toHaveBeenLastCalledWith(3)

    expect(complete).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(3)
    expect(error).not.toHaveBeenCalled()

    // this pull will cause the error to be thrown and switched to a new source
    handlers.pull()
    await nextTick()

    expect(error).not.toHaveBeenCalled()

    expect(next).toHaveBeenCalledTimes(4)
    expect(next).toHaveBeenLastCalledWith(myError)

    expect(handlers.started).toBe(true)

    handlers.pull()
    expect(next).toHaveBeenLastCalledWith(5)
    handlers.pull()
    expect(next).toHaveBeenLastCalledWith(6)
    expect(complete).toHaveBeenCalledTimes(0)

    // last pull will not send 'next' but 'complete'
    handlers.pull()
    expect(next).toHaveBeenCalledTimes(6)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(handlers.started).toBe(false)
    expect(handlers.pull).toThrowErrorMatchingInlineSnapshot(
      `"Cannot pull from source that is not started."`,
    )

    expect(end).toHaveBeenCalledTimes(1)
  })

  it(`should consume synchronously`, () => {
    const source = sequence(10)
    const result = consumeSynchronously(source)
    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it(`should transform as synchronous input`, () => {
    const source = sequence(10)
    const transformedSource = createSource<number>(
      ({ next, start, complete, error }) => {
        const consumption = consumeSource(source, {
          start,
          complete,
          error,
          next: (input) => {
            next(input * 100)
          },
        })
        return consumption
      },
    )
    const result = consumeSynchronously(transformedSource)
    expect(result).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
  })
})
