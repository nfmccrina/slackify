const axios = require('axios').default
const child_process = require('child_process')
const crypto = require('crypto')
const querystring = require('querystring')
const { setTimeout } = require('timers')

class SpotifyClient {
    constructor(client_id, redirect_uri) {
        this.authorize_base_url = 'https://accounts.spotify.com/authorize'
        this.token_base_url = 'https://accounts.spotify.com/api/token'
        this.state = Buffer.from(crypto.randomBytes(32)).toString('base64')
        this.code_verifier = this.base64URLEncode(crypto.randomBytes(32))
        this.scopes = encodeURIComponent('user-read-currently-playing')
        this.client_id = client_id
        this.redirect_uri = redirect_uri
        this.accessToken = null
        this.refreshTokenTimeout = null
        this.spotify_api_client = axios.create({
            baseURL: 'https://api.spotify.com/v1/'
        })
        this.spotify_api_client.interceptors.request.use((config) => {
            config.headers = {
                ...config.headers,
                ...{
                    Authorization: `Bearer ${this.accessToken}`
                }
            }
            return config
        })
    }

    async initiateAuthorization() {
        const url = `${this.authorize_base_url}?client_id=${this.client_id}&response_type=code&redirect_uri=${encodeURIComponent(this.redirect_uri)}&code_challenge_method=S256&code_challenge=${this.base64URLEncode(this.sha256(this.code_verifier))}&state=${this.state}&scope=${this.scopes}`
        const proc = await child_process.spawn('open', [url], {
            detached: true,
            stdio:  'ignore'
        })
        proc.unref()
    }

    async requestTokens(code) {
        try {
            return await axios.post(
                this.token_base_url,
                querystring.stringify({
                    client_id: this.client_id,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.redirect_uri,
                    code_verifier: this.code_verifier
                })
            )
        } catch (err) {
            this.onError(err)
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const response = await axios.post(
                this.token_base_url,
                querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: this.client_id
                })
            )

            return response
        } catch (err) {
            this.onError(err)
        }
    }

    saveAccessToken(accessToken) {
        this.accessToken = accessToken
    }

    async getCurrentlyPlaying() {
        try {
            const response = await this.spotify_api_client.get('me/player/currently-playing')
            return response
        } catch (err) {
            this.onError(err)
        }
    }

    isStateValid(s) {
        return this.state === s
    }

    sha256(buffer) {
        return crypto.createHash('sha256').update(buffer).digest();
    }

    base64URLEncode(str) {
        return str.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    onError(err) {
        console.error(err)
        process.exit(1)
    }
}

module.exports = {
    SpotifyClient
}