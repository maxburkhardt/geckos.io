import WebRTCConnection from './webrtcConnection'
import { ChannelId, ServerOptions } from '@geckos.io/common/lib/types'
import { EVENTS } from '@geckos.io/common/lib/constants'
import makeRandomId from '@geckos.io/common/lib/makeRandomId'

export default class ConnectionsManagerServer {
  connections: Map<ChannelId, WebRTCConnection> = new Map()

  constructor(public options: ServerOptions) {}

  private createId(): ChannelId {
    do {
      const id = makeRandomId(24)
      if (!this.connections.has(id)) {
        return id
      }
    } while (true)
  }

  getConnection(id: ChannelId) {
    return this.connections.get(id) || null
  }

  getConnections() {
    return this.connections
  }

  async createConnection(authorization: string | undefined) {
    let userData: any
    if (authorization) {
      const res = await this.options?.authorization?.(authorization)
      if (typeof res === 'boolean' && res) userData = {}
      else if (typeof res === 'boolean' && !res) return 401
      else if (typeof res === 'number' && res >= 100 && res < 600) return res
      else userData = res
    }

    const connection = new WebRTCConnection(this.createId(), this.options, this.connections, userData)
    const pc = connection.peerConnection

    pc.onconnectionstatechange = () => {
      // keep track of the maxMessageSize
      if (pc.connectionState === 'connected') connection.channel.maxMessageSize = pc.sctp?.maxMessageSize

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        connection.channel.eventEmitter.emit(EVENTS.DISCONNECT, pc.connectionState)
        this.deleteConnection(connection)
      }
    }

    this.connections.set(connection.id, connection)
    return connection
  }

  deleteConnection(connection: WebRTCConnection) {
    connection.close()
    connection.channel.eventEmitter.removeAllListeners()
    connection.removeAllListeners()

    this.connections.delete(connection.id)
  }
}
