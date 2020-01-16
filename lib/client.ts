import URL from 'url'
import uuid from 'uuid'
import { isSupport, generateDeviceId, parseMessage } from './utils'
import { MESSAGE_COMMAND_RG, API_GATEWAY_HB_INTERVAL, MESSAGE_COMMAND_RO, MESSAGE_COMMAND_H1 } from './constant'

export interface AliyunWSClientConfig {
  url: string
  registerPath?: string
  unregisterPath?: string
  apiHost?: string
  logger?: Function
  stage?: 'TEST' | 'PRE'
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
  private readonly urlObj: URL.UrlWithParsedQuery
  private hbInterval: number = 0
  private deviceId: string
  private logger: Function
  private registered = false
  private serverClosed = false

  constructor(config: AliyunWSClientConfig) {
    const supportWs = isSupport()
    if (!supportWs) {
      throw new Error('WebSocket is not supported in current platform')
    }
    this.config = config
    this.urlObj = URL.parse(config.url, true)
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
    }

    this.socket.onmessage = (event: MessageEvent) => {
      this.logger({ type: 'recieve', message: event.data })
      const message = parseMessage(event.data)
      if (message.type === MESSAGE_COMMAND_RO) {
        this.register()
        this.startHeartBeat(parseInt((message.data! as any).keepAliveInterval!, 10))
      }
    }

    this.socket.onerror = (event: Event) => this.logger(event.type)
    this.socket.onclose = () => {
      this.serverClosed = true
      this.registered = false
      this.stopHeartBeat()
      this.logger('ws closed')
    }
  }

  send(message: string) {
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
        'x-ca-nonce': [uuid.v4().toString()],
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
    this.registered = true
    this.sendApiRequest(this.config.registerPath || '/register', {
      apiType: 'REGISTER'
    })
  }

  unregister() {
    this.registered = false
    this.sendApiRequest(this.config.registerPath || '/unregister', {
      apiType: 'UNREGISTER'
    })
  }

  startHeartBeat(interval: number) {
    if (this.hbInterval > 0) {
      return
    }
    this.hbInterval = window.setInterval(() => {
      this.send(MESSAGE_COMMAND_H1)
    }, interval || API_GATEWAY_HB_INTERVAL)
  }

  stopHeartBeat() {
    window.clearInterval(this.hbInterval)
  }

  close() {
    if (!this.serverClosed) {
      this.stopHeartBeat()
      this.unregister()
    }
    this.socket.close()
  }

  async reconnect() {
    this.close()
    this.createSocket()
  }

  getDeviceId() {
    return this.deviceId
  }

  static init(config: AliyunWSClientConfig) {
    return new AliyunWSClient(config)
  }
}
