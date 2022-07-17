import { consumeSource, consumeSynchronously } from 'callbag-toolkit'
import { fromForEachable } from './main'

describe(`fromForEachable`, () => {
  it(`should emit values and complete correctly`, () => {
    const source = fromForEachable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
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

    expect(next).toHaveBeenCalledTimes(10)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
    expect(handlers.started).toBe(false)
  })

  it(`should emit values when consumed synchronously`, () => {
    const input = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const source = fromForEachable(input)
    const result = consumeSynchronously(source)
    expect(result).toEqual([...input])
  })
})
