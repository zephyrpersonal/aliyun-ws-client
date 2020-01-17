import uuid from 'uuid/v4'
import {
  MESSAGE_COMMAND_RO,
  MESSAGE_COMMAND_HO,
  MESSAGE_COMMAND_NF,
  API_RESPONSE,
  API_TYPE_REGISTER,
  API_TYPE_UNREGISTER
} from './constant'

export const generateDeviceId = () => {
  return uuid()
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

  const apiResponseMessage = JSON.parse(message)
  console.log(apiResponseMessage.body)
  const body = JSON.parse(apiResponseMessage.body)

  if ([API_TYPE_REGISTER, API_TYPE_UNREGISTER].includes(body._apiType)) {
    return {
      type: body._apiType,
      data: apiResponseMessage.status === 200,
      message: body.message
    }
  }

  return { type: API_RESPONSE, data: apiResponseMessage }
}
