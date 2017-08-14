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
        if(this.currentseeds[i].steamID64 == data.steamID64) {
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
    console.log('trade accepted function')
    var isAJoiner = false
    var j

    if(!this.currentFlipsDataForPublic) {
        this.currentFlipsDataForPublic = []
    }

    for(j = 0; j < this.currentPendingJoiners.length; j++) {
        if(this.currentPendingJoiners[j].data.steamID64 == steamID64) {
            isAJoiner = true
            console.log('is a joiner')
            break
        }
    }

    if(!isAJoiner) {
        for(var i = 0; i < this.currentflips.length; i++) {
            if(this.currentflips[i].flipDetails.steamID64 == steamID64) {
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
        console.log('changing data for a join event')
        this.currentJoined[j] = this.currentPendingJoiners[j]
        delete this.currentPendingJoiners[j]

        this.currentflips[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        this.currentFlipsDataForPublic[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        io.emit('flip update', {})

        this.evaluateFlip(steamID64)
    }
}

FlipManager.prototype.evaluateFlip = function evaluateFlip(steamID64) {
    // use steam id
    // iterate through currentjoined
    // once found proper steam id
    // get flip index from currentjoined[indexfound]
    // read currentflips[flipindex] for hash
    // convert hash to dec
    // if dec is less than 50, joiner wins, else creator wins
    // io.send winner
    // set timeout to delete flip

    // ..and ya done
    console.log('evaluating flip . . .')
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