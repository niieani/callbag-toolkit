# callbag-toolkit

[`callbag`](https://github.com/callbag/callbag) is a very powerful and succinct standard for observables and iterables that use a common API.

This toolkit is a collection of very simple tools (20~40 lines each) that make creating and consuming callbags more intuitive, using abstractions familiar to many developers. At the same time, they do not sacrifice the flexibility of the `callbag` standard, as any functionality that can be written using the standard directly, can be represented through the helpers offered in the toolkit.

If you're unsure about why you should use this toolkit, read the [Why should I use `callbag-toolkit`?](#why-should-i-use-callbag-toolkit) section.

Otherwise, see the [Getting Started](#getting-started) section for a quick introduction to the toolkit.

## Getting Started

First, you'll need to install the toolkit using your package manager of choice, for example:

```bash
yarn install callbag-toolkit
```

Next you'll want to create some Sources, Consumers (aka Sinks) and Operators.

If you're already familiar with callbags, you might benefit from reviewing the [Low-level vs Toolkit implementation examples](#low-level-vs-toolkit-implementation-examples) section to get a feel for the usage.

### Creating a Source

Sources emit data, either _pushing_ them to the Consumer, or in response to a Consumer's _pull_.

To create a Source of data using the Toolkit, you'll need to use the `createSource` utility.

`createSource` utility takes in a single argument that is a callback function describing the Source's behavior. The callback is called once the Consumer starts the Source, and provides a set of functions in its argument:

- `start()`: sends a handshake back to the Consumer, indicating that the Source is ready to emit data
- `next(data)`: sends data to the Consumer
- `error(e)`: sends an error to the Consumer
- `complete()`: indicates that the Source has finished emitting data

If you are familiar with RxJS, you probably already know how to use the last three.

Having to call `start()` manually may seem redundant, but as you'll see later, it's convenient for creating Operators, which can simply pass it upwards.

`start()` is also the only function that you are required to call in the Source, all other ones are entirely optional.

The return value of the callback is optional, and if present, may be a source management object with the following optional callbacks:

- `pull: () => void`: called in response to a request to pull data
- `stop: () => void`: called in response to stopping of the Source

As a convenience, returning a single function instead of the object is a shorthand for the `stop` callback only. This is similar to the behavior in RxJS, `useEffect()` hook and many other libraries.

An example Source that emits the current epoch time every second might look like this:

```ts
import { createSource } from 'callbag-toolkit'

const dateEverySecond = createSource<number>(({ next, start }) => {
  start()
  const timeoutId = setInterval(() => next(Date.now()), 1000)
  return () => clearInterval(timeoutId)
})
```

If we instead wanted to create a Source that emits the current epoch time, but only once the Consumer has requested it, we could do the following:

```ts
import { createSource } from 'callbag-toolkit'

const dateOnPull = createSource<number>(({ next, start }) => {
  start()
  return {
    pull: () => next(Date.now()),
  }
})
```

Uniquely to callbag standard, if we wanted to get creative, we could even combine both to make a Source that emits the epoch time on pull _while_ pushing it every second too!

```ts
import { createSource } from 'callbag-toolkit'

const dateEverySecondAndOnPull = createSource<number>(({ next, start }) => {
  start()
  const timeoutId = setInterval(() => next(Date.now()), 1000)
  return {
    pull: () => next(Date.now()),
    stop: () => clearInterval(timeoutId),
  }
})
```

### Creating a Consumer (Sink)

Consumers (aka Sinks/Listeners/Observers) offer a way to define how we want to consume data from Sources.

To create a Consumer we can use the analogous `createConsumer` utility.

It requires a single argument that is an object with a set of callbacks, analogous to the ones called by the source:

- `next: (data) => void`: called when the Source sends data
- `complete: () => void`: called when the Source completes
- `error: (e) => void`: called when the Source sends an error
- `end: () => void`: convenience callback, called after either `complete` or `error` (think: `finally` for cleaning up stale resources)
- `start: (consumptionManagement) => void`: called when the Source starts, and provides a set of functions in its argument:
  - `pull: () => void`: request data from the Source
  - `stop: () => void`: stop the Source

While it is possible to create a Consumer directly using the `createConsumer` utility, akin to `createSource`, it requires you to handle the management of the Source, which is [cumbersome](#-using-the-createconsumer-utility-directly) to do manually.

Most often, you'll want to use the `consumeSource` wrapper, which takes care of the management of the Source for you and offers a convenient API. By default it automatically starts the source as soon as it is called. If you wish to have control over that, set the 3rd argument to `true` to make the start lazy instead.

```ts
import { consumeSource } from 'callbag-toolkit'

const consumptionManagement = consumeSource(dateEverySecondAndOnPull, {
  next: (data) => console.log(data),
  complete: () => console.log('complete'),
  error: (e) => console.error(e),
  start: () => console.log('start'),
  end: () => console.log('end'),
})

// check whether the source has started:
const isStarted = consumptionManagement.started
// stop consumption:
consumptionManagement.stop()
// ask for the next value:
consumptionManagement.pull()
// you can even re-start the consumption after it was stopped
consumptionManagement.start()
```

#### (\*) Using the `createConsumer` utility directly

```ts
import { createConsumer } from 'callbag-toolkit'

let consumptionManagement

const consumer = createConsumer({
  next: (data) => console.log(data),
  complete: () => console.log('complete'),
  error: (e) => console.error(e),
  start: (management) => {
    console.log('start')
    consumptionManagement = management
  },
  end: () => {
    console.log('end')
    consumptionManagement = undefined
  },
})
```

### Creating an Operator

Operators can be used to transform, filter or buffer data flowing from Sources before they reach the Consumer. They are both Consumers and Sources at the same time, which means to create an Operator we can simply combine `createSource` with `consumeSource`.

A `take` Operator, which limits the number of values emitted by a Source, may look like this:

```ts
const take = (n) => (inputSource) =>
  createSource(({ complete, next, ...rest }) => {
    const consumption = consumeSource(inputSource, {
      next: (data) => {
        if (n > 0) {
          next(data)
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
```

## Why should I use `callbag-toolkit`

As powerful and effective as it is, the [`callbag`](https://github.com/callbag/callbag) standard is unfortunately fairly low-level, and brings with it a relatively steep learning curve. I believe this is a significant barrer to entry and one of the reasons for why callbags have not become more popular, despite being superior in many ways to other stream/observable/iterable libraries.

The code of producers, consumers and operators implemented directly using the spec can be quite challenging to read and understand, and arguably makes it more likely to for subtle errors or ommissions in their implementation to occur.

### Low-level vs Toolkit implementation examples

#### Creating Sources

Consider the simplest example of the `interval` callbag from the `callbag-interval` package:

```js
const interval = (period) => (start, sink) => {
  if (start !== 0) return
  let i = 0
  const id = setInterval(() => {
    sink(1, i++)
  }, period)
  sink(0, (t) => {
    if (t === 2) clearInterval(id)
  })
}
```

Even after memorizing the specification of callbags, there's a significant mental overhead when trying to reverse-engineer what this callbag is doing. Consider an implementation of the same callbag that instead uses the ~30-line `createSource` helper from this toolkit:

```js
const interval = (period) =>
  createSource(({ next, start }) => {
    start()
    let value = 0
    const timeoutId = setInterval(() => next(value++), period)
    return () => clearInterval(timeoutId)
  })
```

The in-depth understanding of the specification is abstracted away and no longer required.
Instead of having to remember magic values and things like how to setup a clean-up function, almost all of the code is now pure logic related to the functionality of the source.

In this case, the returned value is the clean-up function, which should be a concept familiar to anyone who previously used React's `useEffect` or created `RxJS` `Observable`s.

#### Consuming Sources (aka Sinks)

Consider another example of a simple sink that mimics RxJS's `.subscribe()` functionality, [`callbag-observe`](https://github.com/staltz/callbag-observe):

```js
const observe = (operation) => (source) => {
  source(0, (t, d) => {
    if (t === 1) operation(d)
  })
}
```

And the equivalent implementation using the toolkit's ~20-line `createConsumer` utility:

```js
const observe = (operation) => createConsumer({ next: operation })
```

Or a more intricate example, the [`callbag-for-each`](https://github.com/staltz/callbag-for-each) sink:

```js
const forEach = (operation) => (source) => {
  let talkback
  source(0, (t, d) => {
    if (t === 0) talkback = d
    if (t === 1) operation(d)
    if (t === 1 || t === 0) talkback(1)
  })
}
```

And the toolkit equivalent:

```js
const forEach = (operation) => (source) => {
  const { pull } = consumeSource(source, {
    next: (value) => {
      operation(value)
      pull()
    },
  })
}
```

Without knowing or remembering the details of the callbag specification, it's much easier to intuit what the second implementation is doing, which is not the case with the low-level implementation.

#### Creating Operators

Creating Operators using the Toolkit really make its code readability aspect shine.

Consider a simple `multiplyBy` operator.

Low-level implementation (from callbag's [getting started guide](https://github.com/callbag/callbag/blob/master/getting-started.md#creating-an-operator)):

```js
const multiplyBy = (factor) => (inputSource) => (start, outputSink) => {
  if (start !== 0) return
  inputSource(0, (t, d) => {
    if (t === 1) outputSink(1, d * factor)
    else outputSink(t, d)
  })
}
```

And the toolkit equivalent:

```js
const multiplyBy = (factor) => (inputSource) =>
  createSource(({ next, ...passthrough }) =>
    consumeSource(inputSource, {
      next: (data) => next(data * factor),
      ...passthrough,
    }),
  )
```

And a much more complex example of a `rescue` / `switchError` operator.

[`callbag-rescue`](https://github.com/franciscotln/callbag-rescue/blob/06350e34ad51654e128838c3bd595fb2957978b6/index.js#L7-L46)'s code is an example of the low-level implementation. Trying to wrap my head around what's going on there was a real challenge and was time-consuming.

Now compare that to the toolkit's implementation:

```js
import { consumeSource, createSource } from 'callbag-toolkit'

const switchError = (getNewSource) => (inputSource) =>
  createSource(({ start, next, error, complete }) => {
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
            // we'll also want to pull on the new source as soon as it starts:
            start: pulling ? ({ pull }) => pull() : undefined,
            error,
          })
        } catch (err) {
          error(err)
        }
      },
    })
    return {
      stop: () => consumption.stop(),
      pull: () => {
        pulling = true
        consumption.pull()
      },
    }
  })
```

#### Note on why I prefer calling Sinks "Consumers"

The reasons are very pragmatic:

- There is no way to verb "sink" in English, whereas "to consume" is the action that a "consumer" does, which makes documentation and explanation easier.
- "Sinks" are objects that drain liquids to the sewers, which doesn't suggest usefulness of the data flowing to them, whereas "consumption" often means the act of providing vital sustenance - food is a key component enabling life, and analogously, data is a key component in enabling applications to function.
