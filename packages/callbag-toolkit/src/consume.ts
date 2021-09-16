import { createConsumer } from './create'
import type {
  ConsumerHandlers,
  ConsumptionManagement,
  ConsumptionSource,
  Sink,
  Source,
} from './types'
import { START } from './types'

export const consumeSourceWithConsumer = <In>(
  source: Source<In>,
  consumer: Sink<In>,
) => void source(START, consumer)

const defaultConsumptionManagement: Readonly<ConsumptionManagement> = {
  pull: () => {
    throw new Error(`Cannot pull from source that is not started.`)
  },
  stop: () => {
    throw new Error(`Cannot stop a source that is not started.`)
  },
}

export const consumeSource = <In>(
  source: Source<In>,
  consumerHandlers: ConsumerHandlers<In>,
  lazyStart = false,
): ConsumptionSource => {
  let consumptionManagement = defaultConsumptionManagement

  const consumer = createConsumer({
    ...consumerHandlers,
    start: (management) => {
      consumptionManagement = management
      consumerHandlers?.start?.(management)
    },
    end: () => {
      consumptionManagement = defaultConsumptionManagement
      consumerHandlers?.end?.()
    },
  })

  const isStarted = () => consumptionManagement !== defaultConsumptionManagement
  const start = () =>
    !(isStarted() || void consumeSourceWithConsumer(source, consumer))
  if (!lazyStart) start()

  return {
    pull: () => void consumptionManagement.pull(),
    stop: () => void consumptionManagement.stop(),
    start,
    get started() {
      return isStarted()
    },
  }
}

export const consumeSynchronously = <In>(source: Source<In>): In[] => {
  const emittedValues: In[] = []
  let error: unknown
  let consumptionManagement = defaultConsumptionManagement
  let didComplete = false

  const consumer = createConsumer({
    next: (data: In) => {
      emittedValues.push(data)
    },
    complete: () => {
      didComplete = true
    },
    error: (e: unknown) => {
      error = e
    },
    start: (management) => {
      consumptionManagement = management
    },
  })

  consumeSourceWithConsumer(source, consumer)

  if (consumptionManagement === defaultConsumptionManagement) {
    throw new Error(
      `Could not consume synchronously, because the source never started.`,
    )
  }

  consumptionManagement.stop()

  if (!didComplete) {
    throw new Error(
      `Could not consume, because the source never completed synchronously.`,
    )
  }
  if (error) throw error

  return emittedValues
}
