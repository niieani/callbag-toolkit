import { createSource } from 'callbag-toolkit'

interface ForEachable<T> {
  forEach: (callbackfn: (value: T) => unknown) => unknown
}

/**
 * Creates a synchronous Source that emits values from the given input (e.g. Array).
 * @param input input object implementing a .forEach method (e.g. Array)
 * @returns source that emits each item of the input
 */
export const fromForEachable = <T>(input: ForEachable<T>) =>
  createSource<T>(({ next, start, complete }) => {
    start()
    input.forEach(next)
    complete()
  })
