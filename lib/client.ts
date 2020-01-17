import Url from 'url-parse'
import uuid from 'uuid/v4'
import { isSupport, generateDeviceId, parseMessage } from './utils'
import {
  MESSAGE_COMMAND_RG,
  API_GATEWAY_HB_INTERVAL_DEFAULT,
  MESSAGE_COMMAND_RO,
  MESSAGE_COMMAND_H1,
  API_TYPE_REGISTER,
  API_TYPE_UNREGISTER,
  API_RESPONSE
} from './constant'

export interface AliyunWSClientConfig {
  url: string
  registerPath?: string
  unregisterPath?: string
  apiHost?: string
  logger?: Function
  stage?: 'TEST' | 'PRE'
  onConnected?: (this: AliyunWSClient, deviceId: string) => void
  onMessage?: (this: AliyunWSClient, event: MessageEvent) => void
  onClosed?: (this: AliyunWSClient) => void
  onError?: (this: AliyunWSClient, event: Event) => void
}

export interface ApiRequestOptions {
  stage?: string
  method?: string
  apiType?: string
  isBase64?: boolean
  body?: any
  query?: { [key: string]: any }
  headers?: { [key: string]: any }
}

export class AliyunWSClient {
  private socket!: WebSocket
  private readonly config: AliyunWSClientConfig
  private readonly urlObj: Url
  private hbInterval: number = 0
  private deviceId: string
  private logger: Function
  private registered = false
  private serverClosed = false

  static isSupport: Function

  constructor(config: AliyunWSClientConfig) {
    const supportWs = isSupport()
    if (!supportWs) {
      throw new Error('WebSocket is not supported in current platform')
    }
    this.config = config
    this.urlObj = new Url(config.url, true)
    this.deviceId = generateDeviceId()
    this.logger = config.logger || console.log.bind(console)
    this.createSocket()
  }

  private createSocket() {
    this.socket = new WebSocket(this.config.url)
    this.addEventListener()
  }

  private addEventListener() {
    this.socket.onopen = () => {
      this.logger('ws open')
      this.serverClosed = false
      this.registerDevice()
      this.config.onConnected && this.config.onConnected.call(this, this.deviceId)
    }

    this.socket.onmessage = (event: MessageEvent) => {
      this.logger({ type: 'recieve', message: event.data })

      const message = parseMessage(event.data)
      this.config.onMessage && this.config.onMessage.call(this, event)

      // handle RG response
      if (message.type === MESSAGE_COMMAND_RO) {
        this.register()
      }

      // handle REGISTER response
      if (message.type === API_TYPE_REGISTER) {
        if (message.data) {
          this.registered = true
          this.startHeartBeat(parseInt((message.data! as any).keepAliveInterval!, 10))
          this.logger('register successfully')
        } else {
          this.logger(`register failed for: ${message.message}`)
          this.close()
        }
      }

      // handle UNREGISTER response
      if (message.type === API_TYPE_UNREGISTER) {
        if (message.data) {
          this.registered = false
          this.logger('unregister successfully')
        } else {
          this.logger(`unregister failed for: ${message.message}`)
        }
      }

      // handle api-request response
      if (message.type === API_RESPONSE) {
      }
    }

    this.socket.onerror = (event: Event) => {
      this.logger(event.type)
      this.config.onError && this.config.onError.call(this, event)
    }
    this.socket.onclose = () => {
      this.serverClosed = true
      this.registered = false
      this.stopHeartBeat()
      this.logger('ws closed')
      this.config.onClosed && this.config.onClosed.call(this)
    }
  }

  send(message: string) {
    if (this.serverClosed) {
      this.logger({
        type: 'error',
        message: 'server closed'
      })
      return
    }
    this.logger({
      type: 'send',
      message
    })
    this.socket.send(message)
  }

  sendJSON(message: object) {
    this.send(JSON.stringify(message))
  }

  sendApiRequest(path: string, options?: ApiRequestOptions) {
    const host = this.config.apiHost || this.urlObj.hostname
    options = options || {}
    const now = new Date()
    this.sendJSON({
      headers: {
        ...(this.config.stage && { 'x-ca-stage': [this.config.stage] }),
        ...(options.apiType && { 'x-ca-websocket_api_type': [options.apiType] }),
        host,
        'x-ca-seq': ['0'],
        'x-ca-nonce': [uuid().toString()],
        date: [now.toUTCString()],
        'x-ca-timestamp': [now.getTime().toString()],
        ca_version: ['1'],
        ...options.headers
      },
      method: options.method || 'GET',
      host,
      querys: options.query,
      isBase64: options.isBase64,
      path,
      body: options.body
    })
  }

  registerDevice() {
    this.send(`${MESSAGE_COMMAND_RG}#${this.deviceId}`)
  }

  register() {
    if (this.registered) return
    this.logger('register started')
    this.sendApiRequest(this.config.registerPath || '/register', {
      apiType: API_TYPE_REGISTER
    })
  }

  unregister() {
    if (!this.registered) return
    this.logger('unregister started')
    this.sendApiRequest(this.config.unregisterPath || '/unregister', {
      apiType: API_TYPE_UNREGISTER,
      method: 'POST'
    })
  }

  startHeartBeat(interval: number) {
    if (this.hbInterval > 0) return

    this.logger('heartbeat sync started')
    this.hbInterval = window.setInterval(() => {
      this.send(MESSAGE_COMMAND_H1)
    }, interval || API_GATEWAY_HB_INTERVAL_DEFAULT)
  }

  stopHeartBeat() {
    if (this.hbInterval <= 0) return

    this.logger('heartbeat sync stopped')
    window.clearInterval(this.hbInterval)
    this.hbInterval = 0
  }

  close() {
    this.stopHeartBeat()
    this.unregister()
    this.socket.close()
  }

  reconnect() {
    if (!this.serverClosed) return
    this.createSocket()
  }

  getDeviceId() {
    return this.deviceId
  }

  static create(config: AliyunWSClientConfig) {
    return new AliyunWSClient(config)
  }
}

AliyunWSClient.isSupport = isSupport
