'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')
const crypto = require('crypto');


function FlipManager(params) {
    this.currentflips = []
    this.currentFlipsDataForPublic = []
    this.currentseeds = []

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
}

FlipManager.prototype.getFlipValueByFlipIndex = function getFlipValueByFlipIndex(index) {
    return this.currentflips[index].itemsAndDetails.value ? this.currentflips[index].itemsAndDetails.value : -1
}

FlipManager.prototype.joinFlip = function joinFlip() {

}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager