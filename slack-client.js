const { WebClient } = require('@slack/web-api')

class SlackClient {
    constructor(user_id, token) {
        this.user_id = user_id
        this.web = new WebClient(token)
    }

    async setStatus(status, emoji) {
        try {
            await this.web.users.profile.set({
                profile: {
                    status_text: !status ? '' : `${status.slice(0, 95)}...`,
                    status_emoji: emoji,
                    status_expiration: 0,
                },
                user: this.user_id
            })
        } catch (error) {
            console.error(error)
        }
    }

    trimStatus(status) {
        let result = status ? status : ''

        return result.length < 100 ? result : `${result.slice(0, 95)}...`
    }
}

module.exports = {
    SlackClient
}