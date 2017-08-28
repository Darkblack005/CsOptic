'use strict'

const config = require('../config')
const async = require('async')
const fs = require('fs')
const Trade = require('./index')

const SteamUser = require('steam-user')
const SteamCommunity = require('steamcommunity')
const SteamTotp = require('steam-totp')
const TradeOfferManager = require('steam-tradeoffer-manager')
const SteamID = require('steamid');

Trade.prototype.startBots = function startBots(done) {
    const self = this
    let count = 0

    async.eachOfSeries(config.bots, (bot, id, callback) => {
        count += 1
        const client = new SteamUser({
            dataDirectory: null,
        })
        const community = new SteamCommunity()
        self.instances[id] = {
            client,
            community: community,
            manager: new TradeOfferManager({
                steam: client,
                domain: config.domain,
                language: 'en',
                community: community,
                cancelTime: 600000,
            }),
            login: {
                "accountName": bot.accountName,
                "password": bot.password,
                "twoFactorCode": SteamTotp.getAuthCode(bot.twoFactorCode),
            },
            user: bot,
        }
        // identifiers
        self.instances[id].client.bot_id = id
        self.instances[id].community.bot_id = id
        self.instances[id].manager.bot_id = id
        // polldata
        if (fs.existsSync(`./polls/${id}.json`)) {
            self.instances[id].manager.pollData = JSON.parse(fs.readFileSync(`./polls/${id}.json`))
        }
        // personaState
        const LookingToTrade = SteamUser.Steam.EPersonaState.LookingToTrade
        // login
        self.instances[id].client.logOn(self.instances[id].login)
        self.instances[id].client.addListener('webSession', (sessionID, cookies) => {
            self.instances[id].manager.setCookies(cookies, (err) => {
                if (err) {
                    return callback(err)
                }
                return true
            })
            self.instances[id].community.setCookies(cookies)
            self.instances[id].client.setPersona(LookingToTrade, bot.personaName)
        })

        self.instances[id].manager.on('pollData', (data) => {
            fs.writeFile(`./polls/${id}.json`, JSON.stringify(data))
        })
        // authenticated
        console.log(`Bot (${id}) has been logged-in.`)
        if (count >= Object.keys(config.bots).length) {
            return callback()
        }
        console.log('Waiting 30 seconds before authenticating another bot to avoid Steam cooldowns.')
        return setTimeout(() => {
            callback()
        }, 30000)
    }, () => {
        console.log('[!] All bots online.')
        if (typeof done === 'function') {
            done()
        }
    })
}

Trade.prototype.addBotListeners = function addBotListeners() {
    const self = this
    this.botListen('manager', 'newOffer', (offer) => {
        setTimeout(() => offer.decline(), 30000)
    })

    this.botListen('manager', 'sentOfferChanged', (offer, oldState) => {
        console.log(`Offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);

        var sid = new SteamID()

        sid.universe = offer.partner.universe
        sid.type = offer.partner.type
        sid.instance = offer.partner.instance
        sid.accountid = offer.partner.accountid

        var sid64 = sid.getSteamID64()

        if (offer.state == TradeOfferManager.ETradeOfferState.CanceledBySecondFactor) {
            self.flipmanager.flipCanceled(sid64)
        }

        if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
            offer.getExchangeDetails((err, status, tradeInitTime, receivedItems, sentItems) => {
                if (err) {
                    console.log(`Error ${err}`);
                    return;
                }

                // Grab the old and new assetids of each item

                // Make an array with the old and new coinflips
                // When it's time to send back an item map the old assetid to the new one
                let newReceivedItems = receivedItems.map(item => item.new_assetid);
                let newSentItems = sentItems.map(item => item.new_assetid);
                let oldReceivedItems = receivedItems.map(item => item.assetid);
                let oldSentItems = sentItems.map(item => item.assetid);

                if(!oldSentItems.length > 0) {
                    self.flipmanager.tradeAccepted(sid64)
                    self.io.emit('flip update', {})

                    oldReceivedItems.forEach(function(e, index) {
                        self.assetIdMap[e] = newReceivedItems[index]
                    })

                    console.log('Old asset ids')
                    console.log(oldReceivedItems)
                    console.log('New asset ids')
                    console.log(newReceivedItems)
                }

                console.log(`Received items ${newReceivedItems.join(',')} Sent Items ${newSentItems.join(',')} - status ${TradeOfferManager.ETradeStatus[status]}`)
                console.log(offer.partner)
            })
        }
    })
}

Trade.prototype.reloadBotSessions = function reloadBotSessions() {
    Object.keys(this.instances).forEach((id) => {
        this.instances[id].client.webLogOn()
    })
}

Trade.prototype.getBot = function getBot(id) {
    return this.instances[id]
}

Trade.prototype.botConfirmation = function botConfirmation(id, offerid, callback) {
    const bot = this.instances[id]
    bot.community.acceptConfirmationForObject(bot.user.identitySecret, offerid, callback)
}

Trade.prototype.botListen = function botListen(obj, listen, fn) {
    Object.keys(this.instances).forEach((id) => {
        this.instances[id][obj].on(listen, fn)
    })
}
