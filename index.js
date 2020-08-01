const express = require('express')
const app = express()
const { SpotifyClient } = require('./spotify-client')
const { SlackClient } = require('./slack-client')
const { Controller } = require('./controller')

const port = 8888
const spotify_client = new SpotifyClient(process.env.SPOTIFY_CLIENT_ID, 'http://localhost:8888')
const slack_client = new SlackClient(process.env.SLACK_USER_ID, process.env.SLACK_TOKEN)
const controller = new Controller(spotify_client, slack_client, true)

process.on('SIGINT', () => {
    console.info('Received interrupt, stopping service...')
    controller.stopService()
    slack_client.setStatus('', '').then(() => process.exit())
})

controller.initService()

app.get('/', (req, res) => {
    const code = req.query.code

    if (spotify_client.isStateValid(req.query.state)) {
        controller.emit('code_received', code)
        res.send('Logged in; this window can be closed.')
        res.connection.destroy()
    } else {
        res.send('state validation failed')
    }
})

spotify_client.initiateAuthorization().then(() => {
    const server = app.listen(port, () => console.log('Waiting for OAuth callback from server...'))
    server.on('request', () => {
        server.close()
    })
})