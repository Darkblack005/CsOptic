'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')
const crypto = require('crypto');


function FlipManager(params) {
    this.currentflips = {}

    this.hash = crypto.createHash('sha256')

    this.coinflipschema = new mongoose.Schema({
        steamid1: { type: String, required: true },
        steamid2: { type: String, required: true },
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

FlipManager.prototype.createNewFlip = function createNewFlip(data) {
    var serverSeed = crypto.randomBytes(48).toString('hex')
    this.hash.update(serverSeed)
    var serverHash = hash.digest('hex')

    console.log()

}

FlipManager.prototype.joinFlip = function joinFlip() {

}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager