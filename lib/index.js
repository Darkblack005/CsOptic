'use strict'

const config = require('../config')
const async = require('async')

function Trade(params) {
    this.prices = {}
    this.instances = []
    this.assetIdMap = new Map();

    this.io = params.io || false
    this.flipmanager = params.Flip || false
    this.flipmanager ? this.flipmanager.Trade = this : false

    this.getPrices((prices) => {
        this.prices = prices
    })
    setInterval(() => {
        this.getPrices((prices) => {
            this.prices = prices
        })
    }, 21600000)

    this.startBots(() => {
        this.addBotListeners()
        setInterval(() => this.reloadBotSessions(), 3600000)
    })
}

Trade.prototype.getPriceList = function getPriceList() {
    return this.prices
}

Trade.prototype.getPrice = function getPrice(name, rateType, itemType) {
    const price = this.prices[name] || 0
    // Check if price is below ignoreItemsBelow value.
    // If it is we set the value to 0
    if (price <= config.rates.ignoreItemsBelow) {
        return 0
    }
    return price
}

Trade.prototype.getUserRates = function getUserRates() {
    return config.rates.user
}

Trade.prototype.getBotRates = function getBotRates() {
    return config.rates.bot
}

Trade.prototype.getTrashPrice = function getTrashPrice() {
    return config.rates.trashPriceBelow
}

Trade.prototype.getIgnorePrice = function getIgnorePrice() {
    return config.rates.ignoreItemsBelow
}

Trade.prototype.validateOffer = function validateOffer(object, callback) {
    const self = this

    let userValue = 0
    let userCount = 0

    let fixedObject = Object.assign({}, object);
    fixedObject.user = []

    object.user.forEach(function(e) {
        fixedObject.user.push(e.assetid)
    })

    const obj = fixedObject
    obj.user = obj.user.filter(Boolean)

    if (!obj.user.length) {
        return callback('No way, jose')
    }
    return self.getInventory(obj.steamID64, '730', '2', (err, data) => {
        if (err) {
            return callback('Could not verify inventory contents for the trade. Please try again later!')
        }
        const userInventory = data
        return async.forEach(Object.keys(userInventory), (index, cb) => {
            const item = userInventory[index]
            if (obj.user.indexOf(item.assetid) !== -1) {
                const price = self.getPrice(item.data.market_hash_name, 'user', item.item_type)
                userCount += 1
                userValue += price
            }
            cb()
        }, () => {
            if (userCount !== obj.user.length) {
                console.log(userCount, obj.user.length, obj.user)
                return callback('Some items were not found in users inventory!')
            }

            return callback(null, true, userCount, userValue)
        })
    })
}

module.exports = Trade

require('./bots')
require('./inv')
require('./prices')
