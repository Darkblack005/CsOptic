'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')
const crypto = require('crypto');


function FlipManager(params) {
    this.currentflips = []
    this.currentFlipsDataForPublic = null
    this.currentseeds = []
    this.currentPendingJoiners = []
    this.currentJoined = []

    this.coinflipschema = new mongoose.Schema({
        steamid1: { type: String },
        steamid2: { type: String },
        serverseed: { type: String },
        clientseed: { type: String },
        hash: { type: String },
        date: { type: Date, default: Date.now, required: true }
    })

    this.coinflipmodel = mongoose.model('coinflip', this.coinflipschema)

    var options = {
        user: config.dbUser,
        pass: config.dbPassword
    }

    mongoose.connect('mongodb://localhost/coinflips', options, function (error) {
        // Check error in initial connection. There is no 2nd param to the callback.
        if (!error) {
            console.log('[!] Connected to MongoDB')
        } else {
            console.log(error)
        }
    })

    this.Trade = null
    this.io = params.io || false
}

FlipManager.prototype.getCurrentFlips = function getCurrentFlips() {
    return this.currentFlipsDataForPublic
}

FlipManager.prototype.createNewServerSeed = function createNewFlip(id, callback) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = crypto.randomBytes(48).toString('hex')

    this.currentseeds.push({
        steamID64: id,
        seed: serverSeed
    })

    hmac.update(serverSeed)

    var hash = hmac.digest('hex')
    callback(hash)
}

FlipManager.prototype.createNewFlip = function createNewFlip(data, itemsAndDetails) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = -1

    for(var i = 0; i < this.currentseeds.length; i++) {
        if(this.currentseeds[i] && this.currentseeds[i].steamID64 == data.steamID64) {
            serverSeed = this.currentseeds[i].seed
            break
        }
    }

    if(serverSeed == -1) {
        console.log('ERROR server seed not found for given steamid')
        console.log('this.currentseeds:')
        console.log(this.currentseeds)
        console.log('data:')
        console.log(data)
    }

    hmac.update(serverSeed + data.clientSeed)
    var hash = hmac.digest('hex')

    this.currentflips.push({
        flipDetails: data,
        itemsAndDetails: itemsAndDetails,
        serverSeed: serverSeed,
        finalHash: hash,
        joinable: false
    })
}

FlipManager.prototype.tradeAccepted = function tradeAccepted(steamID64) {
    console.log('Trade accepted')
    var isAJoiner = false
    var j

    if(!this.currentFlipsDataForPublic) {
        this.currentFlipsDataForPublic = []
    }

    for(j = 0; j < this.currentPendingJoiners.length; j++) {
        if(this.currentPendingJoiners[j] && this.currentPendingJoiners[j].data.steamID64 == steamID64) {
            isAJoiner = true
            console.log('Determined user is a joiner')
            break
        }
    }

    if(!isAJoiner) {
        for(var i = 0; i < this.currentflips.length; i++) {
            if(this.currentflips[i] && this.currentflips[i].flipDetails.steamID64 == steamID64) {
                this.currentFlipsDataForPublic.push({
                    flipDetails: this.currentflips[i].flipDetails,
                    itemsAndDetails: this.currentflips[i].itemsAndDetails,
                    finalHash: this.currentflips[i].finalHash,
                    joinable: true
                })

                this.currentflips[i].joinable = true

                break
            }
        }
    } else {
        console.log('Changing data on a flip because a user joined')
        this.currentJoined[j] = this.currentPendingJoiners[j]
        delete this.currentPendingJoiners[j]

        this.currentflips[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        this.currentFlipsDataForPublic[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        this.io.emit('flip update', {})

        this.evaluateFlip(steamID64)
    }
}

FlipManager.prototype.evaluateFlip = function evaluateFlip(steamID64) {
    console.log('Evaluating flip . . .')

    for(var i = 0; i < this.currentJoined.length; i++) {
        if(this.currentJoined[i].data.steamID64 == steamID64) {
            console.log('Found steamid in evaluate flip')
            this.sendWinner(parseInt(this.currentflips[i].serverSeed+this.currentflips[i].flipDetails.clientSeed, 16) % 100 > 49, i)
            break
        }
    }
}

// T 0-49
// CT 50-99
// Convert old assetids in coinflip to new assetids, store in an array
// Get the prices of all of them
// Find any that are within 0%-8% of the total value of the flip
// Delete those from the array and create a trade offer for the rest of the items to go to the winner
// Set a timeout to delete the flip
FlipManager.prototype.sendWinner = function sendWinner(ctWin, coinflipIndex) {
    //config.rates.commissionPercentage
    //coinflips[coinflipIndex]

/*
    Trade.getInventory(obj.steamID64, '730', '2', (err, data) => {
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
*/

    console.log(ctWin)
}

FlipManager.prototype.getFlipValueByFlipIndex = function getFlipValueByFlipIndex(index) {
    return this.currentflips[index].itemsAndDetails.value ? this.currentflips[index].itemsAndDetails.value : -1
}

FlipManager.prototype.changeFlipJoinableByFlipIndex = function changeFlipJoinableByFlipIndex(index, newVal, callback) {
    this.currentflips[index].joinable = newVal
    this.currentFlipsDataForPublic[index].joinable = newVal

    callback()
}

FlipManager.prototype.joinFlip = function joinFlip(dataPassed, itemsAndDetailsPassed) {
    this.currentPendingJoiners[dataPassed.flipId] = {
        data: dataPassed,
        itemsAndDetails: itemsAndDetailsPassed
    }
}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager