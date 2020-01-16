import uuid from 'uuid'
import { MESSAGE_COMMAND_RO, MESSAGE_COMMAND_HO, MESSAGE_COMMAND_NF } from './constant'

export const generateDeviceId = () => {
  return uuid
    .v4()
    .replace(/-/g, '')
    .substr(0, 8)
}

export const isSupport = () => typeof WebSocket !== 'undefined'

export const parseMessage = (message: string) => {
  if (message.startsWith(MESSAGE_COMMAND_RO)) {
    const [, connectionCredential, keepAliveInterval] = message.split('#')
    return {
      type: MESSAGE_COMMAND_RO,
      message: 'register successfully',
      data: {
        connectionCredential,
        keepAliveInterval
      }
    }
  }

  if (message.startsWith(MESSAGE_COMMAND_HO)) {
    const [, connectionCredential] = message.split('#')
    return {
      type: MESSAGE_COMMAND_HO,
      message: 'heart beat',
      data: {
        connectionCredential
      }
    }
  }

  if (message.startsWith(MESSAGE_COMMAND_NF)) {
    const [, data] = message.split('#')
    return {
      type: MESSAGE_COMMAND_NF,
      message: 'receive message',
      data
    }
  }

  return { type: 'UNKNOWN', data: null }
}
