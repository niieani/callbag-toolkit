import { IGNORE_LIST } from '@beemo/config-constants'
import { IGNORE_LIST as IGNORE_LIST_PATCHED } from '@beemo/config-constants-patched'

// hack, will be fixed when not using `beemo`
IGNORE_LIST.length = 0
IGNORE_LIST.push(...IGNORE_LIST_PATCHED)

export default {}
