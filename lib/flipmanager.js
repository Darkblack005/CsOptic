'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')
const crypto = require('crypto');


function FlipManager(params) {
    this.currentflips = []
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
    return this.currentflips
}

FlipManager.prototype.createNewServerSeed = function createNewFlip(id, callback) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = crypto.randomBytes(48).toString('hex')

    currentseeds.push({
        steamid64: id,
        seed: serverSeed
    })

    hmac.update(serverSeed)

    var hash = this.hmac.digest('hex')
    callback(hash)
}

FlipManager.prototype.createNewFlip = function createNewFlip(data, callback) {
    var hmac = crypto.createHash('sha256')
    var serverseed = -1

    for(i = 0; i < currentseeds.length; i++) {
        if(currentseeds[i].steamID64 == data.steamID64) {
            serverseed = currentseeds[i].seed
        }
    }

    if(serverseed == -1) {
        console.log('ERROR server seed not found for given steamid')
    }

    hmac.update(serverSeed + data.clientSeed)

    var hash = this.hmac.digest('hex')
    callback(hash)
}

FlipManager.prototype.joinFlip = function joinFlip() {

}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager