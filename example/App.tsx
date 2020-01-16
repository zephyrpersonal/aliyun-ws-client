import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { format } from 'date-fns'
import { AliyunWSClient } from '../lib/client'

interface Log {
  timeStamp: string
  type: string
  message: string
}

export default function App() {
  const [logs, setLogs] = useState<Log[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const wsClient = useRef<AliyunWSClient>()

  const logContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    wsClient.current = AliyunWSClient.init({
      url: process.env.WS_URL as string,
      registerPath: '/register',
      unregisterPath: '/unregister',
      apiHost: process.env.API_HOST as string,
      stage: 'TEST',
      logger: (str: any) => {
        const now = format(new Date(), 'HH:mm:ss')
        const log: Log = {
          type: 'internal',
          message: '',
          timeStamp: now
        }

        if (typeof str === 'object') {
          log.type = str.type
          log.message = str.message
        } else {
          log.message += str
        }

        setLogs((logs) => [...logs, log])
      }
    })
    setDeviceId(wsClient.current.getDeviceId())
  }, [])

  useLayoutEffect(() => {
    if (!logContainer.current) return
    logContainer.current.scrollTop = logContainer.current.scrollHeight
  }, [logs.length])

  return (
    <>
      <h1>DeviceId #{deviceId}</h1>
      <label>
        <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
        <button
          onClick={() =>
            wsClient.current?.sendApiRequest('/notify', {
              headers: {
                'x-ca-deviceid': deviceId
              },
              method: 'POST',
              body: JSON.stringify({ text: messageInput, from: deviceId })
            })
          }
        >
          send
        </button>
      </label>
      <button onClick={() => setLogs([])}>clear</button>
      <div id="logs" ref={logContainer}>
        {logs.map((log, index) => {
          return (
            <div className="log" key={index}>
              <span className="timestamp">{log.timeStamp}</span>
              <span className="message-tag">{log.type}</span>
              <p>{log.message}</p>
            </div>
          )
        })}
      </div>
    </>
  )
}
