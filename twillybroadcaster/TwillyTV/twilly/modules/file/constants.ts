import { getReadableSize } from '@/modules/file'

export const FILE_MAX_SIZE = 100_000_000_000 // 100 GB

export const FILE_MAX_SIZE_FORMATTED = getReadableSize(FILE_MAX_SIZE).toLowerCase().replace(' ', '')
