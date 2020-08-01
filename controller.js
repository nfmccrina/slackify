const EventEmitter = require('events')
const { setTimeout } = require('timers')

class Controller extends EventEmitter {
    constructor(spotify_client, slack_client, keep_alive) {
        super()
        this.spotify_token_refresh_timeout = null
        this.song_polling_timeout = null
        this.spotify_client = spotify_client
        this.slack_client = slack_client
        this.keep_alive = keep_alive
        this.polling_interval_ms = 30000
    }

    initService() {
        this.on('code_received', async (code) => {
            await this.onCodeReceived(code)
        })

        this.on('token_refresh_required', async (refresh_token, expires_in) => {
            await this.tokenRefresh(refresh_token, expires_in)
        })

        this.on('authentication_complete', async () => {
            await this.pollCurrentlyPlaying()

            if (this.keep_alive) {
                this.song_polling_timeout = setTimeout(() => this.emit('poll_required'), this.polling_interval_ms)
            }
        })

        this.on('poll_required', async () => {
            await this.pollCurrentlyPlaying()
            this.song_polling_timeout = setTimeout(() => this.emit('poll_required'), this.polling_interval_ms)
        })
    }

    stopService() {
        clearTimeout(this.spotify_token_refresh_timeout)
        clearTimeout(this.song_polling_timeout)
    }

    async onCodeReceived(code) {
        const token_response = await this.spotify_client.requestTokens(code)
        this.spotify_client.saveAccessToken(token_response.data.access_token)
        this.emit('authentication_complete')
    }

    async tokenRefresh(refresh_token, expires_in) {
        console.debug('Starting token refresh...')
        const response = await this.spotify_client.refreshAccessToken(refresh_token)
        console.debug('Token refresh completed.')
        this.spotify_client.saveAccessToken(response.data.access_token)
        this.spotify_token_refresh_timeout = setTimeout(
            () => this.emit(
                'token_refresh_required',
                response.data.refresh_token,
                response.data.expires_in
            ),
            expires_in / 240)
    }

    async pollCurrentlyPlaying() {
        console.debug('Polling currently playing status...')
        const currently_playing_response = await this.spotify_client.getCurrentlyPlaying()
        console.debug('Poll completed.')
        let info_string = ''
        let emoji = ''
        
        if (currently_playing_response.data.is_playing) {
            emoji = ':notes:'
            info_string = this.parseCurrentlyPlayingData(currently_playing_response)
        }

        await this.slack_client.setStatus(info_string, ':notes:')
    }

    parseCurrentlyPlayingData(currently_playing_response) {
        const song_title = currently_playing_response.data.item.name
        const album_title = (currently_playing_response.data.item.album && currently_playing_response.data.item.album.name) || ''
        let artist_name = ''

        for (const artist of currently_playing_response.data.item.artists || []) {
            if (!artist_name) {
                artist_name = artist.name
            } else {
                artist_name = `${artist_name}, ${artist.name}`
            }
        }

        return `${song_title} on ${album_title} by ${artist_name}`
    }
}

module.exports = {
    Controller
}